import test from "node:test";
import assert from "node:assert/strict";
import {inspectV17Events,validateV17Protocol} from
  "../benchmarks/agent-ab/real-repos/v17-event-audit.mjs";

const line=(...events)=>events.map(x=>JSON.stringify(x)).join("\n")+"\n";
const complete=item=>({type:"item.completed",item});
const edit=complete({type:"file_change",status:"completed"});
const cmd=(status=0,command="python -m unittest discover -s v17_native_tests -p test_fix.py -v")=>
  complete({type:"command_execution",
    status:status?"failed":"completed",exit_code:status,command});
const guide=complete({type:"mcp_tool_call",server:"godprompt",
  tool:"get_tailored_guidance",status:"completed"});
const unrelated=complete({type:"mcp_tool_call",server:"github",
  tool:"search",status:"completed"});
const turn={type:"turn.completed",
  usage:{input_tokens:88,cached_input_tokens:44,output_tokens:9}};

test("V17 counts two failed native tests separated by a repair edit",()=>{
  const x=inspectV17Events(line(edit,cmd(1),edit,cmd(1),guide,edit,cmd(0),turn));
  assert.equal(x.repeated_failure_gate_eligible,true);
  assert.equal(x.successful_post_edit_native_tests,1);
  assert.equal(x.failing_post_edit_native_tests,2);
  assert.equal(x.mcp_calls[0].after_repeated_post_edit_test_failures,true);
  assert.equal(validateV17Protocol("repeated_failure_mcp",x),true);
  assert.equal(validateV17Protocol("baseline",x),false);
  assert.equal(x.model_reported_usage.input_tokens,88);
});

test("V17 ignores pre-fix RED, a single post-edit failure, and repeated tests with no intervening edit",()=>{
  const pre=inspectV17Events(line(cmd(1),edit,cmd(0),turn));
  assert.equal(pre.failing_post_edit_native_tests,0);
  assert.equal(pre.repeated_failure_gate_eligible,false);
  assert.equal(validateV17Protocol("repeated_failure_mcp",pre),true);
  const single=inspectV17Events(line(edit,cmd(1),cmd(0),turn));
  assert.equal(single.repeated_failure_gate_eligible,false);
  const retry=inspectV17Events(line(edit,cmd(1),cmd(1),turn));
  assert.equal(retry.failing_post_edit_native_tests,2);
  assert.equal(retry.repeated_failure_gate_eligible,false);
});

test("V17 refuses early or excessive MCP calls even if later tests pass",()=>{
  for(const events of [
    [edit,cmd(1),guide,edit,cmd(1),cmd(0),turn],
    [edit,cmd(1),edit,cmd(1),guide,guide,cmd(0),turn],
    [edit,cmd(1),edit,cmd(1),unrelated,guide,cmd(0),turn],
    [edit,cmd(0),guide,turn],
  ]) {
    assert.equal(validateV17Protocol("repeated_failure_mcp",
      inspectV17Events(line(...events))),false);
  }
});

test("V17 ignores Git failures and nonzero commands unrelated to native unittest",()=>{
  const x=inspectV17Events(line(edit,cmd(1,"git status"),
    edit,cmd(1,"python -B -m pytest -q"),cmd(0),turn));
  assert.equal(x.failing_post_edit_native_tests,0);
  assert.equal(x.repeated_failure_gate_eligible,false);
});

test("V17 missing tool events, malformed transcript and incomplete usage fail closed",()=>{
  const x=inspectV17Events(line(edit,cmd(0),{type:"turn.completed"}));
  assert.equal(x.model_reported_usage,null);
  const bad=inspectV17Events(line(edit,cmd(0),turn)+"wrong-json\n");
  assert.equal(bad.malformed_jsonl_lines,1);
  assert.equal(validateV17Protocol("baseline",bad),false);
  assert.throws(()=>validateV17Protocol("something-else",x),/Unknown/);
});

test("V17 baseline requires no MCP despite any number of genuine native failures",()=>{
  const x=inspectV17Events(line(edit,cmd(1),edit,cmd(1),cmd(0),turn));
  assert.equal(validateV17Protocol("baseline",x),true);
  assert.equal(validateV17Protocol("repeated_failure_mcp",x),false);
});

test("V17 actual gate rejects edits only to regression tests between two failures",()=>{
  const root="C:/isolated/task";
  const editCode=complete({type:"file_change",status:"completed",changes:[
    {path:"C:/isolated/task/src/bug.py",kind:"update"}]});
  const editTest=complete({type:"file_change",status:"completed",changes:[
    {path:"C:/isolated/task/v17_native_tests/test_fix.py",kind:"update"}]});
  const options={root,codePaths:["src/bug.py"]};
  const notRepaired=inspectV17Events(
    line(editCode,cmd(1),editTest,cmd(1),turn),options);
  assert.equal(notRepaired.successful_source_code_edits,1);
  assert.equal(notRepaired.repeated_failure_gate_eligible,false);
  assert.equal(validateV17Protocol("repeated_failure_mcp",notRepaired),true);
  const repaired=inspectV17Events(
    line(editCode,cmd(1),editTest,editCode,cmd(1),guide,cmd(0),turn),options);
  assert.equal(repaired.successful_source_code_edits,2);
  assert.equal(repaired.repeated_failure_gate_eligible,true);
  assert.equal(validateV17Protocol("repeated_failure_mcp",repaired),true);
  assert.throws(()=>inspectV17Events("",{root}),/root and source/);
});
