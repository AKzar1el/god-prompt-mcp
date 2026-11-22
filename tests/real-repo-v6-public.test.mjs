import assert from "node:assert/strict";
import { test } from "node:test";
import {
 loadPublicV6,summariseV6,
} from "../benchmarks/agent-ab/real-repos/v6-verify-public.mjs";

const copy=x=>structuredClone(x);
const {suite,results}=loadPublicV6();
test("V6 public frozen source and visible test hashes are intact",()=>{
 const s=summariseV6(suite,results);
 assert.equal(s.frozen_task_count,10);
 assert.equal(s.completed_arm_count,30);
});
test("V6 first-party 30-arm statuses are complete, including real negatives",()=>{
 const s=summariseV6(suite,results);
 assert.deepEqual(Object.fromEntries(Object.entries(s.byArm).map(
  ([k,v])=>[k,[v.accepted,v.validIncorrect,v.invalid]]
 )),{
  baseline:[9,0,1],
  preinjected:[9,1,0],
  live_mcp:[8,1,1],
 });
 assert.equal(results.outcome_tally.valid_correct,26);
 assert.equal(results.outcome_tally.valid_incorrect,2);
 assert.equal(results.outcome_tally.invalid,2);
 assert.equal(results.records.find(x=>x.task_id==="auditor-path-ignore"&&
   x.arm==="baseline").elapsed_seconds,null);
});
test("V6 conditional matched arithmetic and no-exaggeration conditions",()=>{
 const s=summariseV6(suite,results);
 assert.equal(s.comparisons.preinjected.pairs,9);
 assert.equal(s.comparisons.live_mcp.pairs,8);
 assert.equal(s.comparisons.preinjected.wins,3);
 assert.equal(s.comparisons.live_mcp.wins,3);
 assert.ok(s.comparisons.preinjected.aggregate_percent_delta>10);
 assert.ok(s.comparisons.live_mcp.aggregate_percent_delta>15);
 assert.ok(s.comparisons.preinjected.sign_test_p>0.05);
 assert.ok(s.comparisons.live_mcp.sign_test_p>0.05);
});
test("V6 verifier rejects altered source, inflated correctness or duplicates",()=>{
 const a=copy(suite);
 a.tasks[0].source_code+="\n// tampered";
 assert.throws(()=>summariseV6(a,results),/Public source changed/);
 const b=copy(results);
 b.records[0].status="VALID_CORRECT";
 b.records[0].hidden_passed=0;
 assert.throws(()=>summariseV6(suite,b),/Expected values to be strictly equal/);
 const c=copy(results);
 c.records[1].task_id=c.records[0].task_id;
 c.records[1].arm=c.records[0].arm;
 assert.throws(()=>summariseV6(suite,c),/Duplicate result/);
});
test("V6 public data never embeds private hidden cases or raw model transcripts",()=>{
 for(const t of suite.tasks){
  assert.equal("hidden_checks" in t,false);
  assert.equal("grader_source" in t,false);
  assert.equal("raw_transcript" in t,false);
  assert.match(t.note,/Locally synthesized seeded defect/);
 }
 for(const r of results.records){
  assert.equal("raw_transcript" in r,false);
  assert.equal("hidden_failure_details" in r,false);
  assert.equal("tool_stdout" in r,false);
 }
});
