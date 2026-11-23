import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyPublicV11 } from "../benchmarks/agent-ab/real-repos/v11-verify-public.mjs";

const base=new URL("../benchmarks/agent-ab/real-repos/", import.meta.url);
const raw=readFileSync(new URL("v11-frozen-study-20261123.json",base));
const study=JSON.parse(raw);
const evidence=JSON.parse(readFileSync(new URL("v11-public-results-20261123.json",base)));
const verify= (s=study,e=evidence,bytes=raw)=>verifyPublicV11(s,e,bytes);
const mutate= () => structuredClone(evidence);

test("V11 preserves original stopped run without claiming a productivity improvement",()=>{
  const r=verify();
  assert.equal(r.status,"VERIFIED_STOPPED_RUBRIC_BIAS_NO_PRODUCTIVITY_CLAIM");
  assert.equal(r.planned,6);
  assert.equal(r.attempted,1);
  assert.equal(r.not_run,5);
});

test("V11 rejects a modified frozen manifest",()=>{
  assert.throws(()=>verify({...study,source_sha:"not-original"},evidence,
    Buffer.from(JSON.stringify({...study,source_sha:"not-original"}))),/sha|equal/i);
});

test("V11 refuses fabricated completed treatments",()=>{
  const e=mutate();
  e.raw_first_run[1]={...e.raw_first_run[1],status:"VALID_CORRECT",accepted:true};
  assert.throws(()=>verify(study,e),/NOT_RUN/);
});

test("V11 refuses retroactively passing the originally rejected baseline",()=>{
  const e=mutate();
  e.raw_first_run[0].accepted=true;
  assert.throws(()=>verify(study,e),/false/);
});

test("V11 rejects fabricated cost-per-fix and causal uplift",()=>{
  const e=mutate();
  e.productivity.seconds_per_accepted_fix=45;
  e.productivity.causal_speed_or_accuracy_uplift_established=true;
  assert.throws(()=>verify(study,e),/null|false/i);
});

test("V11 rejects false publication, deployment or service restart claims",()=>{
  const e=mutate();
  e.release_effects.published=true;
  assert.throws(()=>verify(study,e),/Unverified external effects/);
});
