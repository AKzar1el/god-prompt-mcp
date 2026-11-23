import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyV15Receipt,scoreV15 } from
  "../benchmarks/agent-ab/real-repos/v15-secondary-audit.mjs";

const sha=x=>createHash("sha256").update(x).digest("hex");
const study={
  schema:"godprompt.v15.behavioral-verify-once-study.v1",
  study_id:"V15-unit-fixture",source_sha:"a".repeat(40),
  private_grader_sha256:"b".repeat(64),
  arms:["baseline","full_mcp","verify_once_mcp"],
  tasks:[{id:"fix-one",issue:410,order:["baseline","full_mcp","verify_once_mcp"],
    allowed_paths:["src/fix.py"]},
    {id:"fix-two",issue:408,order:["full_mcp","verify_once_mcp","baseline"],
      allowed_paths:["src/fix.py"]}]
};
const events=[
  {type:"thread.started"},
  {type:"turn.started"},
  {type:"item.completed",item:{type:"command_execution",status:"completed",exit_code:0}},
  {type:"item.completed",item:{type:"file_change",status:"completed"}},
  {type:"item.completed",item:{type:"mcp_tool_call",status:"completed",
    server:"godprompt",tool:"get_tailored_guidance"}},
  {type:"turn.completed",usage:{input_tokens:27,cached_input_tokens:9,output_tokens:5}}
];
const stdout=events.map(x=>JSON.stringify(x)).join("\n")+"\n";
const stderr="";
const receipt={
  schema:"godprompt.v15.original-first-run.v1",
  study:study.study_id,task_id:"fix-one",issue:410,arm:"verify_once_mcp",
  source_sha:study.source_sha,frozen_grader_sha256:study.private_grader_sha256,
  manifest_sha256:"a".repeat(64),
  stdout_sha256:sha(stdout),stderr_sha256:sha(stderr),
  model_turns:1,successful_native_commands:1,successful_file_edits:1,
  mcp_calls:[{server:"godprompt",tool:"get_tailored_guidance",success:true}],
  model_reported_usage:{input_tokens:27,cached_input_tokens:9,output_tokens:5},
  changed_paths:["src/fix.py"],out_of_scope_paths:[],other_mcp_count:0,
  enabled_mcp_at_preflight:["godprompt"],
  protocol_valid:true,wall_seconds:12,accepted:true,original_status:"VALID_CORRECT",
  model_exit_code:0,hidden_total:19,hidden_passed:19,ordinary_tests_exit_code:0,
  policy_denial:false,timeout:false
};
const grade=(r=receipt,raw=stdout,paths=["src/fix.py"])=>
  verifyV15Receipt(study,r,raw,stderr,paths);
test("V15 secondary auditor independently reconstructs MCP and native tool receipts",()=>{
  const x=grade();
  assert.equal(x.accepted,true);
  assert.equal(x.hidden_checks,"19/19");
  assert.equal(x.input_tokens,27);
});
test("V15 secondary auditor refuses manipulated original log bytes and model telemetry",()=>{
  const x=structuredClone(receipt);x.stdout_sha256="0".repeat(64);
  assert.throws(()=>grade(x),/equal/i);
  const y=structuredClone(receipt);y.model_reported_usage.input_tokens+=1;
  assert.throws(()=>grade(y),/equal/i);
});
test("V15 secondary auditor rejects fake GodPrompt use and outside-scope paths",()=>{
  const x=structuredClone(receipt);x.mcp_calls=[];
  assert.throws(()=>grade(x),/equal/i);
  assert.throws(()=>grade(receipt,stdout,["src/other.py"]),/equal/i);
  const y=structuredClone(receipt);y.hidden_passed=18;
  assert.throws(()=>grade(y),/equal/i);
  const z=structuredClone(receipt);z.enabled_mcp_at_preflight=["github","godprompt"];
  assert.throws(()=>grade(z),/intended pinned MCP|equal/i);
});
test("V15 score cannot advertise full denominator from partial trials",()=>{
  const r=grade();
  const data=scoreV15(study,[r]);
  assert.equal(data.complete,false);
  assert.equal(data.by_arm.verify_once_mcp.seconds_per_accepted_fix,null);
  assert.equal(data.repeatable_productivity_improvement_proven,false);
});
test("V15 score includes unsuccessful first-run wall time in full denominator",()=>{
  const make=(task,arm,accepted,seconds)=>({
    task_id:task,arm,accepted,seconds,input_tokens:100,
    original_status:accepted?"VALID_CORRECT":"VALID_INCORRECT"
  });
  const rows=[
    make("fix-one","baseline",true,20),make("fix-two","baseline",false,40),
    make("fix-one","full_mcp",true,30),make("fix-two","full_mcp",true,25),
    make("fix-one","verify_once_mcp",false,42),make("fix-two","verify_once_mcp",true,28)
  ];
  const s=scoreV15(study,rows);
  assert.equal(s.complete,true);
  assert.equal(s.by_arm.baseline.seconds_per_accepted_fix,60);
  assert.equal(s.by_arm.full_mcp.seconds_per_accepted_fix,27.5);
  assert.equal(s.by_arm.verify_once_mcp.seconds_per_accepted_fix,70);
  assert.equal(s.by_arm.verify_once_mcp.input_tokens_per_accepted_fix,200);
  assert.throws(()=>scoreV15(study,[...rows,rows[0]]),/duplicate/i);
});
