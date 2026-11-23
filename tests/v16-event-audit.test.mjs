import test from "node:test";
import assert from "node:assert/strict";
import { inspectV16Events, validV16TreatmentProtocol } from
  "../benchmarks/agent-ab/real-repos/v16-event-audit.mjs";

const emit = (...events) => events.map(x => JSON.stringify(x)).join("\n") + "\n";
const completed = item => ({type:"item.completed",item});
const shell = (exit,command="python -m pytest -q tests/test_bug.py") =>
  completed({type:"command_execution",
    status:exit===0?"completed":"failed",exit_code:exit,command});
const edit = completed({type:"file_change",status:"completed"});
const mcp = (tool="get_tailored_guidance",server="godprompt") =>
  completed({type:"mcp_tool_call",status:"completed",server,tool});
const finish = {type:"turn.completed",
  usage:{input_tokens:42,cached_input_tokens:22,output_tokens:9}};

test("V16 expected pre-fix RED does not trigger unnecessary MCP context",()=>{
  const e=inspectV16Events(emit(shell(1),edit,shell(0),finish));
  assert.equal(e.post_edit_pytest_failures,0);
  assert.equal(e.successful_post_edit_pytest,1);
  assert.equal(validV16TreatmentProtocol("conditional_mcp",e),true);
  assert.equal(e.model_reported_usage.input_tokens,42);
});

test("V16 failing real post-edit pytest permits exactly one subsequent guidance call",()=>{
  const e=inspectV16Events(emit(edit,shell(1),mcp(),shell(0),finish));
  assert.equal(e.post_edit_pytest_failures,1);
  assert.equal(e.successful_post_edit_pytest,1);
  assert.equal(e.mcp_calls[0].after_post_edit_pytest_failure,true);
  assert.equal(validV16TreatmentProtocol("conditional_mcp",e),true);
  assert.equal(validV16TreatmentProtocol("baseline",e),false);
});

test("V16 rejects preemptive, redundant, unobserved and fake conditional tool calls",()=>{
  const pre=inspectV16Events(emit(mcp(),edit,shell(1),shell(0),finish));
  assert.equal(pre.mcp_calls[0].after_post_edit_pytest_failure,false);
  assert.equal(validV16TreatmentProtocol("conditional_mcp",pre),false);
  const redundant=inspectV16Events(emit(edit,shell(0),mcp(),finish));
  assert.equal(validV16TreatmentProtocol("conditional_mcp",redundant),false);
  const two=inspectV16Events(emit(edit,shell(1),mcp(),mcp(),shell(0),finish));
  assert.equal(validV16TreatmentProtocol("conditional_mcp",two),false);
  const never=inspectV16Events(emit(edit,shell(1),shell(0),finish));
  assert.equal(validV16TreatmentProtocol("conditional_mcp",never),false);
});

test("V16 ignores ordinary failed commands as evidence to request guidance",()=>{
  const e=inspectV16Events(emit(edit,shell(1,"git status"),shell(0),finish));
  assert.equal(e.post_edit_pytest_failures,0);
  assert.equal(validV16TreatmentProtocol("conditional_mcp",e),true);
});

test("V16 full guidance requires successful classify and at least two guidance calls",()=>{
  const good=inspectV16Events(emit(mcp("classify_task"),mcp(),edit,shell(0),mcp(),finish));
  assert.equal(validV16TreatmentProtocol("full_mcp",good),true);
  assert.equal(validV16TreatmentProtocol("baseline",good),false);
  assert.equal(validV16TreatmentProtocol("conditional_mcp",good),false);
  const bad=inspectV16Events(emit(mcp("classify_task"),mcp(),edit,shell(0),finish));
  assert.equal(validV16TreatmentProtocol("full_mcp",bad),false);
});

test("V16 rejects other MCP usage and malformed transcript lines, without granting success",()=>{
  const other=inspectV16Events(emit(edit,shell(0),mcp("get_tailored_guidance","github"),finish));
  assert.equal(validV16TreatmentProtocol("baseline",other),false);
  const malformed=inspectV16Events(emit(edit,shell(0),finish) + "not json\n");
  assert.equal(malformed.malformed_lines,1);
  assert.equal(validV16TreatmentProtocol("baseline",malformed),false);
  const clean=inspectV16Events(emit(edit,shell(0),finish));
  assert.throws(()=>validV16TreatmentProtocol("not-an-arm",clean),/Unknown arm/);
});

test("V16 does not assume missing token usage equals zero",()=>{
  const e=inspectV16Events(emit(edit,shell(0),{type:"turn.completed"}));
  assert.equal(e.model_reported_usage,null);
});
