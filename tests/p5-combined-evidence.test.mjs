import test from "node:test";
import assert from "node:assert/strict";
import { createWorkContract } from "../dist/work-contract.js";
import { combinedEvidence } from "../bin/godprompt-proof.mjs";

const SHA="a".repeat(40);
async function fixture(){
 const contract=(await createWorkContract({
   task:"Repair the parser and verify the targeted regression test",
   task_type:"DEBUG",risk_level:"medium",allowed_paths:["src/","tests/"],
   forbidden_actions:["deploy"],success_criteria:["Malformed values are rejected"],
   verification_commands:["npm test"],
 })).contract;
 const snapshot={complete:true,commit:{sha:SHA,files:[{filename:"src/parser.ts",status:"modified"}]},
   check_runs:{total_count:1,check_runs:[{id:2,name:"verify (22)",head_sha:SHA,status:"completed",conclusion:"success"}]}};
 const exportData={changed_files:["tests/parser.test.ts"],checks:[{
   id:"VC-01",command:"npm test",tool:"mcp__God_v5__exec_command",
   response:{upstream_result:{exit_code:0,output:"secret_canary_should_not_echo"}}
 }]};
 return {contract,snapshot,exportData};
}
test("P5 combined local collector reuses pinned GitHub/CodeXify receipts without claim of authorization",async()=>{
 const v=await fixture();
 const result=await combinedEvidence({repo:"AKzar1el/sample",sha:SHA,
   mapping:{"VC-01":"verify (22)"},...v});
 assert.equal(result.adapter,"combined_github_codexify");
 assert.equal(result.observed_sources,2);
 assert.deepEqual(result.review_input.changed_files,["src/parser.ts","tests/parser.test.ts"]);
 assert.equal(result.review_input.checks[0].exit_code,0);
 assert.equal(result.independently_verified,false);
 assert.equal(result.completion_authorized,false);
 assert.ok(result.gaps.includes("github:ACCEPTANCE_REQUIRES_INDEPENDENT_EVIDENCE"));
 assert.doesNotMatch(JSON.stringify(result),/secret_canary_should_not_echo/);
});
test("P5 combined local collector invalidates contradictory host evidence",async()=>{
 const v=await fixture();
 v.exportData.checks[0].response.upstream_result.exit_code=1;
 const r=await combinedEvidence({repo:"AKzar1el/sample",sha:SHA,
   mapping:{"VC-01":"verify (22)"},...v});
 assert.equal(r.receipt_conflicts,1);
 assert.equal(r.review_input.checks[0].exit_code,null);
 assert.equal(r.review_input.checks[0].source,"self_report");
 assert.ok(r.gaps.includes("CHECK_EVIDENCE_CONFLICT:VC-01"));
});
test("P5 combined collector detects incomplete and inconsistent inputs without network",async()=>{
 const v=await fixture();
 v.snapshot.commit.sha="b".repeat(40);
 await assert.rejects(()=>combinedEvidence({repo:"AKzar1el/sample",sha:SHA,
   mapping:{"VC-01":"verify (22)"},...v}),/SHA/);
 const w=await fixture();
 w.exportData.checks[0].command="npm run deploy";
 const r=await combinedEvidence({repo:"AKzar1el/sample",sha:SHA,
   mapping:{"VC-01":"verify (22)"},...w});
 assert.equal(r.receipt_conflicts,1);
 assert.equal(r.review_input.checks[0].exit_code,null);
});
