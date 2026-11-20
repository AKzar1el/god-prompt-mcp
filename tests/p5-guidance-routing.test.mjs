import test from "node:test";
import assert from "node:assert/strict";
import { getTailoredGuidance } from "../dist/tailored-guidance.js";
const types=["BUILD","DEBUG","REFACTOR","CONTENT","DESIGN","SHIP","ANALYZE","AUTOMATE","PLAN"];
const phases=["plan","execute","verify","handoff"];
test("P5 goal-specific tool suggestions are bounded, deterministic and only on first chunk",()=>{
 for(const type of types)for(const phase of phases){
   const first=getTailoredGuidance(type,phase,0,250);
   const repeat=getTailoredGuidance(type,phase,0,250);
   const extra=getTailoredGuidance(type,phase,400,250);
   assert.deepEqual(first,repeat);
   assert.ok(first.suggested_tools.length>=1&&first.suggested_tools.length<=3);
   assert.equal(new Set(first.suggested_tools).size,first.suggested_tools.length);
   assert.ok(first.tool_selection_rule.includes("Only"));
   assert.deepEqual(extra.suggested_tools,[]);
   assert.equal(extra.tool_selection_rule,null);
 }
});
test("P5 routing privileges no tool calls and never assumes source evidence",()=>{
 const ship=getTailoredGuidance("SHIP","verify",0,300);
 assert.deepEqual(ship.suggested_tools,["assess_release_readiness","review_work_evidence"]);
 assert.match(ship.tool_selection_rule,/caller supplies/);
 assert.match(ship.warning,/did not inspect/);
});
