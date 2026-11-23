import test from "node:test";
import assert from "node:assert/strict";
import {loadV7,verifyV7Public} from "../benchmarks/agent-ab/real-repos/v7-verify-public.mjs";
const {suite,results}=loadV7();
test("V7 all three frozen sources and visible tests retain pinned hashes",()=>{
 const o=verifyV7Public(suite,results);
 assert.equal(o.task_count,3);
 assert.equal(o.arms,9);
});
test("V7 strict results retain timeout as invalid even though code passes",()=>{
 const o=verifyV7Public(suite,results);
 assert.deepEqual(o.byArm,{
  baseline:{correct:3,incorrect:0,invalid:0},
  live_full:{correct:3,incorrect:0,invalid:0},
  live_compact:{correct:2,incorrect:0,invalid:1},
 });
 assert.equal(o.compact_vs_full.n,2);
 assert.equal(o.compact_vs_full.compact_faster,1);
});
test("V7 public reviewer rejects source mutations and invented success",()=>{
 const s=structuredClone(suite);
 s.tasks[0].source_code+="\n// changed";
 assert.throws(()=>verifyV7Public(s,results),{name:"AssertionError"});
 const r=structuredClone(results);
 const invalid=r.records.find(x=>x.status==="INVALID");
 invalid.status="VALID_CORRECT";
 assert.throws(()=>verifyV7Public(suite,r),{name:"AssertionError"});
});
test("V7 public reviewer rejects forged elapsed comparisons",()=>{
 const r=structuredClone(results);
 r.comparison.live_full_vs_live_compact.aggregate_percent_delta=42;
 assert.throws(()=>verifyV7Public(suite,r),{name:"AssertionError"});
});
test("V7 data exposes no private hidden grader implementation or model transcript",()=>{
 for(const t of suite.tasks){
  assert.equal("grader_source" in t,false);
  assert.equal("hidden_cases" in t,false);
  assert.equal("raw_transcript" in t,false);
 }
 for(const row of results.records){
  assert.equal("model_stdout" in row,false);
  assert.equal("hidden_failure_details" in row,false);
  assert.match(row.original_transcript_sha256,/^[0-9a-f]{64}$/u);
 }
});
