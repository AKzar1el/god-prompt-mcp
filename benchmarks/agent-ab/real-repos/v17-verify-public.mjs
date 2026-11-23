#!/usr/bin/env node
/** V17 portable public study verifier: no raw private files, grader or writes. */
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const HERE=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");
const sha64=/^[0-9a-f]{64}$/u;
const round=x=>Number(x.toFixed(3));
const normalizeLf=x=>Buffer.from(x.toString("utf8").replace(/\r\n/gu,"\n"),"utf8");
// Independently reconstructed and published immutable original receipt IDs.
// These intentionally include the timeout and the grader non-result.
const ORIGINALS={
  "anyio-1498-v17|baseline":["INVALID_TIMEOUT",420.150,
    "89d1426afc9b635b9fd7b8eb9a58f56b0104db1a946d5c6dd5d2db0585cf033c",0,3,4],
  "anyio-1498-v17|repeated_failure_mcp":["VALID_CORRECT",261.641,
    "f0757922a2266490e4c17379b8d7561bc39b5e9a3ed1553fbc5de5d17b9959b5",0,4,4],
  "rich-4255-v17|repeated_failure_mcp":["INVALID_OTHER",256.296,
    "fecd9f92a2099f37cb3bcb8431a301a22792c89ac85269d2f79120737e9cb5a1",0,null,null],
  "rich-4255-v17|baseline":["VALID_CORRECT",210.499,
    "1b59495317864f82576002e942c8c84f607232d3da652e3aae628f8f66b704e2",0,15,15],
  "pytest-15287-v17|baseline":["VALID_CORRECT",200.091,
    "2976cc51537d30597bae2006fc24865b2f7e2dc4cea032525b33dd9f62b680fc",0,10,10],
  "pytest-15287-v17|repeated_failure_mcp":["VALID_CORRECT",246.676,
    "0d7fa363fb41495013c97443acc8e8769fb55bf63df3e86d89819b8e33ef4710",0,10,10]
};

export function verifyV17Public(study,publicResult,originalManifestBytes){
  assert.equal(study.schema,"godprompt.v17.difficult-failure-recovery-study.v1");
  assert.equal(publicResult.schema,"godprompt.v17.public-original-evidence.v1");
  assert.equal(publicResult.study_id,study.study_id);
  assert.equal(sha(normalizeLf(originalManifestBytes)),
    publicResult.original_freeze_sha256.manifest);
  assert.equal(publicResult.original_freeze_sha256.private_grader,
    study.private_grader_sha256);
  assert.equal(publicResult.original_freeze_sha256.event_helper,
    study.event_audit_helper_sha256);
  assert.equal(publicResult.original_freeze_sha256.git_path_helper,
    study.git_changed_paths_helper_sha256);
  assert.equal(publicResult.original_freeze_sha256.pinned_runtime,
    study.godprompt_stdio_sha256);
  assert.equal(publicResult.original_freeze_sha256.runner,
    "d0787490034d7b24cb31422556af7761aaacf5273d3a12ed235bb0037a95a9c8");
  assert.equal(publicResult.planned_first_runs,6);
  assert.equal(publicResult.completed_first_runs,6);
  assert.deepEqual(publicResult.intended_arms,["baseline","repeated_failure_mcp"]);
  assert.equal(publicResult.preregistered_tasks.length,3);
  for(let i=0;i<study.tasks.length;i++){
    const t=study.tasks[i],p=publicResult.preregistered_tasks[i];
    assert.equal(p.task_id,t.id);
    assert.equal(p.issue,t.issue);
    assert.equal(p.repository,t.repo);
    assert.equal(p.issue_url,t.url);
    assert.equal(p.pinned_source_sha,t.source_sha);
    assert.equal(p.original_untouched_passed,t.original_behavior_passed);
    assert.equal(p.hidden_cases,t.behavior_checks);
    assert.equal(p.reference_a_passed,t.reference_a_passed);
    assert.equal(p.reference_b_passed,t.reference_b_passed);
    assert.equal(p.deliberately_wrong_mutant_passed,t.mutant_passed);
    assert.deepEqual(p.frozen_order,t.order);
  }
  const expected=study.tasks.flatMap(t=>t.order.map(a=>t.id+"|"+a));
  assert.deepEqual(publicResult.original_rows.map(x=>x.task_id+"|"+x.arm),expected,
    "Every original arm must appear exactly once in frozen order");
  assert.deepEqual(Object.keys(ORIGINALS),expected);
  const identity=new Set();
  for(const row of publicResult.original_rows){
    const original=ORIGINALS[row.task_id+"|"+row.arm];
    assert.ok(original);
    assert.deepEqual(
      [row.original_status,row.elapsed_seconds,row.original_receipt_sha256,
        row.real_mcp_calls,row.hidden_passed,row.hidden_total],
      original,"Original frozen first-run receipt changed");
    const t=study.tasks.find(x=>x.id===row.task_id);
    assert.ok(t&&t.issue===row.issue&&t.repo===row.repo);
    assert.ok(["VALID_CORRECT","VALID_INCORRECT","INVALID_PROTOCOL",
      "INVALID_TIMEOUT","INVALID_POLICY","INVALID_OTHER"].includes(row.original_status));
    assert.ok(Number.isFinite(row.elapsed_seconds)&&row.elapsed_seconds>0&&
      row.elapsed_seconds<=t.timeout_seconds+8);
    assert.equal(row.original_status==="VALID_CORRECT",row.accepted);
    for(const k of ["original_receipt_sha256","original_jsonl_sha256",
      "original_stderr_sha256"]) assert.ok(sha64.test(row[k]));
    assert.ok(!identity.has(row.original_receipt_sha256));
    identity.add(row.original_receipt_sha256);
    if(row.model_reported_input_tokens===null){
      assert.equal(row.model_reported_cached_input_tokens,null);
      assert.equal(row.model_reported_output_tokens,null);
    }else{
      assert.ok(Number.isSafeInteger(row.model_reported_input_tokens)&&
        row.model_reported_input_tokens>=0);
      assert.ok(Number.isSafeInteger(row.model_reported_cached_input_tokens)&&
        row.model_reported_cached_input_tokens>=0&&
        row.model_reported_cached_input_tokens<=row.model_reported_input_tokens);
      assert.ok(Number.isSafeInteger(row.model_reported_output_tokens)&&
        row.model_reported_output_tokens>=0);
    }
    if(row.repeated_failure_trigger===false&&row.arm==="repeated_failure_mcp")
      assert.equal(row.real_mcp_calls,0,
        "No GodPrompt diagnostic call without the strict source-edit failure gate");
    if(row.accepted){
      assert.equal(row.hidden_passed,t.behavior_checks);
      assert.equal(row.hidden_total,t.behavior_checks);
      assert.equal(row.native_test_exit_code,0);
      assert.ok(row.native_tests_count>=study.environment.minimum_native_tests);
      assert.equal(row.model_exit_code,0);
      assert.equal(row.timeout,false);
      assert.equal(row.policy_denial,false);
    }
    if(row.timeout){
      assert.equal(row.original_status,"INVALID_TIMEOUT");
      assert.equal(row.accepted,false);
    }
  }
  const byArm={};
  for(const arm of study.arms){
    const records=publicResult.original_rows.filter(r=>r.arm===arm);
    const accepted=records.filter(r=>r.accepted).length;
    const elapsed=round(records.reduce((s,r)=>s+r.elapsed_seconds,0));
    const known=records.reduce((s,r)=>s+(r.model_reported_input_tokens??0),0);
    const cached=records.reduce((s,r)=>s+(r.model_reported_cached_input_tokens??0),0);
    const output=records.reduce((s,r)=>s+(r.model_reported_output_tokens??0),0);
    const missing=records.filter(r=>r.model_reported_input_tokens===null).length;
    byArm[arm]={
      attempts:records.length,accepted,
      original_total_wall_seconds:elapsed,
      seconds_per_accepted_fix:accepted?round(elapsed/accepted):null,
      model_reported_input_tokens_known:known,
      model_reported_cached_input_tokens_known:cached,
      model_reported_output_tokens_known:output,
      missing_usage_attempts:missing,
      model_input_tokens_per_fix:accepted&&!missing?Math.round(known/accepted):null
    };
  }
  assert.deepEqual(publicResult.by_arm,byArm);
  let conditionalWins=[],baselineWins=[],ties=[];
  for(const t of study.tasks){
    const b=publicResult.original_rows.find(r=>r.task_id===t.id&&r.arm==="baseline");
    const a=publicResult.original_rows.find(r=>r.task_id===t.id&&r.arm==="repeated_failure_mcp");
    if(a.accepted&&!b.accepted)conditionalWins.push(t.id);
    else if(b.accepted&&!a.accepted)baselineWins.push(t.id);
    else if(a.accepted&&b.accepted){
      if(a.elapsed_seconds<b.elapsed_seconds)conditionalWins.push(t.id);
      else if(b.elapsed_seconds<a.elapsed_seconds)baselineWins.push(t.id);
      else ties.push(t.id);
    }else ties.push(t.id);
  }
  assert.deepEqual(publicResult.comparisons.conditional_wins_on_accuracy_or_time,conditionalWins);
  assert.deepEqual(publicResult.comparisons.baseline_wins_on_accuracy_or_time,baselineWins);
  assert.deepEqual(publicResult.comparisons.ties_or_both_incorrect,ties);
  const rate=byArm.baseline.accepted&&byArm.repeated_failure_mcp.accepted?
    Number(((byArm.repeated_failure_mcp.seconds_per_accepted_fix/
      byArm.baseline.seconds_per_accepted_fix-1)*100).toFixed(2)):null;
  assert.equal(publicResult.comparisons.relative_treatment_seconds_per_accepted_fix_percent,rate);
  assert.equal(publicResult.comparisons.conditional_godprompt_calls_total,
    publicResult.original_rows.filter(r=>r.arm==="repeated_failure_mcp")
      .reduce((s,r)=>s+r.real_mcp_calls,0));
  assert.equal(publicResult.comparisons.treatment_strict_trigger_observed_attempts,
    publicResult.original_rows.filter(r=>
      r.arm==="repeated_failure_mcp"&&r.repeated_failure_trigger).length);
  assert.equal(publicResult.comparisons.replicated_godprompt_uplift_proven,false);
  assert.equal(publicResult.comparisons.production_guidance_change,"NO_GO");
  assert.equal(publicResult.audit.independent_original_receipt_count,6);
  assert.equal(publicResult.audit.private_raw_jsonl_committed,false);
  assert.equal(publicResult.audit.private_calibration_patches_committed,false);
  assert.equal(publicResult.audit.private_grader_committed,false);
  assert.ok(publicResult.caveats.length>=5);
  return {status:"VERIFIED_V17_SIX_ORIGINAL_ARMS_NO_CAUSAL_GAIN_CLAIM",
    observed:6,accepted_by_arm:Object.fromEntries(study.arms.map(a=>
      [a,byArm[a].accepted])),
    seconds_per_accepted_fix:Object.fromEntries(study.arms.map(a=>
      [a,byArm[a].seconds_per_accepted_fix])),
    actual_treatment_mcp_calls:publicResult.comparisons.conditional_godprompt_calls_total,
    no_production_change:true};
}
if(process.argv[1]&&fileURLToPath(import.meta.url).toLowerCase()===
  process.argv[1].toLowerCase()){
  const raw=readFileSync(join(HERE,"v17-frozen-study-20261123.json"));
  const data=JSON.parse(readFileSync(join(HERE,"v17-public-results-20261123.json")));
  console.log(JSON.stringify(verifyV17Public(JSON.parse(raw),data,raw),null,2));
}
