import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reviewArm } from "../benchmarks/agent-ab/real-repos/v4-evaluate-runs.mjs";

const sha=x=>createHash("sha256").update(x).digest("hex");
const suite=JSON.parse(readFileSync(resolve("benchmarks/agent-ab/real-repos/v4-frozen-suite.json"),"utf8"));
const task=suite.tasks.find(x=>x.task_id==="dashboard-snapshot");
const path="docs/interactive/dashboard.html";
const names=["get_version","classify_task","get_tailored_guidance","get_tailored_guidance"];
const mcp=(tool,server="godprompt",status="completed")=>({
  type:"item.completed",item:{
    id:tool,type:"mcp_tool_call",server,tool,status,error:null,
    result:{content:[{type:"text",text:"{}"}]},
  },
});
const shell=(exit=0)=>({
  type:"item.completed",item:{id:"cmd",type:"command_execution",status:exit===0?"completed":"failed",
    exit_code:exit,command:"node --test example.mjs",aggregated_output:"ok"},
});
function fixture(arm="baseline",options={}){
  const events=[
    {type:"thread.started",thread_id:"evidence-only"},
    {type:"turn.started"},shell(options.commandExit??0),
    ...(options.mcp??[]),
    {type:"turn.completed",usage:{input_tokens:5000,cached_input_tokens:4000,output_tokens:900}},
  ];
  const jsonl=events.map(x=>JSON.stringify(x)).join("\n")+"\n";
  const stderr=options.stderr??"";
  const gitPaths=options.gitPaths??[path];
  const summary={
    task_id:task.task_id,arm,source_sha:task.source_sha,
    checkout_branch:"gp-v4/"+task.task_id+"-"+arm,
    cli_model_requested:"gpt-6.1-sol",cli_effort_requested:"high",
    cli_permission_profile:"workspace-write",cli_windows_sandbox:"unelevated",
    cli_approval_policy:"never",direct_shell_network_disabled:true,
    transcript_sha256:sha(jsonl),stderr_sha256:sha(stderr),
    turn_completed:true,timed_out:false,cli_exit:0,elapsed_seconds:240,
    modified_git_entries:gitPaths.map(x=>" M "+x),
    private_hidden_grade:{
      task_id:task.task_id,arm,source_sha:task.source_sha,
      grader_sha256:task.grader.sha256,checks:task.grader.checks,
      passed_checks:task.grader.checks,hidden_pass:true,
      changed_files:gitPaths,outside_scope_changes:[],
    },
    usage:{input_tokens:5000,cached_input_tokens:4000,output_tokens:900},
  };
  return {task,arm,summary,jsonl,stderr,gitHead:task.source_sha,
    gitBranch:summary.checkout_branch,gitPaths};
}
test("independent Git changes + actual successful shell prove coding without a Codex file_change event",()=>{
  const out=reviewArm(fixture());
  assert.equal(out.status,"VALID_CORRECT");
  assert.equal(out.observed_file_changes,0);
  assert.equal(out.successful_commands,1);
  assert.equal(out.correctness,true);
  assert.equal(out.effective_model_and_billing_verified,false);
});
test("real pinned GodPrompt calls permit valid live arm, even with recovered failed guidance attempt",()=>{
  const x=fixture("live_mcp",{mcp:[mcp("get_version"),mcp("classify_task"),
    mcp("get_tailored_guidance", "godprompt","failed"),
    mcp("get_tailored_guidance"),mcp("get_tailored_guidance")]});
  const out=reviewArm(x);
  assert.equal(out.status,"VALID_CORRECT");
  assert.equal(out.pinned_godprompt_calls.length,4);
});
test("unrelated app access invalidates both live and ordinary arms",()=>{
  for(const arm of ["live_mcp","baseline","preinjected"]){
    const x=fixture(arm,{mcp:[
      ...names.map(n=>mcp(n)),mcp("mcp_get_tool","codex_apps/god")]});
    const out=reviewArm(x);
    assert.equal(out.status,"INVALID_ARM");
    assert.ok(out.blockers.includes("other_connected_mcp_contamination"));
  }
});
test("live MCP guidance missing and code missing both invalidate arm",()=>{
  const x=fixture("live_mcp",{mcp:[mcp("get_version"),mcp("classify_task")],gitPaths:[]});
  const out=reviewArm(x);
  assert.ok(out.blockers.includes("pinned_live_mcp_not_proven"));
  assert.ok(out.blockers.includes("no_real_code_change"));
});
test("out-of-scope, altered SHA, false usage, transcript mismatch or host policy denial invalidates arm",()=>{
  const cases=[
    x=>{x.gitPaths=[".codex/config.toml"];},
    x=>{x.gitHead="0".repeat(40);},
    x=>{x.summary.usage.input_tokens+=1;},
    x=>{x.summary.transcript_sha256="0".repeat(64);},
    x=>{x.stderr="blocked by policy";x.summary.stderr_sha256=sha(x.stderr);},
    x=>{x.summary.private_hidden_grade.grader_sha256="0".repeat(64);},
  ];
  for(const mutate of cases){
    const x=fixture();
    mutate(x);
    assert.equal(reviewArm(x).status,"INVALID_ARM");
  }
});
test("failed sandbox command alone is not proof of executed coding",()=>{
  const out=reviewArm(fixture("baseline",{commandExit:1}));
  assert.equal(out.status,"INVALID_ARM");
  assert.ok(out.blockers.includes("no_successful_shell_tool"));
});
