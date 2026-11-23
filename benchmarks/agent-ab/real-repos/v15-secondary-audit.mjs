#!/usr/bin/env node
/**
 * Independent read-only V15 receipt audit. No models, grader changes, or retries.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changedGitPaths } from "./v14-git-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../real-runs/replication-v15");
const STUDY_FILE = join(HERE, "v15-frozen-study-20261123.json");
const SHA = /^[0-9a-f]{64}$/u;
const sha = x => createHash("sha256").update(x).digest("hex");
const sameMembers = (a,b) => assert.deepEqual([...a].sort(),[...b].sort());

function parseEvents(raw) {
  const events = raw.split(/\r?\n/u).filter(Boolean).map(line=>JSON.parse(line));
  let turns=0,complete=0,commands=0,edits=0;
  const usage={input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls=[];
  for(const e of events) {
    if(e.type==="turn.completed") {
      turns++;
      if(Object.keys(usage).every(k=>Number.isSafeInteger(e.usage?.[k]) && e.usage[k]>=0)) {
        complete++;
        for(const k of Object.keys(usage))usage[k]+=e.usage[k];
      }
    }
    if(e.type!=="item.completed")continue;
    const x=e.item||{};
    if(x.type==="command_execution" && x.status==="completed" && !x.error &&
       x.exit_code===0)commands++;
    if(x.type==="file_change" && x.status==="completed" && !x.error)edits++;
    if(x.type==="mcp_tool_call")calls.push({server:x.server,tool:x.tool,
      success:x.status==="completed"&&!x.error});
  }
  return {turns,commands,edits,calls,usage:turns&&turns===complete?usage:null};
}

export function verifyV15Receipt(study,receipt,original,stderr,realPaths) {
  assert.equal(study.schema,"godprompt.v15.behavioral-verify-once-study.v1");
  assert.equal(receipt.schema,"godprompt.v15.original-first-run.v1");
  assert.equal(receipt.study,study.study_id);
  assert.equal(receipt.source_sha,study.source_sha);
  assert.equal(receipt.frozen_grader_sha256,study.private_grader_sha256);
  const task=study.tasks.find(t=>t.id===receipt.task_id);
  assert.ok(task&&task.issue===receipt.issue&&task.order.includes(receipt.arm));
  assert.ok(SHA.test(receipt.manifest_sha256));
  assert.equal(sha(original),receipt.stdout_sha256);
  assert.equal(sha(stderr),receipt.stderr_sha256);
  const obs=parseEvents(original);
  assert.equal(obs.turns,receipt.model_turns);
  assert.equal(obs.commands,receipt.successful_native_commands);
  assert.equal(obs.edits,receipt.successful_file_edits);
  assert.deepEqual(obs.calls,receipt.mcp_calls);
  assert.deepEqual(obs.usage,receipt.model_reported_usage);
  sameMembers(realPaths,receipt.changed_paths);
  const outside=realPaths.filter(p=>!task.allowed_paths.includes(p));
  sameMembers(outside,receipt.out_of_scope_paths);
  assert.equal(receipt.other_mcp_count,obs.calls.filter(x=>x.server!=="godprompt").length);
  assert.deepEqual(receipt.enabled_mcp_at_preflight,
    receipt.arm==="baseline"?[]:["godprompt"],
    "Only the intended pinned MCP source may be active");
  const good=obs.calls.filter(x=>x.server==="godprompt"&&x.success);
  const protocol=receipt.arm==="baseline"?obs.calls.length===0:
    receipt.arm==="verify_once_mcp"?
      obs.calls.length===1&&good.length===1&&good[0].tool==="get_tailored_guidance":
      good.some(x=>x.tool==="classify_task")&&
        good.filter(x=>x.tool==="get_tailored_guidance").length>=2;
  assert.equal(receipt.protocol_valid,protocol);
  assert.ok(Number.isFinite(receipt.wall_seconds)&&receipt.wall_seconds>=0);
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_OTHER",
    "INVALID_TIMEOUT","INVALID_POLICY"].includes(receipt.original_status));
  if(receipt.accepted) {
    assert.equal(receipt.original_status,"VALID_CORRECT");
    assert.equal(receipt.model_exit_code,0);
    assert.ok(receipt.model_turns>0&&receipt.successful_native_commands>0&&
      receipt.successful_file_edits>0);
    assert.equal(receipt.hidden_total,19);
    assert.equal(receipt.hidden_passed,19);
    assert.equal(receipt.ordinary_tests_exit_code,0);
    assert.deepEqual(outside,[]);
    assert.equal(receipt.policy_denial,false);
    assert.equal(receipt.timeout,false);
    assert.equal(receipt.protocol_valid,true);
  }
  return {task_id:receipt.task_id,arm:receipt.arm,
    original_status:receipt.original_status,accepted:receipt.accepted,
    hidden_checks:String(receipt.hidden_passed)+"/"+String(receipt.hidden_total),
    seconds:receipt.wall_seconds,
    input_tokens:receipt.model_reported_usage?.input_tokens??null};
}

export function scoreV15(study,rows) {
  const expected=new Set(study.tasks.flatMap(t=>t.order.map(a=>t.id+"|"+a)));
  assert.equal(expected.size,6);
  const seen=new Set();
  for(const r of rows) {
    const key=r.task_id+"|"+r.arm;
    assert.ok(expected.has(key)&&!seen.has(key),"Unexpected/duplicate slot: "+key);
    seen.add(key);
  }
  const complete=rows.length===expected.size;
  const by_arm=Object.fromEntries(study.arms.map(arm=>{
    const rr=rows.filter(r=>r.arm===arm);
    const accepted=rr.filter(r=>r.accepted).length;
    const seconds=rr.reduce((s,r)=>s+r.seconds,0);
    const missing=rr.filter(r=>r.input_tokens===null).length;
    const tokens=rr.reduce((s,r)=>s+(r.input_tokens??0),0);
    return [arm,{
      attempts:rr.length,accepted,
      all_attempts_seconds:Number(seconds.toFixed(3)),
      seconds_per_accepted_fix:complete&&accepted?Number((seconds/accepted).toFixed(3)):null,
      model_input_tokens_known:tokens,missing_usage_attempts:missing,
      input_tokens_per_accepted_fix:complete&&accepted&&!missing?
        Math.round(tokens/accepted):null
    }];
  }));
  return {schema:"godprompt.v15.secondary-evidence-audit.v1",
    planned:expected.size,observed:rows.length,complete,by_arm,rows,
    repeatable_productivity_improvement_proven:false};
}

export function auditV15Folder() {
  const studyBytes=readFileSync(STUDY_FILE);
  const study=JSON.parse(studyBytes);
  const frozen=JSON.parse(readFileSync(join(ROOT,"v15-freeze-sha256.json")));
  assert.equal(sha(studyBytes),frozen.manifest_sha256);
  assert.equal(frozen.grader_sha256,study.private_grader_sha256);
  assert.equal(sha(readFileSync(join(ROOT,"v15-grade.py"))),frozen.grader_sha256);
  assert.equal(sha(readFileSync(join(HERE,"v15-runner.mjs"))),frozen.runner_sha256);
  assert.equal(sha(readFileSync(join(HERE,"v15-git-paths.mjs"))),
    study.git_helper_sha256);
  const rows=[];
  const incompleteGitInventories=[];
  for(const task of study.tasks)for(const arm of task.order) {
    const base=join(ROOT,"receipts",task.id,arm);
    if(!existsSync(base+".json"))continue;
    const receipt=JSON.parse(readFileSync(base+".json"));
    assert.equal(receipt.manifest_sha256,frozen.manifest_sha256);
    const original=readFileSync(base+".jsonl");
    const stderr=readFileSync(base+".stderr.txt");
    const armDir=join(ROOT,"arms",task.id,arm);
    // Git can succeed while omitting sandbox-owned untracked directories
    // which it cannot traverse. Preserve that uncertainty instead of
    // overstating an exact changed-file allowlist audit.
    const visibility=spawnSync("git",["ls-files","--others","--exclude-standard","-z"],{
      cwd:armDir,encoding:"utf8",windowsHide:true,timeout:60000,
      env:{...process.env,GIT_TERMINAL_PROMPT:"0"}});
    const warnings=String(visibility.stderr||"").trim();
    if(visibility.error || visibility.status!==0 || warnings) {
      incompleteGitInventories.push({task:task.id,arm,
        command_exit:visibility.status,
        warning_sha256:warnings?sha(warnings):null,
        warning_count:warnings.split(/\r?\n/u).filter(x=>/warning:|permission denied/iu.test(x)).length});
    }
    const revision=execFileSync("git",["rev-parse","HEAD"],{
      cwd:armDir,encoding:"utf8",windowsHide:true,timeout:60000,
      env:{...process.env,GIT_TERMINAL_PROMPT:"0"}}).trim();
    assert.equal(revision,study.source_sha,"Original clone must remain pinned");
    const paths=changedGitPaths(armDir);
    rows.push(verifyV15Receipt(study,receipt,original.toString("utf8"),
      stderr.toString("utf8"),paths));
  }
  const score=scoreV15(study,rows);
  return {...score,
    independently_complete_untracked_scope_inventory:incompleteGitInventories.length===0,
    incomplete_untracked_scope_arms:incompleteGitInventories,
    note:"Original frozen verdicts unchanged; incomplete Git inventory must not be represented as an independently verified absence of extra files."};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  console.log(JSON.stringify(auditV15Folder(),null,2));
