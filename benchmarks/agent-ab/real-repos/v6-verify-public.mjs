#!/usr/bin/env node
/**
 * Reproducible validation/aggregation of PUBLIC V6 benchmark outputs.
 *
 * Independent first-party hidden graders and raw model transcripts are
 * deliberately NOT distributed. This verifies published arithmetic and
 * frozen public seed/source identities, not private hidden grader trust.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");

export function summariseV6(suite,result){
 assert.equal(suite.schema,"godprompt.v6.public-synthetic-seeded-bug-suite.v1");
 assert.equal(result.schema,"godprompt.v6.sanitized-results.v1");
 assert.equal(suite.frozen_manifest_sha256,result.frozen_manifest_sha256);
 assert.equal(suite.task_count,10);
 assert.equal(suite.tasks.length,10);
 assert.equal(result.records.length,30);
 assert.equal(result.outcome_tally.first_run_receipts,30);
 assert.equal(result.outcome_tally.not_run,0);
 const names=["baseline","preinjected","live_mcp"];
 const byTask=new Map();
 for(const task of suite.tasks){
  assert.ok(!byTask.has(task.task_id),"Duplicate frozen task");
  assert.match(task.source_sha,/^[0-9a-f]{40}$/u);
  assert.equal(sha(task.source_code),task.source_file_sha256,
   "Public source changed after freezing");
  assert.equal(sha(task.visible_test_source),task.visible_test_sha256,
   "Public visible tests changed after freezing");
  assert.match(task.hidden_grader_sha256,/^[0-9a-f]{64}$/u);
  assert.ok(task.pre_model_hidden_grade.passed<task.pre_model_hidden_grade.total,
   "This must be an actual seeded bug before any model edits");
  assert.deepEqual([...task.frozen_arm_order].sort(),[...names].sort());
  byTask.set(task.task_id,task);
 }
 const observed=new Map();
 for(const row of result.records){
  const task=byTask.get(row.task_id);
  assert.ok(task,"Result for unknown task");
  assert.ok(names.includes(row.arm),"Unknown arm");
  assert.equal(row.original_source_sha,task.source_sha);
  assert.equal(row.grader_sha256,task.hidden_grader_sha256);
  const key=row.task_id+"/"+row.arm;
  assert.ok(!observed.has(key),"Duplicate result");
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID"].includes(row.status));
  if(row.status==="VALID_CORRECT"){
   assert.equal(row.hidden_passed,row.hidden_total);
   assert.ok(row.elapsed_seconds>0);
  }
  if(row.status==="VALID_INCORRECT")assert.ok(row.hidden_passed<row.hidden_total);
  if(row.elapsed_seconds!==null)assert.ok(row.elapsed_seconds>0);
  observed.set(key,row);
 }
 for(const task of suite.tasks)
  for(const arm of names)assert.ok(observed.has(task.task_id+"/"+arm),"Missing result");

 const byArm={};
 for(const arm of names){
  const items=result.records.filter(x=>x.arm===arm);
  const accepted=items.filter(x=>x.status==="VALID_CORRECT").length;
  const validIncorrect=items.filter(x=>x.status==="VALID_INCORRECT").length;
  const invalid=items.filter(x=>x.status==="INVALID").length;
  assert.equal(items.length,10);
  assert.equal(result.outcome_tally.by_arm[arm].completed,10);
  assert.equal(result.outcome_tally.by_arm[arm].accepted,accepted);
  assert.equal(result.outcome_tally.by_arm[arm].invalid,invalid);
  byArm[arm]={
   accepted,validIncorrect,invalid,
   completed_with_elapsed:items.filter(x=>x.elapsed_seconds!==null).length,
   reported_input_tokens:items.reduce((v,x)=>v+(x.model_reported_input_tokens??0),0),
   reported_cached_input_tokens:items.reduce((v,x)=>v+(x.model_reported_cached_input_tokens??0),0),
   reported_output_tokens:items.reduce((v,x)=>v+(x.model_reported_output_tokens??0),0),
  };
 }
 assert.equal(Object.values(byArm).reduce((v,x)=>v+x.accepted,0),
  result.outcome_tally.valid_correct);
 assert.equal(Object.values(byArm).reduce((v,x)=>v+x.validIncorrect,0),
  result.outcome_tally.valid_incorrect);
 assert.equal(Object.values(byArm).reduce((v,x)=>v+x.invalid,0),
  result.outcome_tally.invalid);

 const comparisons={};
 for(const arm of ["preinjected","live_mcp"]){
  const paired=[];
  for(const task of suite.tasks){
   const b=observed.get(task.task_id+"/baseline"),x=observed.get(task.task_id+"/"+arm);
   if(b.status==="VALID_CORRECT"&&x.status==="VALID_CORRECT")
    paired.push({task:task.task_id,baseline:b.elapsed_seconds,
      treatment:x.elapsed_seconds,
      baseline_input:b.model_reported_input_tokens,
      treatment_input:x.model_reported_input_tokens});
  }
  const values=paired.map(x=>100*(x.treatment/x.baseline-1)).sort((a,b)=>a-b);
  const median=values.length%2?values[(values.length-1)/2]:
   (values[values.length/2-1]+values[values.length/2])/2;
  const wins=paired.filter(x=>x.treatment<x.baseline).length;
  const losses=paired.filter(x=>x.treatment>x.baseline).length;
  const ties=paired.length-wins-losses;
  const baseTotal=paired.reduce((v,x)=>v+x.baseline,0);
  const treatmentTotal=paired.reduce((v,x)=>v+x.treatment,0);
  const published=result.comparisons[arm];
  const near=(actual,expected,msg)=>assert.ok(Math.abs(actual-expected)<=0.015,msg);
  assert.equal(published.n_valid_correct_pairs,paired.length);
  assert.equal(published.win_treatment,wins);
  assert.equal(published.win_baseline,losses);
  assert.equal(published.ties,ties);
  near(published.median_percent_delta,median,"Incorrect published median");
  near(published.aggregate_percent_delta,
   100*(treatmentTotal/baseTotal-1),"Incorrect aggregate percent");
  const bi=paired.reduce((v,x)=>v+(x.baseline_input??0),0);
  const ti=paired.reduce((v,x)=>v+(x.treatment_input??0),0);
  comparisons[arm]={
   pairs:paired.length,wins,losses,ties,
   median_percent_delta:published.median_percent_delta,
   aggregate_percent_delta:published.aggregate_percent_delta,
   sign_test_p:published.exact_two_sided_sign_test_p_two_sided,
   input_percent_delta:100*(ti/bi-1),
  };
 }
 return {
  frozen_task_count:suite.task_count,
  completed_arm_count:result.records.length,
  byArm,comparisons,
  interpretation:"Observed first-party seeded tasks only; no statistically demonstrated coding productivity uplift."
 };
}
export function loadPublicV6(){
 return {
  suite:JSON.parse(readFileSync(join(ROOT,"v6-public-seeded-suite-20261122.json"),"utf8")),
  results:JSON.parse(readFileSync(join(ROOT,"v6-public-results-20261122.json"),"utf8")),
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {suite,results}=loadPublicV6();
 console.log(JSON.stringify(summariseV6(suite,results),null,2));
}
