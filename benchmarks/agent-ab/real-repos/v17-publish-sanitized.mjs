#!/usr/bin/env node
/**
 * Create one sanitized, inspectable V17 research result from original evidence.
 * No model calls, patch retries, private grader publication or overwrite.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {auditV17Folder} from "./v17-secondary-audit.mjs";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v17");
const sha=x=>createHash("sha256").update(x).digest("hex");
const original=readFileSync(join(HERE,"v17-frozen-study-20261123.json"));
const study=JSON.parse(original);
const freeze=JSON.parse(readFileSync(join(ROOT,"v17-freeze-sha256.json")));
assert.equal(sha(original),freeze.manifest_sha256);
const audit=auditV17Folder();
assert.equal(audit.complete,true,"All six original arms must finish before public export");
assert.equal(audit.rows.length,6);
const records=audit.rows.map(r=>({
  task_id:r.task_id,repo:r.repo,issue:r.issue,arm:r.arm,
  original_status:r.original_status,accepted:r.accepted,
  elapsed_seconds:r.seconds,
  model_exit_code:r.model_exit_code,timeout:r.timeout,
  policy_denial:r.policy_denial,
  hidden_passed:r.hidden_passed,hidden_total:r.hidden_total,
  native_tests_count:r.native_tests,
  native_test_exit_code:r.native_test_exit,
  native_failures_after_edits:r.native_failures_after_edits,
  source_file_edits:r.successful_source_edits,
  repeated_failure_trigger:r.repeated_failure_trigger,
  real_mcp_calls:r.mcp_calls,
  model_reported_input_tokens:r.input_tokens,
  model_reported_cached_input_tokens:r.cached_input_tokens,
  model_reported_output_tokens:r.output_tokens,
  original_receipt_sha256:r.receipt_sha256,
  original_jsonl_sha256:r.raw_jsonl_sha256,
  original_stderr_sha256:r.raw_stderr_sha256
}));
const baseline=audit.by_arm.baseline;
const treated=audit.by_arm.repeated_failure_mcp;
const conditionalWins=[];
const baselineWins=[];
const ties=[];
for(const t of study.tasks){
  const b=records.find(r=>r.task_id===t.id&&r.arm==="baseline");
  const a=records.find(r=>r.task_id===t.id&&r.arm==="repeated_failure_mcp");
  assert.ok(b&&a);
  if(a.accepted&&!b.accepted)conditionalWins.push(t.id);
  else if(b.accepted&&!a.accepted)baselineWins.push(t.id);
  else if(a.accepted&&b.accepted){
    if(a.elapsed_seconds<b.elapsed_seconds)conditionalWins.push(t.id);
    else if(b.elapsed_seconds<a.elapsed_seconds)baselineWins.push(t.id);
    else ties.push(t.id);
  }else ties.push(t.id);
}
const percentage=baseline.accepted&&treated.accepted?
  Number(((treated.seconds_per_accepted_fix/
    baseline.seconds_per_accepted_fix-1)*100).toFixed(2)):null;
const publicResult={
  schema:"godprompt.v17.public-original-evidence.v1",
  study_id:study.study_id,
  source_date:study.created,
  intended_arms:study.arms,
  planned_first_runs:6,completed_first_runs:6,
  preregistered_tasks:study.tasks.map(t=>({
    task_id:t.id,repository:t.repo,issue:t.issue,issue_url:t.url,
    pinned_source_sha:t.source_sha,
    original_untouched_passed:t.original_behavior_passed,
    hidden_cases:t.behavior_checks,
    reference_a_passed:t.reference_a_passed,
    reference_b_passed:t.reference_b_passed,
    deliberately_wrong_mutant_passed:t.mutant_passed,
    frozen_order:t.order
  })),
  original_freeze_sha256:{
    manifest:freeze.manifest_sha256,runner:freeze.runner_sha256,
    private_grader:freeze.private_grader_sha256,
    event_helper:freeze.event_audit_helper_sha256,
    git_path_helper:freeze.git_path_helper_sha256,
    pinned_runtime:freeze.runtime_stdio_sha256
  },
  requested_model:study.environment.requested_model,
  requested_effort:study.environment.reasoning_effort_requested,
  requested_sandbox:study.environment.sandbox,
  original_rows:records,
  by_arm:audit.by_arm,
  comparisons:{
    conditional_wins_on_accuracy_or_time:conditionalWins,
    baseline_wins_on_accuracy_or_time:baselineWins,
    ties_or_both_incorrect:ties,
    relative_treatment_seconds_per_accepted_fix_percent:percentage,
    conditional_godprompt_calls_total:records.filter(r=>
      r.arm==="repeated_failure_mcp").reduce((s,x)=>s+x.real_mcp_calls,0),
    treatment_strict_trigger_observed_attempts:records.filter(r=>
      r.arm==="repeated_failure_mcp"&&r.repeated_failure_trigger).length,
    replicated_godprompt_uplift_proven:false,
    production_guidance_change:"NO_GO"
  },
  audit:{
    independent_original_receipt_count:audit.observed,
    private_raw_jsonl_committed:false,private_calibration_patches_committed:false,
    private_grader_committed:false,
    independent_untracked_file_inventory_complete:
      audit.independent_untracked_file_inventory_complete,
    incomplete_inventories:audit.incomplete_git_inventories
  },
  caveats:[
    "Only three genuinely difficult public defects; one first run per model condition. No independent blinded human reviewer.",
    "The same author calibrated hidden graders and reference solutions; native test and source events are observable, but quality and environment generalization are limited.",
    "Agent treatment is prompt-mediated and not a production automatic GodPrompt policy; even correct failures may not trigger two repair-separated test failures.",
    "Upstream pytest test suites had local optional dependency or snapshot-version constraints; benchmark requires two or more real stdlib unittest regressions plus hidden native behavior execution.",
    "The study includes all attempts and timeouts; no counterfactual replay or statistically general improvement claim.",
    "Model-reported tokens include cache and are not proof of billable cost."
  ]
};
writeFileSync(join(HERE,"v17-public-results-20261123.json"),
  JSON.stringify(publicResult,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({
  created:"v17-public-results-20261123.json",
  attempts:audit.observed,by_arm:audit.by_arm,decision:"NO_GO"
},null,2));
