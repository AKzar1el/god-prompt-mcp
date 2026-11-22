#!/usr/bin/env node
/** Fail-closed V4 arm evidence review. A live MCP call alone is not coding. */
import { createHash } from "node:crypto";
import { readFile, lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewCodexSession } from "./session-evidence.mjs";

const ARM_NAMES=["baseline","preinjected","live_mcp"];
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../real-runs/replication-v4");
const hash=value=>createHash("sha256").update(value).digest("hex");
const PATH_SAFE=x=>/^[a-z0-9-]+$/u.test(x);

export function inspectV4ArmSession({jsonl,stderr="",task_id,arm}){
  if(!PATH_SAFE(task_id)||!ARM_NAMES.includes(arm))
    throw new Error("Invalid task or arm identity");
  const base=reviewCodexSession(jsonl,stderr);
  const events=jsonl.split(/\r?\n/u).filter(Boolean).map(line=>JSON.parse(line));
  const succeeded=events.filter(e=>e.type==="item.completed"&&e.item?.status==="completed");
  const commands=succeeded.filter(e=>e.item?.type==="command_execution"&&e.item.exit_code===0);
  const patches=succeeded.filter(e=>e.item?.type==="file_change"&&
    Array.isArray(e.item.changes)&&e.item.changes.length>0);
  const mcp=succeeded.filter(e=>e.item?.type==="mcp_tool_call");
  const godprompt=mcp.filter(e=>String(e.item.server).toLowerCase()==="godprompt");
  const usedTools=new Set(godprompt.map(e=>e.item.tool));
  const liveMcpProven=usedTools.has("get_version")&&usedTools.has("classify_task")&&
    usedTools.has("get_tailored_guidance")&&
    godprompt.filter(e=>e.item.tool==="get_tailored_guidance").length>=2;
  const contamination=(arm!=="live_mcp"&&godprompt.length>0);
  const modelCanCode=base.tool_use_preflight_passed&&
    commands.length>0&&patches.length>0;
  const armMcpOkay=arm==="live_mcp"?liveMcpProven:!contamination;
  const eligible=modelCanCode&&armMcpOkay;
  let status="CODING_TOOL_PREFLIGHT_ONLY_NOT_GRADED";
  if(!base.tool_use_preflight_passed)status=base.status;
  else if(!commands.length||!patches.length)status="MISSING_REAL_SHELL_OR_FILE_CHANGE";
  else if(contamination)status="NONLIVE_ARM_MCP_CONTAMINATED";
  else if(arm==="live_mcp"&&!liveMcpProven)status="LIVE_MCP_NOT_PROVEN";
  return {
    schema:"godprompt.v4.arm-tool-evidence.v1",task_id,arm,status,
    coding_tool_preflight_passed:eligible,
    independently_graded:false,effective_model_and_effort_verified:false,
    cost_verified:false,causal_productivity_proven:false,
    actual_successful_shell_commands:commands.length,
    actual_successful_file_changes:patches.length,
    godprompt_tool_names:[...usedTools].sort(),
    godprompt_tool_call_count:godprompt.length,
    live_mcp_invocation_proven:liveMcpProven,
    original_session_preflight:base.status,
    transcript_sha256:hash(jsonl),stderr_sha256:hash(stderr),
    note:"Pass only establishes observed tool events and arm MCP separation. Independently verify source changes, grader, model/effort, time, token usage, policy and provenance before scoring productivity.",
  };
}
async function scopedFile(path,maxBytes){
  const physicalRoot=await realpath(ROOT);
  const target=resolve(path),physical=await realpath(target);
  const rel=relative(physicalRoot,physical);
  if(!rel||rel===".."||rel.startsWith(".."+sep)||isAbsolute(rel))
    throw new Error("Refusing evidence outside ignored V4 root");
  const st=await lstat(target);
  if(!st.isFile()||st.isSymbolicLink()||st.size>maxBytes)
    throw new Error("Invalid or oversized evidence file");
  return readFile(target,"utf8");
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [task_id,arm,jsonlPath,stderrPath]=process.argv.slice(2);
  if(!task_id||!arm||!jsonlPath){
    console.error("Usage: v4-session-gate.mjs TASK ARM V4_JSONL [V4_STDERR]");
    process.exitCode=2;
  }else{
    try{
      const result=inspectV4ArmSession({
        task_id,arm,jsonl:await scopedFile(jsonlPath,16*1024*1024),
        stderr:stderrPath?await scopedFile(stderrPath,4*1024*1024):"",
      });
      console.log(JSON.stringify(result,null,2));
      if(!result.coding_tool_preflight_passed)process.exitCode=1;
    }catch(err){
      console.error("V4 arm evidence refused: "+String(err.message).slice(0,160));
      process.exitCode=2;
    }
  }
}
