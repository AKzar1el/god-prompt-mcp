#!/usr/bin/env node
/** Public deterministic verifier for the three-task V7 compact/full pilot.
 * Private original model transcripts and hidden grader implementations remain
 * local and are NOT independently reproduced by this public arithmetic check.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const dir=dirname(fileURLToPath(import.meta.url));
const hash=x=>createHash("sha256").update(x).digest("hex");
const expectedArms=["baseline","live_full","live_compact"];
const sum=(r,k)=>r.reduce((s,x)=>s+(x[k]??0),0);

export function loadV7(){
 return {
  suite:JSON.parse(readFileSync(join(dir,"v7-compact-guidance-suite-20261123.json"),"utf8")),
  results:JSON.parse(readFileSync(join(dir,"v7-compact-guidance-results-20261123.json"),"utf8")),
 };
}

export function verifyV7Public(suite,results){
 assert.equal(suite.schema,"godprompt.v7.public-fresh-seeded-suite.v1");
 assert.equal(results.schema,"godprompt.v7.public-optin-compact-results.v1");
 assert.equal(suite.frozen_manifest_sha256,results.frozen_manifest_sha256);
 assert.equal(suite.task_count,3);
 assert.equal(suite.tasks.length,3);
 assert.equal(results.records.length,9);
 assert.deepEqual([...suite.arms].sort(),[...expectedArms].sort());
 const map=new Map();
 for(const t of suite.tasks){
  assert.ok(!map.has(t.task_id),"Duplicate task");
  assert.match(t.source_sha,/^[0-9a-f]{40}$/u);
  assert.match(t.private_grader_sha256,/^[0-9a-f]{64}$/u);
  assert.equal(hash(t.source_code),t.source_file_sha256);
  assert.equal(hash(t.visible_test_source),t.visible_test_sha256);
  assert.ok(t.initial_hidden.passed<t.initial_hidden.total);
  assert.deepEqual([...t.frozen_arm_order].sort(),[...expectedArms].sort());
  map.set(t.task_id,t);
 }
 const records=new Map();
 for(const row of results.records){
  const t=map.get(row.task_id);
  assert.ok(t,"Unknown task");
  assert.ok(expectedArms.includes(row.arm),"Unknown treatment");
  assert.equal(row.frozen_source_sha,t.source_sha);
  assert.match(row.original_transcript_sha256,/^[0-9a-f]{64}$/u);
  const key=row.task_id+"/"+row.arm;
  assert.ok(!records.has(key),"Duplicate model arm");
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID"].includes(row.status));
  if(row.status==="VALID_CORRECT"){
   assert.equal(row.hidden_passed,row.hidden_total);
   assert.equal(row.independently_checked_code_correct,true);
   assert.equal(row.protocol_valid,true);
  }
  if(row.status==="VALID_INCORRECT")
   assert.ok(row.hidden_passed<row.hidden_total);
  assert.ok(row.elapsed_seconds>0);
  records.set(key,row);
 }
 for(const id of map.keys())
  for(const arm of expectedArms)assert.ok(records.has(id+"/"+arm));
 const byArm={};
 for(const arm of expectedArms){
  const items=results.records.filter(x=>x.arm===arm);
  const correct=items.filter(x=>x.status==="VALID_CORRECT").length;
  const incorrect=items.filter(x=>x.status==="VALID_INCORRECT").length;
  const invalid=items.filter(x=>x.status==="INVALID").length;
  assert.equal(items.length,3);
  assert.deepEqual(results.count.by_arm[arm],{
   correct,valid_incorrect:incorrect,invalid});
  byArm[arm]={correct,incorrect,invalid};
 }
 assert.equal(sum(Object.values(byArm),"correct"),results.count.valid_correct);
 assert.equal(sum(Object.values(byArm),"incorrect"),results.count.valid_incorrect);
 assert.equal(sum(Object.values(byArm),"invalid"),results.count.invalid);
 assert.equal(results.count.first_run_receipts,9);
 assert.equal(results.count.not_run,0);
 const observed={};
 for(const treatment of ["live_full","live_compact"]){
  const pairs=suite.tasks.flatMap(t=>{
   const b=records.get(t.task_id+"/baseline");
   const r=records.get(t.task_id+"/"+treatment);
   return b.status==="VALID_CORRECT"&&r.status==="VALID_CORRECT"?
    [{task:t.task_id,baseline_time:b.elapsed_seconds,
      treatment_time:r.elapsed_seconds}]:[];
  });
  const pub=results.comparison.vs_baseline[treatment];
  const bt=sum(pairs,"baseline_time"),tt=sum(pairs,"treatment_time");
  assert.equal(pub.paired_correct,pairs.length);
  assert.equal(pub.wins,pairs.filter(x=>x.treatment_time<x.baseline_time).length);
  assert.ok(Math.abs(pub.aggregate_percent_delta-100*(tt/bt-1))<1e-8);
  observed[treatment]={correct_pairs:pairs.length,aggregate_percent_delta:pub.aggregate_percent_delta};
 }
 const both=suite.tasks.flatMap(t=>{
  const f=records.get(t.task_id+"/live_full");
  const c=records.get(t.task_id+"/live_compact");
  return f.status==="VALID_CORRECT"&&c.status==="VALID_CORRECT"?
   [{task:t.task_id,full_seconds:f.elapsed_seconds,
     compact_seconds:c.elapsed_seconds,
     full_input:f.reported_input_tokens,
     compact_input:c.reported_input_tokens}]:[];
 });
 const pr=results.comparison.live_full_vs_live_compact;
 assert.equal(pr.n,both.length);
 assert.equal(pr.compact_faster,both.filter(x=>x.compact_seconds<x.full_seconds).length);
 assert.equal(pr.full_faster,both.filter(x=>x.full_seconds<x.compact_seconds).length);
 assert.ok(Math.abs(pr.aggregate_percent_delta-
   100*(sum(both,"compact_seconds")/sum(both,"full_seconds")-1))<1e-8);
 assert.ok(Math.abs(pr.input_token_percent_delta-
   100*(sum(both,"compact_input")/sum(both,"full_input")-1))<1e-8);
 assert.equal(results.records.find(x=>x.task_id==="safe-repo-relative-path"&&
   x.arm==="live_compact").status,"INVALID");
 assert.equal(results.records.find(x=>x.task_id==="safe-repo-relative-path"&&
   x.arm==="live_compact").hidden_passed,32);
 const bytes=results.measured_payload_bytes;
 for(const type of ["DEBUG","BUILD","REFACTOR","CONTENT","DESIGN","SHIP","ANALYZE","AUTOMATE","PLAN"]){
  assert.ok(bytes[type].compact_json_bytes<bytes[type].full_json_bytes);
  assert.ok(bytes[type].reduction_percent>=45&&bytes[type].reduction_percent<=75);
 }
 return {task_count:map.size,arms:records.size,byArm,
  paired:observed,compact_vs_full:pr,
  debug_payload_reduction_percent:bytes.DEBUG.reduction_percent,
  interpretation:"One invalid timed-out compact arm; no statistically supported general coding productivity uplift."};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {suite,results}=loadV7();
 console.log(JSON.stringify(verifyV7Public(suite,results),null,2));
}
