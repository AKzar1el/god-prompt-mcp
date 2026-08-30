import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const EXPECTED_TOOLS = [
  "classify_task",
  "get_anti_patterns",
  "get_core_skill",
  "get_gates",
  "get_god_prompt",
  "get_protocols",
  "get_version",
];

function request(child, pending, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 5000);

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

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
    );
  });
}

function toolText(result) {
  const item = result.content.find((entry) => entry.type === "text");
  assert.ok(item, "Expected text content from MCP tool");
  return item.text;
}

test("builds a stdio MCP server exposing current GodPrompt content", async (t) => {
  const build = spawnSync("npm", ["run", "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  assert.equal(
    build.status,
    0,
    `npm run build failed\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
  );

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
  let protocolError = null;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          waiter.reject(new Error(JSON.stringify(message.error)));
        } else {
          waiter.resolve(message.result);
        }
      }
    } catch (error) {
      protocolError = error;
    }
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      for (const waiter of pending.values()) {
        waiter.reject(
          new Error(`stdio server exited with code ${code}\nstderr:\n${stderr}`)
        );
      }
      pending.clear();
    }
  });

  const initialized = await request(child, pending, 1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "god-prompt-mcp-test", version: "1.0.0" },
  });

  assert.equal(initialized.serverInfo.name, "god-prompt-mcp");
  assert.equal(initialized.serverInfo.version, "1.0.0");

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    })}\n`
  );

  const listed = await request(child, pending, 2, "tools/list");
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, EXPECTED_TOOLS);
  for (const tool of listed.tools) {
    assert.equal(typeof tool.title, "string", `${tool.name} must expose a title`);
    assert.ok(tool.title.trim(), `${tool.name} must expose a non-empty title`);
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
    assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be non-destructive`);
  }

  const core = await request(child, pending, 3, "tools/call", {
    name: "get_core_skill",
    arguments: {},
  });
  const coreText = toolText(core);
  assert.match(coreText, /references\/01-PROTOCOLS\.md/);
  assert.match(coreText, /references\/02-GATES\.md/);
  assert.match(coreText, /references\/03-ANTI-PATTERNS\.md/);
  assert.doesNotMatch(coreText, /core\/01-PROTOCOLS\.md/);
  assert.doesNotMatch(coreText, /core\/02-GATES\.md/);
  assert.doesNotMatch(coreText, /core\/03-ANTI-PATTERNS\.md/);

  const versionResult = await request(child, pending, 4, "tools/call", {
    name: "get_version",
    arguments: {},
  });
  const version = JSON.parse(toolText(versionResult));
  assert.ok(version.files["SKILL.md"]);
  assert.ok(version.files["references/01-PROTOCOLS.md"]);
  assert.ok(version.files["references/02-GATES.md"]);
  assert.ok(version.files["references/03-ANTI-PATTERNS.md"]);
  assert.equal(version.files["core/00-THE-SKILL.md"], undefined);

  assert.equal(protocolError, null, `Non-JSON output on stdout: ${protocolError}`);
});
