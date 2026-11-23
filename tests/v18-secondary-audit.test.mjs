import test from "node:test";
import assert from "node:assert/strict";
import {inspectV18Raw,auditV18} from
  "../benchmarks/agent-ab/real-repos/v18-secondary-audit.mjs";
import {inspectV18Events,validV18Protocol} from
  "../benchmarks/agent-ab/real-repos/v18-event-audit.mjs";
const root="C:/v18/pytest-15335/guided_mcp";
const code=["src/_pytest/approx.py"];
const e=x=>({type:"item.completed",item:x});
const line=(...items)=>items.map(x=>JSON.stringify(x)).join("\n")+"\n";
const mk=p=>e({type:"file_change",status:"completed",
  changes:[{path:root+"/"+p,kind:"update"}]});
const command=exit=>e({type:"command_execution",
  status:exit?"failed":"completed",exit_code:exit,
  command:"python -B -m unittest discover -s v18_native_tests -p test_recovery.py -v"});
const call=e({type:"mcp_tool_call",server:"godprompt",
  tool:"get_tailored_guidance",status:"completed",
  arguments:{task_type:"DEBUG",phase:"execute",compact:true,max_chars:600}});
const end={type:"turn.completed",
  usage:{input_tokens:123,cached_input_tokens:101,output_tokens:13}};

test("V18 independent original-log parser reconstructs real intervention chronology",()=>{
 const raw=line(command(1),call,mk("src/_pytest/approx.py"),command(0),end);
 const a=inspectV18Raw(raw,root,code);
 const b=inspectV18Events(raw,{root,codePaths:code});
 assert.equal(a.calls.length,1);
 assert.equal(a.calls[0].before_edit,true);
 assert.equal(a.calls[0].arguments_valid,true);
 assert.equal(a.native_runs,2);
 assert.equal(a.native_fail,1);
 assert.equal(a.native_pass,1);
 assert.equal(a.source_edits,1);
 assert.equal(a.usage.input_tokens,123);
 assert.equal(validV18Protocol("guided_mcp",b),true);
 assert.equal(b.source_edits,a.source_edits);
 assert.equal(b.post_test_successes,a.native_pass);
 assert.equal(b.mcp_calls[0].before_source_edit,a.calls[0].before_edit);
});

test("V18 independent event auditor rejects original guidance that came after a repair",()=>{
 const raw=line(command(1),mk("src/_pytest/approx.py"),call,command(0),end);
 const a=inspectV18Raw(raw,root,code);
 const b=inspectV18Events(raw,{root,codePaths:code});
 assert.equal(a.calls[0].before_edit,false);
 assert.equal(validV18Protocol("guided_mcp",b),false);
});

test("V18 independent parser ignores edits confined to frozen test file",()=>{
 const raw=line(mk("v18_native_tests/test_recovery.py"),call,end);
 const a=inspectV18Raw(raw,root,code);
 assert.equal(a.source_edits,0);
 assert.equal(a.calls[0].before_edit,true);
});

test("V18 source audit sees existing first-run receipt without inventing missing arms",()=>{
 const audit=auditV18();
 assert.ok(audit.observed>=1&&audit.observed<=6);
 assert.equal(audit.planned,6);
 assert.equal(audit.by_arm.baseline.accepted>=1,true);
 assert.ok(!audit.replicated_productivity_gain_proven);
 assert.equal(audit.missing.length,6-audit.observed);
});
