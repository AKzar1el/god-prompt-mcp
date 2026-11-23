#!/usr/bin/env node
/** V15 frozen six-first-run public evidence audit. No models, grader, or writes. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE=dirname(fileURLToPath(import.meta.url));
const SHA=/^[0-9a-f]{64}$/u;
const sha=x=>createHash("sha256").update(x).digest("hex");
// The frozen V15 Windows manifest was CRLF; Git stores JSON as LF.
// Reconstitute the original frozen byte identity for cross-platform audit.
const originalWindowsBytes=bytes=>Buffer.from(bytes.toString("utf8")
  .replace(/\r?\n/gu,"\r\n"),"utf8");
const round=x=>Number(x.toFixed(3));

export function verifyV15Public(study,evidence,manifestBytes) {
  assert.equal(study.schema,"godprompt.v15.behavioral-verify-once-study.v1");
  assert.equal(evidence.schema,"godprompt.v15.public-first-run-results.v1");
  assert.equal(evidence.study,study.study_id);
  assert.equal(sha(originalWindowsBytes(manifestBytes)),evidence.frozen_manifest_sha256);
  assert.equal(evidence.frozen_runner_sha256,
    "dc70513dbcad5f67909618ed39b6bc6d0670be35916531ab3bcfa2e41b4456e9");
  assert.equal(evidence.frozen_grader_sha256,study.private_grader_sha256);
  assert.equal(evidence.frozen_source_sha,study.source_sha);
  assert.equal(evidence.godprompt_stdio_sha256,study.godprompt_stdio_sha256);
  assert.equal(evidence.planned,6);
  assert.equal(evidence.original_first_runs,6);
  assert.equal(evidence.not_run,0);
  assert.deepEqual(study.arms,["baseline","full_mcp","verify_once_mcp"]);
  const expected=study.tasks.flatMap(t=>t.order.map(arm=>t.id+"|"+arm));
  const actual=evidence.rows.map(r=>r.task_id+"|"+r.arm);
  assert.equal(actual.length,6);
  assert.deepEqual(actual,expected,"Frozen row order and original arms preserved");
  const states={
    "rss-retitles-410-v15|baseline":["VALID_CORRECT",299.272,20],
    "rss-retitles-410-v15|verify_once_mcp":["VALID_CORRECT",292.86,20],
    "rss-retitles-410-v15|full_mcp":["VALID_CORRECT",247.691,22],
    "rss-sort-url-408-v15|full_mcp":["VALID_CORRECT",309.531,16],
    "rss-sort-url-408-v15|baseline":["VALID_CORRECT",271.574,20],
    "rss-sort-url-408-v15|verify_once_mcp":["INVALID_TIMEOUT",420.07,19]
  };
  for(const row of evidence.rows) {
    const key=row.task_id+"|"+row.arm;
    const task=study.tasks.find(t=>t.id===row.task_id);
    assert.ok(task && task.issue===row.issue);
    assert.deepEqual([row.original_status,row.wall_seconds,row.ordinary_tests_passed],
      states[key]);
    assert.ok(row.wall_seconds>0 && row.wall_seconds<=420.2);
    assert.equal(row.hidden_passed,19);
    assert.equal(row.hidden_total,19);
    assert.equal(row.ordinary_tests_exit_code,0);
    assert.equal(row.policy_denial,false);
    assert.ok(SHA.test(row.original_jsonl_sha256));
    assert.ok(SHA.test(row.original_stderr_sha256));
    assert.ok(SHA.test(row.original_receipt_sha256));
    assert.deepEqual(row.out_of_scope_paths,[]);
    assert.deepEqual([...row.changed_paths].sort(),
      [...task.allowed_paths].sort());
    if(row.arm==="baseline") assert.equal(row.mcp_calls.length,0);
    else if(row.arm==="verify_once_mcp") {
      assert.equal(row.mcp_calls.length,1);
      assert.equal(row.mcp_calls[0].tool,"get_tailored_guidance");
      assert.equal(row.mcp_calls[0].success,true);
    } else {
      assert.ok(row.mcp_calls.some(c=>c.tool==="classify_task"&&c.success));
      assert.ok(row.mcp_calls.filter(c=>c.tool==="get_tailored_guidance"&&c.success).length>=2);
    }
    if(row.original_status==="VALID_CORRECT") {
      assert.equal(row.accepted,true);
      assert.equal(row.model_exit_code,0);
      assert.equal(row.timeout,false);
      assert.ok(row.model_turns>0);
      assert.ok(Number.isInteger(row.reported_input_tokens)&&row.reported_input_tokens>0);
      assert.ok(Number.isInteger(row.reported_cached_input_tokens));
      assert.ok(row.reported_cached_input_tokens<=row.reported_input_tokens);
      assert.ok(Number.isInteger(row.reported_output_tokens));
    } else {
      assert.equal(key,"rss-sort-url-408-v15|verify_once_mcp");
      assert.equal(row.accepted,false);
      assert.equal(row.timeout,true);
      assert.equal(row.model_exit_code,null);
      assert.equal(row.reported_input_tokens,null);
      assert.equal(row.reported_cached_input_tokens,null);
      assert.equal(row.reported_output_tokens,null);
      assert.equal(row.model_turns,0);
    }
  }
  const byArm={};
  for(const arm of study.arms) {
    const rows=evidence.rows.filter(r=>r.arm===arm);
    const accepted=rows.filter(r=>r.accepted).length;
    const elapsed=round(rows.reduce((n,r)=>n+r.wall_seconds,0));
    const unknown=rows.filter(r=>r.reported_input_tokens==null).length;
    const tokens=rows.reduce((n,r)=>n+(r.reported_input_tokens??0),0);
    byArm[arm]={
      attempts:rows.length,accepted,
      total_seconds:elapsed,
      seconds_per_accepted_fix:accepted?round(elapsed/accepted):null,
      model_reported_input_tokens_known:tokens,
      missing_input_token_attempts:unknown,
      input_tokens_per_accepted_fix:accepted&&!unknown?Math.round(tokens/accepted):null
    };
  }
  assert.deepEqual(evidence.by_arm,byArm);
  assert.equal(byArm.baseline.accepted,2);
  assert.equal(byArm.full_mcp.accepted,2);
  assert.equal(byArm.verify_once_mcp.accepted,1);
  assert.equal(evidence.independent_secondary_audit.six_original_receipts_checked,true);
  assert.equal(evidence.independent_secondary_audit.raw_stdout_stderr_sha_checked,true);
  assert.equal(evidence.independent_secondary_audit.expected_mcp_calls_reconstructed,true);
  assert.equal(evidence.independent_secondary_audit.incomplete_scope_inventory.length,1);
  const uncertainty=evidence.independent_secondary_audit.incomplete_scope_inventory[0];
  assert.equal(uncertainty.issue,408);
  assert.equal(uncertainty.arm,"verify_once_mcp");
  assert.equal(uncertainty.inaccessible_sandbox_owned_temporary_test_directories,2);
  assert.equal(uncertainty.independent_out_of_scope_absence_fully_verified,false);
  assert.equal(evidence.productivity.repeatable_general_improvement_proven,false);
  assert.equal(evidence.productivity.verified_speed_advantage,null);
  assert.equal(evidence.productivity.verified_cost_advantage,null);
  assert.ok(Object.values(evidence.effects).every(flag=>flag===false));
  return {status:"VERIFIED_V15_SIX_ORIGINAL_ARMS_NO_REPLICABLE_GAIN",
    planned:6,first_runs:6,
    accepted_by_arm:Object.fromEntries(study.arms.map(a=>[a,byArm[a].accepted])),
    seconds_per_accepted_fix:Object.fromEntries(study.arms.map(a=>
      [a,byArm[a].seconds_per_accepted_fix])),
    incomplete_untracked_inventory_arms:1,
    proven_repeatable_productivity_gain:false};
}
if(process.argv[1]&&fileURLToPath(import.meta.url).toLowerCase()===
  process.argv[1].toLowerCase()) {
  const raw=readFileSync(join(HERE,"v15-frozen-study-20261123.json"));
  const evidence=JSON.parse(readFileSync(join(HERE,"v15-public-results-20261123.json")));
  console.log(JSON.stringify(verifyV15Public(JSON.parse(raw),evidence,raw),null,2));
}
