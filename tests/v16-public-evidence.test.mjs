import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyV16Public } from
  "../benchmarks/agent-ab/real-repos/v16-verify-public.mjs";
import { auditV16Folder, scoreV16 } from
  "../benchmarks/agent-ab/real-repos/v16-secondary-audit.mjs";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const manifestBytes=readFileSync(join(root,"benchmarks/agent-ab/real-repos/v16-prospective-study-20261123.json"));
const study=JSON.parse(manifestBytes);
const original=JSON.parse(readFileSync(join(root,
  "benchmarks/agent-ab/real-repos/v16-public-results-20261123.json")));
const clone=x=>structuredClone(x);
const expectBad=mutate=>{
  const bad=clone(original);mutate(bad);
  assert.throws(()=>verifyV16Public(study,bad,manifestBytes));
};

test("V16 nine authentic original rows verify with reproducible full-denominator comparison",()=>{
  const out=verifyV16Public(study,original,manifestBytes);
  assert.equal(out.original_first_runs,9);
  assert.equal(out.no_release,true);
  assert.equal(out.seconds_per_fix.baseline,130.067);
  assert.equal(out.seconds_per_fix.full_mcp,245.88);
  assert.equal(out.seconds_per_fix.conditional_mcp,189.276);
});

test("V16 public verifier rejects omitted, duplicated or reordered arms",()=>{
  expectBad(x=>x.first_runs.pop());
  expectBad(x=>x.first_runs[2]=x.first_runs[0]);
  expectBad(x=>x.first_runs.reverse());
});

test("V16 public verifier refuses falsely positive treatment-speed or correctness claims",()=>{
  expectBad(x=>x.decision.relative_full_wall_time_percent=-30);
  expectBad(x=>x.decision.production_change="GO");
  expectBad(x=>x.decision.statistical_replicable_godprompt_uplift_proven=true);
  expectBad(x=>x.first_runs[0].original_accepted=false);
});

test("V16 verifier detects altered first-run timings, telemetry and hidden acceptance",()=>{
  expectBad(x=>x.first_runs[0].elapsed_seconds=50);
  expectBad(x=>x.first_runs[1].model_reported_input_tokens=0);
  expectBad(x=>x.first_runs[2].hidden_checks_passed=0);
  expectBad(x=>x.first_runs[3].native_tests_exit_code=1);
  expectBad(x=>x.by_arm.baseline.seconds_per_accepted_fix=1);
});

test("V16 verifier rejects forged original receipt identity and source SHA",()=>{
  expectBad(x=>x.first_runs[0].original_receipt_sha256="0".repeat(64));
  expectBad(x=>x.repositories[0].pinned_source_sha="0".repeat(40));
  expectBad(x=>x.frozen_sha256.private_grader="0".repeat(64));
  expectBad(x=>x.frozen_sha256.manifest="0".repeat(64));
});

test("V16 public evidence discloses real limits, not private raw transcripts",()=>{
  assert.equal(original.caveats.length,5);
  assert.ok(original.caveats.some(x=>/no separate blinded human/u.test(x)));
  assert.equal(original.evidence_integrity.private_raw_transcripts_committed,false);
  assert.equal(original.evidence_integrity.private_graders_committed,false);
  assert.equal(original.decision.statistical_replicable_godprompt_uplift_proven,false);
  assert.equal(original.frozen_sha256.runner.length,64);
});

test("V16 independent read-only audit crosschecks all 9 preserved first-run logs",()=>{
  const audit=auditV16Folder();
  assert.equal(audit.complete,true);
  assert.equal(audit.observed,9);
  assert.equal(audit.independent_untracked_scope_inventory_complete,true);
  assert.equal(audit.incomplete_scope_inventories.length,0);
  assert.deepEqual(Object.fromEntries(Object.entries(audit.by_arm)
    .map(([arm,r])=>[arm,r.accepted])),
    {baseline:3,full_mcp:3,conditional_mcp:3});
  assert.deepEqual(audit.rows.map(x=>x.receipt_sha256),
    original.first_runs.map(x=>x.original_receipt_sha256));
});

test("V16 full-denominator scorer refuses duplicates and ignores no missing tasks",()=>{
  const fabricated=study.tasks.map(t=>({
    task_id:t.id,arm:"baseline",accepted:true,seconds:1,input_tokens:1,
    cached_input_tokens:0,output_tokens:1
  }));
  const partial=scoreV16(study,fabricated);
  assert.equal(partial.complete,false);
  assert.equal(partial.by_arm.baseline.seconds_per_accepted_fix,null);
  assert.throws(()=>scoreV16(study,[...fabricated,fabricated[0]]),/Duplicate/);
});
