import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {verifyV17Public} from
  "../benchmarks/agent-ab/real-repos/v17-verify-public.mjs";
import {auditV17Folder} from
  "../benchmarks/agent-ab/real-repos/v17-secondary-audit.mjs";
const dir=dirname(fileURLToPath(import.meta.url));
const here=join(dir,"..","benchmarks","agent-ab","real-repos");
const studyBytes=readFileSync(join(here,"v17-frozen-study-20261123.json"));
const study=JSON.parse(studyBytes);
const original=JSON.parse(readFileSync(join(here,"v17-public-results-20261123.json")));
const mutate=fn=>{
  const copy=structuredClone(original);
  fn(copy);
  assert.throws(()=>verifyV17Public(study,copy,studyBytes));
};

test("V17 portable original trial verifier passes six immutable receipts",()=>{
  const score=verifyV17Public(study,original,studyBytes);
  assert.equal(score.observed,6);
  assert.deepEqual(score.accepted_by_arm,{baseline:2,repeated_failure_mcp:2});
  assert.deepEqual(score.seconds_per_accepted_fix,{baseline:415.37,
    repeated_failure_mcp:382.307});
  assert.equal(score.actual_treatment_mcp_calls,0);
  assert.equal(score.no_production_change,true);
});

test("V17 rejects missing, reordered, duplicated or forged original trial slots",()=>{
  mutate(x=>x.original_rows.pop());
  mutate(x=>x.original_rows.reverse());
  mutate(x=>x.original_rows[0]=x.original_rows[1]);
  mutate(x=>x.original_rows[0].task_id="different");
});

test("V17 does not let postflight success override the frozen grader non-result",()=>{
  const idx=2;
  assert.equal(original.original_rows[idx].task_id,"rich-4255-v17");
  assert.equal(original.original_rows[idx].original_status,"INVALID_OTHER");
  assert.equal(original.original_rows[idx].accepted,false);
  mutate(x=>x.original_rows[idx].original_status="VALID_CORRECT");
  mutate(x=>x.original_rows[idx].accepted=true);
  mutate(x=>x.original_rows[idx].hidden_passed=15);
  mutate(x=>x.original_rows[idx].elapsed_seconds=190);
});

test("V17 never treats original AnyIO timeout as accepted",()=>{
  assert.equal(original.original_rows[0].original_status,"INVALID_TIMEOUT");
  assert.equal(original.original_rows[0].accepted,false);
  mutate(x=>x.original_rows[0].accepted=true);
  mutate(x=>x.original_rows[0].original_status="VALID_CORRECT");
  mutate(x=>x.original_rows[0].elapsed_seconds=180);
});

test("V17 must not invent an MCP call, a trigger or a productivity claim",()=>{
  mutate(x=>x.original_rows[1].real_mcp_calls=1);
  mutate(x=>x.comparisons.conditional_godprompt_calls_total=1);
  mutate(x=>x.comparisons.treatment_strict_trigger_observed_attempts=1);
  mutate(x=>x.comparisons.replicated_godprompt_uplift_proven=true);
  mutate(x=>x.comparisons.production_guidance_change="GO");
});

test("V17 rejects falsified original receipt hashes or frozen manifest",()=>{
  mutate(x=>x.original_rows[0].original_receipt_sha256="0".repeat(64));
  mutate(x=>x.original_rows[1].original_jsonl_sha256="not-hash");
  mutate(x=>x.preregistered_tasks[0].pinned_source_sha="wrong");
  mutate(x=>x.original_freeze_sha256.manifest="0".repeat(64));
  mutate(x=>x.original_freeze_sha256.private_grader="0".repeat(64));
});

test("V17 checks aggregates, denominator and the entire observed telemetry",()=>{
  mutate(x=>x.by_arm.baseline.accepted=3);
  mutate(x=>x.by_arm.baseline.original_total_wall_seconds=100);
  mutate(x=>x.by_arm.repeated_failure_mcp.seconds_per_accepted_fix=1);
  mutate(x=>x.original_rows[5].model_reported_input_tokens=1);
  mutate(x=>x.comparisons.relative_treatment_seconds_per_accepted_fix_percent=-50);
});

test("V17 sanitizer excludes raw private trials and discloses limitations",()=>{
  assert.equal(original.audit.independent_original_receipt_count,6);
  assert.equal(original.audit.private_raw_jsonl_committed,false);
  assert.equal(original.audit.private_calibration_patches_committed,false);
  assert.equal(original.audit.private_grader_committed,false);
  assert.equal(original.comparisons.replicated_godprompt_uplift_proven,false);
  assert.ok(original.caveats.some(x=>/human/i.test(x)));
});

test("V17 independent auditor reconstructs six untouched original log transcripts",()=>{
  const result=auditV17Folder();
  assert.equal(result.complete,true);
  assert.equal(result.observed,6);
  assert.equal(result.independent_untracked_file_inventory_complete,true);
  assert.equal(result.incomplete_git_inventories.length,0);
  assert.deepEqual(result.rows.map(x=>x.receipt_sha256),
    original.original_rows.map(x=>x.original_receipt_sha256));
  assert.equal(result.rows.reduce((n,x)=>n+x.mcp_calls,0),0);
});
