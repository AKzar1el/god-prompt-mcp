import test from "node:test";
import assert from "node:assert/strict";
import { getTailoredGuidance } from "../dist/tailored-guidance.js";

const types = ["BUILD","DEBUG","REFACTOR","CONTENT","DESIGN","SHIP","ANALYZE","AUTOMATE","PLAN"];
const phases = ["plan","execute","verify","handoff"];

test("compact guidance is opt-in, bounded and task-specific for all 36 routes",()=>{
 const seen=new Set();
 for(const type of types)for(const phase of phases){
  const item=getTailoredGuidance(type,phase,0,600,true);
  assert.equal(item.compact,true);
  assert.equal(item.task_type,type);
  assert.equal(item.phase,phase);
  assert.ok(item.content.includes(type),type+"/"+phase+" missing task identity");
  assert.ok(item.content.includes(phase),type+"/"+phase+" missing phase identity");
  assert.ok(item.content.length>=90&&item.content.length<=600,type+"/"+phase+" response must be concise");
  assert.equal(item.truncated,false,type+"/"+phase+" should fit in one call");
  assert.equal(item.next_start,null);
  assert.match(item.warning,/did not run|not verified|no checks/i);
  seen.add(item.content);
 }
 assert.equal(seen.size,36,"each route/phase must have distinct meaningful guidance");
});
test("full legacy guidance remains byte-identical when compact is omitted or false",()=>{
 for(const type of types)for(const phase of phases){
  assert.deepEqual(
   getTailoredGuidance(type,phase,0,1800),
   getTailoredGuidance(type,phase,0,1800,false)
  );
 }
});
test("compact DEBUG requires root cause, scope and real verification receipts",()=>{
 const ex=getTailoredGuidance("DEBUG","execute",0,600,true);
 assert.match(ex.content,/reproduc|root cause|failing test/i);
 assert.match(ex.content,/scop|allowed|boundar/i);
 assert.deepEqual(ex.recommended_next_call,{
  tool:"get_tailored_guidance",
  arguments:{task_type:"DEBUG",phase:"verify",max_chars:600,compact:true},
 });
 const check=getTailoredGuidance("DEBUG","verify",0,600,true);
 assert.match(check.content,/test/i);
 assert.match(check.content,/exit|evidence|output/i);
 assert.match(check.content,/diff|changed files|scope/i);
 assert.equal(check.guidance_is_verification,false);
});
test("compact SHIP/automation gates never authorize external effects",()=>{
 for(const type of ["SHIP","AUTOMATE"]){
  const e=getTailoredGuidance(type,"execute",0,600,true);
  assert.match(e.content,/approv|authoriz|permission/i);
  assert.match(e.content,/deploy|send|trigger|publish|external/i);
  const v=getTailoredGuidance(type,"verify",0,600,true);
  assert.match(v.content,/test|check|evidence|receipt/i);
 }
});
test("compact response length materially reduces predictable model context",()=>{
 let full=0,compact=0;
 for(const type of types){
  const e=getTailoredGuidance(type,"execute",0,1800);
  const v=getTailoredGuidance(type,"verify",0,1800);
  full+=Buffer.byteLength(JSON.stringify(e))+Buffer.byteLength(JSON.stringify(v));
  const ce=getTailoredGuidance(type,"execute",0,600,true);
  const cv=getTailoredGuidance(type,"verify",0,600,true);
  compact+=Buffer.byteLength(JSON.stringify(ce))+Buffer.byteLength(JSON.stringify(cv));
 }
 assert.ok(compact/full<0.55,"compact "+compact+"B vs full "+full+"B isn't sufficient reduction");
});
