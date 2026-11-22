import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectV4ArmSession } from "../benchmarks/agent-ab/real-repos/v4-session-gate.mjs";
const started={type:"thread.started",thread_id:"dry-run"};
const turn={type:"turn.started"};
const finished={type:"turn.completed",usage:{input_tokens:900,output_tokens:120}};
const event=(type,item)=>({type,item});
const cmd={id:"shell",type:"command_execution",status:"completed",exit_code:0,
  command:"node --test",aggregated_output:"ok"};
const patch={id:"edit",type:"file_change",status:"completed",
  changes:[{path:"src/index.js",kind:"update"}]};
const tool=name=>({id:name,type:"mcp_tool_call",server:"godprompt",
  tool:name,status:"completed",result:{isError:false}});
const jsonl=(...xs)=>xs.map(x=>JSON.stringify(x)).join("\n")+"\n";
const actualCode=(extras=[])=>jsonl(started,turn,
  event("item.completed",cmd),event("item.completed",patch),
  ...extras.map(x=>event("item.completed",x)),finished);

test("baseline shell+file edits are observed but remain ungraded",()=>{
  const r=inspectV4ArmSession({task_id:"dashboard-snapshot",arm:"baseline",
    jsonl:actualCode()});
  assert.equal(r.coding_tool_preflight_passed,true);
  assert.equal(r.status,"CODING_TOOL_PREFLIGHT_ONLY_NOT_GRADED");
  assert.equal(r.actual_successful_shell_commands,1);
  assert.equal(r.actual_successful_file_changes,1);
  assert.equal(r.independently_graded,false);
  assert.equal(r.causal_productivity_proven,false);
});
test("live in-session arm needs real GodPrompt calls as well as coding tools",()=>{
  const insufficient=inspectV4ArmSession({task_id:"trendpulse-references",
    arm:"live_mcp",jsonl:actualCode()});
  assert.equal(insufficient.status,"LIVE_MCP_NOT_PROVEN");
  const complete=inspectV4ArmSession({task_id:"trendpulse-references",
    arm:"live_mcp",jsonl:actualCode([
      tool("get_version"),tool("classify_task"),
      tool("get_tailored_guidance"),tool("get_tailored_guidance"),
    ])});
  assert.equal(complete.coding_tool_preflight_passed,true);
  assert.equal(complete.live_mcp_invocation_proven,true);
  assert.equal(complete.godprompt_tool_call_count,4);
  assert.equal(complete.causal_productivity_proven,false);
});
test("preinjected and baseline cannot quietly invoke live GodPrompt",()=>{
  for(const arm of ["preinjected","baseline"]){
    const r=inspectV4ArmSession({task_id:"pinescript-pagination",arm,
      jsonl:actualCode([tool("get_version")])});
    assert.equal(r.status,"NONLIVE_ARM_MCP_CONTAMINATED");
    assert.equal(r.coding_tool_preflight_passed,false);
  }
});
test("live GodPrompt alone without shell+file edits is not coding productivity",()=>{
  const mcpOnly=jsonl(started,turn,
    event("item.completed",tool("get_version")),
    event("item.completed",tool("classify_task")),
    event("item.completed",tool("get_tailored_guidance")),
    event("item.completed",tool("get_tailored_guidance")),finished);
  const r=inspectV4ArmSession({task_id:"dashboard-snapshot",arm:"live_mcp",
    jsonl:mcpOnly});
  assert.equal(r.live_mcp_invocation_proven,true);
  assert.equal(r.status,"MISSING_REAL_SHELL_OR_FILE_CHANGE");
  assert.equal(r.coding_tool_preflight_passed,false);
});
test("invalid run identity and host-policy denial fail closed",()=>{
  assert.throws(()=>inspectV4ArmSession({task_id:"../x",arm:"baseline",
    jsonl:actualCode()}),/Invalid task/);
  const r=inspectV4ArmSession({task_id:"dashboard-snapshot",arm:"baseline",
    jsonl:actualCode(),stderr:"exec_command rejected: blocked by policy"});
  assert.equal(r.status,"POLICY_DENIED");
  assert.equal(r.coding_tool_preflight_passed,false);
});
