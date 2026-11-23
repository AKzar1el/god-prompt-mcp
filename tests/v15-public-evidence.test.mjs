import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyV15Public } from
  "../benchmarks/agent-ab/real-repos/v15-verify-public.mjs";
const dir=new URL("../benchmarks/agent-ab/real-repos/",import.meta.url);
const studyBytes=readFileSync(new URL("v15-frozen-study-20261123.json",dir));
const study=JSON.parse(studyBytes);
const data=JSON.parse(readFileSync(new URL("v15-public-results-20261123.json",dir)));
const validate=(s=study,d=data,b=studyBytes)=>verifyV15Public(s,d,b);
const cloned=()=>structuredClone(data);
const timeout=(d)=>d.rows.find(x=>x.arm==="verify_once_mcp"&&x.issue===408);

test("V15 preserves six original first runs and the true failed-arm denominator",()=>{
  const report=validate();
  assert.equal(report.status,"VERIFIED_V15_SIX_ORIGINAL_ARMS_NO_REPLICABLE_GAIN");
  assert.deepEqual(report.accepted_by_arm,
    {baseline:2,full_mcp:2,verify_once_mcp:1});
  assert.equal(report.seconds_per_accepted_fix.verify_once_mcp,712.93);
});
test("V15 original Windows CRLF digest survives Git LF normalization",()=>{
  const lf=Buffer.from(studyBytes.toString("utf8").replace(/\r\n/gu,"\n"),"utf8");
  assert.equal(validate(study,data,lf).first_runs,6);
});
test("V15 refuses edited frozen manifest",()=>{
  const s=structuredClone(study);s.source_sha="0".repeat(40);
  assert.throws(()=>validate(s,data,Buffer.from(JSON.stringify(s))),/equal/i);
});
test("V15 never promotes timed-out code to a completed accepted agent run",()=>{
  const d=cloned();timeout(d).accepted=true;
  assert.throws(()=>validate(study,d),/false/);
  const d2=cloned();timeout(d2).original_status="VALID_CORRECT";
  assert.throws(()=>validate(study,d2),/equal/i);
});
test("V15 missing model telemetry stays unknown, never zero",()=>{
  const d=cloned();timeout(d).reported_input_tokens=0;
  assert.throws(()=>validate(study,d),/null/);
  const d2=cloned();d2.by_arm.verify_once_mcp.missing_input_token_attempts=0;
  assert.throws(()=>validate(study,d2),/equal/i);
});
test("V15 disallows fabricated slots or hidden passes",()=>{
  const d=cloned();d.rows.pop();
  assert.throws(()=>validate(study,d),/equal/i);
  const d2=cloned();d2.rows[0].hidden_passed=18;
  assert.throws(()=>validate(study,d2),/equal/i);
});
test("V15 checks real tool invocation and scoped source paths",()=>{
  const d=cloned();d.rows[2].mcp_calls=[];
  assert.throws(()=>validate(study,d),/falsy|equal/i);
  const d2=cloned();d2.rows[0].changed_paths[0]="other/private.yml";
  assert.throws(()=>validate(study,d2),/equal/i);
});
test("V15 rejects invented efficiency and production effects",()=>{
  const d=cloned();d.by_arm.full_mcp.seconds_per_accepted_fix=100;
  assert.throws(()=>validate(study,d),/equal/i);
  const d2=cloned();d2.productivity.repeatable_general_improvement_proven=true;
  assert.throws(()=>validate(study,d2),/false/);
  const d3=cloned();d3.effects.deployed=true;
  assert.throws(()=>validate(study,d3),/false/);
});
test("V15 cannot conceal incomplete sandbox-owned untracked directories",()=>{
  const d=cloned();d.independent_secondary_audit.incomplete_scope_inventory=[];
  assert.throws(()=>validate(study,d),/equal/i);
  const d2=cloned();
  d2.independent_secondary_audit.incomplete_scope_inventory[0].
    independent_out_of_scope_absence_fully_verified=true;
  assert.throws(()=>validate(study,d2),/false/);
});
