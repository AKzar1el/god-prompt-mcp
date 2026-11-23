#!/usr/bin/env node
/** Fail-closed public audit for stopped V13/V14 original studies. No model execution. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const SHA = /^[0-9a-f]{64}$/u;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
// V14's original Windows study bytes used CRLF, but Git attributes normalize
// JSON to LF on checkout. Reconstruct the exact archived original byte digest
// without changing the frozen study, original receipt or historical runner.
const originalWindowsBytes = bytes => Buffer.from(bytes.toString("utf8")
  .replace(/\r?\n/gu,"\r\n"),"utf8");
const taskArm = item => JSON.stringify([item.task_id, item.arm]);
const expectedSlots = manifest =>
  manifest.tasks.flatMap(task => task.order.map(arm =>
    JSON.stringify([task.id, arm])));

export function verifyStoppedV13V14(v13, r13, v13Bytes, v14, r14, v14Bytes) {
  assert.equal(v13.schema, "godprompt.v13.behavioral-verify-once-study.v1");
  assert.equal(v14.schema, "godprompt.v14.behavioral-verify-once-study.v1");
  assert.equal(v13.study_id, r13.study);
  assert.equal(v14.study_id, r14.study);
  assert.equal(r13.schema, "godprompt.v13.stopped-public-evidence.v1");
  assert.equal(r14.schema, "godprompt.v14.stopped-public-evidence.v1");
  assert.equal(sha(v13Bytes), r13.frozen_manifest_sha256);
  assert.equal(sha(originalWindowsBytes(v14Bytes)), r14.frozen_manifest_sha256);
  assert.equal(r13.frozen_runner_sha256,
    "864fc69bf1d36f2052308369a3fb413f2615480b1e86fa08aacb5f0afe0d836c");
  assert.equal(r14.frozen_runner_sha256,
    "cd638f4fd3737b2c0005e6ed1bb3661149e065948697ca4bdf774f554b08c51b");
  assert.equal(r13.frozen_grader_sha256, v13.private_grader_sha256);
  assert.equal(r14.frozen_grader_sha256, v14.private_grader_sha256);
  assert.equal(r13.source_sha, v13.source_sha);
  assert.equal(r14.source_sha, v14.source_sha);
  assert.equal(r13.status,
    "STOPPED_AFTER_ONE_FIRST_RUN_GIT_PORCELAIN_LEADING_SPACE_PARSER_BUG");
  assert.equal(r14.status,
    "STOPPED_FIRST_BASELINE_CODEX_CLI_CONFIG_INVALID_TRANSPORT_NO_MODEL_TURN");
  for (const [m, r] of [[v13, r13], [v14, r14]]) {
    assert.equal(m.tasks.length, 2);
    assert.deepEqual(m.arms, ["baseline", "full_mcp", "verify_once_mcp"]);
    assert.equal(r.planned, 6);
    assert.equal(r.original_first_runs, 1);
    assert.equal(r.intentionally_unrun, 5);
    assert.ok(SHA.test(r.frozen_runner_sha256));
  }
  const slots13 = r13.trials.map(taskArm);
  assert.equal(slots13.length, 6);
  assert.deepEqual(new Set(slots13), new Set(expectedSlots(v13)));
  const first13 = r13.trials.find(t => t.original_status !== undefined);
  assert.equal(r13.trials.filter(t => t.original_status !== undefined).length, 1,
    "V13 has exactly one original first-run receipt");
  assert.equal(first13.issue, 410);
  assert.equal(first13.arm, "verify_once_mcp");
  assert.equal(first13.original_status, "INVALID_OTHER");
  assert.equal(first13.original_accepted, false);
  assert.equal(first13.wall_seconds, 313.001);
  assert.equal(first13.hidden_passed, 19);
  assert.equal(first13.hidden_total, 19);
  assert.equal(first13.original_repository_tests_passed, 20);
  assert.equal(first13.model_exit, 0);
  assert.equal(first13.model_turns, 1);
  assert.equal(first13.reported_input_tokens, 630912);
  assert.equal(first13.godprompt_calls.length, 1);
  assert.equal(first13.godprompt_calls[0].tool, "get_tailored_guidance");
  assert.equal(first13.godprompt_calls[0].success, true);
  assert.ok(SHA.test(first13.original_receipt_sha256));
  assert.ok(SHA.test(first13.original_jsonl_sha256));
  assert.deepEqual(first13.frozen_runner_changed_paths, [
    "rc/mcp_trendpulse/cli.py", "src/mcp_trendpulse/rss_compare.py",
    "tests/test_rss_compare.py",
  ]);
  assert.deepEqual(first13.independently_observed_git_diff_paths, [
    "src/mcp_trendpulse/cli.py", "src/mcp_trendpulse/rss_compare.py",
    "tests/test_rss_compare.py",
  ]);
  const unrun13 = r13.trials.filter(t => t.status === "NOT_RUN");
  assert.equal(unrun13.length, 5);
  for (const t of unrun13) {
    assert.ok(!Object.hasOwn(t, "original_status") &&
      !Object.hasOwn(t, "original_accepted") && !Object.hasOwn(t, "wall_seconds") &&
      !Object.hasOwn(t, "reported_input_tokens") &&
      !Object.hasOwn(t, "hidden_passed"), "NOT_RUN slots cannot contain outcomes");
  }
  assert.equal(r13.parser_audit.original_status_unchanged, true);
  assert.equal(r13.parser_audit.actual_changed_paths_within_allowlist, true);
  assert.equal(r13.productivity.causal_improvement_proven, false);
  assert.equal(r13.productivity.verified_relative_baseline_speed_advantage, null);
  assert.equal(r13.productivity.full_denominator_seconds_per_accepted_fix, null);
  assert.ok(Object.values(r13.effects).every(flag => flag === false));

  const slots14 = [r14.original_first_run, ...r14.unrun_slots];
  assert.equal(slots14.length, 6);
  assert.deepEqual(new Set(slots14.map(taskArm)), new Set(expectedSlots(v14)));
  const first14 = r14.original_first_run;
  assert.equal(first14.issue, 410);
  assert.equal(first14.arm, "baseline");
  assert.equal(first14.original_status, "INVALID_OTHER");
  assert.equal(first14.original_accepted, false);
  assert.equal(first14.wall_seconds, 0.614);
  assert.equal(first14.model_exit_code, 1);
  assert.equal(first14.model_turns, 0);
  assert.equal(first14.successful_native_commands, 0);
  assert.equal(first14.hidden_passed, 4);
  assert.equal(first14.hidden_total, 19);
  assert.equal(first14.model_reported_input_tokens, null);
  assert.deepEqual(first14.changed_paths, []);
  assert.ok(first14.stderr_explanation.includes("invalid transport"));
  assert.ok(SHA.test(first14.original_receipt_sha256));
  assert.ok(SHA.test(first14.original_jsonl_sha256));
  for (const t of r14.unrun_slots) {
    assert.equal(t.status, "NOT_RUN");
    assert.ok(!Object.hasOwn(t, "original_status") &&
      !Object.hasOwn(t, "original_accepted") && !Object.hasOwn(t, "wall_seconds") &&
      !Object.hasOwn(t, "model_turns"), "NOT_RUN slots cannot contain outcomes");
  }
  assert.equal(r14.productivity.causal_productivity_uplift_proven, false);
  assert.equal(r14.productivity.baseline_elapsed_per_correct_fix, null);
  assert.equal(r14.productivity.verified_speed_advantage, null);
  assert.ok(Object.values(r14.effects).every(flag => flag === false));

  return { status: "VERIFIED_V13_V14_ORIGINAL_STOPS_NO_UPLIFT",
    planned: 12, original_attempts: 2, intentionally_unrun: 10,
    v13_original_status: first13.original_status,
    v13_behavior_checks: first13.hidden_passed + "/" + first13.hidden_total,
    v14_original_status: first14.original_status, v14_model_turns: first14.model_turns };
}

const ownCall = process.argv[1] &&
  fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase();
if (ownCall) {
  const load = name => readFileSync(join(DIR, name));
  const bytes13 = load("v13-frozen-study-20261123.json");
  const bytes14 = load("v14-frozen-study-20261123.json");
  const evidence13 = JSON.parse(load("v13-public-results-20261123.json"));
  const evidence14 = JSON.parse(load("v14-public-results-20261123.json"));
  console.log(JSON.stringify(verifyStoppedV13V14(
    JSON.parse(bytes13), evidence13, bytes13,
    JSON.parse(bytes14), evidence14, bytes14), null, 2));
}
