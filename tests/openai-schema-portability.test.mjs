import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker from "../dist/index.js";

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "schema-portability-test", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};
let id = 0;
async function request(method, params = {}) {
  const response = await worker.fetch(new Request("https://example.test/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": method,
      ...(params.name ? { "mcp-name": params.name } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params: { ...params, _meta: META } }),
  }));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.ok(json.result, JSON.stringify(json.error));
  return json.result;
}

function checkPatterns(node, path) {
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "pattern" && typeof value === "string") {
      // The portal's validator need not implement Unicode property escapes.
      // Keep externally advertised regexes within the portable subset.
      assert.doesNotMatch(value, /\\[pP]\{|\\u\{|\(\?<|\\[1-9]/, path);
      assert.doesNotThrow(() => new RegExp(value, "u"), path);
      continue;
    }
    checkPatterns(value, path + "/" + key);
  }
}

test("all 22 hosted tool schemas avoid nonportable pattern constructs", async () => {
  const { tools } = await request("tools/list");
  assert.equal(tools.length, 22);
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    checkPatterns(tool.inputSchema, tool.name + "/input");
    checkPatterns(tool.outputSchema, tool.name + "/output");
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false,
    }, tool.name);
  }
  const schema = tools.find(tool => tool.name === "classify_task").inputSchema;
  assert.deepEqual(schema.required, ["description"]);
  const description = schema.properties.description;
  assert.equal(description.type, "string");
  assert.equal(description.minLength, 3);
  assert.equal(description.maxLength, 1000);
  assert.equal(description.pattern, undefined);
  assert.match(description.description, /letter or number/i);
});

test("classify_task retains Unicode validation and length limits on the server", async () => {
  for (const description of ["!!!", "   ", "ab", "\u{1F600}\u{1F600}\u{1F600}", "x".repeat(1001)]) {
    const result = await request("tools/call", { name: "classify_task", arguments: { description } });
    assert.equal(result.isError, true, JSON.stringify(description.slice(0, 20)));
  }
  for (const description of ["  fix the login bug  ", "\u017ee\u017ee", "\u4FEE\u590D\u9519\u8BEF", "\u0661\u0662\u0663", "x".repeat(1000)]) {
    const result = await request("tools/call", { name: "classify_task", arguments: { description } });
    assert.notEqual(result.isError, true, description.slice(0, 20));
    const output = JSON.parse(result.content[0].text);
    assert.equal(typeof output.description, "string");
    if (description.includes("login")) assert.equal(output.task_type, "DEBUG");
  }
});

test("future Worker deployments preserve dashboard-configured domain verification", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"));
  assert.equal(config.keep_vars, true);
  assert.equal(config.vars?.OPENAI_APPS_CHALLENGE, undefined);
});
