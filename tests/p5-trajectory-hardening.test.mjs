import test from "node:test";
import assert from "node:assert/strict";
import { auditAgentTrajectory,TrajectoryInputSchema,TrajectoryOutputSchema } from "../dist/agent-trajectory.js";
test("P5 trajectory flags redundant unchanged reads once without echoing fingerprints",()=>{
 const events=Array.from({length:6},(_,i)=>({id:"r"+i,kind:"tool_result",operation:"read",
  tool:"filesystem-read",status:"ok",fingerprint:"secret_fp_123"}));
 const r=auditAgentTrajectory(events);
 assert.equal(r.findings.filter(x=>x.code==="REPEATED_UNCHANGED_READ").length,1);
 assert.equal(r.completion_authorized,false);
 assert.doesNotMatch(JSON.stringify(r),/secret_fp_123/);
 assert.equal(TrajectoryOutputSchema.safeParse(r).success,true);
 const reset=auditAgentTrajectory([...events.slice(0,3),{id:"decision",kind:"decision"},...events.slice(3)]);
 assert.equal(reset.findings.some(x=>x.code==="REPEATED_UNCHANGED_READ"),false);
});
test("P5 trajectory treats failed final verification as blocker",()=>{
 const r=auditAgentTrajectory([
  {id:"w",kind:"tool_result",operation:"write",status:"ok"},
  {id:"v1",kind:"verification",status:"ok"},
  {id:"v2",kind:"verification",status:"failed"},
  {id:"done",kind:"completion"},
 ]);
 assert.ok(r.findings.some(x=>x.code==="FAILED_FINAL_VERIFICATION"));
 assert.ok(r.findings.some(x=>x.code==="PREMATURE_COMPLETION"));
 assert.equal(r.independently_verified,false);
});
test("P5 trajectory signals excessive edits and reported token budget without executing tools",()=>{
 const events=Array.from({length:12},(_,i)=>({id:"w"+i,kind:"tool_result",operation:"write",status:"ok",tokens:150}));
 const input=TrajectoryInputSchema.parse({events,budget_tokens:1000});
 const r=auditAgentTrajectory(input.events,input.budget_tokens);
 assert.equal(r.reported_tokens,1800);
 assert.equal(r.token_budget,1000);
 assert.ok(r.findings.some(x=>x.code==="LONG_UNCHECKED_WRITE_STREAK"));
 assert.ok(r.findings.some(x=>x.code==="TOKEN_BUDGET_EXCEEDED_REPORTED"));
 assert.equal(TrajectoryOutputSchema.safeParse(r).success,true);
 assert.equal(TrajectoryInputSchema.safeParse({events,budget_tokens:-5}).success,false);
});
