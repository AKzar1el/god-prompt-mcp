#!/usr/bin/env node
/**
 * Frozen three-arm public-repository productivity pilot controller.
 *
 * No model calls, API keys, deployments, releases, or cleanup operations.
 * Only "prepare" writes: fresh local independent clones inside ignored real-runs.
 * Grading executes isolated, already-frozen offline scripts, never providers.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v4");
const SOURCES=join(ROOT,"sources");
const ARMS=join(ROOT,"arms");
const PRIVATE=join(ROOT,"private");
const SUITE_PATH=join(HERE,"v4-frozen-suite.json");
const suiteBytes=await readFile(SUITE_PATH);
const suite=JSON.parse(suiteBytes.toString("utf8"));
const sha=value=>createHash("sha256").update(value).digest("hex");
const pinsBytes=await readFile(join(HERE,"v4-context-pins.json"));
const pins=JSON.parse(pinsBytes.toString("utf8"));
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SHA=/^[a-f0-9]{40}$/u;
const SHA256=/^[a-f0-9]{64}$/u;
const ARM_NAMES=["baseline","preinjected","live_mcp"];
const allowedRel=x=>typeof x==="string"&&!isAbsolute(x)&&!x.startsWith(".")&&
  !x.includes("\\")&&x.split("/").every(s=>s&&s!=="."&&s!=="..");
const valid= (value,msg)=>{if(!value)throw new Error(msg);};
const within=(parent,path)=>{const rel=relative(parent,path);return !!rel&&
  rel!==".."&&!rel.startsWith(".."+sep)&&!isAbsolute(rel);};
function validateManifest(){
  valid(suite.schema==="godprompt.v4.frozen-public-agentic-triarm.v1"&&
    ID.test(suite.suite_id)&&Array.isArray(suite.arms)&&
    JSON.stringify(suite.arms)===JSON.stringify(ARM_NAMES)&&
    Array.isArray(suite.tasks)&&suite.tasks.length===3&&
    suite.model==="gpt-6.1-sol"&&suite.reasoning_effort==="high"&&
    suite.sandbox==="workspace-write"&&SHA.test(suite.godprompt_product_base_sha),
    "Frozen tri-arm manifest invalid");
  const seen=new Set();
  for(const task of suite.tasks){
    valid(ID.test(task.task_id)&&!seen.has(task.task_id)&&
      /^AKzar1el\/[A-Za-z0-9_.-]+$/u.test(task.repo)&&
      task.url==="https://github.com/"+task.repo+".git"&&
      SHA.test(task.source_sha)&&
      task.description.length>=60&&task.description.length<=1800&&
      Array.isArray(task.allowed_paths)&&task.allowed_paths.length>=1&&
      task.allowed_paths.every(allowedRel)&&
      Number.isInteger(task.max_minutes)&&task.max_minutes>=1&&task.max_minutes<=30&&
      /^[a-z0-9-]+\.(?:py|mjs)$/u.test(task.grader.file)&&
      SHA256.test(task.grader.sha256)&&
      Number.isInteger(task.grader.checks)&&task.grader.checks>0&&
      Number.isInteger(task.grader.red_passed)&&task.grader.red_passed<task.grader.checks,
      "Invalid frozen task descriptor: "+String(task.task_id).slice(0,45));
    seen.add(task.task_id);
  }
}
validateManifest();
const suiteDigest=sha(suiteBytes);
valid(pins.schema==="godprompt.v4.preinjection-pins.v1"&&
  pins.suite_sha256===suiteDigest&&
  pins.godprompt_product_base_sha===suite.godprompt_product_base_sha,
  "Pinned preinjection context belongs to a different frozen suite");
const taskById=id=>{const t=suite.tasks.find(x=>x.task_id===id);valid(t,"Unknown task");return t;};
const sourcePath=task=>join(SOURCES,task.repo.split("/")[1]);
const armPath=(task,arm)=>join(ARMS,task.task_id,arm);
function git(cwd,args){
  return execFileSync("git",args,{cwd,encoding:"utf8",timeout:45000,windowsHide:true,
    maxBuffer:1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:"0"}}).replace(/\r?\n$/u,"");
}
async function normalDirectory(path) {
  const info=await lstat(path);
  valid(info.isDirectory()&&!info.isSymbolicLink()&&
    (info.mode & 0o170000)!==0o120000,"Linked or non-directory checkout");
  const physical=await realpath(path);
  valid(resolve(physical).toLowerCase()===resolve(path).toLowerCase(),
    "Unresolved or aliased checkout: "+path);
}
async function verifySource(task){
  const path=sourcePath(task);
  valid(within(ROOT,path),"Source escaped pilot root");
  await normalDirectory(path);
  await normalDirectory(join(path,".git"));
  valid(git(path,["rev-parse","HEAD"])===task.source_sha,"Pinned source SHA changed: "+task.task_id);
  valid(git(path,["remote","get-url","origin"])===task.url,"Source origin changed");
  valid(git(path,["status","--porcelain=v1"])==="","Source clone dirty: "+task.task_id);
  valid(!existsSync(join(path,".git","objects","info","alternates")),
    "Source object alternates forbidden");
  return path;
}
async function verifyArm(task,arm){
  valid(ARM_NAMES.includes(arm),"Unknown comparison arm");
  const path=armPath(task,arm);
  valid(within(ROOT,path),"Arm escaped pilot root");
  await normalDirectory(path);
  await normalDirectory(join(path,".git"));
  valid(git(path,["rev-parse","HEAD"])===task.source_sha,
    "Pinned agent checkout SHA changed");
  valid(git(path,["branch","--show-current"])===
    "gp-v4/"+task.task_id+"-"+arm,"Wrong agent checkout branch");
  valid(git(path,["remote","get-url","origin"])===task.url,"Agent checkout origin changed");
  valid(!existsSync(join(path,".git","objects","info","alternates")),
    "Shared object store forbidden");
  return path;
}
async function checkGrader(task){
  const path=join(PRIVATE,task.grader.file);
  valid(within(ROOT,path),"Grader escaped pilot root");
  const info=await lstat(path);
  valid(info.isFile()&&!info.isSymbolicLink()&&info.size<32*1024,
    "Grader must be a bounded private ordinary file");
  const physical=await realpath(path);
  valid(resolve(physical).toLowerCase()===resolve(path).toLowerCase(),"Grader alias refused");
  const digest=sha(await readFile(path));
  valid(digest===task.grader.sha256,"Hidden grader was changed after freeze: "+task.task_id);
  return path;
}
async function preinjectedContext(task){
  const expected=pins.tasks?.[task.task_id];
  valid(expected&&SHA256.test(expected.receipt_sha256),
    "Missing pinned preinjection receipt identity");
  const path=join(ROOT,"context",task.task_id+".json");
  const info=await lstat(path);
  valid(info.isFile()&&!info.isSymbolicLink()&&info.size<200000,
    "Missing or unsafe preinjection context file");
  const physical=await realpath(path);
  valid(resolve(physical).toLowerCase()===resolve(path).toLowerCase(),
    "Preinjection context alias refused");
  const receipt=JSON.parse(await readFile(path,"utf8"));
  const unsigned={...receipt};
  delete unsigned.receipt_sha256;
  valid(receipt.receipt_sha256===expected.receipt_sha256&&
    sha(JSON.stringify(unsigned))===expected.receipt_sha256&&
    receipt.schema==="godprompt.v4.local-stdio-context.v1"&&
    receipt.task_id===task.task_id&&
    receipt.product_base_sha===suite.godprompt_product_base_sha&&
    receipt.route?.task_type===expected.route&&
    JSON.stringify(receipt.runtime_sha256)===JSON.stringify(pins.runtime_sha256),
    "Actual MCP context differs from frozen receipt");
  const guidance={execution:receipt.execution_guidance,
    verification:receipt.verification_guidance};
  const text=JSON.stringify(guidance);
  valid(text.length<12000,"Frozen MCP guidance unexpectedly oversized");
  return {receipt_sha256:expected.receipt_sha256,guidance:text};
}
function statusPaths(path) {
  const raw=git(path,["status","--porcelain=v1","--untracked-files=all"]);
  return raw.split(/\r?\n/u).filter(Boolean).map(line=>{
    const tail=line.slice(3);
    return (tail.includes(" -> ")?tail.split(" -> ").at(-1):tail).replaceAll("\\","/");
  });
}
function grading(task,arm,path,grader){
  const runner=grader.endsWith(".py")?"python":process.execPath;
  const run=spawnSync(runner,[grader,path],{
    cwd:HERE,windowsHide:true,encoding:"utf8",timeout:100000,maxBuffer:256*1024,
    env:{...process.env,PYTHONNOUSERSITE:"1",GIT_TERMINAL_PROMPT:"0"},
  });
  if(run.error)throw run.error;
  valid(run.status===0||run.status===1,"Grader process failed: "+String(run.stderr).slice(0,220));
  let grade;
  try{grade=JSON.parse(run.stdout);}catch{throw new Error("Malformed independent grader receipt");}
  valid(grade?.schema==="godprompt.v4.hidden-grade.v1"&&
    grade.task===task.task_id&&grade.checks===task.grader.checks&&
    Number.isInteger(grade.passed)&&grade.passed>=0&&grade.passed<=grade.checks,
    "Hidden grader identity/count mismatch");
  const touched=statusPaths(path);
  const outsideScope=touched.filter(name=>!task.allowed_paths.includes(name));
  const pass=grade.passed===grade.checks&&outsideScope.length===0;
  return {task_id:task.task_id,arm,source_sha:task.source_sha,
    grader_sha256:task.grader.sha256,checks:grade.checks,passed_checks:grade.passed,
    hidden_pass:pass,changed_files:touched,outside_scope_changes:outsideScope,
    grader_exit_status:run.status,failures:grade.failures??[],
    agent_session_authenticated:false,effective_model_verified:false,
    live_mcp_used_verified:false,productivity_gain_proven:false};
}
// Counterbalance time/order without using grader results or task difficulty.
const orderedTasks=[...suite.tasks].sort((a,b)=>
  sha(suite.freeze_seed+":"+a.task_id).localeCompare(sha(suite.freeze_seed+":"+b.task_id)));
const orderFor=task=>{
  const index=orderedTasks.findIndex(x=>x.task_id===task.task_id);
  return ARM_NAMES.map((_,i)=>ARM_NAMES[(index+i)%ARM_NAMES.length]);
};

const [command="plan",id="all",armArg="all"]=process.argv.slice(2);
valid(["plan","prepare","status","prompt","grade","score"].includes(command),
  "Usage: v4-control.mjs plan|prepare|status|prompt TASK ARM|grade [TASK] [ARM]|score");
const selected=id==="all"?suite.tasks:[taskById(id)];
const report={
  schema:"godprompt.v4.controller-receipt.v1",mode:command,
  suite_id:suite.suite_id,suite_sha256:suiteDigest,
  context_pins_sha256:sha(pinsBytes),
  status:"PILOT_DESIGN_ONLY_UNTIL_REAL_AGENT_RECEIPTS",
  tasks:[],
};
for(const task of selected){
  const privateGrader=await checkGrader(task);
  const source=await verifySource(task);
  const row={task_id:task.task_id,repo:task.repo,source_sha:task.source_sha,
    grader_sha256:task.grader.sha256,red_checks:task.grader.red_passed,
    total_hidden_checks:task.grader.checks,arm_order:orderFor(task)};
  if(command==="plan"){
    row.allowed_paths=task.allowed_paths;
    row.minutes_per_arm=task.max_minutes;
    row.source_clone=source;
    row.workspaces=Object.fromEntries(ARM_NAMES.map(arm=>[arm,armPath(task,arm)]));
  }else if(command==="prepare"){
    await mkdir(join(ARMS,task.task_id),{recursive:true});
    row.workspaces={};
    for(const arm of ARM_NAMES){
      const dest=armPath(task,arm);
      valid(!existsSync(dest),"Refusing to overwrite prepared arm: "+task.task_id+"/"+arm);
      git(HERE,["clone","--quiet","--no-hardlinks","--no-local",source,dest]);
      git(dest,["remote","set-url","origin",task.url]);
      git(dest,["switch","-c","gp-v4/"+task.task_id+"-"+arm]);
      await verifyArm(task,arm);
      row.workspaces[arm]=dest;
    }
    row.prepared=true;
  }else if(command==="prompt"){
    valid(id!=="all"&&ARM_NAMES.includes(armArg),"Specify TASK ARM");
    const target=await verifyArm(task,armArg);
    const base="Use your own isolated coding-agent session in "+target+
      ". Verify exact SHA "+task.source_sha+" and branch gp-v4/"+task.task_id+"-"+armArg+
      " before edits. Only touch "+task.allowed_paths.join(", ")+
      ". Use model "+suite.model+" with "+suite.reasoning_effort+" reasoning and "+
      suite.sandbox+" sandbox; no direct shell network, no paid API-key calls, "+
      "no secrets, no deployments, no PRs, no edits to live worktrees or other arms. "+
      "Hard limit "+task.max_minutes+" minutes. Task: "+task.description;
    const variant=armArg==="baseline"?
      "Do not access GodPrompt MCP, its skill, guidance, controller or sibling arm. Use normal tools.":
      armArg==="preinjected"?
      "Receive the frozen, hash-verified GodPrompt execute/verify guidance from the controller BEFORE this session. Do not dynamically call GodPrompt or read the live source; record the guidance receipt. If missing, declare the arm invalid.":
      "Use the exact pinned GodPrompt stdio MCP LIVE in this coding session. First verify get_version and call classify_task and get_tailored_guidance using actual MCP tool calls. Do not accept pre-injected guidance as a substitute. If the live tool is not visible and callable, declare arm invalid.";
    row.arm=armArg;
    row.prompt=base+" "+variant+
      " Run your own source regression tests, report actual command/file tool calls, and never claim a test passed if no command ran.";
    if(armArg==="preinjected"){
      const frozen=await preinjectedContext(task);
      row.godprompt_receipt_sha256=frozen.receipt_sha256;
      row.prompt+="\n\nFROZEN REAL GODPROMPT MCP GUIDANCE (pre-session only; receipt "+
        frozen.receipt_sha256+"):\n"+frozen.guidance;
    }
  }else{
    row.arms={};
    const arms=ARM_NAMES.filter(arm=>armArg==="all"||armArg===arm);
    valid(arms.length>0,"Unknown requested arm");
    for(const arm of arms){
      const dest=armPath(task,arm);
      if(!existsSync(dest)){
        row.arms[arm]={state:"NOT_PREPARED"};continue;
      }
      await verifyArm(task,arm);
      const touched=statusPaths(dest);
      if(command==="status"){
        row.arms[arm]={state:touched.length?"MODIFIED_UNGRADED":"FROZEN_SOURCE",
          changed_files:touched,checkout:dest};
      }else{
        row.arms[arm]={state:touched.length?"MODIFIED_GRADED":"UNMODIFIED_CONTROL",
          grade:grading(task,arm,dest,privateGrader)};
      }
    }
  }
  report.tasks.push(row);
}
if(command==="score"){
  const total=report.tasks.reduce((n,t)=>n+Object.values(t.arms).filter(a=>
    a.state==="MODIFIED_GRADED"&&a.grade?.hidden_pass).length,0);
  report.hidden_pass_arms=total;
  report.expected_arms=suite.tasks.length*ARM_NAMES.length;
  report.status="INSPECTABLE_GRADER_RESULTS_ONLY_AGENT_PROVENANCE_REQUIRED";
  report.fresh_valid_model_trials=0;
  report.real_tool_execution_proven=false;
  report.causal_productivity_proven=false;
  report.warning="Grader outcomes alone NEVER verify model/effort equality, live in-session MCP, shell tool events, time or token costs. Join independent child session receipts before scoring productivity.";
}
console.log(JSON.stringify(report,null,2));
