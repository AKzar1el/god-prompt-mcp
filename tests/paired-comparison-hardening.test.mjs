import test from "node:test";
import assert from "node:assert/strict";
import { compareEvaluationRuns } from "../dist/decision-support.js";

test("P4.6 reports exact paired discordance without claiming causal productivity",()=>{
  const baseline=Array.from({length:30},(_,i)=>({case_id:"C"+i,passed:false,duration_ms:120,cost_usd:0.02}));
  const candidate=Array.from({length:30},(_,i)=>({case_id:"C"+i,passed:i<12,duration_ms:100,cost_usd:0.01}));
  const r=compareEvaluationRuns(baseline,candidate);
  assert.equal(r.improved,12);
  assert.equal(r.regressed,0);
  assert.ok(Math.abs(r.mcnemar_two_sided_exact_p-(2/4096))<1e-12);
  assert.ok(r.paired_delta_95_percent_ci.lower_points <= 40);
  assert.ok(r.paired_delta_95_percent_ci.upper_points >= 40);
  assert.equal(r.median_duration_delta_ms,-20);
  assert.equal(r.median_cost_delta_usd,-0.01);
  assert.equal(r.independently_verified,false);
});
test("P4.6 reports no p-value for zero discordance and no confidence interval for n<20",()=>{
  const r=compareEvaluationRuns([{case_id:"one",passed:true}],[{case_id:"one",passed:true}]);
  assert.equal(r.mcnemar_two_sided_exact_p,null);
  assert.equal(r.paired_delta_95_percent_ci,null);
  assert.equal(r.status,"LOW_SAMPLE_DIRECTIONAL");
});
