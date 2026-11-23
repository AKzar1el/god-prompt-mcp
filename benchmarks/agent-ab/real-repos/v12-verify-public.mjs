#!/usr/bin/env node
/** V12 frozen evidence audit. No model execution or post-hoc acceptance changes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const sha=x=>createHash("sha256").update(x).digest("hex");
const SHA=/^[0-9a-f]{64}$/u;

export function verifyPublicV12(study,evidence,manifestBytes){
  assert.equal(study.schema,"godprompt.v12.real-repo.multireference-triarm.v1");
  assert.equal(evidence.schema,"godprompt.v12.stopped-public-evidence.v1");
  assert.equal(sha(manifestBytes),evidence.frozen_manifest_sha256);
  assert.ok(SHA.test(evidence.frozen_runner_sha256));
  assert.equal(study.grader_sha256,evidence.frozen_grader_sha256);
  assert.equal(study.source_sha,evidence.source_sha);
  assert.equal(evidence.status,"STOPPED_FROZEN_RUBRIC_OPTIONAL_UVX_PYTHON_FALSE_NEGATIVE");
  assert.equal(study.tasks.length,2);
  assert.deepEqual(study.arms,["baseline","full_mcp","compact_mcp"]);
  const expected=study.tasks.flatMap(t=>t.order.map(arm=>t.id+"|"+arm));
  const actual=evidence.trials.map(t=>t.task_id+"|"+t.arm);
  assert.equal(expected.length,6);
  assert.equal(actual.length,6);
  assert.deepEqual(new Set(actual),new Set(expected));
  assert.equal(evidence.planned,6);
  assert.equal(evidence.original_first_runs,2);
  assert.equal(evidence.intentionally_unrun,4);
  const full=evidence.trials.find(x=>x.issue===415&&x.arm==="full_mcp");
  const base=evidence.trials.find(x=>x.issue===415&&x.arm==="baseline");
  assert.equal(full.original_status,"VALID_CORRECT");
  assert.equal(full.accepted,true);
  assert.equal(full.hidden_passed,14);
  assert.equal(full.hidden_total,14);
  assert.equal(full.wall_seconds,142.034);
  assert.equal(full.reported_input_tokens,401171);
  assert.equal(full.tests_passed,10);
  assert.equal(full.policy_denial,false);
  assert.deepEqual(full.changed_paths,["README.md"]);
  assert.deepEqual(full.outside_scope_paths,[]);
  assert.ok(SHA.test(full.original_jsonl_sha256));
  assert.equal(full.godprompt_calls.filter(x=>x.success).length,4);
  assert.equal(base.original_status,"VALID_INCORRECT");
  assert.equal(base.accepted,false);
  assert.equal(base.hidden_passed,13);
  assert.equal(base.hidden_total,14);
  assert.equal(base.wall_seconds,108.725);
  assert.equal(base.reported_input_tokens,230378);
  assert.equal(base.tests_passed,10);
  assert.equal(base.policy_denial,false);
  assert.equal(base.godprompt_calls.length,0);
  assert.deepEqual(base.failed_case_ids,["415-release-pinned-command"]);
  assert.deepEqual(base.changed_paths,["README.md"]);
  assert.deepEqual(base.outside_scope_paths,[]);
  assert.ok(SHA.test(base.original_jsonl_sha256));
  const unrun=evidence.trials.filter(x=>!Object.hasOwn(x,"original_status"));
  assert.equal(unrun.length,4);
  for(const x of unrun){
    assert.equal(x.status,"NOT_RUN");
    assert.ok(!Object.hasOwn(x,"accepted")&&!Object.hasOwn(x,"wall_seconds")&&
      !Object.hasOwn(x,"reported_input_tokens"),"Never fabricate unrun trials");
  }
  assert.equal(evidence.rubric_audit.original_score_unchanged,true);
  assert.equal(evidence.rubric_audit.independent_peer_adjudication,false);
  assert.equal(evidence.productivity.accepted_full,1);
  assert.equal(evidence.productivity.accepted_baseline_by_original_frozen_grade,0);
  assert.equal(evidence.productivity.accepted_compact,null);
  assert.equal(evidence.productivity.verified_speed_advantage,null);
  assert.equal(evidence.productivity.seconds_per_accepted_fix,null);
  assert.equal(evidence.productivity.input_tokens_per_accepted_fix,null);
  assert.equal(evidence.productivity.proven_causal_productivity_uplift,false);
  assert.equal(evidence.descriptive_only.valid_randomized_productivity_comparison,false);
  assert.ok(Object.values(evidence.release_effects).every(x=>x===false));
  return {status:"VERIFIED_STOPPED_OPTIONAL_UVX_RUBRIC_BIAS_NO_CAUSAL_CLAIM",
    frozen_sha256:sha(manifestBytes),planned:6,original_attempts:2,unrun:4,
    original_full_hidden_passed:14,original_baseline_hidden_passed:13};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const raw=readFileSync(join(HERE,"v12-frozen-study-20261123.json"));
  const data=JSON.parse(readFileSync(join(HERE,"v12-public-results-20261123.json")));
  console.log(JSON.stringify(verifyPublicV12(JSON.parse(raw),data,raw),null,2));
}
