#!/usr/bin/env node
/** Portable V18 public original-first-run evidence verifier, no private raw files. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const HERE=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");
const isSha=x=>typeof x==="string"&&/^[a-f0-9]{64}$/u.test(x);
const three=x=>Number(x.toFixed(3));
const normalise=x=>Buffer.from(x.toString("utf8").replace(/\r\n/gu,"\n"),"utf8");
// Independently audited original first-run SHA identities. These are explicit
// immutable control anchors, not values calculated from the submitted public
// result at verification time. Include every original, not just accepted fixes.
const ORIGINAL_RECEIPTS=Object.freeze({
  "pytest-15335|baseline":["VALID_CORRECT",true,217.305,
    "d9674fad799aae28bd5e7c78eb6ee26c239f3be3c2237add161b4a5877a2fffe",13],
  "pytest-15335|guided_mcp":["VALID_CORRECT",true,179.255,
    "aabd1dbc6f1fef3596fbee5e93a8a8ffbe6c8f11c68917b651ba6e29a6d1b61d",13],
  "anyio-1486|baseline":["VALID_CORRECT",true,230.244,
    "a9620c780ed3a569b3b0bf6a801a1ceae1578139a45e06250edf8ffceed4d223",6],
  "anyio-1486|guided_mcp":["VALID_CORRECT",true,234.131,
    "86072ae1e13dc5745f0d894d6a43d3c22281dcdb68efcf8daa7cdb6f6dc0c833",6],
  "rich-4264|guided_mcp":["VALID_CORRECT",true,125.954,
    "8cf0104b93311734beeda881b50b96332ace7ca5d5b26924445559508dcda714",19],
  "rich-4264|baseline":["VALID_CORRECT",true,135.153,
    "5ab7ee47f47b474c729facf542a0a0c0867488bb9645da978b117bf604ee5a3b",19]
});
export function verifyV18Public(study,publicResult,manifestBytes){
  assert.equal(study.schema,"godprompt.v18.matched-failing-checkpoint.v1");
  assert.equal(publicResult.schema,"godprompt.v18.sanitized-original-matched-study.v1");
  assert.equal(publicResult.study_id,study.id);
  assert.equal(publicResult.frozen_sha256.manifest,sha(normalise(manifestBytes)));
  assert.equal(publicResult.frozen_sha256.runner,
    "cc96023860094be631e962029b760ade66c18ab9b747aa643b46e7d37739eea4");
  assert.equal(publicResult.frozen_sha256.private_grader,study.private_behavior_grader_sha256);
  assert.equal(publicResult.frozen_sha256.event_helper,study.event_helper_sha256);
  assert.equal(publicResult.frozen_sha256.unchanged_stdio,study.runtime_stdio_sha256);
  assert.deepEqual(publicResult.randomized_run_order,study.run_order);
  assert.equal(publicResult.preregistered_tasks.length,study.tasks.length);
  for(let i=0;i<study.tasks.length;i++){
    const t=study.tasks[i],d=publicResult.preregistered_tasks[i];
    assert.equal(d.id,t.id);
    assert.equal(d.issue,t.issue);
    assert.equal(d.repo,t.repo);
    assert.equal(d.issue_url,t.issue_url);
    assert.equal(d.upstream_revision,t.source_sha);
    assert.equal(d.source_sha256,t.code_file_sha256);
    assert.equal(d.frozen_regression_sha256,t.regression_sha256);
    assert.equal(d.original_hidden_red,t.checkpoint_hidden_passed);
    assert.equal(d.hidden_checks,t.hidden_total);
    assert.equal(d.reference_a_passed,t.reference_a_passed);
    assert.equal(d.reference_b_passed,t.reference_b_passed);
    assert.equal(d.mutant_passed,t.mutant_passed);
    assert.deepEqual(d.arm_order,t.order);
  }
  const expected=study.run_order.flatMap(id=>{
    const task=study.tasks.find(x=>x.id===id);
    assert.ok(task);
    return task.order.map(arm=>id+"|"+arm);
  });
  assert.equal(expected.length,6);
  assert.deepEqual(publicResult.original_rows.map(x=>x.task+"|"+x.arm),expected,
    "All six original arms must be present once in preregistered order");
  for(const row of publicResult.original_rows){
    const task=study.tasks.find(t=>t.id===row.task);
    assert.ok(task&&task.order.includes(row.arm));
    assert.ok(Number.isFinite(row.model_wall_seconds)&&row.model_wall_seconds>=0&&
      row.model_wall_seconds<=task.timeout_seconds+10);
    assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_TIMEOUT",
      "INVALID_POLICY","INVALID_PROTOCOL","INVALID_OTHER"].includes(row.original_status));
    assert.equal(row.accepted,row.original_status==="VALID_CORRECT");
    for(const key of ["original_receipt_sha256","original_jsonl_sha256",
      "original_stderr_sha256"])assert.ok(isSha(row[key]));
    if(row.accepted){
      assert.equal(row.hidden_passed,task.hidden_total);
      assert.equal(row.hidden_total,task.hidden_total);
      assert.equal(row.grader_process_exit_code,0);
      assert.equal(row.grader_process_error,null);
      assert.equal(row.native_tests_exit_code,0);
      assert.ok(row.native_tests_count>=study.environment.test_minimum);
    }
    if(row.model_reported_usage!==null){
      const u=row.model_reported_usage;
      for(const key of ["input_tokens","cached_input_tokens","output_tokens"])
        assert.ok(Number.isSafeInteger(u[key])&&u[key]>=0);
      assert.ok(u.cached_input_tokens<=u.input_tokens);
    }
    assert.ok(Array.isArray(row.original_changed_paths));
    assert.ok(row.original_changed_paths.includes(task.regression_file));
    assert.ok(row.original_changed_paths.every(p=>
      [...task.code_paths,task.regression_file].includes(p)),
      "Unwanted original changed files");
    if(row.accepted)
      assert.ok(task.code_paths.every(p=>row.original_changed_paths.includes(p)),
        "Accepted fix did not modify the scoped source file");
    assert.ok(Array.isArray(row.original_mcp_calls));
    if(row.arm==="baseline")assert.deepEqual(row.original_mcp_calls,[]);
    else if(row.original_status==="VALID_CORRECT"){
      assert.equal(row.original_mcp_calls.length,1);
      const call=row.original_mcp_calls[0];
      assert.deepEqual(
        [call.server,call.tool,call.success,call.before_edit,call.arguments_valid],
        ["godprompt","get_tailored_guidance",true,true,true]);
    }
    const original=ORIGINAL_RECEIPTS[row.task+"|"+row.arm];
    assert.ok(original,"Unknown frozen original identity");
    assert.deepEqual(
      [row.original_status,row.accepted,row.model_wall_seconds,
        row.original_receipt_sha256,row.hidden_passed],
      original,"Original first-run receipt identity was altered");
  }
  assert.equal(Object.keys(ORIGINAL_RECEIPTS).length,6);
  const recomputed={};
  for(const arm of study.arms){
    const rows=publicResult.original_rows.filter(x=>x.arm===arm);
    const accepted=rows.filter(x=>x.accepted).length;
    const seconds=three(rows.reduce((s,x)=>s+x.model_wall_seconds,0));
    const known=rows.reduce((s,x)=>s+(x.model_reported_usage?.input_tokens??0),0);
    const missing=rows.filter(x=>x.model_reported_usage===null).length;
    const calls=rows.reduce((s,x)=>s+x.original_mcp_calls.length,0);
    recomputed[arm]={attempts:rows.length,accepted,
      all_original_seconds:seconds,
      seconds_per_accepted_fix:accepted?three(seconds/accepted):null,
      known_input_tokens:known,missing_usage:missing,actual_mcp_calls:calls};
  }
  assert.deepEqual(publicResult.by_arm,recomputed);
  const b=recomputed.baseline.seconds_per_accepted_fix;
  const g=recomputed.guided_mcp.seconds_per_accepted_fix;
  const ratio=b&&g?Number(((g/b-1)*100).toFixed(2)):null;
  assert.equal(publicResult.comparison.guided_wall_seconds_per_accepted_fix_relative_percent,ratio);
  assert.equal(publicResult.comparison.original_guided_mcp_calls,recomputed.guided_mcp.actual_mcp_calls);
  assert.equal(publicResult.comparison.correct_guided_mcp_calls_required_per_arm,1);
  assert.equal(publicResult.comparison.original_matched_trials_complete,true);
  assert.equal(publicResult.comparison.replicated_productivity_gain_proven,false);
  assert.equal(publicResult.comparison.production_guidance_change,"NO_GO");
  assert.equal(publicResult.evidence_integrity.independent_raw_audit_original_receipts,6);
  assert.equal(publicResult.evidence_integrity.original_session_jsonl_committed,false);
  assert.equal(publicResult.evidence_integrity.original_stderr_committed,false);
  assert.equal(publicResult.evidence_integrity.private_hidden_grader_committed,false);
  assert.equal(publicResult.evidence_integrity.private_calibration_sources_committed,false);
  assert.equal(publicResult.evidence_integrity.independent_blinded_human_adjudication_completed,false);
  assert.ok(publicResult.limitations.length>=5);
  return{
    status:"VERIFIED_V18_SIX_ORIGINAL_MATCHED_ARMS_NO_REPLICATED_CAUSAL_CLAIM",
    original_first_runs:6,
    accepted_by_arm:Object.fromEntries(study.arms.map(x=>[x,recomputed[x].accepted])),
    seconds_per_fix:Object.fromEntries(study.arms.map(x=>
      [x,recomputed[x].seconds_per_accepted_fix])),
    actual_guided_mcp_calls:recomputed.guided_mcp.actual_mcp_calls,
    no_production_change:true
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const raw=readFileSync(join(HERE,"v18-frozen-study-20261123.json"));
  const publicResult=JSON.parse(readFileSync(join(HERE,"v18-public-results-20261123.json")));
  console.log(JSON.stringify(verifyV18Public(JSON.parse(raw),publicResult,raw),null,2));
}
