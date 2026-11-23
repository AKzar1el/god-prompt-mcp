#!/usr/bin/env node
/** One-time sanitized V18 result export. Fails until all original arms are audited. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {auditV18} from "./v18-secondary-audit.mjs";
const here=dirname(fileURLToPath(import.meta.url));
const frozen=readFileSync(join(here,"v18-frozen-study-20261123.json"));
const study=JSON.parse(frozen);
const digest=x=>createHash("sha256").update(x).digest("hex");
const audit=auditV18();
assert.ok(audit.complete&&audit.observed===6&&audit.missing.length===0,
 "Cannot publish partial V18 evidence; no missing first-run arms allowed");
const receipts=audit.rows.map(r=>({
  task:r.task,arm:r.arm,original_status:r.status,accepted:r.accepted,
  model_wall_seconds:r.seconds,
  hidden_passed:r.hidden_passed,hidden_total:r.hidden_total,
  grader_process_exit_code:r.grader_status,
  grader_process_error:r.grader_error,
  native_tests_count:r.native_tests,native_tests_exit_code:r.native_status,
  model_reported_usage:r.reported_usage,
  original_mcp_calls:r.mcp_calls,
  original_changed_paths:r.scope,
  original_receipt_sha256:r.receipt_sha256,
  original_jsonl_sha256:r.jsonl_sha256,
  original_stderr_sha256:r.stderr_sha256
}));
const baseline=audit.by_arm.baseline,guided=audit.by_arm.guided_mcp;
const ratio=baseline.seconds_per_accepted_fix&&guided.seconds_per_accepted_fix?
  Number(((guided.seconds_per_accepted_fix/baseline.seconds_per_accepted_fix)-1)*100)
  :null;
const oneDecimal=ratio===null?null:Number(ratio.toFixed(2));
const result={
 schema:"godprompt.v18.sanitized-original-matched-study.v1",
 study_id:study.id,date:study.date,
 frozen_sha256:{
   manifest:digest(frozen),
   runner:JSON.parse(readFileSync(join(here,
     "../real-runs/replication-v18/v18-freeze-sha256.json"))).runner_sha256,
   private_grader:study.private_behavior_grader_sha256,
   event_helper:study.event_helper_sha256,
   unchanged_stdio:study.runtime_stdio_sha256
 },
 randomized_run_order:study.run_order,
 preregistered_tasks:study.tasks.map(t=>({
  id:t.id,issue:t.issue,repo:t.repo,issue_url:t.issue_url,
  upstream_revision:t.source_sha,source_sha256:t.code_file_sha256,
  frozen_regression_sha256:t.regression_sha256,
  original_hidden_red:t.checkpoint_hidden_passed,hidden_checks:t.hidden_total,
  reference_a_passed:t.reference_a_passed,reference_b_passed:t.reference_b_passed,
  mutant_passed:t.mutant_passed,arm_order:t.order
 })),
 original_rows:receipts,by_arm:audit.by_arm,
 comparison:{
  guided_wall_seconds_per_accepted_fix_relative_percent:oneDecimal,
  original_guided_mcp_calls:guided.actual_mcp_calls,
  correct_guided_mcp_calls_required_per_arm:1,
  original_matched_trials_complete:true,
  replicated_productivity_gain_proven:false,
  production_guidance_change:"NO_GO"
 },
 evidence_integrity:{
  independent_raw_audit_original_receipts:6,
  original_session_jsonl_committed:false,
  original_stderr_committed:false,
  private_hidden_grader_committed:false,
  private_calibration_sources_committed:false,
  independent_blinded_human_adjudication_completed:false,
  immutable_original_receipt_ids:true
 },
 limitations:[
  "Three new public issue reports selected by one researcher with same-author graders and reference/mutant patches, not independent blinded review.",
  "Each of two randomized arms began with identical source and frozen failing regression tests; one first-run agent per arm, insufficient for a repeatable population claim.",
  "The guided arm invokes general short GodPrompt DEBUG execute guidance once; no additional repository-specific diagnostic information was supplied to the MCP tool.",
  "Original attempts, timeouts, policy denials and grader process errors are counted in the full denominator; postflight checks do not convert failed original receipts to accepted.",
  "Reported model input tokens include cached content, are not billed-token attestations, and model effort is requested rather than independently verified.",
  "Private raw logs, graders, test fixtures and isolated code remain off GitHub; public receipt digests alone cannot reproduce private hidden grading."
 ]
};
writeFileSync(join(here,"v18-public-results-20261123.json"),
 JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({public_result:"v18-public-results-20261123.json",
 attempts:6,by_arm:audit.by_arm,relative_percent:oneDecimal,
 decision:"NO_GO_NO_REPLICATED_CAUSAL_ADVANTAGE"},null,2));
