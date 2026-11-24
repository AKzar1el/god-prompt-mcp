/**
 * Portable V19 public-data verifier. No private benchmark clones or model
 * logs are needed; sha256 receipt anchors are declared separately after the
 * first-run read-only audit, and hidden/private evidence is not distributed.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const HERE=dirname(fileURLToPath(import.meta.url));
const SHA=/^[a-f0-9]{64}$/u;
const ARMS=["baseline","generic_godprompt","evidence_mcp"];
const IDS=["tenacity-710","rich-4270","requests-4965","pytest-15410","click-3914"];
const STATUS=["VALID_CORRECT","VALID_INCORRECT","INVALID_TIMEOUT",
 "INVALID_PROTOCOL","INVALID_POLICY","INVALID_OTHER"];
function approxEq(actual,expected,digits=3){
 assert.equal(Number(actual).toFixed(digits),Number(expected).toFixed(digits));
}
function q(v){assert.ok(Number.isFinite(v)&&v>=0);return v}
export function validateV19Public(data,anchors){
 assert.equal(data?.schema,"godprompt.v19.public-three-arm-original-results.v1");
 assert.ok(SHA.test(data.frozen_manifest_sha256));
 assert.ok(SHA.test(data.frozen_runner_sha256));
 assert.equal(data.intended_sample_size,15);
 assert.equal(data.actual_original_runs,15);
 assert.equal(data.independent_raw_log_audit_passed,true);
 assert.equal(data.review_draft_only,true);
 assert.equal(data.no_production_change,true);
 assert.equal(data.human_blinded_review_completed,false);
 assert.equal(data.second_unseen_replication_cohort_completed,false);
 assert.equal(data.conclusion,"NO_REPLICABLE_PRODUCTION_GAIN_CLAIM");
 assert.deepEqual(data.expected_tasks,IDS);
 assert.equal(data.effect_requirement.minimum_replicated_wall_time_gain_percent,15);
 assert.equal(data.effect_requirement.upper_model_reported_input_overhead_guardrail_percent,10);
 assert.equal(data.effect_requirement.no_correctness_regression,true);
 assert.ok(Array.isArray(data.caveats)&&data.caveats.length>=3);
 assert.ok(Array.isArray(data.all_original_rows)&&data.all_original_rows.length===15);
 assert.ok(anchors&&typeof anchors==="object"&&!Array.isArray(anchors));
 assert.equal(Object.keys(anchors).length,15);
 const seen=new Set();
 const summary={};
 for(const arm of ARMS)
  summary[arm]={accepted:0,seconds:0,input:0,missing:0,calls:0};
 for(const row of data.all_original_rows){
  assert.ok(IDS.includes(row.id));
  assert.ok(ARMS.includes(row.arm));
  const id=row.id+"|"+row.arm;
  assert.equal(seen.has(id),false,"Duplicate original entry "+id);
  seen.add(id);
  assert.ok(STATUS.includes(row.original_status));
  assert.equal(row.accepted,row.original_status==="VALID_CORRECT");
  for(const field of ["original_receipt_sha256","original_jsonl_sha256",
    "original_stderr_sha256"])assert.ok(SHA.test(row[field]));
  assert.deepEqual({
   sha256:row.original_receipt_sha256,
   status:row.original_status,
   seconds:row.wall_seconds
  },anchors[id],"Receipt identity, original verdict or original time changed");
  q(row.wall_seconds);
  if(row.accepted){
   assert.ok(Number.isInteger(row.native_test_count)&&row.native_test_count>=2);
   assert.ok(Number.isInteger(row.hidden_total)&&row.hidden_total>0);
   assert.equal(row.hidden_passed,row.hidden_total);
   assert.equal(row.native_test_exit,0);
   assert.equal(row.grader_exit,0);
  }else{
   assert.ok(row.native_test_count===null||
    Number.isInteger(row.native_test_count)&&row.native_test_count>=0);
   assert.ok(row.hidden_total===null||
    Number.isInteger(row.hidden_total)&&row.hidden_total>0);
   assert.ok(row.hidden_passed===null||
    Number.isInteger(row.hidden_passed)&&row.hidden_passed>=0&&
      (row.hidden_total===null||row.hidden_passed<=row.hidden_total));
  }
  assert.ok(Array.isArray(row.actual_mcp_calls));
  if(row.arm==="baseline")assert.equal(row.actual_mcp_calls.length,0);
  else if(row.accepted)assert.equal(row.actual_mcp_calls.length,1);
  for(const call of row.actual_mcp_calls){
   assert.ok(call.server==="godprompt"||
     call.server==="godprompt_evidence");
   assert.equal(typeof call.success,"boolean");
   assert.equal(typeof call.before_source_edit,"boolean");
   assert.equal(typeof call.exact_generic_args,"boolean");
   assert.equal(typeof call.exact_evidence_args,"boolean");
   assert.equal(typeof call.expected_frozen_packet,"boolean");
   if(row.accepted){
    assert.equal(call.success,true);
    assert.equal(call.before_source_edit,true);
    if(row.arm==="generic_godprompt"){
     assert.equal(call.server,"godprompt");
     assert.equal(call.tool,"get_tailored_guidance");
     assert.equal(call.exact_generic_args,true);
    }
    if(row.arm==="evidence_mcp"){
     assert.equal(call.server,"godprompt_evidence");
     assert.equal(call.tool,"get_failure_evidence");
     assert.equal(call.exact_evidence_args,true);
     assert.equal(call.expected_frozen_packet,true);
    }
   }
  }
  const s=summary[row.arm];
  s.seconds+=row.wall_seconds;
  s.accepted+=Number(row.accepted);
  s.calls+=row.actual_mcp_calls.length;
  if(row.model_reported_usage===null)s.missing++;
  else{
   const u=row.model_reported_usage;
   for(const k of ["input_tokens","cached_input_tokens","output_tokens"])
    assert.ok(Number.isSafeInteger(u[k])&&u[k]>=0);
   assert.ok(u.cached_input_tokens<=u.input_tokens);
   s.input+=u.input_tokens;
  }
 }
 assert.equal(seen.size,15);
 assert.equal(Object.keys(data.by_arm).length,3);
 for(const arm of ARMS){
  const summaryExpected=data.by_arm[arm],actual=summary[arm];
  assert.equal(summaryExpected.original_attempts,5);
  assert.equal(summaryExpected.accepted,actual.accepted);
  assert.equal(summaryExpected.actual_mcp_calls,actual.calls);
  assert.equal(summaryExpected.missing_token_usage,actual.missing);
  assert.equal(summaryExpected.known_model_reported_input_tokens,actual.input);
  approxEq(summaryExpected.all_attempt_wall_seconds,actual.seconds);
  if(actual.accepted>0)approxEq(summaryExpected.seconds_per_accepted_fix,
    actual.seconds/actual.accepted);
  else assert.equal(summaryExpected.seconds_per_accepted_fix,null);
 }
 const change=(treatedKey,field)=>{
  const b=summary.baseline;
  const t=summary[treatedKey];
  if(field==="wall"){
   if(!b.accepted||!t.accepted)return null;
   return Math.round((1-data.by_arm[treatedKey].seconds_per_accepted_fix/
      data.by_arm.baseline.seconds_per_accepted_fix)*10000)/100;
  }
  if(b.missing||t.missing||b.input===0)return null;
  return Math.round((t.input/b.input-1)*10000)/100;
 };
 for(const [name,key] of [
  ["generic_vs_baseline","generic_godprompt"],
  ["evidence_vs_baseline","evidence_mcp"]]){
  const a=data.directional_gain_percent_per_accepted_fix[name];
  const b=change(key,"wall");
  if(b===null)assert.equal(a,null);
  else approxEq(a,b,2);
  const tokenChange=data.reported_input_token_change_percent[name];
  const expectedTokenChange=change(key,"tokens");
  if(expectedTokenChange===null)assert.equal(tokenChange,null);
  else approxEq(tokenChange,expectedTokenChange,2);
 }
 return{status:"VERIFIED_V19_15_ORIGINAL_RESULTS_NO_REPLICATED_GAIN_CLAIM",
  original_attempts:seen.size,
  by_arm:data.by_arm,
  percent_wall_time_gain:data.directional_gain_percent_per_accepted_fix,
  percent_model_reported_input_change:data.reported_input_token_change_percent,
  population_replicability_proven:false};
}
export function verifyV19FromFiles({
 dataFile=join(HERE,"v19-public-results-20261123.json"),
 anchorsFile=join(HERE,"v19-original-receipt-anchors-20261123.json")
}={}){
 return validateV19Public(JSON.parse(readFileSync(dataFile,"utf8")),
  JSON.parse(readFileSync(anchorsFile,"utf8")));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 console.log(JSON.stringify(verifyV19FromFiles(),null,2));
