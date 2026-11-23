import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFrozenStudies, scoreStudy } from "../benchmarks/agent-ab/real-repos/v8-denominator-efficiency.mjs";

const round = (value, places = 2) => Math.round(value * 10 ** places) / 10 ** places;

test("V7 uses all nine first-run arms, including the timed-out compact attempt", () => {
  const { v7 } = analyzeFrozenStudies();
  assert.equal(v7.study, "V7");
  assert.equal(v7.attempts, 9);
  assert.equal(v7.by_arm.baseline.accepted, 3);
  assert.equal(v7.by_arm.live_full.accepted, 3);
  assert.equal(v7.by_arm.live_compact.accepted, 2);
  assert.equal(v7.by_arm.live_compact.invalid, 1);
  assert.equal(v7.by_arm.live_compact.elapsed_seconds.total, 466.86);
  assert.equal(v7.by_arm.live_full.elapsed_seconds.total, 398.47);
  assert.equal(round(v7.by_arm.live_compact.elapsed_seconds.per_accepted), 233.43);
  assert.equal(round(v7.by_arm.live_full.elapsed_seconds.per_accepted), 132.82);
  assert.equal(round(v7.by_arm.live_compact.input_tokens.per_accepted), 461677.5);
  assert.equal(round(v7.by_arm.live_full.input_tokens.per_accepted), 265352.67);
  assert.ok(v7.by_arm.live_compact.elapsed_seconds.per_accepted > v7.by_arm.live_full.elapsed_seconds.per_accepted);
});

test("V6 interrupted baseline has an unknown duration and unknown tokens, never zero", () => {
  const { v6 } = analyzeFrozenStudies();
  assert.equal(v6.attempts, 30);
  assert.equal(v6.by_arm.baseline.accepted, 9);
  assert.equal(v6.by_arm.preinjected.accepted, 9);
  assert.equal(v6.by_arm.live_mcp.accepted, 8);
  assert.equal(v6.by_arm.baseline.elapsed_seconds.missing, 1);
  assert.equal(v6.by_arm.baseline.input_tokens.missing, 1);
  assert.equal(v6.by_arm.baseline.elapsed_seconds.per_accepted, null);
  assert.equal(v6.by_arm.baseline.input_tokens.per_accepted, null);
  assert.equal(round(v6.by_arm.baseline.elapsed_seconds.known_lower_bound_per_accepted), 115);
  assert.equal(round(v6.by_arm.preinjected.elapsed_seconds.per_accepted), 138.64);
  assert.equal(round(v6.by_arm.live_mcp.elapsed_seconds.per_accepted), 170.63);
});

test("no accepted fixes yields undefined cost per accepted fix, never Infinity or zero", () => {
  const scores = scoreStudy([
    { task_id: "a", arm: "baseline", status: "VALID_INCORRECT", hidden_passed: 0, hidden_total: 1, elapsed_seconds: 4, reported_input_tokens: 10, reported_cached_input_tokens: 1, reported_output_tokens: 2 },
    { task_id: "a", arm: "full", status: "VALID_CORRECT", hidden_passed: 1, hidden_total: 1, elapsed_seconds: 5, reported_input_tokens: 12, reported_cached_input_tokens: 2, reported_output_tokens: 3 },
  ], { study: "test", taskIds: ["a"], arms: ["baseline", "full"], timeoutSeconds: 10,
    inputField: "reported_input_tokens", cacheField: "reported_cached_input_tokens",
    outputField: "reported_output_tokens" });
  assert.equal(scores.by_arm.baseline.elapsed_seconds.per_accepted, null);
  assert.equal(scores.by_arm.baseline.input_tokens.per_accepted, null);
  assert.equal(scores.by_arm.baseline.acceptance_rate, 0);
});

test("duplicate/missing arms, implausible tokens, invalid status and invalid timeout claims fail closed", () => {
  const valid = [
    { task_id: "a", arm: "baseline", status: "VALID_CORRECT", hidden_passed: 1, hidden_total: 1, elapsed_seconds: 9, reported_input_tokens: 10, reported_cached_input_tokens: 6, reported_output_tokens: 2 },
    { task_id: "a", arm: "full", status: "INVALID", hidden_passed: 1, hidden_total: 1, elapsed_seconds: 12, reported_input_tokens: 20, reported_cached_input_tokens: 8, reported_output_tokens: 4 },
  ];
  const config = { study: "test", taskIds: ["a"], arms: ["baseline", "full"], timeoutSeconds: 10,
    inputField: "reported_input_tokens", cacheField: "reported_cached_input_tokens",
    outputField: "reported_output_tokens" };
  const evaluate = (rows) => scoreStudy(rows, config);
  assert.doesNotThrow(() => evaluate(structuredClone(valid)));
  assert.throws(() => evaluate([...valid, valid[0]]), /duplicate/i);
  assert.throws(() => evaluate([valid[0]]), /missing/i);
  assert.throws(() => evaluate(valid.map(x => x.arm === "full" ? { ...x, status: "VALID_CORRECT" } : x)), /timeout/i);
  assert.throws(() => evaluate(valid.map(x => x.arm === "full" ? { ...x, reported_cached_input_tokens: 21 } : x)), /cached/i);
  assert.throws(() => evaluate(valid.map(x => x.arm === "full" ? { ...x, reported_input_tokens: -1 } : x)), /token/i);
  assert.throws(() => evaluate(valid.map(x => x.arm === "full" ? { ...x, status: "SUCCESS" } : x)), /status/i);
});
