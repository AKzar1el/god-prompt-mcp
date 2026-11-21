import test from "node:test";
import assert from "node:assert/strict";
import { auditAgentTrajectory, TrajectoryOutputSchema } from "../dist/agent-trajectory.js";
import { traceChangeImpact, ImpactSchema, ImpactOutputSchema } from "../dist/change-impact.js";
import { reviewMcpToolContracts, McpContractOutputSchema } from "../dist/mcp-contract-audit.js";
import { auditAgentInstructions, InstructionAuditOutputSchema } from "../dist/instruction-audit.js";
import { designAdversarialTests, AdversarialPlanSchema, AdversarialOutputSchema } from "../dist/adversarial-planning.js";

test("P4 output schemas validate every tool result, reject fake verification metadata",()=>{
  const inputs=[
    [TrajectoryOutputSchema,auditAgentTrajectory([{id:"event",kind:"decision"}])],
    [ImpactOutputSchema,traceChangeImpact(ImpactSchema.parse({changed_files:["src/api.ts"]}))],
    [McpContractOutputSchema,reviewMcpToolContracts([{name:"inspect_input",description:"Performs read-only diagnostic inspection."}])],
    [InstructionAuditOutputSchema,auditAgentInstructions([{source_id:"task",priority:"task",text:"Never publish secrets without approval."}])],
    [AdversarialOutputSchema,designAdversarialTests(AdversarialPlanSchema.parse({fields:[{id:"age",type:"number",min:0,max:99}]}).fields,20)]
  ];
  for(const [schema,result] of inputs){
    assert.equal(schema.safeParse(result).success,true,JSON.stringify(result));
    assert.equal(schema.safeParse({...result,independently_verified:true}).success,false);
    assert.equal(schema.safeParse({...result,unexpected_property:"hidden"}).success,false);
  }
});
