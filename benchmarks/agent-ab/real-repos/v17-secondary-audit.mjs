#!/usr/bin/env node
/** V17 independent read-only original JSONL / frozen receipt audit. No model calls. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {execFileSync,spawnSync} from "node:child_process";
import {existsSync,readFileSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {changedGitPaths} from "./v17-git-paths.mjs";

const HERE=dirname(fileURLToPath(import.meta.url));
const ROOT=resolve(HERE,"../real-runs/replication-v17");
const MANIFEST=join(HERE,"v17-frozen-study-20261123.json");
const sha=x=>createHash("sha256").update(x).digest("hex");
const same=(a,b)=>assert.deepEqual([...a].sort(),[...b].sort());
const TOKEN=["input_tokens","cached_input_tokens","output_tokens"];
const NATIVE=/\bpython(?:\.exe)?\s+(?:-B\s+)?-m\s+unittest\s+discover\b/iu;

export function parseOriginalV17(jsonl,task,dir){
  let turns=0,complete=0,commands=0,edits=0,codeEdits=0;
  let nativeRuns=0,passes=0,fails=0,lastFailedEdit=null,eligible=false;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls=[];
  for(const line of jsonl.split(/\r?\n/u)){
    if(!line.trim())continue;
    const ev=JSON.parse(line);
    if(ev.type==="turn.completed"){
      turns++;
      if(TOKEN.every(k=>Number.isSafeInteger(ev.usage?.[k])&&ev.usage[k]>=0)){
        complete++;
        for(const k of TOKEN)usage[k]+=ev.usage[k];
      }
    }
    if(ev.type!=="item.completed")continue;
    const x=ev.item||{};
    if(x.type==="file_change"&&x.status==="completed"&&!x.error){
      edits++;
      if(Array.isArray(x.changes)&&x.changes.some(change=>
        typeof change?.path==="string" &&
        task.code_paths.some(file=>resolve(dir,change.path).toLowerCase()===
          resolve(dir,file).toLowerCase())))codeEdits++;
    }
    if(x.type==="command_execution"){
      if(x.status==="completed"&&!x.error&&x.exit_code===0)commands++;
      if(codeEdits>0&&NATIVE.test(String(x.command||""))&&
          Number.isInteger(x.exit_code)){
        nativeRuns++;
        if(x.exit_code===0&&!x.error)passes++;
        else if(x.exit_code!==0){
          fails++;
          if(lastFailedEdit!==null&&codeEdits>lastFailedEdit)eligible=true;
          lastFailedEdit=codeEdits;
        }
      }
    }
    if(x.type==="mcp_tool_call")calls.push({
      server:x.server,tool:x.tool,
      success:x.status==="completed"&&!x.error,
      after_repeated_post_edit_test_failures:eligible
    });
  }
  return {turns,commands,edits,codeEdits,nativeRuns,passes,fails,eligible,calls,
    usage:turns&&turns===complete?usage:null};
}

export function verifyV17Receipt(study,record,original,stderr,actualPaths,receiptBytes){
  assert.equal(study.schema,"godprompt.v17.difficult-failure-recovery-study.v1");
  assert.equal(record.schema,"godprompt.v17.original-first-run.v1");
  assert.equal(record.study,study.study_id);
  const task=study.tasks.find(t=>t.id===record.task_id);
  assert.ok(task&&task.issue===record.issue&&task.repo===record.repo);
  assert.ok(task.order.includes(record.arm));
  assert.equal(record.source_sha,task.source_sha);
  assert.equal(record.frozen_grader_sha256,study.private_grader_sha256);
  assert.equal(sha(original),record.stdout_sha256);
  assert.equal(sha(stderr),record.stderr_sha256);
  assert.ok(Number.isFinite(record.wall_seconds)&&
    record.wall_seconds>=0&&record.wall_seconds<=task.timeout_seconds+8);
  const dir=join(ROOT,"arms",task.id,record.arm);
  const parsed=parseOriginalV17(original.toString("utf8"),task,dir);
  assert.equal(record.model_turns,parsed.turns);
  assert.equal(record.successful_native_commands,parsed.commands);
  assert.equal(record.successful_file_edits,parsed.edits);
  assert.equal(record.successful_source_code_edits,parsed.codeEdits);
  assert.equal(record.native_test_runs_after_edits,parsed.nativeRuns);
  assert.equal(record.successful_post_edit_native_tests,parsed.passes);
  assert.equal(record.failing_post_edit_native_tests,parsed.fails);
  assert.equal(record.repeated_failure_gate_eligible,parsed.eligible);
  assert.deepEqual(record.mcp_calls,parsed.calls);
  assert.deepEqual(record.model_reported_usage,parsed.usage);
  same(record.changed_paths??[],actualPaths);
  const outside=actualPaths.filter(p=>!task.allowed_paths.includes(p));
  same(record.out_of_scope_paths??[],outside);
  const other=parsed.calls.filter(c=>c.server!=="godprompt");
  assert.equal(record.other_mcp_count,other.length);
  assert.deepEqual(record.enabled_mcp_at_preflight,
    record.arm==="baseline"?[]:["godprompt"]);
  const god=parsed.calls.filter(c=>c.server==="godprompt");
  let protocol=other.length===0;
  if(record.arm==="baseline")protocol=protocol&&god.length===0;
  else if(!parsed.eligible)protocol=protocol&&god.length===0;
  else protocol=protocol&&god.length===1&&god[0].success&&
    god[0].tool==="get_tailored_guidance"&&
    god[0].after_repeated_post_edit_test_failures===true;
  assert.equal(record.protocol_valid,protocol);
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_OTHER",
    "INVALID_PROTOCOL","INVALID_TIMEOUT","INVALID_POLICY"].includes(record.original_status));
  if(record.accepted){
    assert.equal(record.original_status,"VALID_CORRECT");
    assert.equal(record.model_exit_code,0);
    assert.equal(record.policy_denial,false);
    assert.equal(record.timeout,false);
    assert.equal(record.path_scan_error,null);
    assert.ok(parsed.turns>0&&parsed.commands>0&&parsed.edits>0&&parsed.codeEdits>0);
    assert.ok(parsed.passes>0);
    assert.equal(record.hidden_total,task.behavior_checks);
    assert.equal(record.hidden_passed,task.behavior_checks);
    assert.equal(record.ordinary_tests_exit_code,0);
    assert.ok(record.ordinary_tests_count>=study.environment.minimum_native_tests);
    assert.ok(task.code_paths.every(p=>actualPaths.includes(p)));
    assert.ok(actualPaths.includes(task.test_file));
    assert.deepEqual(outside,[]);
    assert.equal(protocol,true);
  }
  return {
    task_id:record.task_id,repo:record.repo,issue:record.issue,arm:record.arm,
    original_status:record.original_status,accepted:record.accepted,
    seconds:record.wall_seconds,model_exit_code:record.model_exit_code,
    timeout:record.timeout,policy_denial:record.policy_denial,
    hidden_passed:record.hidden_passed,hidden_total:record.hidden_total,
    native_tests:record.ordinary_tests_count,
    native_test_exit:record.ordinary_tests_exit_code,
    repeated_failure_trigger:parsed.eligible,
    native_failures_after_edits:parsed.fails,successful_native_tests:parsed.passes,
    successful_source_edits:parsed.codeEdits,
    mcp_calls:parsed.calls.length,
    input_tokens:parsed.usage?.input_tokens??null,
    cached_input_tokens:parsed.usage?.cached_input_tokens??null,
    output_tokens:parsed.usage?.output_tokens??null,
    receipt_sha256:sha(receiptBytes),
    raw_jsonl_sha256:record.stdout_sha256,raw_stderr_sha256:record.stderr_sha256
  };
}

export function scoreV17(study,rows){
  const expected=new Set(study.tasks.flatMap(t=>t.order.map(a=>t.id+"|"+a)));
  assert.equal(expected.size,6);
  const seen=new Set();
  for(const r of rows){
    const key=r.task_id+"|"+r.arm;
    assert.ok(expected.has(key)&&!seen.has(key),"Unexpected or duplicate original");
    seen.add(key);
  }
  const complete=seen.size===expected.size;
  const by_arm=Object.fromEntries(study.arms.map(arm=>{
    const rr=rows.filter(x=>x.arm===arm);
    const accepted=rr.filter(x=>x.accepted).length;
    const time=rr.reduce((s,x)=>s+x.seconds,0);
    const input=rr.reduce((s,x)=>s+(x.input_tokens??0),0);
    const cached=rr.reduce((s,x)=>s+(x.cached_input_tokens??0),0);
    const output=rr.reduce((s,x)=>s+(x.output_tokens??0),0);
    const missing=rr.filter(x=>x.input_tokens===null).length;
    return [arm,{attempts:rr.length,accepted,
      original_total_wall_seconds:Number(time.toFixed(3)),
      seconds_per_accepted_fix:complete&&accepted?
        Number((time/accepted).toFixed(3)):null,
      model_reported_input_tokens_known:input,
      model_reported_cached_input_tokens_known:cached,
      model_reported_output_tokens_known:output,
      missing_usage_attempts:missing,
      model_input_tokens_per_fix:complete&&accepted&&!missing?
        Math.round(input/accepted):null
    }];
  }));
  return {schema:"godprompt.v17.independent-first-run-audit.v1",
    planned:expected.size,observed:rows.length,complete,by_arm,rows,
    replicated_productivity_gain_proven:false};
}

export function auditV17Folder(){
  const originalManifest=readFileSync(MANIFEST);
  const study=JSON.parse(originalManifest);
  const frozen=JSON.parse(readFileSync(join(ROOT,"v17-freeze-sha256.json")));
  assert.equal(sha(originalManifest),frozen.manifest_sha256);
  for(const [file,key] of [
    ["v17-runner.mjs","runner_sha256"],
    ["v17-event-audit.mjs","event_audit_helper_sha256"],
    ["v17-git-paths.mjs","git_path_helper_sha256"]]){
    assert.equal(sha(readFileSync(join(HERE,file))),frozen[key],"Changed frozen "+file);
  }
  assert.equal(sha(readFileSync(join(ROOT,"v17-grade.py"))),
    frozen.private_grader_sha256);
  const incomplete=[];
  const rows=[];
  for(const task of study.tasks)for(const arm of task.order){
    const path=join(ROOT,"receipts",task.id,arm);
    if(!existsSync(path+".json"))continue;
    const receiptBytes=readFileSync(path+".json");
    const record=JSON.parse(receiptBytes);
    assert.equal(record.manifest_sha256,frozen.manifest_sha256);
    const stdout=readFileSync(path+".jsonl"),stderr=readFileSync(path+".stderr.txt");
    const dir=join(ROOT,"arms",task.id,arm);
    const stat=spawnSync("git",["ls-files","--others","--exclude-standard","-z"],{
      cwd:dir,encoding:"utf8",windowsHide:true,timeout:60000
    });
    const warnings=String(stat.stderr||"").trim();
    if(stat.error||stat.status!==0||warnings)
      incomplete.push({task:task.id,arm,git_status:stat.status,
        warnings_sha256:warnings?sha(warnings):null});
    const head=execFileSync("git",["rev-parse","HEAD"],{
      cwd:dir,encoding:"utf8",windowsHide:true,timeout:60000}).trim();
    assert.equal(head,task.source_sha);
    const paths=changedGitPaths(dir);
    rows.push(verifyV17Receipt(study,record,stdout,stderr,paths,receiptBytes));
  }
  const score=scoreV17(study,rows);
  return {...score,independent_untracked_file_inventory_complete:incomplete.length===0,
    incomplete_git_inventories:incomplete,
    no_original_retries_or_receipt_rewrites_claimed:false,
    limitations:[
      "This is a read-only raw receipt and native event audit, not human blinded semantic review.",
      "Same-author calibration reference patches and private graders; only three new public tasks.",
      "Model/effort and metered billability are not independently attested; no V17 production feature."
    ]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(auditV17Folder(),null,2));
