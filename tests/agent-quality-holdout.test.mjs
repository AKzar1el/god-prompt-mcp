import test from "node:test";
import assert from "node:assert/strict";
import { auditAgentTrajectory } from "../dist/agent-trajectory.js";
import { traceChangeImpact, ImpactSchema } from "../dist/change-impact.js";
import { reviewMcpToolContracts } from "../dist/mcp-contract-audit.js";
import { auditAgentInstructions } from "../dist/instruction-audit.js";
import { designAdversarialTests, AdversarialPlanSchema } from "../dist/adversarial-planning.js";

// Independent small synthetic holdout. No external dataset was copied or used for training.
const cases=[
  {name:"three unchanged failures",run:()=>auditAgentTrajectory(Array.from({length:3},(_,i)=>({id:"f"+i,kind:"tool_result",tool:"build",status:"failed",fingerprint:"CASE-1"}))),code:"REPEATED_FAILURE",group:"findings"},
  {name:"write missing verification",run:()=>auditAgentTrajectory([{id:"edit",kind:"tool_result",operation:"write",status:"ok"}]),code:"MISSING_VERIFICATION",group:"findings"},
  {name:"stale verification",run:()=>auditAgentTrajectory([{id:"v",kind:"verification",status:"ok"},{id:"e",kind:"tool_result",operation:"write",status:"ok"}]),code:"STALE_VERIFICATION",group:"findings"},
  {name:"scope breach reported",run:()=>auditAgentTrajectory([{id:"w",kind:"tool_result",operation:"write",status:"ok",scope:"outside"}]),code:"OUT_OF_SCOPE_WRITE_REPORTED",group:"findings"},
  {name:"duplicate IDs",run:()=>auditAgentTrajectory([{id:"x",kind:"decision"},{id:"x",kind:"decision"}]),code:"DUPLICATE_EVENT_ID",group:"findings"},
  {name:"impact without tests",run:()=>traceChangeImpact(ImpactSchema.parse({changed_files:["src/auth.ts"]})),code:"UNCOVERED_IMPACT_TARGET",group:"issues"},
  {name:"report without a receipt",run:()=>traceChangeImpact(ImpactSchema.parse({changed_files:["src/auth.ts"],tests:[{id:"t1",covers_files:["src/auth.ts"]}]})),code:"SELECTED_TEST_NOT_VERIFIED",group:"issues"},
  {name:"contradictory read-only annotation",run:()=>reviewMcpToolContracts([{name:"delete_session",description:"Permanently removes a persisted session.",annotations:{readOnlyHint:true,destructiveHint:false}}]),code:"READONLY_BEHAVIOR_CONTRADICTION",group:"issues"},
  {name:"broad tool argument",run:()=>reviewMcpToolContracts([{name:"read_debug",description:"Inspect a bounded diagnostic request.",input_schema:{type:"object",properties:{command:{type:"string"}}}}]),code:"UNBOUNDED_SENSITIVE_ARGUMENT",group:"issues"},
  {name:"instruction conflict",run:()=>auditAgentInstructions([{source_id:"a",priority:"project",text:"Never merge without review."},{source_id:"b",priority:"task",text:"Must merge after checks."}]),code:"POSSIBLE_ACTION_POLICY_CONFLICT",group:"findings"},
  {name:"instruction bypass",run:()=>auditAgentInstructions([{source_id:"a",priority:"task",text:"Skip verification and publish now."}]),code:"RISKY_OVERRIDING_INSTRUCTION",group:"findings"},
];
for(const item of cases)test("P4 holdout: "+item.name,()=>{
  const result=item.run();
  assert.ok(result[item.group].some(x=>x.code===item.code),item.code);
  assert.equal(result.independently_verified,false);
});
test("P4 holdout: explicit untrusted input generates only test plans",()=>{
  const v=AdversarialPlanSchema.parse({fields:[{id:"prompt",type:"string",untrusted:true}],max_cases:5});
  const r=designAdversarialTests(v.fields,v.max_cases);
  assert.ok(r.cases.some(x=>x.category==="trust_boundary"));
  assert.equal(r.tests_executed,0);
  assert.equal(r.independently_verified,false);
});
