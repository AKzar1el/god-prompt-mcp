import test from "node:test";
import assert from "node:assert/strict";
import { ImpactSchema, traceChangeImpact } from "../dist/change-impact.js";

test("P4.2 walks reverse dependency edges and chooses tests by impact", () => {
  const input = ImpactSchema.parse({
    changed_files:["src/api.ts"],
    dependencies:[{consumer:"src/service.ts",dependency:"src/api.ts"},{consumer:"src/ui.ts",dependency:"src/service.ts"}],
    requirements:[{id:"REQ-1",files:["src/ui.ts"]}],
    tests:[{id:"unit-api",covers_files:["src/api.ts"]},{id:"e2e-ui",covers_requirements:["REQ-1"]}],
    receipts:[{test_id:"unit-api",status:"passed"},{test_id:"e2e-ui",status:"passed"}],
  });
  const result = traceChangeImpact(input);
  assert.deepEqual(result.affected_files.map(x=>x.path), ["src/api.ts","src/service.ts","src/ui.ts"]);
  assert.deepEqual(result.impacted_requirement_ids,["REQ-1"]);
  assert.deepEqual(result.uncovered_targets,[]);
  assert.equal(result.recommended_tests.length,2);
  assert.equal(result.independently_verified,false);
  assert.equal(result.tests_executed,0);
});
test("P4.2 treats missing results and absent tests as unresolved, never verified",()=>{
  const input=ImpactSchema.parse({changed_files:["src/a.ts"],tests:[{id:"check",covers_files:["src/a.ts"]}]});
  const r=traceChangeImpact(input);
  assert.ok(r.issues.some(x=>x.code==="SELECTED_TEST_NOT_VERIFIED"));
  assert.notEqual(r.status,"VERIFIED");
  const none=traceChangeImpact(ImpactSchema.parse({changed_files:["src/a.ts"]}));
  assert.ok(none.uncovered_targets.includes("file:src/a.ts"));
  assert.ok(none.issues.some(x=>x.code==="UNCOVERED_IMPACT_TARGET"));
});
test("P4.2 handles cycles, rejects traversal paths and caps graph payload",()=>{
  const cycle=traceChangeImpact(ImpactSchema.parse({changed_files:["src/a.ts"],dependencies:[{consumer:"src/b.ts",dependency:"src/a.ts"},{consumer:"src/a.ts",dependency:"src/b.ts"}]}));
  assert.equal(cycle.affected_files.length,2);
  for(const path of ["/etc/passwd","../outside","src/../../secrets"]){
    assert.equal(ImpactSchema.safeParse({changed_files:[path]}).success,false,path);
  }
  const over=ImpactSchema.safeParse({changed_files:["src/a.ts"],dependencies:Array.from({length:251},(_,i)=>({consumer:"a"+i,dependency:"b"}))});
  assert.equal(over.success,false);
});
