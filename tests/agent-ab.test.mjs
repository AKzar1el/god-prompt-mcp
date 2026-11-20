import test from "node:test";
import assert from "node:assert/strict";
import { planComparison,scoreComparison } from "../benchmarks/agent-ab/run.mjs";
const suite={suite_id:"agent-ab-synthetic-test",tasks:Array.from({length:12},(_,i)=>({
  task_id:"task-"+i,revision:"fixture-v1",test_command:"node --test tests/task-"+i+".test.mjs",
}))};
function scores(source="test_runner") {
  const plan=planComparison(suite,"fixed-seed");
  return {suite_id:suite.suite_id,plan_hash:plan.plan_hash,trials:plan.trials.map((x,i)=>({
    task_id:x.task_id,revision:x.revision,
    baseline:{model:"gpt-6",environment:"same-budgets",revision:x.revision,
      passed:i%2===0,wall_ms:1000,tokens:500,tool_calls:10,grade_source:source},
    candidate:{model:"gpt-6",environment:"same-budgets",revision:x.revision,
      passed:true,wall_ms:800,tokens:450,tool_calls:8,grade_source:source}
  }))};
}
test("A/B plan shuffles order deterministically and freezes the task manifest",()=>{
  const a=planComparison(suite,"fixed-seed");
  const b=planComparison(suite,"fixed-seed");
  assert.deepEqual(a,b);
  assert.equal(a.trials.length,12);
  assert.ok(a.trials.some(x=>x.first_variant==="baseline"));
  assert.ok(a.trials.some(x=>x.first_variant==="candidate"));
  assert.equal(a.status,"DESIGN_ONLY_NO_AGENT_CALLS");
});
test("A/B score retains paired tasks and never asserts causal productivity",()=>{
  const r=scoreComparison(scores(),suite,"fixed-seed");
  assert.equal(r.matched_tasks,12);
  assert.equal(r.improved,6);
  assert.equal(r.regressed,0);
  assert.equal(r.reported_test_runner_pairs,12);
  assert.equal(r.paired_deltas_candidate_minus_baseline.tokens.median,-50);
  assert.equal(r.causal_productivity_gain_claimed,false);
  assert.equal(r.independently_verified,false);
});
test("A/B scorer blocks missing, swapped, mismatched, self-reported and changed task identities",()=>{
  const data=scores();
  data.trials[0].candidate.model="gpt-5";
  assert.throws(()=>scoreComparison(data,suite,"fixed-seed"),/Model/);
  const fewer=scores();fewer.trials.pop();
  assert.throws(()=>scoreComparison(fewer,suite,"fixed-seed"),/complete frozen suite/);
  const altered=scores();altered.trials[1].revision="other";
  assert.throws(()=>scoreComparison(altered,suite,"fixed-seed"),/Missing or changed task/);
  const self=scoreComparison(scores("agent_report"),suite,"fixed-seed");
  assert.equal(self.status,"INCLUDES_AGENT_SELF_REPORTS");
  const duplicate={...suite,tasks:[...suite.tasks.slice(0,-1),suite.tasks[0]]};
  assert.throws(()=>planComparison(duplicate),/Duplicate/);
});
test("A/B runner rejects small or unpinned suites",()=>{
  assert.throws(()=>planComparison({suite_id:"small",tasks:suite.tasks.slice(0,9)}),/10-100/);
  assert.throws(()=>planComparison({suite_id:"bad",tasks:[...suite.tasks,{task_id:"../etc/passwd",revision:"rev",test_command:"test"}]}),/Every task/);
});

test("P5 original microtask suite contains twelve independently failing baseline graders",async()=>{
  const { readFile }=await import("node:fs/promises");
  const { spawnSync }=await import("node:child_process");
  const { fileURLToPath }=await import("node:url");
  const suite=JSON.parse(await readFile(new URL("../benchmarks/agent-ab/suite.json",import.meta.url),"utf8"));
  const path=fileURLToPath(new URL("../benchmarks/agent-ab/microtasks/checks.test.mjs",import.meta.url));
  assert.equal(suite.tasks.length,12);
  for(const task of suite.tasks){
    const r=spawnSync(process.execPath,["--test","--test-name-pattern="+task.task_id,path],{
      encoding:"utf8",timeout:10000,windowsHide:true,maxBuffer:512*1024,
      env:{...process.env,NODE_TEST_CONTEXT:undefined},
    });
    assert.equal(r.status,1,"Fixture must fail before an agent repairs "+task.task_id+": "+r.stderr);
    assert.ok(r.stdout.includes(task.task_id) && /(?:not ok|✖|\u2716)/.test(r.stdout),
      task.task_id+" must execute a real failing test on Node 22 and Node 24");
  }
});
