import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const plugin = JSON.parse(
  await readFile(new URL("../distribution/openai/plugin.json", import.meta.url), "utf8")
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
  assert.equal(plugin.version, "1.0.9");
  assert.equal(plugin.license, "MIT");
  assert.equal(plugin.repository, "https://github.com/AKzar1el/god-prompt-mcp");
  assert.equal(plugin.extensions, undefined);
  assert.match(skill, /^---\r?\nname: god-prompt\r?\n/m);
  assert.match(mcpbIgnore, /^distribution\/$/m);
});

test("uses a scoped trigger instead of the universal internal trigger contract", () => {
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  assert.match(frontmatter, /software-engineering task/i);
  assert.match(frontmatter, /Do not use for general knowledge/i);
  assert.doesNotMatch(frontmatter, /EVERY task|ANY request|default operating mode|No exceptions/i);
  assert.match(skill, /higher-priority instructions always control scope and authority/i);
  assert.match(skill, /do not modify files unless the user also asked/i);
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
