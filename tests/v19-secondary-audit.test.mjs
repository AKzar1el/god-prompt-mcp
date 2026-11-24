import test from "node:test";
import assert from "node:assert/strict";
import {independentV19EventReader,auditV19} from
  "../benchmarks/agent-ab/real-repos/v19-secondary-audit.mjs";
const ROOT="C:/sandbox/trial";
const SRC="tenacity/wait.py";
const line=(...xs)=>xs.map(x=>JSON.stringify(x)).join("\n");
const edit={type:"item.completed",item:{type:"file_change",
  status:"completed",changes:[{path:ROOT+"/"+SRC,kind:"update"}]}};
const success={type:"item.completed",item:{type:"command_execution",
  status:"completed",exit_code:0,
  command:"python -B -m unittest discover -s v19_native_tests -p test_recovery.py -v"}};
const generic={type:"item.completed",item:{type:"mcp_tool_call",
  server:"godprompt",tool:"get_tailored_guidance",
  arguments:{task_type:"DEBUG",phase:"execute",compact:true,max_chars:600},
  status:"completed"}};
const evidence={type:"item.completed",item:{type:"mcp_tool_call",
  server:"godprompt_evidence",tool:"get_failure_evidence",
  arguments:{},status:"completed",
  result:{structured_content:{task_id:"tenacity-710",
    evidence_sha256:"b".repeat(64),
    status:"EXTERNALLY_FROZEN_FAILURE_EVIDENCE_NOT_ROOT_CAUSE"}}}};
const complete={type:"turn.completed",usage:{input_tokens:300,
 cached_input_tokens:240,output_tokens:18}};
test("Independent V19 audit can reconstruct accepted source changes and usage",()=>{
  const e=independentV19EventReader(line(edit,success,complete),ROOT,SRC);
  assert.equal(e.turns,1);
  assert.equal(e.commands,1);
  assert.equal(e.source_edits,1);
  assert.equal(e.native_runs,1);
  assert.equal(e.native_pass,1);
  assert.equal(e.usage.input_tokens,300);
  assert.deepEqual(e.mcp_calls,[]);
});
test("Independent V19 native log reader preserves exact generic and evidence calls",()=>{
  const e=independentV19EventReader(
    line(generic,edit,success,evidence,complete),ROOT,SRC);
  assert.equal(e.mcp_calls.length,2);
  assert.equal(e.mcp_calls[0].before_source_edit,true);
  assert.equal(e.mcp_calls[0].exact_generic_args,true);
  assert.equal(e.mcp_calls[1].before_source_edit,false);
  assert.equal(e.mcp_calls[1].exact_evidence_args,true);
  assert.equal(e.mcp_calls[1].packet_task,"tenacity-710");
});
test("Independent audit requires complete token fields, and preserves malformed event flags",()=>{
  const e=independentV19EventReader(line(complete,{type:"turn.completed"})+
    "\nBAD JSON",ROOT,SRC);
  assert.equal(e.turns,2);
  assert.equal(e.usage,null);
  assert.equal(e.malformed,1);
});
test("Current V19 original receipts remain checkable without rewriting them",()=>{
  const audit=auditV19();
  assert.ok(audit.original_completed>=1);
  assert.ok(audit.original_completed<=15);
  assert.equal(audit.planned,15);
  assert.equal(audit.by_arm.baseline.original_attempts>=1,true);
  assert.equal(audit.replicated_productivity_gain_proven,false);
});
