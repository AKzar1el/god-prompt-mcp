#!/usr/bin/env node
/**
 * V16 independent read-only validator of pinned first-run agent logs.
 * Never executes model text, runs a model, edits trial checkouts or repairs
 * an original receipt. It refuses a mutated grader/runner and preserves
 * incomplete untracked-file scope inventories as an explicit caveat.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { changedGitPaths } from "./v16-git-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../real-runs/replication-v16");
const STUDY_FILE = join(HERE,"v16-prospective-study-20261123.json");
const SHA = /^[0-9a-f]{64}$/u;
const sha = data => createHash("sha256").update(data).digest("hex");
const same = (a,b) => assert.deepEqual([...a].sort(),[...b].sort());

export function independentlyParseV16Events(jsonl) {
  let turns = 0, complete = 0, commands = 0, edits = 0, failures = 0, successes = 0;
  const usage = {input_tokens:0,cached_input_tokens:0,output_tokens:0};
  const calls = [];
  for (const line of jsonl.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const event = JSON.parse(line); // Fail closed on malformed line.
    if (event.type === "turn.completed") {
      turns++;
      if (Object.keys(usage).every(k => Number.isSafeInteger(event.usage?.[k]) &&
          event.usage[k] >= 0)) {
        complete++;
        for (const k of Object.keys(usage)) usage[k] += event.usage[k];
      }
    }
    if (event.type !== "item.completed") continue;
    const item = event.item || {};
    if (item.type === "command_execution") {
      if (item.status === "completed" && !item.error && item.exit_code === 0) commands++;
      if (edits && /\bpytest\b/iu.test(String(item.command || ""))) {
        if (item.status === "completed" && !item.error && item.exit_code === 0) successes++;
        if (Number.isInteger(item.exit_code) && item.exit_code !== 0) failures++;
      }
    }
    if (item.type === "file_change" && item.status === "completed" && !item.error) edits++;
    if (item.type === "mcp_tool_call") calls.push({
      server:item.server,tool:item.tool,
      success:item.status === "completed" && !item.error,
      after_post_edit_pytest_failure:failures > 0
    });
  }
  return {turns,commands,edits,failures,successes,calls,
    usage:turns && turns === complete ? usage : null};
}
export function verifyV16Receipt(study, receipt, raw, stderr, files, bytes) {
  assert.equal(study.schema,"godprompt.v16.prospective-multirepo-study.v1");
  assert.equal(receipt.schema,"godprompt.v16.original-first-run.v1");
  assert.equal(receipt.study,study.study_id);
  const task = study.tasks.find(t=>t.id===receipt.task_id);
  assert.ok(task && task.issue === receipt.issue && task.order.includes(receipt.arm));
  assert.equal(receipt.source_sha,task.source_sha);
  assert.equal(receipt.repo,task.repo);
  assert.equal(receipt.frozen_grader_sha256,study.private_grader_sha256);
  assert.ok(SHA.test(receipt.manifest_sha256) && SHA.test(receipt.prompt_sha256));
  assert.equal(sha(raw),receipt.stdout_sha256);
  assert.equal(sha(stderr),receipt.stderr_sha256);
  assert.ok(Number.isFinite(receipt.wall_seconds) && receipt.wall_seconds>=0 &&
    receipt.wall_seconds<=task.timeout_seconds+10);
  const events=independentlyParseV16Events(raw.toString("utf8"));
  assert.equal(events.turns,receipt.model_turns);
  assert.equal(events.commands,receipt.successful_native_commands);
  assert.equal(events.edits,receipt.successful_file_edits);
  assert.equal(events.failures,receipt.post_edit_pytest_failures);
  assert.equal(events.successes,receipt.successful_post_edit_pytest);
  assert.deepEqual(events.calls,receipt.mcp_calls);
  assert.deepEqual(events.usage,receipt.model_reported_usage);
  same(files,receipt.changed_paths ?? []);
  same(files.filter(x=>!task.allowed_paths.includes(x)),receipt.out_of_scope_paths ?? []);
  assert.equal(receipt.other_mcp_count,events.calls.filter(x=>x.server!=="godprompt").length);
  assert.deepEqual(receipt.enabled_mcp_at_preflight,
    receipt.arm==="baseline"?[]:["godprompt"]);
  const sameServer=events.calls.filter(x=>x.server==="godprompt");
  const good=sameServer.filter(x=>x.success);
  let protocol;
  if (receipt.arm==="baseline")protocol=sameServer.length===0 &&
    events.calls.length===0;
  else if (receipt.arm==="conditional_mcp") protocol=events.failures?
    sameServer.length===1&&good.length===1&&
      good[0].tool==="get_tailored_guidance" &&
      good[0].after_post_edit_pytest_failure===true:
    sameServer.length===0;
  else protocol=good.some(x=>x.tool==="classify_task") &&
    good.filter(x=>x.tool==="get_tailored_guidance").length>=2;
  if (events.calls.some(x=>x.server!=="godprompt"))protocol=false;
  assert.equal(receipt.protocol_valid,protocol);
  assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_OTHER",
    "INVALID_PROTOCOL","INVALID_TIMEOUT","INVALID_POLICY"].includes(receipt.original_status));
  if (receipt.accepted) {
    assert.equal(receipt.original_status,"VALID_CORRECT");
    assert.equal(receipt.model_exit_code,0);
    assert.equal(receipt.timeout,false);assert.equal(receipt.policy_denial,false);
    assert.equal(receipt.path_scan_error,null);
    assert.equal(protocol,true);
    assert.ok(events.turns>0 && events.commands>0 && events.edits>0 &&
      events.successes>0);
    assert.equal(receipt.hidden_total,task.hidden_checks);
    assert.equal(receipt.hidden_passed,task.hidden_checks);
    assert.equal(receipt.ordinary_tests_exit_code,0);
    assert.ok(files.includes(task.code_path) && files.some(p=>p.startsWith("tests/")));
    same(files.filter(x=>!task.allowed_paths.includes(x)),[]);
  }
  return {
    task_id:receipt.task_id,issue:receipt.issue,repo:receipt.repo,
    arm:receipt.arm,original_status:receipt.original_status,
    accepted:receipt.accepted,seconds:receipt.wall_seconds,
    hidden_passed:receipt.hidden_passed,hidden_total:receipt.hidden_total,
    native_test_exit:receipt.ordinary_tests_exit_code,
    post_edit_pytest_failures:events.failures,
    mcp_calls:events.calls.length,
    input_tokens:events.usage?.input_tokens??null,
    cached_input_tokens:events.usage?.cached_input_tokens??null,
    output_tokens:events.usage?.output_tokens??null,
    stdout_sha256:receipt.stdout_sha256,stderr_sha256:receipt.stderr_sha256,
    receipt_sha256:sha(bytes),
    scoped_file_count:files.length
  };
}
export function scoreV16(study,rows){
  const expected=new Set(study.tasks.flatMap(t=>t.order.map(arm=>t.id+"|"+arm)));
  assert.equal(expected.size,9);
  const seen=new Set();
  for(const row of rows){
    const key=row.task_id+"|"+row.arm;
    assert.ok(expected.has(key)&&!seen.has(key),"Duplicate or unexpected trial");
    seen.add(key);
  }
  const complete=seen.size===expected.size;
  const by_arm=Object.fromEntries(study.arms.map(arm=>{
    const rr=rows.filter(r=>r.arm===arm);
    const accepted=rr.filter(r=>r.accepted).length;
    const elapsed=rr.reduce((s,r)=>s+r.seconds,0);
    const missing=rr.filter(r=>r.input_tokens===null).length;
    const tokens=rr.reduce((s,r)=>s+(r.input_tokens??0),0);
    const cached=rr.reduce((s,r)=>s+(r.cached_input_tokens??0),0);
    const output=rr.reduce((s,r)=>s+(r.output_tokens??0),0);
    return [arm,{attempts:rr.length,accepted,
      elapsed_all_attempts_seconds:Number(elapsed.toFixed(3)),
      seconds_per_accepted_fix:complete&&accepted?Number((elapsed/accepted).toFixed(3)):null,
      input_tokens_known:tokens,cached_input_tokens_known:cached,
      output_tokens_known:output,missing_usage_attempts:missing,
      model_input_tokens_per_fix:complete&&accepted&&!missing?
        Math.round(tokens/accepted):null}];
  }));
  return {schema:"godprompt.v16.secondary-evidence-audit.v1",planned:expected.size,
    observed:rows.length,complete,by_arm,rows,
    repeatable_productivity_improvement_proven:false,production_change_no_go:true};
}
export function auditV16Folder(){
  const manifestBytes=readFileSync(STUDY_FILE);
  const study=JSON.parse(manifestBytes);
  const frozen=JSON.parse(readFileSync(join(ROOT,"v16-prospective-freeze-sha256.json")));
  assert.equal(sha(manifestBytes),frozen.manifest_sha256);
  for(const [file,expected] of [
    ["v16-prospective-runner.mjs",frozen.runner_sha256],
    ["v16-git-paths.mjs",frozen.git_changed_paths_helper_sha256],
    ["v16-event-audit.mjs",frozen.event_audit_helper_sha256],
    ["v16-risk-gated-guidance.mjs",frozen.risk_gate_prototype_sha256]]) {
    assert.equal(sha(readFileSync(join(HERE,file))),expected,"Mutated "+file);
  }
  assert.equal(sha(readFileSync(join(ROOT,"v16-grade.py"))),frozen.grader_sha256);
  const rows=[];const incomplete=[];
  for(const task of study.tasks)for(const arm of task.order){
    const base=join(ROOT,"receipts",task.id,arm);
    if(!existsSync(base+".json"))continue;
    const receiptBytes=readFileSync(base+".json");
    const receipt=JSON.parse(receiptBytes);
    assert.equal(receipt.manifest_sha256,frozen.manifest_sha256);
    const stdout=readFileSync(base+".jsonl");
    const stderr=readFileSync(base+".stderr.txt");
    const dir=join(ROOT,"arms",task.id,arm);
    const check=spawnSync("git",["ls-files","--others","--exclude-standard","-z"],{
      cwd:dir,encoding:"utf8",windowsHide:true,timeout:60000});
    const warning=String(check.stderr||"").trim();
    if(check.error||check.status!==0||warning) incomplete.push({
      task:task.id,arm,exit:check.status,warning_sha256:warning?sha(warning):null
    });
    const revision=execFileSync("git",["rev-parse","HEAD"],{
      cwd:dir,encoding:"utf8",windowsHide:true,timeout:60000}).trim();
    assert.equal(revision,task.source_sha);
    const paths=changedGitPaths(dir);
    rows.push(verifyV16Receipt(study,receipt,stdout,stderr,paths,receiptBytes));
  }
  const score=scoreV16(study,rows);
  return {...score,
    independent_untracked_scope_inventory_complete:incomplete.length===0,
    incomplete_scope_inventories:incomplete,
    no_replays_or_edited_original_receipts_claimed:false,
    caveats:[
      "Raw first-run logs and original SHA256 receipts were read in place; they were not modified.",
      "One model attempt per frozen arm. No human blinded grading or unseen model-profile attestation.",
      "Any inaccessible sandbox-owned untracked paths are explicitly disclosed."
    ]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  console.log(JSON.stringify(auditV16Folder(),null,2));
}
