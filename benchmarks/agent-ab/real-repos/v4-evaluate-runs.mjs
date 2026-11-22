#!/usr/bin/env node
/**
 * Offline, read-only review of V4 native Codex coding receipts.
 * No provider calls, no patches, no hidden-grader changes.
 * Independently cross-checks retained transcripts against source Git state.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v4");
const PRIVATE=join(ROOT,"private/model-runs");
const ARMS=join(ROOT,"arms");
const SUITE=JSON.parse(await readFile(join(HERE,"v4-frozen-suite.json"),"utf8"));
const sha=x=>createHash("sha256").update(x).digest("hex");
const ARM_NAMES=["baseline","preinjected","live_mcp"];

export function reviewArm({
  task,arm,summary,jsonl,stderr,gitHead,gitBranch,gitPaths,
}) {
  const reasons=[];
  const check=(ok,why)=>{if(!ok)reasons.push(why);};
  check(task?.task_id===summary?.task_id,"task_identity");
  check(ARM_NAMES.includes(arm)&&summary?.arm===arm,"arm_identity");
  check(summary?.source_sha===task?.source_sha&&gitHead===task?.source_sha,
    "source_sha_mismatch");
  check(summary?.checkout_branch===gitBranch&&
    gitBranch==="gp-v4/"+task?.task_id+"-"+arm,"checkout_branch_mismatch");
  check(summary?.cli_model_requested===SUITE.model&&
    summary?.cli_effort_requested===SUITE.reasoning_effort,
    "model_effort_not_matched");
  check(summary?.cli_permission_profile==="workspace-write"&&
    summary?.cli_windows_sandbox==="unelevated"&&
    summary?.cli_approval_policy==="never"&&
    summary?.direct_shell_network_disabled===true,"sandbox_not_matched");
  check(summary?.transcript_sha256===sha(jsonl)&&
    summary?.stderr_sha256===sha(stderr),"transcript_digest_mismatch");
  check(summary?.turn_completed===true&&summary?.timed_out===false&&
    summary?.cli_exit===0,"incomplete_or_timed_out");
  check(Array.isArray(summary?.modified_git_entries)&&
    summary.modified_git_entries.length===gitPaths.length&&
    summary.modified_git_entries.every((s,i)=>s.slice(3)===gitPaths[i]),
    "git_diff_receipt_mismatch");
  check(Number.isFinite(summary?.elapsed_seconds)&&
    summary.elapsed_seconds>=0&&
    summary.elapsed_seconds<=(task?.max_minutes??15)*60+120,
    "wall_time_outside_frozen_limit");
  const grader=summary?.private_hidden_grade;
  check(grader?.grader_sha256===task?.grader?.sha256&&
    grader?.checks===task?.grader?.checks&&
    grader?.source_sha===task?.source_sha&&
    grader?.task_id===task?.task_id&&grader?.arm===arm,
    "hidden_grader_identity_mismatch");
  check(JSON.stringify(grader?.changed_files??[])===JSON.stringify(gitPaths),
    "hidden_grader_git_scope_mismatch");
  const outOfScope=gitPaths.filter(path=>!task?.allowed_paths.includes(path));
  check(outOfScope.length===0&&
    JSON.stringify(grader?.outside_scope_changes??[])==="[]",
    "out_of_scope_change");
  const events=jsonl.split(/\r?\n/u).filter(Boolean).map(line=>JSON.parse(line));
  const lastCompleted=events.filter(x=>x.type==="turn.completed").at(-1);
  check(lastCompleted?.usage?.input_tokens===summary?.usage?.input_tokens&&
    lastCompleted?.usage?.output_tokens===summary?.usage?.output_tokens&&
    lastCompleted?.usage?.cached_input_tokens===summary?.usage?.cached_input_tokens,
    "reported_usage_receipt_mismatch");
  check(!/blocked by policy|rejected by user approval settings|sandbox(?:ing)? (?:is )?unavailable/iu.test(stderr)&&
    !events.some(x=>/blocked by policy|rejected by user approval settings/iu.test(
      String(x.item?.error??"")+String(x.item?.aggregated_output??""))),
    "agent_tool_policy_denied");
  const cmds=events.filter(x=>x.type==="item.completed"&&
    x.item?.type==="command_execution");
  const successes=cmds.filter(x=>x.item?.status==="completed"&&
    x.item.exit_code===0);
  const successfulPatches=events.filter(x=>x.type==="item.completed"&&
    x.item?.type==="file_change"&&
    x.item.status==="completed"&&x.item.changes?.length>0);
  const allMcp=events.filter(x=>x.type==="item.completed"&&
    x.item?.type==="mcp_tool_call");
  const mcpOk=allMcp.filter(x=>x.item.status==="completed"&&
    !x.item.error&&x.item.result?.isError!==true);
  const pinned=mcpOk.filter(x=>x.item.server==="godprompt");
  const otherMcp=allMcp.filter(x=>x.item.server!=="godprompt");
  check(events.some(x=>x.type==="thread.started")&&
    events.some(x=>x.type==="turn.started")&&
    events.some(x=>x.type==="turn.completed")&&
    !events.some(x=>x.type==="turn.failed"),"agent_turn_not_authenticated");
  check(successes.length>0,"no_successful_shell_tool");
  check(gitPaths.length>0||successfulPatches.length>0,"no_real_code_change");
  const names=pinned.map(x=>x.item.tool);
  if(arm==="live_mcp"){
    check(names.includes("get_version")&&names.includes("classify_task")&&
      names.filter(x=>x==="get_tailored_guidance").length>=2,
      "pinned_live_mcp_not_proven");
  }else check(pinned.length===0,"nonlive_used_godprompt");
  check(otherMcp.length===0,"other_connected_mcp_contamination");
  const correctness=grader?.hidden_pass===true&&
    grader?.passed_checks===grader?.checks&&
    gitPaths.length>0&&outOfScope.length===0;
  const integrity=reasons.length===0;
  const status=!integrity?"INVALID_ARM":correctness?"VALID_CORRECT":"VALID_INCORRECT";
  return {
    task_id:task?.task_id,arm,status,integrity,correctness,
    blockers:reasons,
    time_seconds:summary?.elapsed_seconds??null,
    hidden_passed:grader?.passed_checks??null,
    hidden_total:grader?.checks??null,
    modified_git_paths:gitPaths,
    commands:cmds.length,successful_commands:successes.length,
    observed_file_changes:successfulPatches.length,
    pinned_godprompt_calls:pinned.map(x=>x.item.tool),
    unrelated_mcp_calls:otherMcp.map(x=>x.item.server+"/"+x.item.tool),
    reported_input_tokens:summary?.usage?.input_tokens??null,
    reported_cached_tokens:summary?.usage?.cached_input_tokens??null,
    reported_output_tokens:summary?.usage?.output_tokens??null,
    transcript_sha256:sha(jsonl),stderr_sha256:sha(stderr),
    effective_model_and_billing_verified:false,
    note:"Actual Git changes + transcript + frozen independent grader are corroborated; no population productivity claim.",
  };
}

async function ordinary(path,maxBytes){
  const s=await lstat(path);
  if(!s.isFile()||s.isSymbolicLink()||s.size>maxBytes)throw new Error("Unsafe private receipt");
  const r=await realpath(path);
  if(resolve(r).toLowerCase()!==resolve(path).toLowerCase())throw new Error("Receipt alias");
  return readFile(path,"utf8");
}
function git(dir,...args){
  return execFileSync("git",args,{cwd:dir,encoding:"utf8",
    windowsHide:true,timeout:12000,maxBuffer:1024*1024}).trimEnd();
}
async function evaluate(task,arm){
  const independentGrader=await ordinary(join(ROOT,"private",task.grader.file),32768);
  if(sha(independentGrader)!==task.grader.sha256)
    throw new Error("Frozen hidden grader SHA changed for "+task.task_id);
  const dir=join(PRIVATE,task.task_id);
  const headPath=join(dir,arm+".summary.json");
  if(!existsSync(headPath))return {task_id:task.task_id,arm,status:"NOT_COMPLETE"};
  const armDir=join(ARMS,task.task_id,arm);
  const summary=JSON.parse(await ordinary(headPath,50000));
  const jsonl=await ordinary(join(dir,arm+".stdout.jsonl"),16*1024*1024);
  const stderr=await ordinary(join(dir,arm+".stderr.txt"),4*1024*1024);
  const gitHead=git(armDir,"rev-parse","HEAD");
  const gitBranch=git(armDir,"branch","--show-current");
  const gitPaths=git(armDir,"-c","core.quotepath=false","status","--porcelain=v1","--untracked-files=all")
    .split(/\r?\n/u).filter(Boolean).map(x=>x.slice(3).replaceAll("\\","/"));
  return reviewArm({task,arm,summary,jsonl,stderr,gitHead,gitBranch,gitPaths});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const tasks=SUITE.tasks;
  const results=[];
  for(const task of tasks){
    for(const arm of ARM_NAMES)results.push(await evaluate(task,arm));
  }
  console.log(JSON.stringify({
    schema:"godprompt.v4.real-code-receipt-review.v1",
    completed:results.filter(x=>x.status!=="NOT_COMPLETE").length,
    valid_correct:results.filter(x=>x.status==="VALID_CORRECT").length,
    valid_incorrect:results.filter(x=>x.status==="VALID_INCORRECT").length,
    invalid:results.filter(x=>x.status==="INVALID_ARM").length,
    results,
    causal_productivity_proven:false,
  },null,2));
}
