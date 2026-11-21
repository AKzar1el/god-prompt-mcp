#!/usr/bin/env node
/**
 * Codexify public-repo paired A/B workspace controller.
 * The only write operation is "prepare": it creates new, independent local clones.
 * No provider API calls, package scripts, service changes, branch pushes or cleanup.
 */
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../real-runs");
const SOURCES = join(ROOT, "sources");
const TRIALS = join(ROOT, "trials");
const suite = JSON.parse(await readFile(join(HERE, "suite.json"), "utf8"));
const command = process.argv[2] ?? "plan";
const selected = process.argv[3] ?? "all";
const armArg = process.argv[4] ?? "both";
const TASK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA = /^[a-f0-9]{40}$/;
const hash = value => createHash("sha256").update(value).digest("hex");
function requireValid(value, why) { if (!value) throw new Error(why); }
function allowedRel(name) {
  return typeof name === "string" && !isAbsolute(name) &&
    !name.startsWith(".") && !name.includes("\\") &&
    name.split("/").every(part => part !== ".." && part !== "." && part !== "");
}
function validateSuite(s) {
  requireValid(s?.schema === "godprompt.real_repo_ab.v1" &&
    TASK_ID.test(s.suite_id) && TASK_ID.test(s.seed) &&
    Array.isArray(s.tasks) && s.tasks.length >= 2 && s.tasks.length <= 20,
    "Invalid pinned public-repo suite");
  const ids = new Set();
  for (const task of s.tasks) {
    requireValid(TASK_ID.test(task.task_id) && !ids.has(task.task_id) &&
      SHA.test(task.source_sha) &&
      /^AKzar1el\/[a-zA-Z0-9_.-]+$/.test(task.repo) &&
      task.url === "https://github.com/" + task.repo + ".git" &&
      Array.isArray(task.allowed_paths) && task.allowed_paths.length > 0 &&
      task.allowed_paths.every(allowedRel) &&
      ["bug", "feature", "refactor"].includes(task.kind) &&
      Number.isInteger(task.max_minutes) && task.max_minutes >= 1 && task.max_minutes <= 30,
      "Invalid task descriptor");
    ids.add(task.task_id);
  }
}
validateSuite(suite);
if (!["plan", "prepare", "status", "grade", "score", "prompt"].includes(command)) {
  throw new Error("Usage: trial.mjs plan | prepare [task|all] | status | grade [task|all] | score | prompt TASK_ID baseline|candidate");
}
const tasks = selected === "all" ? suite.tasks :
  suite.tasks.filter(task => task.task_id === selected);
requireValid(tasks.length > 0, "Unknown task");
const variant = (task, arm) => join(TRIALS, suite.suite_id, task.task_id, arm);
const ordering = (task) => {
  const first = parseInt(hash(suite.seed + ":" + task.task_id).slice(0, 2), 16) % 2
    ? "candidate" : "baseline";
  return [first, first === "candidate" ? "baseline" : "candidate"];
};
// Hash the COMPLETE frozen task definition, not just IDs and paths:
// changed instructions or budgets must invalidate earlier trial receipts.
const planHash = hash(JSON.stringify(suite));
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd, encoding: "utf8", timeout: 30000, windowsHide: true,
    maxBuffer: 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
}
async function ensureUnlinkedDir(path) {
  const lstatInfo = await lstat(path);
  requireValid(lstatInfo.isDirectory() && !lstatInfo.isSymbolicLink() &&
    !lstatInfo.isBlockDevice() && !lstatInfo.isCharacterDevice(),
    "Linked/special checkout directory refused");
  const resolved = await realpath(path);
  requireValid(resolve(resolved).toLowerCase() === resolve(path).toLowerCase(),
    "Unexpected physical path alias");
}
function pathWithin(parent, target) {
  const rel = relative(parent, target);
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + sep) && !isAbsolute(rel);
}
async function verifySource(task) {
  const source = join(SOURCES, task.repo.split("/")[1]);
  requireValid(pathWithin(ROOT, source), "Source escaped experiment root");
  await ensureUnlinkedDir(source);
  requireValid(git(source, ["rev-parse", "HEAD"]) === task.source_sha,
    "Source SHA changed: " + task.task_id);
  requireValid(git(source, ["remote", "get-url", "origin"]) === task.url,
    "Source remote changed: " + task.task_id);
  requireValid(git(source, ["status", "--porcelain=v1"]) === "",
    "Source is dirty: " + task.task_id);
  return source;
}
async function verifyTrial(task, arm) {
  const path = variant(task, arm);
  requireValid(pathWithin(ROOT, path), "Trial escaped experiment root");
  await ensureUnlinkedDir(path);
  await ensureUnlinkedDir(join(path, ".git"));
  requireValid(git(path, ["rev-parse", "HEAD"]) === task.source_sha,
    "Trial SHA changed: " + task.task_id + "/" + arm);
  requireValid(git(path, ["remote", "get-url", "origin"]) === task.url,
    "Trial remote changed: " + task.task_id + "/" + arm);
  const branch = git(path, ["branch", "--show-current"]);
  requireValid(branch === "gp-ab/" + task.task_id + "-" + arm,
    "Unexpected branch: " + branch);
  requireValid(!existsSync(join(path, ".git", "objects", "info", "alternates")),
    "Git object alternates would break workspace independence");
  return path;
}
function grade(task, path) {
  const run = spawnSync(process.execPath, [join(HERE, "grader.mjs"), task.task_id, path], {
    // Windows Defender and concurrent Codexify workers can delay a cold Node
    // process substantially; do not mistake an infrastructure timeout for a failed task.
    cwd: HERE, windowsHide: true, encoding: "utf8", timeout: 120000, maxBuffer: 512 * 1024,
  });
  if (run.error) throw run.error;
  requireValid(run.status === 0 || run.status === 1, "Grader internal failure: " +
    String(run.stderr).slice(0, 250));
  const receipt = JSON.parse(run.stdout);
  requireValid(receipt.task_id === task.task_id && receipt.source_sha === task.source_sha,
    "Grader receipt source mismatch");
  return { exit_status: run.status, ...receipt };
}
const payload = { schema: suite.schema, suite_id: suite.suite_id, plan_hash: planHash,
  seed: suite.seed, mode: command, tasks: [] };
for (const task of tasks) {
  const first = ordering(task);
  const entry = { task_id: task.task_id, repo: task.repo, source_sha: task.source_sha,
    kind: task.kind, first_arm: first[0], second_arm: first[1] };
  if (command === "plan") {
    entry.allowed_paths = task.allowed_paths;
    entry.time_budget_minutes = task.max_minutes;
    entry.checkout_baseline = variant(task, "baseline");
    entry.checkout_candidate = variant(task, "candidate");
  } else if (command === "prepare") {
    const source = await verifySource(task);
    await mkdir(join(TRIALS, suite.suite_id, task.task_id), { recursive: true });
    for (const arm of ["baseline", "candidate"]) {
      const target = variant(task, arm);
      requireValid(!existsSync(target), "Refusing to overwrite existing trial: " + target);
      // Independent local clone: no linked worktree and no shared object alternates.
      git(HERE, ["clone", "--quiet", "--no-hardlinks", "--no-local", source, target]);
      git(target, ["remote", "set-url", "origin", task.url]);
      git(target, ["switch", "-c", "gp-ab/" + task.task_id + "-" + arm]);
      await verifyTrial(task, arm);
    }
    entry.prepared = true;
  } else if (command === "prompt") {
    requireValid(selected !== "all" && ["baseline", "candidate"].includes(armArg),
      "Use prompt TASK_ID baseline|candidate");
    await verifyTrial(task, armArg);
    const preamble = "Use Codexify on this Windows computer for the exact public Git repo task. " +
      "The only permitted checkout is " + variant(task, armArg) + ". " +
      "Do not open/edit its sibling arm or the grader/controller files. " +
      "Use only the files: " + task.allowed_paths.join(", ") + ". " +
      "Verify HEAD equals " + task.source_sha + " and branch equals gp-ab/" +
      task.task_id + "-" + armArg + " before changing any file. " +
      "Do not touch main branches, existing workers, secrets, live services, remote APIs, " +
      "deployments, GitHub PRs, or paid models. Hard cap your own engineering work at " +
      task.max_minutes + " minutes. Task: " + task.description;
    const instructions = armArg === "candidate"
      ? "Before implementation, use Codexify exec_command to invoke node " +
        join(HERE, "godprompt-probe.mjs") + " " + task.task_id + " in its existing " +
        "GodPrompt controller checkout. It calls get_version, classify_task, and " +
        "tailored execute/verify guidance through the EXACT unreleased local GodPrompt " +
        "stdio MCP. Record its source SHA, route and receipt. If the inferred route " +
        "disagrees with the task, report this as a real usability defect rather than " +
        "silently repairing its score. Apply its scoped guidance faithfully. If the " +
        "probe fails, declare this arm noncompliant rather than quietly replacing " +
        "GodPrompt with generic advice. "
      : "Do not load or invoke any GodPrompt MCP tools or skills and do not read " +
        "GodPrompt source, docs or prior candidate output. Use normal software " +
        "engineering judgment and Codexify tools only. ";
    entry.arm = armArg;
    entry.prompt = preamble + " " + instructions +
      "Work independently, include regression tests, and stop with a concise " +
      "summary of changes and source tests. Do not claim results you have not run.";
  } else if (command === "status" || command === "grade" || command === "score") {
    entry.arms = {};
    for (const arm of ["baseline", "candidate"]) {
      const path = variant(task, arm);
      if (!existsSync(path)) {
        entry.arms[arm] = { state: "NOT_PREPARED" };
        continue;
      }
      await verifyTrial(task, arm);
      const status = git(path, ["status", "--porcelain=v1", "--untracked-files=all"]);
      const edited = Boolean(status.trim());
      if (command === "status") {
        entry.arms[arm] = { state: edited ? "MODIFIED_UNGRADED" : "READY_BASELINE",
          checkout: path };
      } else {
        const result = grade(task, path);
        entry.arms[arm] = { state: edited ? "MODIFIED_GRADED" : "UNMODIFIED_CONTROL",
          checkout: path, grade: result };
      }
    }
  }
  payload.tasks.push(entry);
}
if (command === "score") {
  const pairs = payload.tasks.filter(t => {
    const a = t.arms?.baseline, b = t.arms?.candidate;
    return a?.state === "MODIFIED_GRADED" && b?.state === "MODIFIED_GRADED";
  });
  const valid = pairs.filter(t => t.arms.baseline.grade.outside_scope_changes.length === 0 &&
    t.arms.candidate.grade.outside_scope_changes.length === 0);
  payload.paired_modified_tasks = pairs.length;
  payload.valid_scope_pairs = valid.length;
  payload.paired_test_pass_improvements = valid.filter(t =>
    !t.arms.baseline.grade.passed && t.arms.candidate.grade.passed).length;
  payload.paired_test_pass_regressions = valid.filter(t =>
    t.arms.baseline.grade.passed && !t.arms.candidate.grade.passed).length;
  payload.status = valid.length === suite.tasks.length
    ? "GRADER_RESULTS_ONLY_AWAIT_AGENT_PROVENANCE" : "UNSCORED_NO_COMPLETE_MATCHED_AGENT_RUN";
  payload.agent_model_verified = false;
  payload.model_cost_verified_zero = false;
  payload.elapsed_time_and_token_uplift_verified = false;
  payload.warning = "Objective code grader only. Arm authenticity/model/effort/tool/cost " +
    "and wall-time/token metrics require independent Codexify session receipts. " +
    "Do not report causal productivity gain from these records alone.";
}
console.log(JSON.stringify(payload, null, 2));
