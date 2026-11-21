import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = new URL("../distribution/openai/", import.meta.url);
const read = async path => readFile(new URL(path, base), "utf8");
const json = async path => JSON.parse(await read(path));
const remote = "https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp";
const name = "god-prompt-mcp";
const allTools = [
  "classify_task", "get_tailored_guidance", "audit_requirements", "build_test_matrix",
  "create_work_contract", "review_work_evidence", "review_code_change",
  "trace_change_impact", "diagnose_failure", "audit_agent_trajectory",
  "review_mcp_tool_contracts", "audit_agent_instructions", "design_adversarial_tests",
  "assess_release_readiness", "compare_evaluation_runs", "create_context_handoff",
];

test("portable MCP and Codex compatibility manifest describe one shared remote server", async () => {
  const portable = await json("mcp.json");
  const codex = await json(".mcp.json");
  const plugin = await json("plugin.json");
  const compat = await json(".codex-plugin/plugin.json");
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.version, "1.4.2");
  assert.equal(portable.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  assert.deepEqual(Object.keys(portable.mcpServers), [name]);
  assert.deepEqual(Object.keys(codex.mcpServers), [name]);
  assert.equal(portable.mcpServers[name].type, "streamable-http");
  assert.equal(portable.mcpServers[name].url, remote);
  assert.deepEqual(portable.mcpServers[name].extensions?.["com.openai"]?.auth, { type: "none" });
  assert.equal(codex.mcpServers[name].type, "http");
  assert.equal(codex.mcpServers[name].url, remote);
  assert.equal(compat.mcpServers, "./.mcp.json");
  assert.equal(compat.skills, "./skills/");
  assert.equal(plugin.version, pkg.version);
  assert.equal(compat.version, pkg.version);
  assert.equal(plugin.extensions?.["com.openai"]?.interface.displayName, "GodPrompt");
  assert.equal(compat.name, plugin.name);
  for (const text of [JSON.stringify(portable), JSON.stringify(codex)]) {
    assert.doesNotMatch(text, /localhost|command|stdio|api_key|clientSecret|GITHUB_TOKEN|OPENAI_API_KEY/i);
  }
});

test("OpenAI Skill registers one remote dependency and only scoped activation", async () => {
  const entry = await read("skills/god-prompt/SKILL.md");
  const metadata = await read("skills/god-prompt/agents/openai.yaml");
  const routes = await read("skills/god-prompt/references/tool-routing.md");
  assert.match(entry, /^---\r?\nname: god-prompt\r?\n/m);
  assert.match(entry, /software-engineering task/);
  assert.match(entry, /higher-priority instructions always control scope and authority/i);
  assert.match(entry, /references\/tool-routing\.md/);
  assert.match(entry, /get_tailored_guidance/);
  assert.match(entry, /MCP never reads repositories, runs tests/i);
  assert.match(metadata, /display_name:\s*["']?GodPrompt/);
  assert.match(metadata, /dependencies:\s*\n\s+tools:\s*\n\s+- type:\s*["']?mcp/);
  assert.match(metadata, /value:\s*["']?god-prompt-mcp/);
  assert.match(metadata, /transport:\s*["']?streamable_http/);
  assert.ok(metadata.includes(remote));
  for (const tool of allTools) assert.ok(routes.includes(String.fromCharCode(96) + tool + String.fromCharCode(96)), tool);
  assert.match(routes, /If the MCP is unavailable/i);
  assert.match(routes, /bounded, sanitized input/i);
  assert.match(routes, /not authorization/i);
});

test("representative positive, negative and unsafe-input cases retain explicit routing", async () => {
  const cases = await json("review-tests.json");
  assert.ok(cases.positive.length >= 5);
  assert.ok(cases.negative.length >= 3);
  const extra = await json("review-tool-tests.json");
  assert.ok(extra.positive.length >= 8);
  assert.ok(extra.negative.length >= 3);
  assert.ok(extra.edge.length >= 3);
  const ids = [...cases.positive, ...cases.negative, ...extra.positive, ...extra.negative, ...extra.edge].map(x=>x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of extra.positive) {
    assert.ok(item.tool, item.id);
    assert.ok(allTools.includes(item.tool), item.id);
  }
  for (const item of extra.negative) assert.equal(item.tool, null);
  for (const item of extra.edge) assert.ok(/unavailable|secret|untrusted|unsupported|missing/i.test(item.expectedBehavior), item.id);
});

test("bundled skills and referenced resources never specify unreviewed host hooks or local executables", async () => {
  const root = await read("skills/god-prompt/SKILL.md");
  const routing = await read("skills/god-prompt/references/tool-routing.md");
  assert.doesNotMatch(routing, /npx -y|sudo|docker run|wrangler deploy|curl -\s*X\s*POST/i);
  assert.match(routing, /does not execute/i);
  assert.match(root, /scope and authority/);
});
