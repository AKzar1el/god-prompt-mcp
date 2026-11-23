#!/usr/bin/env node
/** V16 portable public evidence verifier. No model, private grader, raw logs or writes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");
const SHA=/^[0-9a-f]{64}$/u;
const round=x=>Number(x.toFixed(3));
const ORIGINALS={
  "tenacity-780-v16|conditional_mcp":[195.299,283488,0,"6dbb75c6c934877845c3de22912ef5e88566d68102bc0d8f125b5e49e6105616"],
  "tenacity-780-v16|baseline":[104.930,141543,0,"1b0eb0c8a334bfab497e01dddc009508f6a0632030841a717085c2adacec06c5"],
  "tenacity-780-v16|full_mcp":[176.161,348687,5,"2f98ba98d1232d40657180d168fda01a2f969e70ce4b4fc2aac80f313626cea3"],
  "requests-7648-v16|full_mcp":[288.074,871528,5,"97b4db51ab73a7fe101a266c391e4aab90d2d2d8876502af475e0b7287f7472d"],
  "requests-7648-v16|conditional_mcp":[268.383,712424,1,"03b746e1c49b97f4e6611d149032307d6d50ed70527357f7e0c25f3f8bd026d1"],
  "requests-7648-v16|baseline":[172.486,325554,0,"3ed7c83f032abd9c7dbb7f93bac1c64d6f6b34d46c62f09d99f784d70ae08628"],
  "rich-4250-v16|baseline":[112.785,189824,0,"0620b008cae924502dd3bbc9812d96a5a7aee7bc09a92182b115219aea80ccf1"],
  "rich-4250-v16|full_mcp":[273.405,705728,5,"52a3797acb8f70e782d61d06b5de243de36c68f6c4237709b58ae25360ff2273"],
  "rich-4250-v16|conditional_mcp":[104.145,191838,0,"767afa5f4a752139ec3dae5a272fc959de2ed4dd1a2aa9b6b241dafc83ebebdf"]
};
function normalizedLf(bytes){
  return Buffer.from(bytes.toString("utf8").replace(/\r\n/gu,"\n"),"utf8");
}

export function verifyV16Public(study,evidence,manifestBytes) {
  assert.equal(study.schema,"godprompt.v16.prospective-multirepo-study.v1");
  assert.equal(evidence.schema,"godprompt.v16.public-first-run-evidence.v1");
  assert.equal(evidence.study_id,study.study_id);
  assert.equal(sha(normalizedLf(manifestBytes)),evidence.frozen_sha256.manifest);
  assert.equal(evidence.frozen_sha256.private_grader,study.private_grader_sha256);
  assert.equal(evidence.frozen_sha256.pinned_runtime,study.godprompt_stdio_sha256);
  assert.equal(evidence.frozen_sha256.risk_gate,study.risk_gate_prototype_sha256);
  assert.equal(evidence.frozen_sha256.event_inspector,study.event_audit_helper_sha256);
  assert.equal(evidence.frozen_sha256.path_helper,study.git_changed_paths_helper_sha256);
  assert.equal(evidence.frozen_sha256.runner,
    "7024c44315dbde4e91f9c143ab321c893893db067d155a0a6563a98d9d3bf673");
  assert.equal(evidence.planned_attempts,9);
  assert.equal(evidence.recorded_first_runs,9);
  assert.equal(evidence.task_count,3);
  assert.deepEqual(study.arms,["baseline","full_mcp","conditional_mcp"]);
  assert.deepEqual(evidence.repositories.map(x=>x.repo),study.tasks.map(x=>x.repo));
  for(let i=0;i<study.tasks.length;i++){
    const task=study.tasks[i];
    const r=evidence.repositories[i];
    assert.equal(r.issue,task.issue);
    assert.equal(r.url,task.issue_url);
    assert.equal(r.pinned_source_sha,task.source_sha);
    assert.deepEqual(r.calibration,{
      untouched_passed:task.untouched_passed,
      reference_a_passed:task.reference_a_passed,
      reference_b_passed:task.reference_b_passed,
      intentionally_wrong_mutant_passed:task.mutant_passed,
      hidden_checks:task.hidden_checks});
  }
  const slots=study.tasks.flatMap(t=>t.order.map(a=>t.id+"|"+a));
  assert.deepEqual(evidence.first_runs.map(x=>x.task_id+"|"+x.arm),slots);
  assert.deepEqual(Object.keys(ORIGINALS),slots);
  for(const row of evidence.first_runs){
    const key=row.task_id+"|"+row.arm;
    const [seconds,tokens,calls,receiptHash]=ORIGINALS[key];
    const task=study.tasks.find(t=>t.id===row.task_id);
    assert.ok(task&&task.repo===row.repo&&task.issue===row.issue);
    assert.equal(row.original_status,"VALID_CORRECT");
    assert.equal(row.original_accepted,true);
    assert.equal(row.elapsed_seconds,seconds);
    assert.equal(row.model_reported_input_tokens,tokens);
    assert.equal(row.mcp_calls,calls);
    assert.equal(row.original_receipt_sha256,receiptHash);
    assert.equal(row.hidden_checks_passed,task.hidden_checks);
    assert.equal(row.hidden_checks_total,task.hidden_checks);
    assert.equal(row.native_tests_exit_code,0);
    assert.ok(Number.isInteger(row.model_reported_cached_input_tokens)&&
      row.model_reported_cached_input_tokens<=tokens);
    assert.ok(Number.isInteger(row.model_reported_output_tokens)&&
      row.model_reported_output_tokens>=0);
    assert.ok(Number.isInteger(row.scoped_changed_file_count) &&
      row.scoped_changed_file_count>=2&&row.scoped_changed_file_count<=task.allowed_paths.length);
    for(const key of ["original_receipt_sha256","original_jsonl_sha256","original_stderr_sha256"])
      assert.ok(SHA.test(row[key]),"Missing SHA256 field "+key);
  }
  const computed={};
  for(const arm of study.arms){
    const rr=evidence.first_runs.filter(r=>r.arm===arm);
    const total=round(rr.reduce((s,r)=>s+r.elapsed_seconds,0));
    const tokens=rr.reduce((s,r)=>s+r.model_reported_input_tokens,0);
    const cached=rr.reduce((s,r)=>s+r.model_reported_cached_input_tokens,0);
    const output=rr.reduce((s,r)=>s+r.model_reported_output_tokens,0);
    const accepted=rr.filter(r=>r.original_accepted).length;
    computed[arm]={
      attempts:rr.length,accepted,
      elapsed_all_attempts_seconds:total,
      seconds_per_accepted_fix:accepted?round(total/accepted):null,
      input_tokens_known:tokens,cached_input_tokens_known:cached,
      output_tokens_known:output,missing_usage_attempts:0,
      model_input_tokens_per_fix:accepted?Math.round(tokens/accepted):null
    };
  }
  assert.deepEqual(evidence.by_arm,computed);
  for(const arm of study.arms) assert.equal(computed[arm].accepted,3);
  const condDelta=Number(((computed.conditional_mcp.elapsed_all_attempts_seconds/
    computed.baseline.elapsed_all_attempts_seconds-1)*100).toFixed(2));
  const fullDelta=Number(((computed.full_mcp.elapsed_all_attempts_seconds/
    computed.baseline.elapsed_all_attempts_seconds-1)*100).toFixed(2));
  assert.equal(evidence.decision.relative_conditional_wall_time_percent,condDelta);
  assert.equal(evidence.decision.relative_full_wall_time_percent,fullDelta);
  assert.deepEqual(evidence.decision.baseline_faster_on_tasks,
    ["tenacity-780-v16","requests-7648-v16"]);
  assert.deepEqual(evidence.decision.conditional_faster_on_tasks,["rich-4250-v16"]);
  assert.equal(evidence.decision.statistical_replicable_godprompt_uplift_proven,false);
  assert.equal(evidence.decision.production_change,"NO_GO");
  assert.deepEqual(evidence.evidence_integrity,{
    originals_unchanged:true,private_raw_transcripts_committed:false,
    private_graders_committed:false,original_study_frozen:true,
    no_missing_receipts:true,independent_untracked_scope_inventory_complete:true
  });
  return {status:"VERIFIED_V16_NINE_ORIGINAL_FIRST_RUNS_NO_PRODUCTIVITY_GAIN",
    planned:9,original_first_runs:9,accepted_per_arm:
      Object.fromEntries(study.arms.map(arm=>[arm,computed[arm].accepted])),
    seconds_per_fix:Object.fromEntries(study.arms.map(arm=>
      [arm,computed[arm].seconds_per_accepted_fix])),
    no_release:true};
}
if(process.argv[1]&&fileURLToPath(import.meta.url).toLowerCase()===
  process.argv[1].toLowerCase()){
  const raw=readFileSync(join(HERE,"v16-prospective-study-20261123.json"));
  const ev=JSON.parse(readFileSync(join(HERE,"v16-public-results-20261123.json")));
  console.log(JSON.stringify(verifyV16Public(JSON.parse(raw),ev,raw),null,2));
}
