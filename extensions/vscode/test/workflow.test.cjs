const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { TYPES, PHASES, section, buildGuidance, guide, draft } = require("../dist/workflow.cjs");
const data = require("../dist/guidance.json");
test("every task and phase has source-backed guidance", () => {
  for (const type of TYPES) for (const phase of PHASES) {
    const output = guide(data, type, phase);
    assert.ok(output.includes(type + " / " + phase));
    assert.ok(output.includes("No repository inspection"));
    assert.ok(output.length > 250);
  }
});
test("quality gate falls back to universal for ANALYZE and PLAN", () => {
  for (const type of ["ANALYZE", "PLAN"]) assert.ok(guide(data, type, "verify").includes("Universal Gate"));
});
test("draft carries explicit unfinished scope and verification placeholders", () => {
  const output = draft(data, { type: "DEBUG", phase: "verify", task: "Investigate a failed build" });
  assert.ok(output.includes("> Investigate a failed build"));
  assert.ok(output.includes("[ ] [Supply an actual repository-appropriate verification command.]"));
  assert.ok(output.includes("No repository inspection"));
});
test("fenced headings do not truncate source sections", () => {
  const text = "## BUILD Protocol\n~~~md\n## nested\n~~~\nReal text\n## Next";
  assert.ok(section(text, "BUILD Protocol").includes("Real text"));
  assert.ok(!section(text, "BUILD Protocol").includes("## Next"));
});
test("missing source section fails closed", () => assert.throws(() => buildGuidance("## BUILD Protocol\nTest", "", "1.5.0"), /Universal gate missing/));
test("invalid workflow and phase are rejected", () => {
  assert.throws(() => guide(data, "../", "verify"));
  assert.throws(() => guide(data, "BUILD", "execute-command"));
});
test("empty, overlong or multiline task rejected", () => {
  for (const task of ["", " ", "x".repeat(501), "a\nb", 7]) assert.throws(() => draft(data, { type: "BUILD", phase: "plan", task }));
});
test("bundle provenance matches exact checked-in references", () => {
  const refs = path.resolve(__dirname, "../../../skills/god-prompt/references");
  const hash = name => crypto.createHash("sha256").update(fs.readFileSync(path.join(refs, name), "utf8"), "utf8").digest("hex");
  assert.equal(data.source_sha256.protocols, hash("01-PROTOCOLS.md"));
  assert.equal(data.source_sha256.gates, hash("02-GATES.md"));
});
