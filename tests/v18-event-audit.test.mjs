import test from "node:test";
import assert from "node:assert/strict";
import {inspectV18Events,validV18Protocol} from
  "../benchmarks/agent-ab/real-repos/v18-event-audit.mjs";
const root="C:/v18/matched";
const props={root,codePaths:["src/module.py"]};
const line=(...items)=>items.map(x=>JSON.stringify(x)).join("\n")+"\n";
const item=x=>({type:"item.completed",item:x});
const change=(p="src/module.py")=>item({type:"file_change",status:"completed",
  changes:[{path:root+"/"+p,kind:"update"}]});
const cmd=exit=>item({type:"command_execution",status:exit?"failed":"completed",
  exit_code:exit,command:"python -B -m unittest discover -s v18_native_tests -p test_recovery.py -v"});
const call=(server="godprompt",tool="get_tailored_guidance",status="completed")=>
  item({type:"mcp_tool_call",server,tool,status});
const finish={type:"turn.completed",usage:{input_tokens:235,cached_input_tokens:180,output_tokens:31}};

test("V18 baseline never invokes MCP and requires independently observed edits/tests",()=>{
  const x=inspectV18Events(line(cmd(1),change(),cmd(0),finish),props);
  assert.equal(x.source_edits,1);
  assert.equal(x.native_tests,2);
  assert.equal(x.post_test_successes,1);
  assert.equal(validV18Protocol("baseline",x),true);
  assert.equal(validV18Protocol("guided_mcp",x),false);
  assert.equal(x.model_reported_usage.input_tokens,235);
});

test("V18 treatment must call exact real tool before first source edit",()=>{
  const x=inspectV18Events(line(cmd(1),call(),change(),cmd(0),finish),props);
  assert.equal(validV18Protocol("guided_mcp",x),true);
  assert.equal(x.mcp_calls.length,1);
  assert.equal(x.mcp_calls[0].before_source_edit,true);
  assert.equal(x.mcp_calls[0].success,true);
});

test("V18 forbids tool calls after source edits, failed calls, duplicate calls and other tools",()=>{
  for(const events of [
    [change(),call(),cmd(0),finish],
    [call("godprompt","get_tailored_guidance","failed"),change(),cmd(0),finish],
    [call(),call(),change(),cmd(0),finish],
    [call("godprompt","classify_task"),change(),cmd(0),finish],
    [call("other","get_tailored_guidance"),change(),cmd(0),finish],
    [call(),call("github","search"),change(),cmd(0),finish]
  ]){
    assert.equal(validV18Protocol("guided_mcp",
      inspectV18Events(line(...events),props)),false);
  }
});

test("V18 test-file-only edits are not counted as source edits",()=>{
  const x=inspectV18Events(line(change("v18_native_tests/test_recovery.py"),call(),cmd(0),finish),props);
  assert.equal(x.successful_edits,1);
  assert.equal(x.source_edits,0);
  assert.equal(validV18Protocol("guided_mcp",x),true);
});

test("V18 missing usage and malformed original transcript cannot be misreported as valid",()=>{
  const incomplete=inspectV18Events(line(call(),change(),cmd(0),{type:"turn.completed"}),props);
  assert.equal(incomplete.model_reported_usage,null);
  const bad=inspectV18Events(line(call(),change(),cmd(0),finish)+"bad-json\n",props);
  assert.equal(bad.malformed_lines,1);
  assert.equal(validV18Protocol("guided_mcp",bad),false);
  assert.throws(()=>validV18Protocol("unsupported",incomplete));
});
