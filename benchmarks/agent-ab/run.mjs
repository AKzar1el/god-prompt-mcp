#!/usr/bin/env node
/** Paired coding-agent comparison protocol. No agent invocation, network, or grading is performed. */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const fail = (message) => { throw new Error(message); };
const safeID = (value) => typeof value === "string" && /^[A-Za-z0-9_.-]{1,96}$/.test(value);
const number = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const digest = (value) => createHash("sha256").update(value).digest("hex");
async function readJson(path) {
  if (typeof path !== "string") fail("An explicit input JSON path is required");
  const fs = await import("node:fs/promises");
  const info = await fs.lstat(resolve(path));
  if (!info.isFile() || info.size > 256 * 1024) fail("Input must be an ordinary JSON file of at most 256 KiB");
  return JSON.parse(await readFile(resolve(path), "utf8"));
}
function validateTasks(raw) {
  if (!raw || !safeID(raw.suite_id) || !Array.isArray(raw.tasks) || raw.tasks.length < 10 || raw.tasks.length > 100)
    fail("Supply a suite_id and 10-100 tasks");
  const tasks = raw.tasks.map((t) => {
    if (!t || !safeID(t.task_id) || !safeID(t.revision) || !t.test_command || typeof t.test_command !== "string" || t.test_command.length > 256)
      fail("Every task needs task_id, revision, and bounded test_command");
    return { task_id:t.task_id, revision:t.revision, test_command:t.test_command };
  });
  if (new Set(tasks.map(t => t.task_id)).size !== tasks.length) fail("Duplicate task IDs");
  return {suite_id:raw.suite_id,tasks};
}
export function planComparison(raw, seed = "godprompt-p5-v1") {
  const {suite_id,tasks} = validateTasks(raw);
  if (!safeID(seed)) fail("Invalid deterministic plan seed");
  return {
    status:"DESIGN_ONLY_NO_AGENT_CALLS",
    suite_id,
    plan_hash:digest(JSON.stringify(tasks.sort((a,b)=>a.task_id.localeCompare(b.task_id)))+":"+seed),
    seed,
    trials:tasks.map(t=>({
      task_id:t.task_id, revision:t.revision,
      first_variant:parseInt(digest(seed+":"+t.task_id).slice(0,2),16)%2 ? "candidate":"baseline",
      second_variant:parseInt(digest(seed+":"+t.task_id).slice(0,2),16)%2 ? "baseline":"candidate",
      test_command:t.test_command,
    })),
    warning:"Assign the same model/version and execution budget to both arms. Use isolated fresh checkouts and blinded runnable grading. This plan does not execute agents.",
  };
}
function validateArm(arm,id) {
  if (!arm || typeof arm!=="object" || !safeID(arm.model) || !safeID(arm.environment) ||
      !safeID(arm.revision) || !Number.isInteger(arm.tool_calls) || !number(arm.wall_ms) ||
      !number(arm.tokens) || !number(arm.tool_calls) || typeof arm.passed!=="boolean" ||
      !["test_runner","agent_report"].includes(arm.grade_source))
    fail("Invalid score evidence for task "+id);
}
function median(values) {
  const list=[...values].sort((a,b)=>a-b);
  return list.length%2 ? list[(list.length-1)/2] : (list[list.length/2-1]+list[list.length/2])/2;
}
export function scoreComparison(raw, suite, seed="godprompt-p5-v1") {
  const expected=planComparison(suite,seed);
  if (!raw || raw.suite_id!==expected.suite_id || raw.plan_hash!==expected.plan_hash ||
    !Array.isArray(raw.trials) || raw.trials.length!==expected.trials.length)
    fail("Scores are not bound to the complete frozen suite and plan hash");
  const cases=new Map();
  for (const row of raw.trials) {
    if (!row || !safeID(row.task_id) || cases.has(row.task_id)) fail("Invalid or duplicate score row");
    cases.set(row.task_id,row);
  }
  const differences={passed:[],tokens:[],wall_ms:[],tool_calls:[]};
  const outcomes=[];
  let improvements=0,regressions=0,graderCases=0;
  for (const task of expected.trials) {
    const item=cases.get(task.task_id);
    if (!item || !item.baseline || !item.candidate || item.revision!==task.revision) fail("Missing or changed task "+task.task_id);
    validateArm(item.baseline,task.task_id); validateArm(item.candidate,task.task_id);
    if (item.baseline.model!==item.candidate.model || item.baseline.environment!==item.candidate.environment ||
        item.baseline.revision!==task.revision || item.candidate.revision!==task.revision)
      fail("Model, environment or task revision mismatch in "+task.task_id);
    const a=item.baseline,b=item.candidate;
    for(const k of ["tokens","wall_ms","tool_calls"])differences[k].push(b[k]-a[k]);
    differences.passed.push(Number(b.passed)-Number(a.passed));
    if(!a.passed&&b.passed)improvements++;
    if(a.passed&&!b.passed)regressions++;
    if(a.grade_source==="test_runner"&&b.grade_source==="test_runner")graderCases++;
    outcomes.push({task_id:task.task_id,baseline_passed:a.passed,candidate_passed:b.passed,
      grade_sources:[a.grade_source,b.grade_source]});
  }
  const n=outcomes.length;
  const means=Object.fromEntries(Object.entries(differences).map(([key,values])=>
    [key,{mean:values.reduce((a,b)=>a+b,0)/n,median:median(values)}]));
  return {
    status:graderCases===n?"REPORTED_TEST_RUNNER_RESULTS":"INCLUDES_AGENT_SELF_REPORTS",
    suite_id:expected.suite_id,plan_hash:expected.plan_hash,matched_tasks:n,
    improved:improvements,regressed:regressions,unchanged:n-improvements-regressions,
    reported_test_runner_pairs:graderCases,
    paired_deltas_candidate_minus_baseline:means,
    case_results:outcomes,
    independently_verified:false,
    causal_productivity_gain_claimed:false,
    warning:"This tool scores imported records only; test-runner source labels are user supplied. Verify the real checkout, grading logs, model/budgets and randomized order independently before attributing improvement.",
  };
}
async function main(argv) {
  if(argv.length<2) fail("Usage: node benchmarks/agent-ab/run.mjs plan suite.json [seed] | score suite.json results.json [seed]");
  const mode=argv[0],suite=await readJson(argv[1]);
  if(mode==="plan") return planComparison(suite,argv[2]??"godprompt-p5-v1");
  if(mode==="score"&&argv[2]) return scoreComparison(await readJson(argv[2]),suite,argv[3]??"godprompt-p5-v1");
  fail("Unknown benchmark mode");
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(x=>process.stdout.write(JSON.stringify(x,null,2)+"\n"))
    .catch(()=>{process.stderr.write("Invalid or unverified benchmark input; inspect suite, plan and scores.\n");process.exitCode=1;});
}
