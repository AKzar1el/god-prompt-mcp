#!/usr/bin/env node
/** Verify frozen, sanitized V11 evidence. Does not run agents or alter grading. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const SHA = /^[0-9a-f]{64}$/u;
export function verifyPublicV11(study, results, manifestBytes) {
  assert.equal(study.schema,"godprompt.v11.real-repository.calibrated-triarm.v1");
  assert.equal(results.schema,"godprompt.v11.stopped-public-evidence.v1");
  assert.equal(sha(manifestBytes),results.manifest_sha256);
  assert.equal(results.runner_sha256.length,64);
  assert.ok(SHA.test(results.runner_sha256));
  assert.equal(study.source_sha,results.pinned_source_sha);
  assert.equal(study.grader_sha256,results.grader_sha256);
  assert.equal(results.status,"STOPPED_FROZEN_GRADER_LAYOUT_BIAS");
  assert.equal(study.tasks.length,2);
  assert.deepEqual(study.arms,["baseline","full_mcp","compact_mcp"]);
  assert.equal(study.tasks.reduce((n,t)=>n+t.order.length,0),6);
  assert.equal(results.planned,6);
  assert.equal(results.original_first_run_count,1);
  assert.equal(results.raw_first_run.length,6);
  assert.deepEqual(results.red_reference,study.baseline_grade);
  assert.deepEqual(results.known_correct_reference,study.known_correct_grade);
  const expected=study.tasks.flatMap(t=>t.order.map(arm=>t.id+"|"+arm));
  const found=results.raw_first_run.map(x=>x.task_id+"|"+x.arm);
  assert.equal(new Set(found).size,6);
  assert.deepEqual(new Set(found),new Set(expected));
  const b=results.raw_first_run.find(x=>x.issue===415&&x.arm==="baseline");
  assert.ok(b);
  assert.equal(b.status,"VALID_INCORRECT");
  assert.equal(b.accepted,false);
  assert.equal(b.hidden_checks_passed,11);
  assert.equal(b.hidden_checks_total,14);
  assert.equal(b.elapsed_seconds,122.736);
  assert.equal(b.model_exit,0);
  assert.equal(b.model_turns,1);
  assert.equal(b.policy_denial,false);
  assert.equal(b.protocol_valid,true);
  assert.deepEqual(b.changed_paths,["README.md"]);
  assert.deepEqual(b.outside_scope_paths,[]);
  assert.equal(b.ordinary_tests_passed,10);
  assert.equal(b.ordinary_tests_exit,0);
  assert.ok(SHA.test(b.raw_jsonl_sha256)&&SHA.test(b.raw_stderr_sha256));
  assert.equal(b.reported_input_tokens,170417);
  assert.deepEqual(b.failed_case_ids,[
    "415-release-pinned-command",
    "415-explicit-installed-wheel-boundary",
    "415-does-not-change-earlier-readme",
  ]);
  const notRun=results.raw_first_run.filter(x=>x!==b);
  assert.equal(notRun.length,5);
  for(const x of notRun){
    assert.equal(x.status,"NOT_RUN");
    assert.ok(!Object.hasOwn(x,"accepted")&&!Object.hasOwn(x,"elapsed_seconds"),
      "Unrun arm cannot contain a fabricated outcome");
  }
  const productivity=results.productivity;
  assert.equal(productivity.baseline_accepted,0);
  assert.equal(productivity.full_mcp_accepted,null);
  assert.equal(productivity.compact_mcp_accepted,null);
  assert.equal(productivity.seconds_per_accepted_fix,null);
  assert.equal(productivity.model_reported_input_tokens_per_accepted_fix,null);
  assert.equal(productivity.causal_speed_or_accuracy_uplift_established,false);
  assert.ok(Object.values(results.release_effects).every(v=>v===false),
    "Unverified external effects");
  return {status:"VERIFIED_STOPPED_RUBRIC_BIAS_NO_PRODUCTIVITY_CLAIM",
    frozen_manifest_sha256:sha(manifestBytes),planned:6,attempted:1,
    not_run:5,original_baseline_hidden_passed:11,
    accepted_by_original_grade:0};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const manifestBytes=readFileSync(join(HERE,"v11-frozen-study-20261123.json"));
  const results=JSON.parse(readFileSync(join(HERE,"v11-public-results-20261123.json")));
  console.log(JSON.stringify(verifyPublicV11(JSON.parse(manifestBytes),results,manifestBytes),null,2));
}
