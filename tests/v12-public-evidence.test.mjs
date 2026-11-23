import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyPublicV12 } from "../benchmarks/agent-ab/real-repos/v12-verify-public.mjs";

const dir=new URL("../benchmarks/agent-ab/real-repos/",import.meta.url);
const manifestBytes=readFileSync(new URL("v12-frozen-study-20261123.json",dir));
const manifest=JSON.parse(manifestBytes);
const evidence=JSON.parse(readFileSync(new URL("v12-public-results-20261123.json",dir)));
const score=(m=manifest,e=evidence,bytes=manifestBytes)=>verifyPublicV12(m,e,bytes);
const mutate=()=>structuredClone(evidence);

test("V12 preserves exactly two original attempts and four unrun slots",()=>{
  const result=score();
  assert.equal(result.original_attempts,2);
  assert.equal(result.unrun,4);
  assert.equal(result.status,"VERIFIED_STOPPED_OPTIONAL_UVX_RUBRIC_BIAS_NO_CAUSAL_CLAIM");
});
test("V12 rejects a rewritten preregistered manifest",()=>{
  const changed={...manifest,source_sha:"0000000000000000000000000000000000000000"};
  assert.throws(()=>score(changed,evidence,Buffer.from(JSON.stringify(changed))),/equal/i);
});
test("V12 preserves frozen baseline failure rather than fixing its score retrospectively",()=>{
  const e=mutate();
  e.trials.find(x=>x.issue===415&&x.arm==="baseline").accepted=true;
  assert.throws(()=>score(manifest,e),/false/i);
});
test("V12 rejects fabricated compact outcomes or missing trial slots",()=>{
  const e=mutate();
  e.trials.find(x=>x.issue===415&&x.arm==="compact_mcp").status="VALID_CORRECT";
  assert.throws(()=>score(manifest,e),/NOT_RUN/);
  const e2=mutate(); e2.trials.pop();
  assert.throws(()=>score(manifest,e2),/equal/i);
});
test("V12 does not permit invented seconds per fix or productivity uplift",()=>{
  const e=mutate();
  e.productivity.seconds_per_accepted_fix=108;
  assert.throws(()=>score(manifest,e),/null/);
  const e2=mutate();e2.productivity.proven_causal_productivity_uplift=true;
  assert.throws(()=>score(manifest,e2),/false/);
});
test("V12 blocks invented merge, release and restart effects",()=>{
  const e=mutate();
  e.release_effects.deployed=true;
  assert.throws(()=>score(manifest,e),/false/);
});
