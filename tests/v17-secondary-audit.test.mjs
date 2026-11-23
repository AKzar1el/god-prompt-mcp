import test from "node:test";
import assert from "node:assert/strict";
import {parseOriginalV17,scoreV17} from
  "../benchmarks/agent-ab/real-repos/v17-secondary-audit.mjs";
import {inspectV17Events,validateV17Protocol} from
  "../benchmarks/agent-ab/real-repos/v17-event-audit.mjs";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const study=JSON.parse(readFileSync(join(HERE,
  "../benchmarks/agent-ab/real-repos/v17-frozen-study-20261123.json")));
const task={code_paths:["src/bug.py"]},root="C:/trial";
const emit=(...events)=>events.map(x=>JSON.stringify(x)).join("\n")+"\n";
const item=obj=>({type:"item.completed",item:obj});
const edit=path=>item({type:"file_change",status:"completed",
  changes:[{path,kind:"update"}]});
const run=exit=>item({type:"command_execution",status:exit?"failed":"completed",
  exit_code:exit,
  command:"python -m unittest discover -s v17_native_tests -p test_fix.py -v"});
const call=item({type:"mcp_tool_call",server:"godprompt",tool:"get_tailored_guidance",
  status:"completed"});
const end={type:"turn.completed",usage:{
  input_tokens:123,cached_input_tokens:100,output_tokens:14}};

test("V17 independent audit reconstructs actual strict gate from original-style events",()=>{
  const raw=emit(
    run(1), // Pre-edit RED cannot enable guidance
    edit("C:/trial/src/bug.py"),run(1),
    edit("C:/trial/v17_native_tests/test_fix.py"),run(1),
    edit("C:/trial/src/bug.py"),run(1),call,run(0),end
  );
  const independent=parseOriginalV17(raw,task,root);
  const primary=inspectV17Events(raw,{root,codePaths:task.code_paths});
  assert.equal(independent.codeEdits,2);
  assert.equal(independent.fails,3);
  assert.equal(independent.passes,1);
  assert.equal(independent.eligible,true);
  assert.equal(independent.usage.input_tokens,123);
  assert.deepEqual(independent.calls,primary.mcp_calls);
  assert.equal(validateV17Protocol("repeated_failure_mcp",primary),true);
});

test("V17 independent parser does not count test-only edits as source repair",()=>{
  const raw=emit(edit("C:/trial/src/bug.py"),run(1),
    edit("C:/trial/v17_native_tests/test_fix.py"),run(1),end);
  const data=parseOriginalV17(raw,task,root);
  assert.equal(data.fails,2);
  assert.equal(data.codeEdits,1);
  assert.equal(data.eligible,false);
});

test("V17 scorer is fail-closed on duplicates, unknown slots and partial study",()=>{
  const one={task_id:"anyio-1498-v17",arm:"baseline",accepted:false,seconds:420,
    input_tokens:null,cached_input_tokens:null,output_tokens:null};
  const partial=scoreV17(study,[one]);
  assert.equal(partial.complete,false);
  assert.equal(partial.observed,1);
  assert.equal(partial.by_arm.baseline.seconds_per_accepted_fix,null);
  assert.equal(partial.by_arm.repeated_failure_mcp.seconds_per_accepted_fix,null);
  assert.throws(()=>scoreV17(study,[one,one]),/duplicate/i);
  assert.throws(()=>scoreV17(study,[{...one,task_id:"not-in-study"}]),/Unexpected/i);
});
