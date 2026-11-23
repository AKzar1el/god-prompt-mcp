import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyStoppedV13V14 } from
  "../benchmarks/agent-ab/real-repos/v13-v14-verify-public.mjs";
const dir = new URL("../benchmarks/agent-ab/real-repos/", import.meta.url);
const read = name => readFileSync(new URL(name, dir));
const bytes13 = read("v13-frozen-study-20261123.json");
const bytes14 = read("v14-frozen-study-20261123.json");
const m13 = JSON.parse(bytes13);
const m14 = JSON.parse(bytes14);
const r13 = JSON.parse(read("v13-public-results-20261123.json"));
const r14 = JSON.parse(read("v14-public-results-20261123.json"));
const score = (a=m13,b=r13,c=m14,d=r14,raw13=bytes13,raw14=bytes14) =>
  verifyStoppedV13V14(a,b,raw13,c,d,raw14);
const clone = obj => structuredClone(obj);

test("V13 and V14 preserved original first-run and unrun counts", () => {
  const s=score();
  assert.equal(s.status, "VERIFIED_V13_V14_ORIGINAL_STOPS_NO_UPLIFT");
  assert.equal(s.original_attempts, 2);
  assert.equal(s.intentionally_unrun, 10);
});
test("V14 original Windows CRLF digest survives Git LF normalization",()=>{
  const lf=Buffer.from(bytes14.toString("utf8").replace(/\r\n/gu,"\n"),"utf8");
  assert.equal(score(m13,r13,m14,r14,bytes13,lf).original_attempts,2);
});
test("V13 cannot upgrade its original false invalid receipt retroactively", () => {
  const b=clone(r13);
  b.trials.find(x=>x.original_status).original_accepted=true;
  assert.throws(()=>score(m13,b),/false/i);
});
test("V13 cannot silently replace damaged original Git porcelain path", () => {
  const b=clone(r13);
  b.trials.find(x=>x.original_status).frozen_runner_changed_paths[0]=
    "src/mcp_trendpulse/cli.py";
  assert.throws(()=>score(m13,b),/equal/i);
});
test("V13 missing arms, invented timing, and incorrect hidden outcomes fail closed", () => {
  const a=clone(r13);a.trials.pop();
  assert.throws(()=>score(m13,a),/equal/i);
  const b=clone(r13);b.trials.find(x=>x.status==="NOT_RUN").wall_seconds=52;
  assert.throws(()=>score(m13,b),/NOT_RUN|falsy|false/i);
  const c=clone(r13);c.trials.find(x=>x.original_status).hidden_passed=18;
  assert.throws(()=>score(m13,c),/equal/i);
  const d=clone(r13);d.trials.find(x=>x.status==="NOT_RUN").original_status="VALID_CORRECT";
  assert.throws(()=>score(m13,d),/exactly one|NOT_RUN/i);
});
test("V14 cannot turn no-model transport failure into a correct model run", () => {
  const b=clone(r14);b.original_first_run.model_turns=1;
  assert.throws(()=>score(m13,r13,m14,b),/equal/i);
  const c=clone(r14);c.original_first_run.original_accepted=true;
  assert.throws(()=>score(m13,r13,m14,c),/false/i);
});
test("V14 won't invent execution or spend and no missing trial rows", () => {
  const b=clone(r14);b.original_first_run.model_reported_input_tokens=7;
  assert.throws(()=>score(m13,r13,m14,b),/null/);
  const c=clone(r14);c.unrun_slots.pop();
  assert.throws(()=>score(m13,r13,m14,c),/equal/i);
  const d=clone(r14);d.unrun_slots[0].model_turns=1;
  assert.throws(()=>score(m13,r13,m14,d),/NOT_RUN/i);
});
test("Manifest mutation is never silently accepted", () => {
  const x=clone(m14);x.source_sha="0".repeat(40);
  assert.throws(()=>score(m13,r13,x,r14,bytes13,
    Buffer.from(JSON.stringify(x))),/equal/i);
});
test("Neither study permits fabricated deployment or productivity uplift", () => {
  const x=clone(r13);x.effects.deployed=true;
  assert.throws(()=>score(m13,x),/false/i);
  const y=clone(r14);y.productivity.causal_productivity_uplift_proven=true;
  assert.throws(()=>score(m13,r13,m14,y),/false/i);
});
