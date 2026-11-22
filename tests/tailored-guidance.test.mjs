import test from "node:test";
import assert from "node:assert/strict";
import { getTailoredGuidance } from "../dist/tailored-guidance.js";

const types = ["BUILD", "DEBUG", "REFACTOR", "CONTENT", "DESIGN", "SHIP", "ANALYZE", "AUTOMATE", "PLAN"];
const phases = ["plan", "execute", "verify", "handoff"];

test("all 9 task types and 4 phases return bounded nonempty guidance", () => {
  for (const taskType of types) {
    for (const phase of phases) {
      const entry = getTailoredGuidance(taskType, phase, 0, 750);
      assert.equal(entry.task_type, taskType);
      assert.equal(entry.phase, phase);
      assert.ok(entry.content.length > 20, `${taskType}/${phase} needs a real guide`);
      assert.ok(entry.content.length <= 750);
      assert.equal(typeof entry.total_chars, "number");
      assert.ok(entry.source.endsWith(".md"));
      assert.match(entry.warning, /Guidance only/);
    }
  }
});

test("paging reconstructs exact task-specific text without loss or repeats", () => {
  const args = ["DEBUG", "execute"];
  const whole = getTailoredGuidance(...args, 0, 4000);
  let start = 0;
  let reconstructed = "";
  for (let i = 0; i < 20; i++) {
    const page = getTailoredGuidance(...args, start, 333);
    reconstructed += page.content;
    if (page.next_start === null) break;
    assert.ok(page.next_start > start);
    start = page.next_start;
  }
  assert.equal(reconstructed.length, whole.total_chars);
  assert.equal(reconstructed, whole.content.slice(0, whole.total_chars));
});

test("one-phase retrieval is smaller than full protocol content", () => {
  const plan = getTailoredGuidance("BUILD", "plan", 0, 4000);
  const full = getTailoredGuidance("BUILD", "execute", 0, 4000);
  assert.ok(plan.total_chars < full.total_chars);
  const eof = getTailoredGuidance("BUILD", "plan", plan.total_chars + 2, 500);
  assert.equal(eof.content, "");
  assert.equal(eof.next_start, null);
});

test("coding-agent execute guidance explicitly schedules bounded verify retrieval", () => {
  const execute = getTailoredGuidance("DEBUG", "execute", 0, 1800);
  assert.deepEqual(execute.recommended_next_call, {
    tool: "get_tailored_guidance",
    arguments: { task_type: "DEBUG", phase: "verify", max_chars: 1800 },
  });
  assert.match(execute.next_step, /after.*(?:edits|implementation).*actual.*test/i);
  assert.equal(execute.guidance_is_verification, false);
  const verify = getTailoredGuidance("DEBUG", "verify", 0, 1800);
  assert.equal(verify.recommended_next_call, null);
  assert.match(verify.next_step, /actual.*verification.*receipts/i);
  assert.equal(verify.guidance_is_verification, false);
});
