import test from "node:test";
import assert from "node:assert/strict";
import {inspectV19Events,validV19Protocol} from
  "../benchmarks/agent-ab/real-repos/v19-event-audit.mjs";

const root="C:/v19/arm";
const options={root,codePaths:["src/module.py"]};
const line=(...items)=>items.map(x=>JSON.stringify(x)).join("\n")+"\n";
const completed=item=>({type:"item.completed",item});
const sourceEdit=completed({type:"file_change",status:"completed",
  changes:[{path:"C:/v19/arm/src/module.py",kind:"update"}]});
const testEdit=completed({type:"file_change",status:"completed",
  changes:[{path:"C:/v19/arm/v19_native_tests/test_recovery.py",kind:"update"}]});
const native=(rc=0)=>completed({
  type:"command_execution",status:rc?"failed":"completed",exit_code:rc,
  command:"python -B -m unittest discover -s v19_native_tests -p test_recovery.py -v"});
const generic=completed({
 type:"mcp_tool_call",server:"godprompt",tool:"get_tailored_guidance",
 status:"completed",arguments:{
  task_type:"DEBUG",phase:"execute",compact:true,max_chars:600}});
const packet="f".repeat(64);
const evidence=completed({
 type:"mcp_tool_call",server:"godprompt_evidence",tool:"get_failure_evidence",
 status:"completed",arguments:{},
 result:{structured_content:{
  task_id:"rich-4270",evidence_sha256:packet,
  status:"EXTERNALLY_FROZEN_FAILURE_EVIDENCE_NOT_ROOT_CAUSE"}}});
const finish={type:"turn.completed",usage:{
 input_tokens:222,cached_input_tokens:200,output_tokens:20}};
const expectEvidence={task_id:"rich-4270",packet_sha256:packet};

test("V19 baseline has no MCP calls and authentic tests/edits",()=>{
 const x=inspectV19Events(line(native(1),sourceEdit,native(0),finish),options);
 assert.equal(x.source_edits,1);
 assert.equal(x.native_runs,2);
 assert.equal(x.native_fail,1);
 assert.equal(x.native_pass,1);
 assert.equal(x.model_reported_usage.input_tokens,222);
 assert.equal(validV19Protocol("baseline",x),true);
 assert.equal(validV19Protocol("evidence_mcp",x,expectEvidence),false);
});
test("V19 generic MCP tool args are exact, successful and precede source repair",()=>{
 const x=inspectV19Events(line(native(1),generic,sourceEdit,native(0),finish),options);
 assert.equal(x.mcp_calls[0].exact_generic_args,true);
 assert.equal(validV19Protocol("generic_godprompt",x),true);
 assert.equal(validV19Protocol("baseline",x),false);
});
test("V19 evidence tool delivers the exact frozen task/digest before editing",()=>{
 const x=inspectV19Events(line(native(1),evidence,sourceEdit,native(0),finish),options);
 assert.equal(x.mcp_calls[0].exact_evidence_args,true);
 assert.equal(x.mcp_calls[0].packet_task,"rich-4270");
 assert.equal(validV19Protocol("evidence_mcp",x,expectEvidence),true);
 assert.equal(validV19Protocol("evidence_mcp",x,{...expectEvidence,packet_sha256:"0".repeat(64)}),false);
 assert.equal(validV19Protocol("evidence_mcp",x,{...expectEvidence,task_id:"other"}),false);
});
test("V19 rejects no-op retests, late calls, duplicates, failing calls and other tools",()=>{
 for(const events of [
  [sourceEdit,generic,native(0),finish],
  [generic,generic,sourceEdit,native(0),finish],
  [completed({type:"mcp_tool_call",server:"godprompt",tool:"get_tailored_guidance",
   status:"failed",arguments:{task_type:"DEBUG",phase:"execute",compact:true,max_chars:600}}),
   sourceEdit,native(0),finish],
  [completed({type:"mcp_tool_call",server:"github",tool:"search",status:"completed"}),
   generic,sourceEdit,native(0),finish]
 ]){
  assert.equal(validV19Protocol("generic_godprompt",
    inspectV19Events(line(...events),options)),false);
 }
});
test("V19 keeps edits to frozen tests separate from changes to source",()=>{
 const x=inspectV19Events(line(testEdit,evidence,finish),options);
 assert.equal(x.file_edits,1);
 assert.equal(x.source_edits,0);
 assert.equal(x.mcp_calls[0].before_source_edit,true);
});
test("V19 malformed transcripts are invalid; missing token usage never imputed",()=>{
 const malformed=inspectV19Events(line(generic,finish)+"bad-json\n",options);
 assert.equal(malformed.malformed_jsonl_lines,1);
 assert.equal(validV19Protocol("generic_godprompt",malformed),false);
 const incomplete=inspectV19Events(line(generic,{type:"turn.completed"}),options);
 assert.equal(incomplete.model_reported_usage,null);
 assert.throws(()=>validV19Protocol("other",incomplete));
});
