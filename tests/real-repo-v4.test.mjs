import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const controller=resolve(ROOT,"benchmarks/agent-ab/real-repos/v4-control.mjs");
const manifest=resolve(ROOT,"benchmarks/agent-ab/real-repos/v4-frozen-suite.json");
const v4root=resolve(ROOT,"benchmarks/agent-ab/real-runs/replication-v4");
const data=JSON.parse(readFileSync(manifest,"utf8"));
const sha=x=>createHash("sha256").update(x).digest("hex");
const run=(...args)=>spawnSync(process.execPath,[controller,...args],{
  cwd:ROOT,windowsHide:true,encoding:"utf8",timeout:120000,maxBuffer:1024*1024,
});
const ARM_NAMES=["baseline","preinjected","live_mcp"];

test("V4 pilot is genuinely fresh, pinned and balanced across three repositories",()=>{
  assert.equal(data.schema,"godprompt.v4.frozen-public-agentic-triarm.v1");
  assert.deepEqual(data.arms,ARM_NAMES);
  assert.equal(data.tasks.length,3);
  assert.equal(new Set(data.tasks.map(t=>t.repo)).size,3);
  assert.equal(new Set(data.tasks.map(t=>t.language)).size,3);
  assert.equal(data.model,"gpt-6.1-sol");
  assert.equal(data.reasoning_effort,"high");
  assert.equal(data.sandbox,"workspace-write");
  for(const task of data.tasks){
    assert.match(task.source_sha,/^[a-f0-9]{40}$/u);
    assert.equal(task.url,"https://github.com/"+task.repo+".git");
    assert.match(task.grader.sha256,/^[a-f0-9]{64}$/u);
    assert.ok(task.grader.red_passed<task.grader.checks);
    assert.ok(task.allowed_paths.length>=2);
    assert.ok(task.allowed_paths.every(p=>!p.startsWith(".")&&!p.includes("..")));
  }
});

test("V4 isolated local prep uses exact grader digests and Latin-square arm order",{
  skip:!existsSync(resolve(v4root,"private/trendpulse-grade.py")),
},()=>{
  const a=run("plan"),b=run("plan");
  assert.equal(a.status,0,a.stderr);
  assert.equal(b.status,0,b.stderr);
  assert.equal(a.stdout,b.stdout);
  const plan=JSON.parse(a.stdout);
  assert.match(plan.suite_sha256,/^[a-f0-9]{64}$/u);
  assert.equal(plan.suite_sha256,sha(readFileSync(manifest)));
  assert.equal(plan.tasks.length,3);
  const first=new Set(plan.tasks.map(t=>t.arm_order[0]));
  assert.deepEqual(first,new Set(ARM_NAMES));
  for(const task of plan.tasks){
    assert.deepEqual([...task.arm_order].sort(),[...ARM_NAMES].sort());
    assert.equal(task.workspaces.baseline===task.workspaces.live_mcp,false);
  }
  const invalid=run("prompt","bogus","baseline");
  assert.notEqual(invalid.status,0);
});

test("V4 local prepared arms remain pinned, unmodified and separately housed",{
  skip:!existsSync(resolve(v4root,"arms/trendpulse-references/baseline")),
},()=>{
  const result=run("status");
  assert.equal(result.status,0,result.stderr);
  const status=JSON.parse(result.stdout);
  for(const task of status.tasks){
    for(const arm of ARM_NAMES){
      assert.equal(task.arms[arm].state,"FROZEN_SOURCE",
        "New model comparison must not start from an already edited arm");
      assert.deepEqual(task.arms[arm].changed_files,[]);
    }
  }
});
