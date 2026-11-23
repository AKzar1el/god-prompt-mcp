#!/usr/bin/env node
/**
 * V18 randomized matched-failure-checkpoint baseline vs real MCP recovery.
 * Research-only, no external network. First runs and receipts never overwritten.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {copyFileSync,existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from "node:fs";
import {dirname,isAbsolute,join,relative,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
import {changedGitPaths} from "./v17-git-paths.mjs";
import {inspectV18Events,validV18Protocol} from "./v18-event-audit.mjs";

const HERE=dirname(fileURLToPath(import.meta.url));
const PROJECT=resolve(HERE,"../../..");
const ROOT=resolve(HERE,"../real-runs/replication-v18");
const STUDY_FILE=join(HERE,"v18-frozen-study-20261123.json");
const GRADER=join(ROOT,"v18-grade.py");
const FREEZE=join(ROOT,"v18-freeze-sha256.json");
const RECEIPTS=join(ROOT,"receipts");
const CLI=resolve(process.env.LOCALAPPDATA||"","npm-cache","_npx",
  "0ba5083c0a8edbde","node_modules","@openai","codex");
const GOD_STDIO=join(PROJECT,"dist","stdio.js");
const MANIFEST_BYTES=readFileSync(STUDY_FILE);
const STUDY=JSON.parse(MANIFEST_BYTES);
const sha=x=>createHash("sha256").update(x).digest("hex");
const childOf=(parent,child)=>{
  const r=relative(parent,child);
  return Boolean(r)&&r!==".."&&!r.startsWith(".."+sep)&&!isAbsolute(r);
};
function ordinaryDir(path){
  const st=lstatSync(path);
  assert.ok(st.isDirectory()&&!st.isSymbolicLink(),"Not a plain directory: "+path);
  assert.equal(resolve(realpathSync(path)).toLowerCase(),resolve(path).toLowerCase(),"Aliased directory: "+path);
}
const git=(cwd,args)=>execFileSync("git",args,{
  cwd,encoding:"utf8",windowsHide:true,timeout:60000,
  env:{...process.env,GIT_TERMINAL_PROMPT:"0"}
}).trim();
const checkpoint=t=>join(ROOT,"checkpoints",t.checkpoint_dir);
const armDir=(t,arm)=>{
  assert.ok(STUDY.arms.includes(arm)&&t.order.includes(arm));
  const dir=join(ROOT,"arms",t.id,arm);
  assert.ok(childOf(ROOT,dir));
  return dir;
};
const receipt=(t,arm)=>join(RECEIPTS,t.id,arm+".json");
function mcpArgs(arm){
  const out=[];
  for(const server of STUDY.environment.unrelated_mcp_disabled)
    out.push("-c","mcp_servers."+server+".enabled=false");
  if(arm==="guided_mcp"){
    out.push("-c","mcp_servers.godprompt.enabled=true",
      "-c","mcp_servers.godprompt.command='node'",
      "-c","mcp_servers.godprompt.args=['"+GOD_STDIO.replaceAll("\\","/")+"']",
      "-c","mcp_servers.godprompt.enabled_tools=['get_tailored_guidance']");
  }
  return out;
}
function mcpPreflight(arm){
  const raw=execFileSync(process.execPath,[
    join(CLI,"bin","codex.js"),"mcp","list","--json",...mcpArgs(arm)],{
    cwd:PROJECT,encoding:"utf8",windowsHide:true,timeout:30000,
    env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
  const entries=JSON.parse(raw);
  assert.ok(Array.isArray(entries),"Codex MCP configuration preflight failed");
  const active=entries.filter(x=>x.enabled).map(x=>x.name).sort();
  assert.deepEqual(active,arm==="baseline"?[]:["godprompt"],
    "Unplanned active MCP servers or invalid configured transport");
  return active;
}
function checkCheckpoint(t){
  const dir=checkpoint(t);
  ordinaryDir(dir);ordinaryDir(join(dir,".git"));
  assert.equal(git(dir,["rev-parse","HEAD"]),t.source_sha);
  assert.equal(git(dir,["remote","get-url","origin"]),t.source_url);
  assert.equal(git(dir,["status","--porcelain=v1"]),"?? v18_native_tests/",
    "Unexpected checkpoint file changes");
  assert.equal(t.code_paths.length,1,"One source file per bounded recovery task");
  assert.equal(sha(readFileSync(join(dir,t.code_paths[0]))),t.code_file_sha256);
  assert.equal(sha(readFileSync(join(dir,t.regression_file))),t.regression_sha256);
  return dir;
}
function checkArm(t,arm,clean=true){
  const dir=armDir(t,arm);
  ordinaryDir(dir);ordinaryDir(join(dir,".git"));
  assert.ok(!existsSync(join(dir,".git","objects","info","alternates")),
    "Linked Git object databases forbidden");
  assert.equal(git(dir,["rev-parse","HEAD"]),t.source_sha);
  assert.equal(git(dir,["branch","--show-current"]),
    "gp-v18-"+t.issue+"-"+arm);
  assert.equal(git(dir,["remote","get-url","origin"]),t.source_url);
  assert.equal(sha(readFileSync(join(dir,t.regression_file))),t.regression_sha256);
  if(clean){
    assert.equal(git(dir,["status","--porcelain=v1"]),"?? v18_native_tests/",
      "Initial trial must match the frozen checkpoint exactly");
    assert.equal(sha(readFileSync(join(dir,t.code_paths[0]))),t.code_file_sha256);
  }
  return dir;
}
function freeze(){
  assert.equal(STUDY.schema,"godprompt.v18.matched-failing-checkpoint.v1");
  assert.deepEqual(STUDY.arms,["baseline","guided_mcp"]);
  assert.equal(STUDY.tasks.length,3);
  const ranked=[...STUDY.tasks].sort((a,b)=>
    sha(STUDY.random_seed+a.id).localeCompare(sha(STUDY.random_seed+b.id)));
  assert.deepEqual(STUDY.run_order,ranked.map(t=>t.id),
    "Frozen task order does not match the recorded random seed");
  for(let i=0;i<ranked.length;i++)
    assert.deepEqual(ranked[i].order,i<2?
      ["baseline","guided_mcp"]:["guided_mcp","baseline"],
      "Frozen arm order inconsistent with blocked randomization");
  ordinaryDir(PROJECT);ordinaryDir(ROOT);
  assert.equal(git(PROJECT,["rev-parse","HEAD"]),STUDY.research_head);
  assert.equal(sha(readFileSync(GRADER)),STUDY.private_behavior_grader_sha256);
  assert.equal(sha(readFileSync(GOD_STDIO)),STUDY.runtime_stdio_sha256);
  assert.equal(sha(readFileSync(join(HERE,"v17-git-paths.mjs"))),
    STUDY.git_path_helper_sha256);
  assert.equal(sha(readFileSync(join(HERE,"v18-event-audit.mjs"))),
    STUDY.event_helper_sha256);
  assert.equal(JSON.parse(readFileSync(join(CLI,"package.json"))).version,
    STUDY.environment.codex_cli_version);
  for(const task of STUDY.tasks){
    checkCheckpoint(task);
    assert.ok(task.checkpoint_hidden_passed<task.hidden_total&&
      task.reference_a_passed===task.hidden_total&&
      task.reference_b_passed===task.hidden_total&&task.mutant_passed<task.hidden_total);
  }
  for(const arm of STUDY.arms)mcpPreflight(arm);
  const r=JSON.parse(readFileSync(FREEZE,"utf8"));
  assert.equal(r.manifest_sha256,sha(MANIFEST_BYTES),"Modified frozen study");
  assert.equal(r.runner_sha256,sha(readFileSync(fileURLToPath(import.meta.url))),
    "Modified runner after freeze");
  assert.equal(r.grader_sha256,STUDY.private_behavior_grader_sha256);
}
function prepare(){
  const created=[];
  for(const name of STUDY.run_order){
    const task=STUDY.tasks.find(t=>t.id===name);
    assert.ok(task);
    for(const arm of task.order){
      const dir=armDir(task,arm);
      assert.ok(!existsSync(dir),"Refusing to overwrite existing arm: "+dir);
      mkdirSync(dirname(dir),{recursive:true});ordinaryDir(dirname(dir));
      execFileSync("git",["clone","--quiet","--no-hardlinks","--no-local",checkpoint(task),dir],{
        cwd:PROJECT,windowsHide:true,timeout:60000,
        env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
      git(dir,["remote","set-url","origin",task.source_url]);
      git(dir,["switch","-c","gp-v18-"+task.issue+"-"+arm]);
      mkdirSync(join(dir,"v18_native_tests"));
      copyFileSync(join(checkpoint(task),task.regression_file),
        join(dir,task.regression_file));
      checkArm(task,arm);
      created.push({id:task.id,arm});
    }
  }
  return{created:created.length,arms:created};
}
function prompt(t,arm){
  const native="python -B -m unittest discover -s v18_native_tests -p test_recovery.py -v";
  const basic=
    "You are continuing a real, externally reported Python library bug from an "+
    "independently verified FAILING checkpoint. Repository "+t.repo+"; issue "+
    t.issue_url+"; pinned source HEAD "+t.source_sha+". "+
    "This checkout has the SAME source and SAME preexisting failing regression "+
    "tests as the other randomized arm. The tests in "+
    t.regression_file+" have been frozen; DO NOT modify, delete or bypass tests. "+
    "Modify ONLY these allowed source files: "+t.code_paths.join(", ")+". "+
    "Never inspect sibling arms, parent directories, hidden graders, prior "+
    "solutions, other tools, secrets, or network resources. Never write to GitHub, "+
    "push, merge, deploy, publish or restart anything. "+
    "If Git reports dubious ownership, verify the exact checkout first and "+
    "never disable global Git trust. "+
    "Set PowerShell environment $env:PYTHONPATH='"+t.pythonpath+
    "' and $env:PYTHONDONTWRITEBYTECODE='1'. "+
    "Reproduce and then repair the preexisting failure using "+
    native+". Inspect actual exit codes and failing tracebacks. "+
    "Keep all edits scoped, review git diff and execute the native regression "+
    "tests again after the source fix. "+
    "Do not claim success if any tests still fail. "+
    "Problem: "+t.description+" ";
  if(arm==="baseline")return basic+
    "CONTROL: Solve with your ordinary engineering reasoning only. "+
    "Do not invoke GodPrompt MCP, skills, prompt snippets or other MCP tools.";
  return basic+
    "TREATMENT: BEFORE modifying any source code, call the EXACT connected "+
    "godprompt MCP tool get_tailored_guidance ONCE with arguments "+
    "task_type=DEBUG, phase=execute, max_chars=600, compact=true. "+
    "This is the randomized real diagnostic intervention. "+
    "Read and consider the advice, but treat it as unverified guidance; "+
    "you must still understand the real failure and run real tests. "+
    "Do not call any other GodPrompt or other MCP tool, and do not invoke "+
    "get_tailored_guidance a second time. If the tool call fails, do not "+
    "pretend it worked; report the failure and continue normally.";
}
function modelArgs(t,arm,dir){
  return[join(CLI,"bin","codex.js"),"exec","--ephemeral","--sandbox",
    STUDY.environment.sandbox,"--model",STUDY.environment.requested_model,
    "-c","model_reasoning_effort='high'",
    "-c","sandbox_workspace_write.network_access=false",
    ...mcpArgs(arm),"-C",dir,"--json",prompt(t,arm)];
}
function nativeTest(t,dir,timeout=40000){
  const e={...process.env,PYTHONPATH:join(dir,t.pythonpath),
    PYTHONDONTWRITEBYTECODE:"1",PYTHONUTF8:"1",
    PYTHONIOENCODING:"utf-8",GIT_TERMINAL_PROMPT:"0"};
  for(const k of ["OPENAI_API_KEY","ANTHROPIC_API_KEY","GITHUB_TOKEN","GH_TOKEN"])
    delete e[k];
  const p=spawnSync("python",STUDY.environment.native_test_args,{
    cwd:dir,encoding:"utf8",env:e,timeout,windowsHide:true,maxBuffer:3*1024*1024});
  const combined=String(p.stdout||"")+"\n"+String(p.stderr||"");
  const m=/Ran\s+(\d+)\s+tests?\s+in\b/u.exec(combined);
  return{status:p.status,count:m?Number(m[1]):null,
    error:p.error?String(p.error.message):null,
    stdout_sha256:sha(String(p.stdout||"")),
    stderr_sha256:sha(String(p.stderr||"")),
    tail:combined.split(/\r?\n/u).slice(-10)};
}
function run(t,arm){
  const idx=t.order.indexOf(arm);
  assert.ok(idx>=0);
  const taskIdx=STUDY.run_order.indexOf(t.id);
  assert.ok(taskIdx>=0);
  for(const prev of STUDY.run_order.slice(0,taskIdx)){
    const earlier=STUDY.tasks.find(x=>x.id===prev);
    for(const priorArm of earlier.order)
      assert.ok(existsSync(receipt(earlier,priorArm)),
        "Earlier frozen task unfinished");
  }
  for(const before of t.order.slice(0,idx))
    assert.ok(existsSync(receipt(t,before)),"Earlier matched arm unfinished");
  const enabled=mcpPreflight(arm);
  const dir=checkArm(t,arm);
  const outDir=join(RECEIPTS,t.id);
  mkdirSync(outDir,{recursive:true});ordinaryDir(outDir);
  const outFile=receipt(t,arm);
  const rawFile=join(outDir,arm+".jsonl");
  const errFile=join(outDir,arm+".stderr.txt");
  for(const f of [outFile,rawFile,errFile])
    assert.ok(!existsSync(f),"Original attempt already exists; do not retry");
  // A checkpoint must still be RED immediately before model use.
  const pre=nativeTest(t,dir);
  assert.ok(pre.status!==0&&pre.count>=STUDY.environment.test_minimum&&
    !pre.error,"Checkpoint is not reliably red; STOP before model");
  const env={...process.env,PYTHONDONTWRITEBYTECODE:"1",PYTHONUTF8:"1",
    PYTHONIOENCODING:"utf-8",GIT_TERMINAL_PROMPT:"0"};
  for(const key of ["OPENAI_API_KEY","ANTHROPIC_API_KEY","GITHUB_TOKEN","GH_TOKEN"])
    delete env[key];
  const start=performance.now();
  const model=spawnSync(process.execPath,modelArgs(t,arm,dir),{
    cwd:dir,env,input:"",encoding:"utf8",windowsHide:true,
    timeout:t.timeout_seconds*1000,maxBuffer:32*1024*1024});
  const seconds=Number(((performance.now()-start)/1000).toFixed(3));
  const stdout=String(model.stdout||"");
  const stderr=String(model.stderr||"");
  writeFileSync(rawFile,stdout,{flag:"wx"});
  writeFileSync(errFile,stderr,{flag:"wx"});
  const events=inspectV18Events(stdout,{root:dir,codePaths:t.code_paths});
  let paths=null,gitError=null;
  try{paths=changedGitPaths(dir);}
  catch(e){gitError=String(e?.message||e).slice(0,440);}
  const outside=paths?.filter(p=>![...t.code_paths,t.regression_file].includes(p))??null;
  const originalTestHash=sha(readFileSync(join(dir,t.regression_file)));
  const testsUnchanged=originalTestHash===t.regression_sha256;
  const sourceChanged=t.code_paths.some(p=>
    sha(readFileSync(join(dir,p)))!==t.code_file_sha256);
  const grader=spawnSync("python",["-B",GRADER,t.id,dir],{
    cwd:PROJECT,env,encoding:"utf8",windowsHide:true,
    timeout:65000,maxBuffer:3*1024*1024});
  let grade=null;
  try{grade=JSON.parse(String(grader.stdout||""));}catch{/* Fail closed. */}
  const native=nativeTest(t,dir);
  const protocol=validV18Protocol(arm,events);
  const timeout=model.error?.code==="ETIMEDOUT"||seconds>t.timeout_seconds+0.5;
  const policy=/blocked by policy|rejected by host policy|permission denied by host/iu
    .test(stdout+"\n"+stderr);
  const accepted=model.status===0&&!model.error&&!timeout&&!policy&&
    events.turns>0&&events.successful_commands>0&&
    events.source_edits>0&&events.post_test_successes>0&&
    events.malformed_lines===0&&protocol&&Array.isArray(paths)&&
    t.code_paths.every(p=>paths.includes(p))&&outside.length===0&&
    testsUnchanged&&sourceChanged&&grader.status===0&&!grader.error&&
    grade?.schema===STUDY.behavior_grader_schema&&grade?.task===t.id&&
    grade?.checked===t.hidden_total&&grade?.passed===t.hidden_total&&
    native.status===0&&!native.error&&native.count>=STUDY.environment.test_minimum;
  const state=accepted?"VALID_CORRECT":timeout?"INVALID_TIMEOUT":policy?"INVALID_POLICY":
    !protocol?"INVALID_PROTOCOL":
    model.status===0&&grader.status===0&&grade?.checked===t.hidden_total&&
      grade.passed<t.hidden_total?"VALID_INCORRECT":"INVALID_OTHER";
  const record={
    schema:"godprompt.v18.original-matched-checkpoint.v1",
    study_id:STUDY.id,task:t.id,arm,repo:t.repo,issue:t.issue,
    original_status:state,accepted,
    original_manifest_sha256:sha(MANIFEST_BYTES),
    prompt_sha256:sha(prompt(t,arm)),checkpoint_source_sha:t.source_sha,
    checkpoint_code_sha256:t.code_file_sha256,
    checkpoint_native_test_sha256:t.regression_sha256,
    preflight_native:pre,
    model_wall_seconds:seconds,model_exit_code:model.status,
    model_error:model.error?String(model.error.message):null,
    model_signal:model.signal??null,
    requested_model:STUDY.environment.requested_model,
    requested_effort:STUDY.environment.requested_effort,
    requested_sandbox:STUDY.environment.sandbox,
    model_turns:events.turns,
    source_edits:events.source_edits,
    successful_commands:events.successful_commands,
    native_tests_in_transcript:events.native_tests,
    successful_native_tests_in_transcript:events.post_test_successes,
    model_reported_usage:events.model_reported_usage,
    malformed_jsonl_lines:events.malformed_lines,
    intervention_tool_calls:events.mcp_calls,
    intervention_protocol_valid:protocol,
    enabled_mcp_at_preflight:enabled,
    changed_paths:paths,out_of_scope_paths:outside,
    git_scan_error:gitError,source_changed:sourceChanged,
    original_test_hash_unchanged:testsUnchanged,
    grader_exit_code:grader.status,
    grader_error:grader.error?String(grader.error.message):null,
    grader_stdout_sha256:sha(String(grader.stdout||"")),
    grader_stderr_sha256:sha(String(grader.stderr||"")),
    grader_stderr_tail:String(grader.stderr||"").slice(-250),
    hidden_passed:grade?.passed??null,
    hidden_total:grade?.checked??null,
    failed_hidden_cases:grade?.cases?.filter(x=>!x.passed).map(x=>x.name)??null,
    native_post:native,
    raw_stdout_sha256:sha(stdout),raw_stderr_sha256:sha(stderr),
    wall_timeout:timeout,policy_denial:policy,
    frozen_no_production_change:true
  };
  writeFileSync(outFile,JSON.stringify(record,null,2)+"\n",{flag:"wx"});
  return record;
}
function score(){
  const rows=STUDY.run_order.flatMap(id=>{
    const t=STUDY.tasks.find(x=>x.id===id);
    return t.order.map(arm=>{
      const f=receipt(t,arm);
      return existsSync(f)?JSON.parse(readFileSync(f)):
        {task:id,arm,original_status:"NOT_RUN"};
    });
  });
  const complete=rows.every(x=>x.schema==="godprompt.v18.original-matched-checkpoint.v1");
  const byArm=Object.fromEntries(STUDY.arms.map(arm=>{
    const r=rows.filter(x=>x.arm===arm&&x.model_wall_seconds!==undefined);
    const accepted=r.filter(x=>x.accepted).length;
    const total=r.reduce((s,x)=>s+x.model_wall_seconds,0);
    const missing=r.filter(x=>x.model_reported_usage===null).length;
    const known=r.reduce((s,x)=>s+(x.model_reported_usage?.input_tokens??0),0);
    const mcp=r.reduce((s,x)=>s+x.intervention_tool_calls.length,0);
    return[arm,{planned:3,observed:r.length,accepted,
      all_attempt_wall_seconds:Number(total.toFixed(3)),
      seconds_per_accepted_fix:complete&&accepted?
        Number((total/accepted).toFixed(3)):null,
      model_reported_input_tokens_known:known,missing_usage:missing,
      intervention_calls:mcp}];
  }));
  return{study_id:STUDY.id,planned:6,observed:rows.filter(x=>x.model_wall_seconds!==undefined).length,
    complete,by_arm:byArm,rows:rows.map(x=>({
      task:x.task,arm:x.arm,status:x.original_status,
      seconds:x.model_wall_seconds??null,hidden_passed:x.hidden_passed??null,
      intervention_calls:x.intervention_tool_calls?.length??null
    })),replicated_productivity_gain_proven:false};
}
freeze();
const[action="plan",id,arm]=process.argv.slice(2);
let result;
if(action==="plan")result={id:STUDY.id,manifest_sha256:sha(MANIFEST_BYTES),
    runner_sha256:sha(readFileSync(fileURLToPath(import.meta.url))),
    order:STUDY.run_order.map(id=>{
      const t=STUDY.tasks.find(x=>x.id===id);
      return{id,arms:t.order,red:t.checkpoint_hidden_passed,hidden:t.hidden_total,
        references:[t.reference_a_passed,t.reference_b_passed],mutant:t.mutant_passed};
    })};
else if(action==="prepare")result=prepare();
else if(action==="run"){
  const t=STUDY.tasks.find(x=>x.id===id);
  assert.ok(t&&t.order.includes(arm),"Unknown task or arm");
  result=run(t,arm);
}
else if(action==="score")result=score();
else throw Error("Use plan|prepare|run TASK ARM|score");
console.log(JSON.stringify(result,null,2));
