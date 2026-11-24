/**
 * Publish only independently audited, minimal first-run results.
 * Private raw JSONL, stderr, graders, prompts and original receipts stay ignored.
 * This never starts Codex and refuses to overwrite an existing public file.
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {auditV19} from "./v19-secondary-audit.mjs";
const HERE=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");
const studyBytes=readFileSync(join(HERE,"v19-frozen-pilot-20261123.json"));
const study=JSON.parse(studyBytes);
const audit=auditV19();
assert.equal(audit.complete,true,"All 15 original runs required before publication");
assert.equal(audit.original_completed,study.limits.original_denominator);
assert.deepEqual(audit.missing,[]);
const byArm=audit.by_arm;
for(const arm of study.arms){
 const a=byArm[arm];
 assert.equal(a.original_attempts,study.tasks.length,
  "Do not report a partial arm denominator as fully executed");
}
const publicRows=audit.rows.map(x=>({
 id:x.id,arm:x.arm,original_status:x.status,
 original_receipt_sha256:x.original_receipt_sha256,
 original_jsonl_sha256:x.original_jsonl_sha256,
 original_stderr_sha256:x.original_stderr_sha256,
 accepted:x.accepted,
 wall_seconds:x.seconds,
 hidden_passed:x.hidden_passed,hidden_total:x.hidden_total,
 native_test_count:x.native_test_count,
 native_test_exit:x.native_test_exit,
 grader_exit:x.grader_exit,
 model_reported_usage:x.model_reported_usage,
 actual_mcp_calls:x.mcp_calls.map(call=>({
  server:call.server,tool:call.tool,success:call.success,
  before_source_edit:call.before_source_edit,
  exact_generic_args:call.exact_generic_args,
  exact_evidence_args:call.exact_evidence_args,
  expected_frozen_packet:study.tasks.find(t=>t.id===x.id)?.evidence_sha256===
   call.packet_evidence_sha256
 }))
}));
const baseline=byArm.baseline,gen=byArm.generic_godprompt,evidence=byArm.evidence_mcp;
const relativeGain=(control,treated)=>{
 if(!control.accepted||!treated.accepted)return null;
 return Math.round((1-treated.seconds_per_accepted_fix/
  control.seconds_per_accepted_fix)*10000)/100;
};
const baselineToGeneric=relativeGain(baseline,gen);
const baselineToEvidence=relativeGain(baseline,evidence);
const percentageCost=(control,treated)=>{
 if(control.missing_token_usage||treated.missing_token_usage||
    control.known_model_reported_input_tokens<=0)return null;
 return Math.round((treated.known_model_reported_input_tokens/
    control.known_model_reported_input_tokens-1)*10000)/100;
};
const genericTokens=percentageCost(baseline,gen);
const evidenceTokens=percentageCost(baseline,evidence);
const data={
 schema:"godprompt.v19.public-three-arm-original-results.v1",
 study:study.id,
 frozen_manifest_sha256:sha(studyBytes),
 frozen_runner_sha256:JSON.parse(readFileSync(join(HERE,
  "../real-runs/replication-v19/v19-freeze-sha256.json"),"utf8")).runner_sha256,
 intended_sample_size:study.limits.original_denominator,
 actual_original_runs:audit.original_completed,
 independent_raw_log_audit_passed:true,
 expected_tasks:study.task_order,
 review_draft_only:true,
 human_blinded_review_completed:false,
 second_unseen_replication_cohort_completed:false,
 no_production_change:true,
 effect_requirement:{
  minimum_replicated_wall_time_gain_percent:15,
  upper_model_reported_input_overhead_guardrail_percent:10,
  no_correctness_regression:true
 },
 by_arm:byArm,
 directional_gain_percent_per_accepted_fix:{
  generic_vs_baseline:baselineToGeneric,
  evidence_vs_baseline:baselineToEvidence
 },
 reported_input_token_change_percent:{
  generic_vs_baseline:genericTokens,
  evidence_vs_baseline:evidenceTokens
 },
 all_original_rows:publicRows,
 conclusion:"NO_REPLICABLE_PRODUCTION_GAIN_CLAIM",
 caveats:[
  "One first-run attempt per arm for only five cases. This is a directional pilot, not a repeatable performance claim.",
  "Private behavior graders, calibration mutants and reference solutions were authored by the same researcher; independent blinded human review is missing.",
  "Real native test failure and exact task-bound evidence calls were independently checked from authentic JSONL, not model self-reported fixes.",
  "Reported input tokens include cache and are not a verified billed cost measure.",
  "All original timeouts, failed treatments, invalid or incorrect attempts remain in the fixed denominator.",
  "Benchmark research is isolated from live GodPrompt runtime and npm package."
 ]
};
const outfile=join(HERE,"v19-public-results-20261123.json");
writeFileSync(outfile,JSON.stringify(data,null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({
 outfile,sha256:sha(readFileSync(outfile)),
 full_denominator:data.actual_original_runs,
 by_arm:data.by_arm,
 gain_percent:data.directional_gain_percent_per_accepted_fix,
 reported_input_overhead_percent:data.reported_input_token_change_percent
},null,2));
