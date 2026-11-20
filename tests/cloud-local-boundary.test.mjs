import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = async (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("public Worker contains only stateless MCP imports and no local feedback adapter", async () => {
  const source = await read("src/index.ts");
  const server = await read("src/server.ts");
  const contracts = await read("src/work-contract.ts");
  for (const text of [source, server, contracts]) {
    assert.doesNotMatch(text, /godprompt-proof|feedback\.jsonl|GODPROMPT_FEEDBACK_FILE/i);
    assert.doesNotMatch(text, /from ["']node:(?:fs|child_process|os)["']/);
  }
  assert.match(source, /registerGodPromptTools/);
  assert.match(source, /registerWorkContractTools/);
  assert.match(source, /createMcpHandler\(createServer/);
  assert.doesNotMatch(source, /getenv|LOCALAPPDATA|XDG_STATE_HOME|open\(|mkdir\(/i);
});

test("local CLI is opt-in, separately packaged, and does not add cloud storage", async () => {
  const pkg = JSON.parse(await read("package.json"));
  const wrangler = JSON.parse(await read("wrangler.jsonc"));
  const cli = await read("bin/godprompt-proof.mjs");
  const stdio = await read("src/stdio.ts");
  assert.equal(pkg.bin["godprompt-proof"], "bin/godprompt-proof.mjs");
  assert.ok(pkg.files.includes("bin/godprompt-proof.mjs"));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["@modelcontextprotocol/server", "parse-diff", "zod"]);
  assert.ok(!("kv_namespaces" in wrangler));
  assert.ok(!("d1_databases" in wrangler));
  assert.ok(!("r2_buckets" in wrangler));
  assert.equal(wrangler.main, "src/index.ts");
  assert.match(cli, /MAX_FEEDBACK_BYTES = 256 \* 1024/);
  assert.match(cli, /GODPROMPT_FEEDBACK_FILE/);
  assert.doesNotMatch(stdio, /godprompt-proof|localWorkflow|saveFeedback/);
  // An existing legacy DO binding is deliberately retained for compatibility
  // and is not referenced by the hosted handler.
  assert.ok(Array.isArray(wrangler.durable_objects?.bindings));
  assert.doesNotMatch(await read("src/index.ts"), /env\.MCP_OBJECT/);
});

test("publishing docs explicitly distinguish hosted tools, local learning and approval", async () => {
  const doc = await read("docs/chatgpt-local-first.md");
  const readme = await read("README.md");
  assert.match(doc, /No automatic GodPrompt storage/);
  assert.match(doc, /single-writer/);
  assert.match(doc, /frozen snapshot/);
  assert.match(doc, /Do not merge, publish, deploy/);
  assert.match(doc, /PR \*\*#349\*\*/);
  assert.match(readme, /docs\/chatgpt-local-first\.md/);
});
