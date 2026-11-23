#!/usr/bin/env node
/**
 * One-time read-only-to-public exporter for independently verified V16
 * first-run evidence. Raw logs, private grader, and auth secrets remain ignored.
 * Does not rewrite existing results, run models or touch Git.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditV16Folder } from "./v16-secondary-audit.mjs";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v16");
const sha=x=>createHash("sha256").update(x).digest("hex");
const studyBytes=readFileSync(join(HERE,"v16-prospective-study-20261123.json"));
const study=JSON.parse(studyBytes);
const frozen=JSON.parse(readFileSync(join(ROOT,"v16-prospective-freeze-sha256.json")));
const audit=auditV16Folder();

assert.equal(sha(studyBytes),frozen.manifest_sha256);
assert.equal(audit.observed,9);
assert.equal(audit.complete,true);
assert.equal(audit.rows.filter(r=>r.accepted).length,9);
assert.equal(audit.independent_untracked_scope_inventory_complete,true);
const by_arm=audit.by_arm;
assert.deepEqual(
  Object.fromEntries(Object.entries(by_arm).map(([arm,x])=>[arm,x.accepted])),
  {baseline:3,full_mcp:3,conditional_mcp:3});
const rowData=audit.rows.map(r=>({
  task_id:r.task_id,repo:r.repo,issue:r.issue,arm:r.arm,
  original_status:r.original_status,original_accepted:r.accepted,
  elapsed_seconds:r.seconds,
  hidden_checks_passed:r.hidden_passed,
  hidden_checks_total:r.hidden_total,
  native_tests_exit_code:r.native_test_exit,
  post_edit_pytest_failures:r.post_edit_pytest_failures,
  mcp_calls:r.mcp_calls,
  model_reported_input_tokens:r.input_tokens,
  model_reported_cached_input_tokens:r.cached_input_tokens,
  model_reported_output_tokens:r.output_tokens,
  scoped_changed_file_count:r.scoped_file_count,
  original_receipt_sha256:r.receipt_sha256,
  original_jsonl_sha256:r.stdout_sha256,
  original_stderr_sha256:r.stderr_sha256
}));
const candidate={
  schema:"godprompt.v16.public-first-run-evidence.v1",
  date:"2026-11-23",
  study_id:study.study_id,
  planned_attempts:9,
  recorded_first_runs:9,
  task_count:3,
  repositories:study.tasks.map(t=>({repo:t.repo,issue:t.issue,
    url:t.issue_url,pinned_source_sha:t.source_sha,
    calibration:{untouched_passed:t.untouched_passed,
      reference_a_passed:t.reference_a_passed,
      reference_b_passed:t.reference_b_passed,
      intentionally_wrong_mutant_passed:t.mutant_passed,
      hidden_checks:t.hidden_checks}})),
  frozen_sha256:{
    manifest:frozen.manifest_sha256,
    runner:frozen.runner_sha256,
    private_grader:frozen.grader_sha256,
    event_inspector:frozen.event_audit_helper_sha256,
    risk_gate:frozen.risk_gate_prototype_sha256,
    path_helper:frozen.git_changed_paths_helper_sha256,
    pinned_runtime:study.godprompt_stdio_sha256
  },
  requested_model:study.environment.requested_model,
  requested_effort:study.environment.requested_effort,
  requested_sandbox:study.environment.sandbox,
  by_arm,
  first_runs:rowData,
  decision:{
    correctness_all_arms:"3/3 accepted first runs each",
    baseline_faster_on_tasks:["tenacity-780-v16","requests-7648-v16"],
    conditional_faster_on_tasks:["rich-4250-v16"],
    relative_conditional_wall_time_percent:
      Number(((by_arm.conditional_mcp.elapsed_all_attempts_seconds/
        by_arm.baseline.elapsed_all_attempts_seconds-1)*100).toFixed(2)),
    relative_full_wall_time_percent:
      Number(((by_arm.full_mcp.elapsed_all_attempts_seconds/
        by_arm.baseline.elapsed_all_attempts_seconds-1)*100).toFixed(2)),
    statistical_replicable_godprompt_uplift_proven:false,
    production_change:"NO_GO"
  },
  evidence_integrity:{
    originals_unchanged:true,
    private_raw_transcripts_committed:false,
    private_graders_committed:false,
    original_study_frozen:true,
    no_missing_receipts:true,
    independent_untracked_scope_inventory_complete:true
  },
  caveats:[
    "All nine real coding agents completed their original frozen attempts and passed hidden behavioral checks and project tests, but three tasks cannot establish a population-level effect.",
    "The same researcher authored references, grader and prompts; no separate blinded human adjudicator verified patches.",
    "The conditional policy was prompt-mediated and its inputs were assessed from authentic Codex events, not a separately deployed GodPrompt MCP route.",
    "Model effort, effective sandbox identity, token billing and cache provenance were requested or model-reported, not independently attested.",
    "No causal gain is established and no production guidance behavior was changed."
  ]
};
const destination=join(HERE,"v16-public-results-20261123.json");
writeFileSync(destination,JSON.stringify(candidate,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({created:"v16-public-results-20261123.json",
  rows:candidate.first_runs.length,by_arm:candidate.by_arm,
  no_go:candidate.decision.production_change==="NO_GO"},null,2));
