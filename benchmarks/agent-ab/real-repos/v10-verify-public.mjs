#!/usr/bin/env node
/** Validate V10 public stopped-study evidence without launching any coding agent. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const HERE=dirname(fileURLToPath(import.meta.url));
const SHA=data=>createHash("sha256").update(data).digest("hex");
const HASH=/^[0-9a-f]{64}$/u;
const good=(v,message)=>assert.ok(v,message);

export function verifyV10Stopped(manifest,evidence,manifestBytes){
  assert.equal(manifest.schema,"godprompt.v10.real-issues.triarm.first-run.v1");
  assert.equal(evidence.schema,"godprompt.v10.stopped-public-first-run-evidence.v1");
  assert.equal(evidence.study,manifest.study_id);
  assert.equal(evidence.manifest_sha256,SHA(manifestBytes));
  assert.equal(evidence.frozen_source_sha,manifest.source.sha);
  assert.equal(evidence.frozen_godprompt_sha,manifest.godprompt.source_sha);
  assert.equal(evidence.frozen_stdio_sha256,manifest.godprompt.stdio_sha256);
  assert.equal(evidence.private_grader_sha256,manifest.grader.sha256);
  good(HASH.test(evidence.private_grader_sha256),"Bad frozen grader digest");
  assert.equal(manifest.tasks.length,2);
  assert.deepEqual(manifest.arms,["baseline","full_mcp","compact_mcp"]);
  assert.equal(manifest.grader.checks_per_issue,19);
  assert.equal(manifest.cli.exit_after_s,360);
  const expected=manifest.tasks.flatMap(t=>t.order.map(arm=>[t.id,arm,t.issue]));
  assert.equal(expected.length,6);
  assert.equal(new Set(expected.map(x=>JSON.stringify(x.slice(0,2)))).size,6);
  assert.equal(evidence.planned,6);
  assert.equal(evidence.original_first_run_attempts,2);
  assert.equal(evidence.not_run,4);
  assert.equal(evidence.accepted_fixes,0);
  assert.equal(evidence.status,"STOPPED_TIMEOUT_POLICY_AND_FROZEN_GRADER_DEFECT");
  good(Array.isArray(evidence.attempts)&&evidence.attempts.length===6,
    "All six planned slots must be accounted for");
  for(let i=0;i<expected.length;i++){
    const trial=evidence.attempts[i], [task,arm,issue]=expected[i];
    assert.equal(trial.task_id,task);
    assert.equal(trial.arm,arm);
    assert.equal(trial.issue??issue,issue);
    if(i>=2){
      assert.equal(trial.status,"NOT_RUN");
      good(trial.accepted===undefined&&trial.observed_wall_seconds===undefined&&
        trial.model_reported_input_tokens===undefined&&trial.private_grader_passed===undefined,
      "Unrun model has invented results");
      continue;
    }
    assert.equal(trial.accepted,false);
    assert.equal(trial.model_error,"ETIMEDOUT");
    assert.equal(trial.model_exit_code,null);
    good(trial.observed_wall_seconds>360,"Accepted pre-cap timeout mismatch");
    assert.equal(trial.completed_model_turns,0);
    assert.equal(trial.model_reported_input_tokens,null);
    assert.equal(trial.private_grader_passed,18);
    assert.equal(trial.private_grader_checks,19);
    assert.equal(trial.ordinary_original_tests_failed,0);
    good(trial.successful_shell_events>0&&trial.successful_edit_events>0,"No actual code work");
    good(HASH.test(trial.raw_jsonl_sha256)&&HASH.test(trial.original_receipt_sha256),
      "Original receipt identity missing");
  }
  assert.equal(evidence.attempts[0].status,"INVALID_TIMEOUT");
  assert.equal(evidence.attempts[0].policy_rejected,false);
  assert.equal(evidence.attempts[0].ordinary_original_tests_passed,29);
  assert.equal(evidence.attempts[0].successful_godprompt_mcp_calls,0);
  assert.equal(evidence.attempts[1].status,"INVALID_TIMEOUT_AND_POLICY_DENIAL");
  assert.equal(evidence.attempts[1].policy_rejected,true);
  assert.equal(evidence.attempts[1].ordinary_original_tests_passed,37);
  good(evidence.attempts[1].successful_godprompt_mcp_calls>=3,
    "Live MCP protocol evidence missing");
  assert.equal(evidence.frozen_grader_defect.affected_case,"408-duplicates-same-semantics");
  assert.equal(evidence.frozen_grader_defect.original_grader_rewritten,false);
  assert.equal(evidence.frozen_grader_defect.original_model_receipts_rewritten,false);
  assert.equal(evidence.frozen_grader_defect.retroactively_promoted_successes,false);
  assert.equal(evidence.measurements.seconds_per_accepted_fix,null);
  assert.equal(evidence.measurements.input_tokens_per_accepted_fix,null);
  assert.equal(evidence.measurements.causal_productivity_uplift,false);
  assert.equal(evidence.measurements.token_telemetry_missing_for_interrupted_sessions,true);
  for(const [k,v] of Object.entries(evidence.release_effects))
    assert.equal(v,false,"Unexpected production/release claim: "+k);
  return {
    status:"VERIFIED_STOPPED_GRADER_DEFECT_POLICY_NO_PRODUCTIVITY_CLAIM",
    frozen_manifest_sha256:SHA(manifestBytes),
    original_first_run_attempts:2,unrun:4,accepted:0,
    original_v9_replayed:false,release_effects:false
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const bytes=readFileSync(join(HERE,"v10-frozen-public-issues-20261123.json"));
  const results=JSON.parse(readFileSync(join(HERE,"v10-public-results-20261123.json"),"utf8"));
  console.log(JSON.stringify(verifyV10Stopped(JSON.parse(bytes),results,bytes),null,2));
}
