import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const plugin = JSON.parse(
  await readFile(new URL("../distribution/openai/plugin.json", import.meta.url), "utf8")
);
const codexPlugin = JSON.parse(
  await readFile(
    new URL("../distribution/openai/.codex-plugin/plugin.json", import.meta.url),
    "utf8"
  )
);
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const skill = await readFile(
  new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
  "utf8"
);
const reviewTests = JSON.parse(
  await readFile(new URL("../distribution/openai/review-tests.json", import.meta.url), "utf8")
);
const mcpbIgnore = await readFile(new URL("../.mcpbignore", import.meta.url), "utf8");

test("keeps the OpenAI review package portable and skill-only", () => {
  assert.equal(plugin.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(plugin.name, "god-prompt");
  assert.equal(plugin.version, packageJson.version);
  assert.equal(plugin.license, "MIT");
  assert.equal(plugin.repository, "https://github.com/AKzar1el/god-prompt-mcp");
  assert.equal(plugin.extensions["com.openai"].interface.displayName, "GodPrompt");
  assert.match(skill, /^---\r?\nname: god-prompt\r?\n/m);
  assert.match(mcpbIgnore, /^distribution\/$/m);
});

test("keeps the scoped package compatible with OpenAI Agents API plugin loading", () => {
  assert.equal(codexPlugin.name, plugin.name);
  assert.equal(codexPlugin.version, packageJson.version);
  assert.equal(codexPlugin.description, plugin.description);
  assert.equal(codexPlugin.skills, "./skills/");
  assert.equal(codexPlugin.mcpServers, undefined);
});

test("keeps current OpenAI public listing metadata submission-ready", () => {
  const portableInterface = plugin.extensions["com.openai"].interface;

  assert.deepEqual(codexPlugin.interface, portableInterface);
  assert.ok(portableInterface.displayName.length <= 30);
  assert.ok(portableInterface.shortDescription.length <= 30);
  assert.ok(portableInterface.longDescription.length <= 4000);
  assert.ok(portableInterface.developerName.length <= 80);
  assert.equal(portableInterface.category, "Developer Tools");
  assert.ok(portableInterface.capabilities.length <= 20);

  for (const capability of portableInterface.capabilities) {
    assert.ok(capability.length > 0 && capability.length <= 120);
    assert.doesNotMatch(capability, /[\r\n]/);
  }
});

test("uses a scoped trigger instead of the universal internal trigger contract", () => {
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  assert.match(frontmatter, /software-engineering task/i);
  assert.match(frontmatter, /Do not use for general knowledge/i);
  assert.doesNotMatch(frontmatter, /EVERY task|ANY request|default operating mode|No exceptions/i);
  assert.match(skill, /higher-priority instructions always control scope and authority/i);
  assert.match(skill, /do not modify files unless the user also asked/i);
});

test("rebinds repository-local authority after checkout or worktree transitions", () => {
  assert.match(skill, /resolve them from the\s+active checkout\/worktree revision/i);
  assert.match(skill, /bind trust to the exact source, not only the skill\s+or instruction name/i);
  assert.match(skill, /lower-trust source shadows the same identifier/i);
  assert.match(skill, /explicit source precedence or stop for reconciliation/i);
  assert.match(skill, /re-resolve both content and source provenance/i);
  assert.match(skill, /authority source and execution root cannot\s+be reconciled/i);
});

test("verifies scoped OpenAI runtime delivery integrity", () => {
  assert.match(skill, /effective runtime-delivered content and source/i);
  assert.match(skill, /not proof of delivered bytes/i);
  assert.match(skill, /reload\/reinstall from a\s+verified source/i);
  assert.match(skill, /stop for reconciliation before consequential work/i);
});

test("binds scoped OpenAI approvals to material call arguments", () => {
  assert.match(skill, /approval evidence includes the material call arguments and effect scope/i);
  assert.match(skill, /exposes\s+only the tool name or omits parameters/i);
  assert.match(skill, /parameter-complete approval/i);
});

test("contains the minimum five positive and three negative directory review cases", () => {
  assert.equal(reviewTests.positive.length, 5);
  assert.equal(reviewTests.negative.length, 3);

  for (const entry of reviewTests.positive) {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.prompt, "string");
    assert.equal(typeof entry.expectedBehavior, "string");
    assert.equal(typeof entry.expectedOutputStructure, "string");
  }

  for (const entry of reviewTests.negative) {
    assert.equal(typeof entry.id, "string");
    assert.equal(typeof entry.prompt, "string");
    assert.equal(typeof entry.expectedBehavior, "string");
    assert.equal(typeof entry.reason, "string");
  }
});

test("negative cases cover distinct non-engineering activation traps", () => {
  const prompts = reviewTests.negative.map((entry) => entry.prompt).join("\n");
  assert.match(prompts, /capital of Slovenia/i);
  assert.match(prompts, /Translate/i);
  assert.match(prompts, /birthday poem/i);
});
