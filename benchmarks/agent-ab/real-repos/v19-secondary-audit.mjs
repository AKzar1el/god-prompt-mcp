#!/usr/bin/env node
/**
 * V19 independent reconstruction from original private JSONL, stderr, Git
 * inventory, frozen manifest and original receipt. Read only, no model calls.
 * Does not import the original runner or V19 event-audit helper.
 */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {existsSync,readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v19");
const MANIFEST=join(HERE,"v19-frozen-pilot-20261123.json");
const sha=x=>createHash("sha256").update(x).digest("hex");
const NATIVE=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;
const TOKEN_FIELDS=["input_tokens","cached_input_tokens","output_tokens"];
const EXPECT_GENERIC={task_type:"DEBUG",phase:"execute",compact:true,max_chars:600};
function exactlyArgs(args,expected){
  if(typeof args==="string"){try{args=JSON.parse(args)}catch{return false}}
  return args&&typeof args==="object"&&!Array.isArray(args)&&
    Object.keys(args).sort().join(",")===Object.keys(expected).sort().join(",")&&
    Object.keys(expected).every(k=>args[k]===expected[k]);
}
function rawInventory(dir){
  function gitRaw(args){
    const p=spawnSync("git",args,{cwd:dir,windowsHide:true,
      encoding:"buffer",timeout:30000,maxBuffer:3*1024*1024,
      env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
    assert.ok(!p.error,"Git inventory process failed");
    assert.equal(p.status,0,
      "Unable to independently inventory Git: "+String(p.stderr).slice(0,230));
    return p.stdout.toString("utf8").split("\0")
      .filter(Boolean).map(x=>x.replaceAll("\\","/"));
  }
  return [...new Set([...gitRaw(["diff","HEAD","--name-only","-z"]),
    ...gitRaw(["ls-files","--others","--exclude-standard","-z"])])].sort();
}
export function independentV19EventReader(raw,dir,sourcePath){
  if(typeof raw!=="string"||!dir||!sourcePath)
    throw new TypeError("Original model events and exact source required");
  const path=resolve(dir,sourcePath).toLowerCase();
  let turns=0,usageTurns=0,commands=0,edits=0,nativeRuns=0,
    nativePass=0,nativeFail=0,malformed=0;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls=[];
  for(const line of raw.split(/\r?\n/u)){
    if(!line.trim())continue;
    let e;
    try{e=JSON.parse(line)}catch{malformed++;continue}
    if(e.type==="turn.completed"){
      turns++;
      if(TOKEN_FIELDS.every(k=>Number.isSafeInteger(e.usage?.[k])&&
          e.usage[k]>=0)){
        usageTurns++;
        for(const k of TOKEN_FIELDS)usage[k]+=e.usage[k];
      }
    }
    if(e.type!=="item.completed")continue;
    const x=e.item??{};
    if(x.type==="file_change"&&x.status==="completed"&&!x.error&&
      Array.isArray(x.changes)&&x.changes.some(change=>
        typeof change?.path==="string"&&
        resolve(dir,change.path).toLowerCase()===path))edits++;
    if(x.type==="command_execution"){
      if(x.status==="completed"&&!x.error&&x.exit_code===0)commands++;
      if(NATIVE.test(String(x.command??""))&&Number.isInteger(x.exit_code)){
        nativeRuns++;
        if(x.exit_code===0&&!x.error)nativePass++;
        else nativeFail++;
      }
    }
    if(x.type==="mcp_tool_call"){
      const content=x.result?.structured_content??x.result?.structuredContent;
      calls.push({
        server:x.server,tool:x.tool,
        success:x.status==="completed"&&!x.error,
        before_source_edit:edits===0,
        exact_generic_args:!!exactlyArgs(x.arguments,EXPECT_GENERIC),
        exact_evidence_args:!!exactlyArgs(x.arguments,{}),
        packet_task:content?.task_id??null,
        packet_evidence_sha256:content?.evidence_sha256??null,
        packet_status:content?.status??null
      });
    }
  }
  return {turns,commands,source_edits:edits,native_runs:nativeRuns,
    native_pass:nativePass,native_fail:nativeFail,malformed,
    mcp_calls:calls,
    usage:turns&&turns===usageTurns?usage:null};
}
function verifyOriginal(study,task,arm){
  const base=join(ROOT,"receipts",task.id,arm);
  if(!existsSync(base+".json"))return null;
  const recordBytes=readFileSync(base+".json");
  const record=JSON.parse(recordBytes);
  const stdout=readFileSync(base+".jsonl");
  const stderr=readFileSync(base+".stderr.txt");
  const dir=join(ROOT,"arms",task.id,arm);
  assert.equal(record.schema,"godprompt.v19.original-three-arm-first-run.v1");
  assert.equal(record.study,study.id);
  assert.equal(record.id,task.id);
  assert.equal(record.arm,arm);
  assert.equal(record.repo,task.repo);
  assert.equal(record.issue,task.issue);
  assert.equal(record.frozen_manifest_sha256,
    sha(readFileSync(MANIFEST)));
  assert.equal(record.upstream_source_sha,task.source_sha);
  assert.equal(record.initial_source_sha256,task.source_sha256);
  assert.equal(record.initial_regression_sha256,task.regression_sha256);
  assert.equal(record.evidence_packet_sha256,task.packet_file_sha256);
  assert.equal(record.evidence_receipt_sha256,task.evidence_sha256);
  assert.equal(sha(stdout),record.raw_stdout_sha256);
  assert.equal(sha(stderr),record.raw_stderr_sha256);
  assert.ok(record.wall_seconds>=0&&
    record.wall_seconds<=task.timeout_seconds+10,
    "Original wall time outside frozen cap");
  const head=execFileSync("git",["rev-parse","HEAD"],{
    cwd:dir,encoding:"utf8",windowsHide:true,timeout:30000}).trim();
  assert.equal(head,task.source_sha);
  assert.equal(sha(readFileSync(join(dir,study.native_test_rel_path))),
    task.regression_sha256);
  assert.equal(record.frozen_regression_unchanged,true);
  const scope=rawInventory(dir);
  assert.deepEqual(scope,record.changed_paths?.slice().sort());
  const outside=scope.filter(x=>![task.source_file,
    study.native_test_rel_path].includes(x));
  assert.deepEqual(outside,record.out_of_scope_paths);
  const event=independentV19EventReader(
    stdout.toString("utf8"),dir,task.source_file);
  assert.equal(event.turns,record.model_turns);
  assert.equal(event.commands,record.successful_commands);
  assert.equal(event.source_edits,record.source_edits);
  assert.equal(event.native_runs,record.native_runs_in_model_log);
  assert.equal(event.native_pass,record.native_test_successes_in_log);
  assert.equal(event.native_fail,record.native_test_failures_in_log);
  assert.equal(event.malformed,record.malformed_jsonl_lines);
  assert.deepEqual(event.usage,record.model_reported_usage);
  assert.deepEqual(event.mcp_calls,record.mcp_calls,
    "Actual MCP call arguments or return packet differ from original receipt");
  let valid=event.mcp_calls.every(c=>c.server==="godprompt"||
    c.server==="godprompt_evidence");
  if(arm==="baseline")valid&&=event.mcp_calls.length===0;
  else if(event.mcp_calls.length!==1)valid=false;
  else {
    const c=event.mcp_calls[0];
    if(!c.success||!c.before_source_edit)valid=false;
    else if(arm==="generic_godprompt")
      valid&&=c.server==="godprompt"&&c.tool==="get_tailored_guidance"&&
        c.exact_generic_args;
    else
      valid&&=c.server==="godprompt_evidence"&&
        c.tool==="get_failure_evidence"&&c.exact_evidence_args&&
        c.packet_task===task.id&&
        c.packet_evidence_sha256===task.evidence_sha256&&
        c.packet_status==="EXTERNALLY_FROZEN_FAILURE_EVIDENCE_NOT_ROOT_CAUSE";
  }
  assert.equal(valid,record.protocol_valid);
  assert.deepEqual(record.enabled_mcp_at_preflight,
    arm==="baseline"?[]:arm==="generic_godprompt"?
      ["godprompt"]:["godprompt_evidence"]);
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_TIMEOUT",
    "INVALID_PROTOCOL","INVALID_POLICY","INVALID_OTHER"].includes(
      record.original_status));
  if(record.accepted){
    assert.equal(record.original_status,"VALID_CORRECT");
    assert.equal(record.model_exit_code,0);
    assert.equal(record.timed_out,false);
    assert.equal(record.policy_denial,false);
    assert.equal(record.grader_status,0);
    assert.equal(record.grader_error,null);
    assert.equal(record.hidden_passed,task.hidden_total);
    assert.equal(record.hidden_total,task.hidden_total);
    assert.equal(record.post_model_native_test.status,0);
    assert.equal(record.post_model_native_test.count,task.native_tests);
    assert.ok(event.turns>0&&event.source_edits>0&&
      event.native_pass>0&&event.commands>0);
    assert.equal(event.malformed,0);
    assert.equal(valid,true);
    assert.ok(scope.includes(task.source_file));
    assert.deepEqual(outside,[]);
  }
  return{id:task.id,arm,status:record.original_status,
    accepted:record.accepted,seconds:record.wall_seconds,
    hidden_passed:record.hidden_passed,hidden_total:record.hidden_total,
    native_test_count:record.post_model_native_test.count,
    native_test_exit:record.post_model_native_test.status,
    grader_exit:record.grader_status,grader_error:record.grader_error,
    mcp_calls:event.mcp_calls,scope,
    model_reported_usage:event.usage,
    original_receipt_sha256:sha(recordBytes),
    original_jsonl_sha256:sha(stdout),
    original_stderr_sha256:sha(stderr)};
}
export function auditV19(){
  const body=readFileSync(MANIFEST);
  const study=JSON.parse(body);
  const freeze=JSON.parse(readFileSync(
    join(ROOT,"v19-freeze-sha256.json")));
  assert.equal(sha(body),freeze.manifest_sha256);
  for(const[file,key]of [
    ["v19-runner.mjs","runner_sha256"],
    ["v19-event-audit.mjs","event_inspector_sha256"],
    ["v19-evidence-stdio.mjs","evidence_mcp_stdio_sha256"]]){
    assert.equal(sha(readFileSync(join(HERE,file))),
      freeze[key],"Original frozen dependency changed: "+file);
  }
  assert.equal(sha(readFileSync(join(ROOT,"v19-grade.py"))),
    freeze.private_grader_sha256);
  const rows=[],missing=[];
  for(const task of study.tasks)for(const arm of task.order){
    const entry=verifyOriginal(study,task,arm);
    if(entry)rows.push(entry);
    else missing.push(task.id+"|"+arm);
  }
  const complete=rows.length===study.limits.original_denominator;
  const by_arm={};
  for(const arm of study.arms){
    const rr=rows.filter(x=>x.arm===arm);
    const seconds=rr.reduce((s,x)=>s+x.seconds,0);
    const accepted=rr.filter(x=>x.accepted).length;
    const known=rr.reduce((s,x)=>s+(x.model_reported_usage?.input_tokens??0),0);
    const missingUsage=rr.filter(x=>x.model_reported_usage===null).length;
    by_arm[arm]={original_attempts:rr.length,accepted,
      all_attempt_wall_seconds:Number(seconds.toFixed(3)),
      seconds_per_accepted_fix:complete&&accepted?
        Number((seconds/accepted).toFixed(3)):null,
      known_model_reported_input_tokens:known,
      missing_token_usage:missingUsage,
      actual_mcp_calls:rr.reduce((s,x)=>s+x.mcp_calls.length,0)};
  }
  return {schema:"godprompt.v19.independent-original-audit.v1",
    study:study.id,planned:study.limits.original_denominator,
    original_completed:rows.length,complete,missing,by_arm,rows,
    replicated_productivity_gain_proven:false,
    reviewer_status:"NO_INDEPENDENT_BLINDED_HUMAN_REVIEW",
    limitations:[
      "Only five matched public-bug tasks, one first run per condition; not enough to establish population gains.",
      "Two valid reference patches and private grader per task authored by the same researcher; blind human review not completed.",
      "Native tests are actual independently executed subprocesses, but private grader stdout itself was hashed rather than preserved as a standalone file.",
      "Cached model-reported input tokens are not independently billed."
    ]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(auditV19(),null,2));
