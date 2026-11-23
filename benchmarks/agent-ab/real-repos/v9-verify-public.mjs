#!/usr/bin/env node
/** Verify only the public, redacted V9 first-run evidence. Never executes agents. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const sha256 = b => createHash("sha256").update(b).digest("hex");
const valid = (v, message) => { if (!v) throw new Error(message); };
const SHA = /^[a-f0-9]{64}$/u;

export function verifyPublicV9(manifest, evidence, manifestBytes) {
  valid(manifest.schema === "godprompt.v9.frozen-public-issues.triarm.v1",
    "Wrong preregistration");
  valid(evidence.schema === "godprompt.v9.public-first-run-evidence.v1",
    "Wrong evidence schema");
  valid(evidence.manifest_sha256 === sha256(manifestBytes),
    "Preregistered manifest bytes changed");
  valid(evidence.frozen_source_sha === manifest.source_sha &&
    evidence.frozen_grader_sha256 === manifest.private_grader_sha256 &&
    SHA.test(evidence.frozen_grader_sha256), "Source/grader identity mismatch");
  valid(evidence.planned_trials === manifest.tasks.length * manifest.arms.length &&
    manifest.tasks.length === 2 && manifest.arms.length === 3,
    "Wrong frozen trial denominator");
  const expected = manifest.tasks.flatMap(task => task.order.map(arm =>
    task.task_id + "|" + arm));
  valid(expected.length === new Set(expected).size, "Duplicate preregistered arm");
  valid(Array.isArray(evidence.trials) &&
    evidence.trials.length === expected.length, "Dropped original planned arm");
  const found = new Set();
  let performed = 0;
  for (const attempt of evidence.trials) {
    const id = attempt.task_id + "|" + attempt.arm;
    valid(expected.includes(id) && !found.has(id), "Missing/duplicate/swapped arm");
    found.add(id);
    if (attempt.status === "NOT_RUN") {
      valid(attempt.accepted === undefined && attempt.reported_input_tokens === undefined,
        "Untested arm has fabricated measurements");
      continue;
    }
    performed++;
    valid(attempt.status === "INVALID_TOOL_POLICY" &&
      attempt.accepted === false && attempt.original_exit_code === 0 &&
      attempt.completed_model_turns >= 1 &&
      attempt.observed_successful_command_or_file_changes === 0 &&
      attempt.original_wall_seconds > 0 &&
      Number.isInteger(attempt.reported_input_tokens) &&
      attempt.reported_input_tokens > 0 &&
      SHA.test(attempt.original_jsonl_sha256) &&
      SHA.test(attempt.original_prompt_sha256) &&
      attempt.native_policy_error.includes("blocked by policy"),
      "Invalid or fabricated failed original receipt");
    valid(attempt.independent_offline_regrade?.passed ===
      manifest.tasks.find(t => t.task_id === attempt.task_id)?.red_passed_checks &&
      attempt.independent_offline_regrade?.checks ===
      manifest.tasks.find(t => t.task_id === attempt.task_id)?.hidden_checks &&
      attempt.ordinary_existing_tests?.failed === 0,
      "Offline RED evidence contradicted");
  }
  valid(performed === evidence.original_first_run_count && performed === 1,
    "Attempt count changed or missing");
  valid(evidence.status === "STOPPED_TOOL_EXECUTION_POLICY" &&
    evidence.verified_preflight?.native_coding_tool_execution_succeeded === false,
    "Stopped-policy study falsely marked usable");
  valid(evidence.productivity?.accepted_fixes === 0 &&
    evidence.productivity.seconds_per_accepted_fix === null &&
    evidence.productivity.input_tokens_per_accepted_fix === null &&
    evidence.productivity.treatment_speed_delta_percent === null &&
    evidence.productivity.causal_uplift_proven === false,
    "Invented productivity effect with no successful valid arms");
  valid(Object.values(evidence.release_effects).every(v => v === false),
    "Unverified release effects");
  return {
    status: "VERIFIED_STOPPED_NO_PRODUCTIVITY_CLAIM",
    manifest_sha256: sha256(manifestBytes),
    frozen_planned: expected.length,
    original_first_run_attempts: performed,
    unrun: expected.length - performed,
    accepted_fixes: 0,
    authorized_shell_execution_verified: false,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifestBytes = readFileSync(join(HERE, "v9-frozen-public-issues-20261123.json"));
  const evidence = JSON.parse(readFileSync(join(HERE, "v9-public-results-20261123.json")));
  console.log(JSON.stringify(verifyPublicV9(JSON.parse(manifestBytes), evidence, manifestBytes), null, 2));
}
