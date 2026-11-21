import test from "node:test";
import assert from "node:assert/strict";
import { primary } from "../benchmarks/public-toolkit/run.mjs";
test("P5 preserves all 74 frozen P4 engineering-quality scenarios",()=>{
  assert.equal(primary.fixture_count,74);
  assert.equal(primary.summary.cases,74);
  assert.equal(primary.summary.passed,74,
    "Regression in frozen code/requirements/release/evaluation fixtures: "+
    JSON.stringify(primary.cases.filter(x=>!x.pass).map(x=>({id:x.id,errors:x.errors}))));
  assert.equal(primary.summary.failed,0);
  assert.ok(primary.cases.every(x=>x.pass));
});
