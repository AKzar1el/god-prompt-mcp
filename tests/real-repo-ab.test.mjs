import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const here = resolve(projectRoot, "benchmarks/agent-ab/real-repos");
const suitePath = resolve(here, "suite.json");
const trialPath = resolve(here, "trial.mjs");
const suite = JSON.parse(await readFile(suitePath, "utf8"));

test("public-repository benchmark uses pinned, scoped, original issues and features", () => {
  assert.equal(suite.schema, "godprompt.real_repo_ab.v1");
  assert.equal(suite.tasks.length, 3);
  assert.equal(new Set(suite.tasks.map(t => t.task_id)).size, 3);
  assert.ok(suite.tasks.some(t => t.kind === "bug"));
  assert.ok(suite.tasks.some(t => t.kind === "feature"));
  for (const task of suite.tasks) {
    assert.match(task.repo, /^AKzar1el\/[a-zA-Z0-9_.-]+$/);
    assert.match(task.source_sha, /^[a-f0-9]{40}$/);
    assert.equal(task.url, "https://github.com/" + task.repo + ".git");
    assert.ok(task.allowed_paths.every(path => !path.startsWith(".") && !path.includes("..")));
    assert.ok(task.max_minutes <= 30);
  }
});

test("real-repo plan is deterministic, scope-bound, non-destructive and randomized", () => {
  const run = (...args) => spawnSync(process.execPath, [trialPath, ...args], {
    cwd: projectRoot, encoding: "utf8", windowsHide: true,
    timeout: 90000, maxBuffer: 512 * 1024,
  });
  const a = run("plan"), b = run("plan");
  assert.equal(a.status, 0, a.stderr);
  assert.equal(b.status, 0, b.stderr);
  assert.equal(a.stdout, b.stdout);
  const plan = JSON.parse(a.stdout);
  assert.match(plan.plan_hash, /^[a-f0-9]{64}$/);
  assert.equal(plan.tasks.length, 3);
  for (const task of plan.tasks) {
    assert.notEqual(task.first_arm, task.second_arm);
    assert.deepEqual([task.first_arm, task.second_arm].sort(), ["baseline", "candidate"]);
    assert.notEqual(task.checkout_baseline, task.checkout_candidate);
  }
  const invalid = run("prompt", "unlisted-task", "baseline");
  assert.notEqual(invalid.status, 0, "Unknown task must fail before any edits");
});
