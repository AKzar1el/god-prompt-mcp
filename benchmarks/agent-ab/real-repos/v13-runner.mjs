#!/usr/bin/env node
/**
 * V13 pinned real-repository first-run A/B/C study.
 * No model execution outside "run", no GitHub writes, no cleanup or replay.
 * Frozen study/runner hashes are stored in an ignored, separately written receipt.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "../../..");
const ROOT = resolve(HERE, "../real-runs/replication-v13");
const SOURCE = resolve(HERE, "../real-runs/replication-v12/source/trendpulse");
const STUDY_FILE = join(HERE, "v13-frozen-study-20261123.json");
const FREEZE = join(ROOT, "v13-freeze-sha256.json");
const GRADER = join(ROOT, "v13-grade.py");
const RECEIPTS = join(ROOT, "receipts");
const CLI = resolve(process.env.LOCALAPPDATA || "", "npm-cache", "_npx",
  "0ba5083c0a8edbde", "node_modules", "@openai", "codex");
const GOD_STDIO = join(PROJECT, "dist", "stdio.js");
const MANIFEST_BYTES = readFileSync(STUDY_FILE);
const STUDY = JSON.parse(MANIFEST_BYTES);
const sha = data => createHash("sha256").update(data).digest("hex");
const childOf = (parent, target) => {
  const r = relative(parent, target);
  return Boolean(r) && r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r);
};
const git = (cwd, args) => execFileSync("git", args, {
  cwd, encoding: "utf8", windowsHide: true, timeout: 60000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
}).trim();
function ordinaryDirectory(path) {
  const st = lstatSync(path);
  assert.ok(st.isDirectory() && !st.isSymbolicLink(), "Not a plain directory: " + path);
  assert.equal(resolve(realpathSync(path)).toLowerCase(),
    resolve(path).toLowerCase(), "Aliased directory: " + path);
}
function ensureSource() {
  assert.equal(STUDY.schema, "godprompt.v13.behavioral-verify-once-study.v1");
  assert.equal(STUDY.tasks.length, 2);
  assert.deepEqual(STUDY.arms, ["baseline", "full_mcp", "verify_once_mcp"]);
  assert.equal(STUDY.source_sha, "3a742c73d0bd7b44e3493129412eb2ca40f474cc");
  for (const dir of [PROJECT, ROOT, SOURCE, join(SOURCE, ".git")]) ordinaryDirectory(dir);
  assert.equal(git(PROJECT, ["rev-parse", "HEAD"]), STUDY.godprompt_revision);
  assert.equal(git(SOURCE, ["rev-parse", "HEAD"]), STUDY.source_sha);
  assert.equal(git(SOURCE, ["status", "--porcelain=v1"]), "");
  assert.equal(git(SOURCE, ["remote", "get-url", "origin"]), STUDY.source_origin);
  assert.equal(sha(readFileSync(GRADER)), STUDY.private_grader_sha256);
  assert.equal(sha(readFileSync(GOD_STDIO)), STUDY.godprompt_stdio_sha256);
  assert.equal(JSON.parse(readFileSync(join(CLI, "package.json"), "utf8")).version,
    STUDY.environment.cli_version);
  const frozen = JSON.parse(readFileSync(FREEZE, "utf8"));
  assert.equal(frozen.manifest_sha256, sha(MANIFEST_BYTES), "Manifest not frozen");
  assert.equal(frozen.runner_sha256, sha(readFileSync(fileURLToPath(import.meta.url))),
    "Runner modified after freeze");
}
function cloneLocation(task, arm) {
  assert.ok(STUDY.arms.includes(arm) && task.order.includes(arm));
  const dir = join(ROOT, "arms", task.id, arm);
  assert.ok(childOf(ROOT, dir), "Escaped V13 experiment directory");
  return dir;
}
function receiptPath(task, arm) { return join(RECEIPTS, task.id, arm + ".json"); }
function checkClone(task, arm, clean = true) {
  const dir = cloneLocation(task, arm);
  ordinaryDirectory(dir); ordinaryDirectory(join(dir, ".git"));
  assert.ok(!existsSync(join(dir, ".git", "objects", "info", "alternates")),
    "Linked Git objects forbidden");
  assert.equal(git(dir, ["rev-parse", "HEAD"]), STUDY.source_sha);
  assert.equal(git(dir, ["branch", "--show-current"]), "gp-v13-" + task.issue + "-" + arm);
  assert.equal(git(dir, ["remote", "get-url", "origin"]), STUDY.source_origin);
  if (clean) assert.equal(git(dir, ["status", "--porcelain=v1"]), "");
  return dir;
}
function prepare() {
  const created = [];
  for (const task of STUDY.tasks) for (const arm of task.order) {
    const dest = cloneLocation(task, arm);
    assert.ok(!existsSync(dest), "Refusing to overwrite trial clone: " + dest);
    mkdirSync(dirname(dest), { recursive: true });
    ordinaryDirectory(dirname(dest));
    execFileSync("git", ["clone", "--quiet", "--no-hardlinks", "--no-local", SOURCE, dest], {
      cwd: PROJECT, windowsHide: true, timeout: 60000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    git(dest, ["remote", "set-url", "origin", STUDY.source_origin]);
    git(dest, ["switch", "-c", "gp-v13-" + task.issue + "-" + arm]);
    checkClone(task, arm);
    created.push({ task: task.id, arm });
  }
  return { new_independent_clones: created.length, created };
}
function makePrompt(task, arm) {
  const basic = "Implement an existing genuine open issue " + task.issue_url +
    " in this pinned Python repository (HEAD " + STUDY.source_sha + "). " +
    "Work ONLY in THIS isolated checkout and these paths: " + task.allowed_paths.join(", ") +
    ". Do not read other arm checkouts, parent paths, private graders, or secrets. " +
    "Do not use shell network, external APIs, paid API keys, other connected apps, or " +
    "GitHub writes. Do not publish, deploy, release, restart services or delete trees. " +
    "Preserve existing defaults; add focused tests and run " +
    "PYTHONPATH=src PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider " +
    "tests/test_rss_compare.py (or equivalent PowerShell env). Complete the requested " +
    "behavior within the frozen wall-time limit and stop rather than adding unrequested changes. " +
    "You must verify actual exit status, source changes, and report unresolved failures. " +
    "TASK: " + task.description + " ";
  if (arm === "baseline") return basic +
    "CONTROL: use ordinary engineering practice without invoking any GodPrompt MCP/skill/prompt.";
  if (arm === "verify_once_mcp") return basic +
    "TREATMENT: code and run actual tests using ordinary engineering practice first. " +
    "Immediately AFTER tests, call the local godprompt MCP get_tailored_guidance " +
    "EXACTLY ONCE with task_type=BUILD, phase=verify, compact=true, max_chars=600. " +
    "Inspect your real evidence against this verify gate; repair only genuine defects " +
    "and stop. Do not call classify_task or request plan/execute guidance. " +
    "If the MCP is inaccessible, say so rather than substituting a fake response.";
  return basic + "TREATMENT: BEFORE edits, call the local godprompt MCP " +
    "classify_task, then get_tailored_guidance with its task_type, phase=execute, " +
    "max_chars=1800, compact=false. Apply this guidance; do scoped edits and run real tests. " +
    "AFTER tests, call get_tailored_guidance again with phase=verify, max_chars=1800, " +
    "compact=false and the same task_type. Verify actual evidence, and report if MCP fails.";
}
function modelArgs(task, arm, dir) {
  const args = [join(CLI, "bin", "codex.js"), "exec", "--ephemeral", "--sandbox",
    STUDY.environment.sandbox, "--model", STUDY.environment.model_requested,
    "-c", "model_reasoning_effort='high'",
    "-c", "sandbox_workspace_write.network_access=false"];
  for (const server of STUDY.environment.disabled_unrelated_mcp)
    args.push("-c", "mcp_servers." + server + ".enabled=false");
  if (arm === "baseline") args.push("-c", "mcp_servers.godprompt.enabled=false");
  else {
    args.push("-c", "mcp_servers.godprompt.enabled=true",
      "-c", "mcp_servers.godprompt.command='node'",
      "-c", "mcp_servers.godprompt.args=['" + GOD_STDIO.replaceAll("\\", "/") + "']",
      "-c", "mcp_servers.godprompt.enabled_tools=['get_version','classify_task','get_tailored_guidance']");
  }
  return [...args, "-C", dir, "--json", makePrompt(task, arm)];
}
function parseEvents(data) {
  const events = data.split(/\r?\n/u).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  let turns = 0, commands = 0, edits = 0, completeUsageTurns = 0;
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  const mcp = [];
  for (const event of events) {
    if (event.type === "turn.completed") {
      turns++;
      if (Object.keys(usage).every(key => Number.isSafeInteger(event.usage?.[key]) &&
          event.usage[key] >= 0)) {
        completeUsageTurns++;
        for (const key of Object.keys(usage)) usage[key] += event.usage[key];
      }
    }
    if (event.type === "item.completed") {
      const item = event.item || {};
      if (item.type === "command_execution" && item.status === "completed" &&
          !item.error && item.exit_code === 0) commands++;
      if (item.type === "file_change" && item.status === "completed" && !item.error) edits++;
      if (item.type === "mcp_tool_call") {
        mcp.push({ server: item.server, tool: item.tool,
          success: item.status === "completed" && !item.error });
      }
    }
  }
  return { turns, successful_shell: commands, successful_edits: edits,
    mcp_calls: mcp, model_reported_usage: turns && completeUsageTurns === turns ? usage : null,
    complete_usage_turns: completeUsageTurns };
}
function changedPaths(dir) {
  return git(dir, ["status", "--porcelain=v1", "--untracked-files=all"])
    .split(/\r?\n/u).filter(Boolean).map(line =>
      line.slice(3).replaceAll('"', "").replaceAll("\\", "/").split(" -> ").at(-1));
}
function run(task, arm) {
  const idx = task.order.indexOf(arm);
  assert.ok(idx >= 0, "Invalid arm order");
  for (const prev of task.order.slice(0, idx)) {
    const file = receiptPath(task, prev);
    assert.ok(existsSync(file), "Earlier frozen arm not complete: " + prev);
    const prior = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(!prior.policy_denial && !prior.timeout &&
      !prior.rubric_bias_suspected, "Prior attempt blocked further execution");
  }
  const dir = checkClone(task, arm, true);
  const outDir = join(RECEIPTS, task.id);
  mkdirSync(outDir, { recursive: true }); ordinaryDirectory(outDir);
  const output = receiptPath(task, arm);
  const stdoutPath = join(outDir, arm + ".jsonl");
  const stderrPath = join(outDir, arm + ".stderr.txt");
  for (const file of [output, stdoutPath, stderrPath])
    assert.ok(!existsSync(file), "No replay/overwrite: " + file);
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
    PYTEST_DISABLE_PLUGIN_AUTOLOAD: "1", GIT_TERMINAL_PROMPT: "0" };
  for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GITHUB_TOKEN", "GH_TOKEN"])
    delete env[key];
  const started = performance.now();
  const model = spawnSync(process.execPath, modelArgs(task, arm, dir), {
    cwd: dir, env, input: "", encoding: "utf8", windowsHide: true,
    timeout: task.timeout_seconds * 1000, maxBuffer: 32 * 1024 * 1024,
  });
  const seconds = Number(((performance.now() - started) / 1000).toFixed(3));
  const stdout = String(model.stdout || "");
  const stderr = String(model.stderr || "");
  writeFileSync(stdoutPath, stdout, { flag: "wx" });
  writeFileSync(stderrPath, stderr, { flag: "wx" });
  const events = parseEvents(stdout);
  const paths = changedPaths(dir), outside = paths.filter(p => !task.allowed_paths.includes(p));
  const denial = /blocked by policy|rejected by host policy|permission denied by host/iu.test(stdout + "\n" + stderr);
  const grading = spawnSync("python", ["-B", GRADER, String(task.issue), dir], {
    cwd: PROJECT, env, encoding: "utf8", windowsHide: true,
    timeout: 120000, maxBuffer: 3 * 1024 * 1024,
  });
  let grade = null;
  try { grade = JSON.parse(String(grading.stdout || "")); } catch { /* Fail closed */ }
  const tests = spawnSync("python", ["-m", "pytest", "-q", "-p", "no:cacheprovider",
    "tests/test_rss_compare.py"], {
    cwd: dir, env: { ...env, PYTHONPATH: join(dir, "src") },
    encoding: "utf8", windowsHide: true,
    timeout: 120000, maxBuffer: 3 * 1024 * 1024,
  });
  const godCalls = events.mcp_calls.filter(c => c.server === "godprompt");
  const otherMcp = events.mcp_calls.filter(c => c.server !== "godprompt");
  const success = godCalls.filter(x => x.success);
  const protocol = arm === "baseline" ? godCalls.length === 0 :
    arm === "verify_once_mcp" ? godCalls.length === 1 &&
      success.length === 1 && success[0].tool === "get_tailored_guidance" :
      success.some(x => x.tool === "classify_task") &&
      success.filter(x => x.tool === "get_tailored_guidance").length >= 2;
  const timeout = model.error?.code === "ETIMEDOUT" || seconds > task.timeout_seconds;
  const accepted = model.status === 0 && !model.error && !denial && !timeout &&
    events.turns > 0 && events.successful_shell > 0 && events.successful_edits > 0 &&
    protocol && !otherMcp.length && paths.length > 0 && outside.length === 0 &&
    grading.status === 0 && grade?.schema === STUDY.grader_schema &&
    grade?.issue === task.issue && grade?.checks === 19 && grade?.passed === 19 &&
    tests.status === 0;
  const status = accepted ? "VALID_CORRECT" :
    denial ? "INVALID_POLICY" : timeout ? "INVALID_TIMEOUT" :
    model.status === 0 && grading.status === 0 && grade?.checks === 19 &&
      grade.passed < 19 ? "VALID_INCORRECT" : "INVALID_OTHER";
  const record = {
    schema: "godprompt.v13.original-first-run.v1",
    study: STUDY.study_id, task_id: task.id, issue: task.issue, arm,
    manifest_sha256: sha(MANIFEST_BYTES), frozen_grader_sha256: STUDY.private_grader_sha256,
    prompt_sha256: sha(makePrompt(task, arm)), source_sha: STUDY.source_sha,
    requested_model: STUDY.environment.model_requested,
    requested_effort: STUDY.environment.reasoning_effort_requested,
    requested_sandbox: STUDY.environment.sandbox,
    original_status: status, accepted,
    wall_seconds: seconds, model_exit_code: model.status, signal: model.signal || null,
    process_error: model.error ? String(model.error.message) : null,
    timeout, policy_denial: denial, rubric_bias_suspected: false,
    model_turns: events.turns, successful_native_commands: events.successful_shell,
    successful_file_edits: events.successful_edits,
    model_reported_usage: events.model_reported_usage,
    mcp_calls: events.mcp_calls, other_mcp_count: otherMcp.length,
    protocol_valid: protocol, changed_paths: paths, out_of_scope_paths: outside,
    hidden_passed: grade?.passed ?? null, hidden_total: grade?.checks ?? null,
    failed_checks: grade?.case_results?.filter(c => !c.passed).map(c => c.check) ?? null,
    grader_exit_code: grading.status, ordinary_tests_exit_code: tests.status,
    ordinary_tests_tail: String(tests.stdout || tests.stderr || "").split(/\r?\n/u).slice(-8),
    stdout_sha256: sha(stdout), stderr_sha256: sha(stderr),
    caveats: [
      "Model/effort/Windows execution profile requested, not independently attested",
      "Source-owner issue and same-author grader; no independent blinded correctness adjudication",
      "Model token counts include cached input and are not independently billed"
    ],
  };
  writeFileSync(output, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  return record;
}
function score() {
  const rows = STUDY.tasks.flatMap(task => task.order.map(arm => {
    const file = receiptPath(task, arm);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) :
      { task_id: task.id, issue: task.issue, arm, original_status: "NOT_RUN" };
  }));
  const totals = Object.fromEntries(STUDY.arms.map(arm => {
    const obs = rows.filter(x => x.arm === arm &&
      x.schema === "godprompt.v13.original-first-run.v1");
    const accepted = obs.filter(x => x.accepted).length;
    const time = obs.reduce((s,x) => s + x.wall_seconds, 0);
    const knownInput = obs.reduce((s,x) => s+(x.model_reported_usage?.input_tokens??0),0);
    const missingUsage = obs.filter(x => x.model_reported_usage === null).length;
    const complete = obs.length === STUDY.tasks.length;
    return [arm, {
      planned: STUDY.tasks.length, first_runs: obs.length, accepted,
      total_observed_seconds: Number(time.toFixed(3)),
      full_denominator_seconds_per_accepted_fix: complete && accepted ?
        Number((time / accepted).toFixed(3)) : null,
      model_reported_input_tokens_known: knownInput,
      model_reported_usage_missing_attempts: missingUsage,
      full_denominator_input_tokens_per_accepted_fix: complete && accepted && !missingUsage ?
        Math.round(knownInput / accepted) : null
    }];
  }));
  return {
    schema: "godprompt.v13.first-run-full-denominator-score.v1",
    study: STUDY.study_id, planned: rows.length,
    first_runs: rows.filter(x => x.schema === "godprompt.v13.original-first-run.v1").length,
    by_arm: totals,
    rows: rows.map(x => ({ task: x.task_id, arm: x.arm, status: x.original_status,
      seconds: x.wall_seconds ?? null, hidden: x.hidden_passed ?? null,
      model_reported_input_tokens: x.model_reported_usage?.input_tokens ?? null })),
    general_replicable_productivity_improvement_proven: false,
    caveat: "Two previously studied owner-reported issues; incomplete/failed arms never imputed as successes."
  };
}
ensureSource();
const [action = "plan", id, arm] = process.argv.slice(2);
let result;
if (action === "plan") result = {
  study: STUDY.study_id, manifest_sha256: sha(MANIFEST_BYTES),
  runner_sha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  grader_sha256: STUDY.private_grader_sha256,
  tasks: STUDY.tasks.map(t => ({ issue: t.issue, order: t.order, timeout_seconds: t.timeout_seconds,
    known_red: STUDY.calibration["issue" + t.issue].untouched_passed }))
};
else if (action === "prepare") result = prepare();
else if (action === "run") {
  const task = STUDY.tasks.find(t => t.id === id);
  assert.ok(task, "Unknown task");
  result = run(task, arm);
}
else if (action === "score") result = score();
else if (action === "receipt") {
  const task = STUDY.tasks.find(t => t.id === id);
  assert.ok(task, "Unknown task");
  result = JSON.parse(readFileSync(receiptPath(task, arm), "utf8"));
}
else throw Error("Usage: v13-runner.mjs plan|prepare|run TASK_ID ARM|score|receipt TASK_ID ARM");
console.log(JSON.stringify(result, null, 2));
