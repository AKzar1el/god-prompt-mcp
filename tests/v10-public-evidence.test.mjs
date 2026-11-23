import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyV10Stopped } from "../benchmarks/agent-ab/real-repos/v10-verify-public.mjs";
const source=new URL("../benchmarks/agent-ab/real-repos/v10-frozen-public-issues-20261123.json",import.meta.url);
const results=new URL("../benchmarks/agent-ab/real-repos/v10-public-results-20261123.json",import.meta.url);
const bytes=readFileSync(source);
const base=JSON.parse(bytes);
const evidence=JSON.parse(readFileSync(results,"utf8"));
const verify=(m=base,e=evidence,b=bytes)=>verifyV10Stopped(m,e,b);

test("V10 publishes exactly two invalid first runs and four true non-runs",()=>{
  assert.equal(verify().status,"VERIFIED_STOPPED_GRADER_DEFECT_POLICY_NO_PRODUCTIVITY_CLAIM");
  assert.equal(verify().original_first_run_attempts,2);
  assert.equal(verify().unrun,4);
  assert.equal(verify().accepted,0);
});

test("manifest/source/grader tampering fails closed",()=>{
  assert.throws(()=>verify({...base,source:{...base.source,sha:"0".repeat(40)}}));
  assert.throws(()=>verify(base,{...evidence,private_grader_sha256:"f".repeat(64)}));
  assert.throws(()=>verify({...base,cli:{...base.cli,exit_after_s:400}}));
});

test("invented completed arms or a smaller frozen denominator fail",()=>{
  const e=structuredClone(evidence);
  e.attempts[2]={...e.attempts[2],status:"VALID_CORRECT",accepted:true};
  assert.throws(()=>verify(base,e));
  const dropped=structuredClone(evidence);
  dropped.attempts.pop();
  assert.throws(()=>verify(base,dropped));
});

test("timed-out first runs cannot become accepted after the fact",()=>{
  const e=structuredClone(evidence);
  e.attempts[0].accepted=true;
  assert.throws(()=>verify(base,e));
  const f=structuredClone(evidence);
  f.attempts[0].observed_wall_seconds=100;
  assert.throws(()=>verify(base,f));
});

test("interrupted model telemetry must remain unknown, not zero or guessed",()=>{
  const e=structuredClone(evidence);
  e.attempts[0].model_reported_input_tokens=0;
  assert.throws(()=>verify(base,e));
  const f=structuredClone(evidence);
  f.measurements.input_tokens_per_accepted_fix=12345;
  assert.throws(()=>verify(base,f));
});

test("host policy denial and frozen grader false-negative are preserved",()=>{
  const e=structuredClone(evidence);
  e.attempts[1].policy_rejected=false;
  assert.throws(()=>verify(base,e));
  const f=structuredClone(evidence);
  f.frozen_grader_defect.retroactively_promoted_successes=true;
  assert.throws(()=>verify(base,f));
  const g=structuredClone(evidence);
  g.release_effects.deployed=true;
  assert.throws(()=>verify(base,g));
});
