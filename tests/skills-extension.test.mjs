import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "god-prompt-skills-extension-test",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {
    extensions: {
      "io.modelcontextprotocol/skills": {},
    },
  },
};

function request(child, pending, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}

test("serves the canonical GodPrompt skill through SEP-2640", async (t) => {
  const child = spawn(process.execPath, ["dist/stdio.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(() => child.kill());

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const pending = new Map();
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    const message = JSON.parse(line);
    if (message.id === undefined || !pending.has(message.id)) return;
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
    else waiter.resolve(message.result);
  });
  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      for (const waiter of pending.values()) {
        waiter.reject(new Error(`stdio server exited with code ${code}\nstderr:\n${stderr}`));
      }
      pending.clear();
    }
  });

  const discovered = await request(child, pending, 1, "server/discover", {
    _meta: REQUEST_META,
  });
  assert.deepEqual(discovered.supportedVersions, ["2026-07-28"]);
  assert.ok(discovered.capabilities?.resources);
  assert.deepEqual(
    discovered.capabilities?.extensions?.["io.modelcontextprotocol/skills"],
    {}
  );

  const listed = await request(child, pending, 2, "skills/list", {
    _meta: REQUEST_META,
  });
  assert.equal(listed.resultType, "complete");
  assert.equal(listed.ttlMs, 300000);
  assert.equal(listed.cacheScope, "public");
  assert.equal(listed.skills.length, 1);

  const skill = listed.skills[0];
  assert.equal(skill.uri, "skill://god-prompt/SKILL.md");
  assert.equal(skill.frontmatter.name, "god-prompt");
  assert.match(skill.frontmatter.description, /Production workflow skill/i);
  assert.equal(skill.resources.length, 4);

  const fetched = await request(child, pending, 3, "skills/get", {
    uri: skill.uri,
    _meta: REQUEST_META,
  });
  assert.equal(fetched.resultType, "complete");
  assert.deepEqual(fetched.skill, skill);

  for (let index = 0; index < skill.resources.length; index += 1) {
    const manifestResource = skill.resources[index];
    assert.match(manifestResource.digest, /^sha256:[0-9a-f]{64}$/);
    const read = await request(child, pending, `resource-${index}`, "resources/read", {
      uri: manifestResource.uri,
      _meta: REQUEST_META,
    });
    assert.equal(read.contents.length, 1);
    assert.equal(read.contents[0].uri, manifestResource.uri);
    assert.equal(read.contents[0].mimeType, "text/markdown");
    const bytes = Buffer.from(read.contents[0].text, "utf8");
    assert.equal(bytes.length, manifestResource.size);
    assert.equal(
      `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      manifestResource.digest
    );
  }

  await assert.rejects(
    request(child, pending, 20, "skills/get", {
      uri: "skill://not-god-prompt/SKILL.md",
      _meta: REQUEST_META,
    }),
    /Unknown GodPrompt skill URI/
  );
});

test("serves SEP-2640 through the hosted Worker transport", async () => {
  const { default: worker } = await import(`../dist/index.js?skills=${Date.now()}`);

  async function post(method, params, id) {
    const methodHeaders =
      method === "resources/read" && typeof params.uri === "string"
        ? { "mcp-name": params.uri }
        : {};
    const response = await worker.fetch(
      new Request("https://example.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-method": method,
          ...methodHeaders,
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      }),
      {},
      {}
    );
    assert.equal(response.status, 200);
    return response.json();
  }

  const listed = await post("skills/list", { _meta: REQUEST_META }, "worker-skills");
  assert.equal(listed.result?.skills?.length, 1);
  assert.equal(listed.result?.skills?.[0]?.uri, "skill://god-prompt/SKILL.md");

  const read = await post(
    "resources/read",
    {
      uri: "skill://god-prompt/SKILL.md",
      _meta: REQUEST_META,
    },
    "worker-skill-read"
  );
  assert.match(read.result?.contents?.[0]?.text ?? "", /# GodPrompt/i);
});
