import test from "node:test";
import assert from "node:assert/strict";
import {validateV19Public} from
 "../benchmarks/agent-ab/real-repos/v19-verify-public.mjs";
const TASKS=["tenacity-710","rich-4270","requests-4965","pytest-15410","click-3914"];
const ARMS=["baseline","generic_godprompt","evidence_mcp"];
const sha="a".repeat(64);
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const anchors={};
 const rows=[];
 for(const [idx,id] of TASKS.entries()){
  for(const [armNo,arm] of ARMS.entries()){
   const original_receipt_sha256=(idx*3+armNo+1).toString(16).padStart(64,"0");
   const k=id+"|"+arm;
   anchors[k]={sha256:original_receipt_sha256,status:"VALID_CORRECT",seconds:100};
   const actual_mcp_calls=arm==="baseline"?[]:[{
    server:arm==="generic_godprompt"?"godprompt":"godprompt_evidence",
    tool:arm==="generic_godprompt"?"get_tailored_guidance":"get_failure_evidence",
    success:true,before_source_edit:true,
    exact_generic_args:arm==="generic_godprompt",
    exact_evidence_args:arm==="evidence_mcp",
    expected_frozen_packet:arm==="evidence_mcp"
   }];
   rows.push({id,arm,original_status:"VALID_CORRECT",
    original_receipt_sha256,original_jsonl_sha256:sha,
    original_stderr_sha256:sha,accepted:true,wall_seconds:100,
    hidden_passed:10,hidden_total:10,native_test_count:3,
    native_test_exit:0,grader_exit:0,actual_mcp_calls,
    model_reported_usage:{
     input_tokens:1000,cached_input_tokens:500,output_tokens:400}
   });
  }
 }
 const by_arm=Object.fromEntries(ARMS.map(a=>[a,{
  planned:5,original_attempts:5,accepted:5,
  all_attempt_wall_seconds:500,seconds_per_accepted_fix:100,
  known_model_reported_input_tokens:5000,missing_token_usage:0,
  actual_mcp_calls:a==="baseline"?0:5}]));
 return {anchors,data:{
  schema:"godprompt.v19.public-three-arm-original-results.v1",
  frozen_manifest_sha256:sha,frozen_runner_sha256:sha,
  intended_sample_size:15,actual_original_runs:15,
  independent_raw_log_audit_passed:true,
  expected_tasks:TASKS,review_draft_only:true,
  no_production_change:true,human_blinded_review_completed:false,
  second_unseen_replication_cohort_completed:false,
  conclusion:"NO_REPLICABLE_PRODUCTION_GAIN_CLAIM",
  effect_requirement:{
   minimum_replicated_wall_time_gain_percent:15,
   upper_model_reported_input_overhead_guardrail_percent:10,
   no_correctness_regression:true
  },
  caveats:["No blinded review","No replication cohort","One attempt per arm"],
  by_arm,all_original_rows:rows,
  directional_gain_percent_per_accepted_fix:{
   generic_vs_baseline:0,evidence_vs_baseline:0},
  reported_input_token_change_percent:{
   generic_vs_baseline:0,evidence_vs_baseline:0}
 }};
}
test("V19 public verifier accepts consistent full-denominator signed originals",()=>{
 const {data,anchors}=fixture();
 const o=validateV19Public(data,anchors);
 assert.equal(o.original_attempts,15);
 assert.equal(o.population_replicability_proven,false);
});
for(const [label,mutate] of [
 ["missing arm",d=>d.all_original_rows.pop()],
 ["replaced result hash",d=>d.all_original_rows[0].original_receipt_sha256=sha],
 ["post-run success inflation",d=>d.all_original_rows[0].original_status="VALID_INCORRECT"],
 ["wall-time alteration",d=>d.all_original_rows[0].wall_seconds=75],
 ["missing actual MCP calls",d=>d.all_original_rows[1].actual_mcp_calls=[]],
 ["misrepresented generic pre-edit time",d=>d.all_original_rows[1].actual_mcp_calls[0].before_source_edit=false],
 ["wrong tool arguments",d=>d.all_original_rows[1].actual_mcp_calls[0].exact_generic_args=false],
 ["false evidence receipt",d=>d.all_original_rows[2].actual_mcp_calls[0].expected_frozen_packet=false],
 ["secretly modified production",d=>d.no_production_change=false],
 ["claimed blinded review",d=>d.human_blinded_review_completed=true],
 ["claimed replication cohort",d=>d.second_unseen_replication_cohort_completed=true],
 ["changed aggregate wall time",d=>d.by_arm.baseline.all_attempt_wall_seconds=499],
 ["changed aggregate tokens",d=>d.by_arm.evidence_mcp.known_model_reported_input_tokens=4900],
 ["misstated performance win",d=>d.directional_gain_percent_per_accepted_fix.evidence_vs_baseline=50],
 ["misstated input overhead",d=>d.reported_input_token_change_percent.generic_vs_baseline=-25],
 ["declared false trial count",d=>d.actual_original_runs=14],
 ["claimed production-readiness",d=>d.conclusion="PROVEN_GAIN"],
 ]){
 test("V19 public verifier rejects "+label,()=>{
  const {data,anchors}=fixture();
  mutate(data);
  assert.throws(()=>validateV19Public(data,anchors));
 });
}
