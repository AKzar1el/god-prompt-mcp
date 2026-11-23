#!/usr/bin/env node
/**
 * V16 prospective three-repository first-run A/B/C study.
 * No model execution outside "run", no GitHub writes, no cleanup or replay.
 * Frozen study/runner hashes are stored in an ignored, separately written receipt.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { changedGitPaths } from "./v16-git-paths.mjs";
import { inspectV16Events, validV16TreatmentProtocol } from "./v16-event-audit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "../../..");
const ROOT = resolve(HERE, "../real-runs/replication-v16");
const STUDY_FILE = join(HERE, "v16-prospective-study-20261123.json");
const FREEZE = join(ROOT, "v16-prospective-freeze-sha256.json");
const GRADER = join(ROOT, "v16-grade.py");
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
function sourceDir(task) {
  return join(ROOT, "candidates", task.source_dir);
}
function ensureSource() {
  assert.equal(STUDY.schema, "godprompt.v16.prospective-multirepo-study.v1");
  assert.equal(STUDY.tasks.length, 3);
  assert.deepEqual(STUDY.arms, ["baseline", "full_mcp", "conditional_mcp"]);
  ordinaryDirectory(PROJECT); ordinaryDirectory(ROOT);
  assert.equal(git(PROJECT, ["rev-parse", "HEAD"]), STUDY.godprompt_revision);
  for (const task of STUDY.tasks) {
    const source = sourceDir(task);
    ordinaryDirectory(source); ordinaryDirectory(join(source, ".git"));
    assert.equal(git(source, ["rev-parse", "HEAD"]), task.source_sha);
    assert.equal(git(source, ["status", "--porcelain=v1"]), "");
    assert.equal(git(source, ["remote", "get-url", "origin"]), task.source_origin);
    assert.ok(task.allowed_paths.includes(task.code_path));
    assert.ok(task.hidden_checks >= 5 && task.reference_a_passed === task.hidden_checks &&
      task.reference_b_passed === task.hidden_checks && task.mutant_passed < task.hidden_checks);
  }
  assert.equal(sha(readFileSync(GRADER)), STUDY.private_grader_sha256);
  assert.equal(sha(readFileSync(GOD_STDIO)), STUDY.godprompt_stdio_sha256);
  assert.equal(sha(readFileSync(join(HERE, "v16-git-paths.mjs"))),
    STUDY.git_changed_paths_helper_sha256, "Changed-file parser modified after freeze");
  assert.equal(sha(readFileSync(join(HERE, "v16-risk-gated-guidance.mjs"))),
    STUDY.risk_gate_prototype_sha256, "Research gate modified after freeze");
  assert.equal(sha(readFileSync(join(HERE, "v16-event-audit.mjs"))),
    STUDY.event_audit_helper_sha256, "Native event inspector modified after freeze");
  assert.equal(JSON.parse(readFileSync(join(CLI, "package.json"), "utf8")).version,
    STUDY.environment.codex_cli_version);
  for (const arm of STUDY.arms) preflightMcpConfig(arm);
  const frozen = JSON.parse(readFileSync(FREEZE, "utf8"));
  assert.equal(frozen.manifest_sha256, sha(MANIFEST_BYTES), "Manifest not frozen");
  assert.equal(frozen.runner_sha256, sha(readFileSync(fileURLToPath(import.meta.url))),
    "Runner modified after freeze");
}
function cloneLocation(task, arm) {
  assert.ok(STUDY.arms.includes(arm) && task.order.includes(arm));
  const dir = join(ROOT, "arms", task.id, arm);
  assert.ok(childOf(ROOT, dir), "Escaped V16 experiment directory");
  return dir;
}
function receiptPath(task, arm) { return join(RECEIPTS, task.id, arm + ".json"); }
function checkClone(task, arm, clean = true) {
  const dir = cloneLocation(task, arm);
  ordinaryDirectory(dir); ordinaryDirectory(join(dir, ".git"));
  assert.ok(!existsSync(join(dir, ".git", "objects", "info", "alternates")),
    "Linked Git objects forbidden");
  assert.equal(git(dir, ["rev-parse", "HEAD"]), task.source_sha);
  assert.equal(git(dir, ["branch", "--show-current"]), "gp-v16-" + task.issue + "-" + arm);
  assert.equal(git(dir, ["remote", "get-url", "origin"]), task.source_origin);
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
    execFileSync("git", ["clone", "--quiet", "--no-hardlinks", "--no-local",
      sourceDir(task), dest], {
      cwd: PROJECT, windowsHide: true, timeout: 60000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    git(dest, ["remote", "set-url", "origin", task.source_origin]);
    git(dest, ["switch", "-c", "gp-v16-" + task.issue + "-" + arm]);
    checkClone(task, arm);
    created.push({ task: task.id, arm });
  }
  return { new_independent_clones: created.length, created };
}
function makePrompt(task, arm) {
  const basic = "Implement a real public bug reported in " + task.repo +
    ", issue " + task.issue + ", in this pinned Python checkout (HEAD " +
    task.source_sha + "). " +
    "Work ONLY in THIS isolated checkout and these paths: " + task.allowed_paths.join(", ") +
    ". Do not read other arm checkouts, parent paths, private graders, or secrets. " +
    "Do not use shell network, external APIs, paid API keys, other connected apps, or " +
    "GitHub writes. Do not publish, deploy, release, restart services or delete trees. " +
    "If Git reports dubious ownership, never relax trust globally; verify the exact " +
    "clone path before any per-command scoped safe.directory override. " +
    "Preserve existing defaults; add focused regression tests. On Windows PowerShell set " +
    "$env:PYTHONPATH='" + task.native_py_path + "'; " +
    "$env:PYTHONDONTWRITEBYTECODE='1'; $env:PYTEST_DISABLE_PLUGIN_AUTOLOAD='1', " +
    "then run python -m pytest -q -p no:cacheprovider " +
    task.native_test_args.join(" ") + ". Verify actual test process exit codes. " +
    "A reproduced regression failure BEFORE the first code edit is expected RED and " +
    "not a reason for extra MCP. Complete within the frozen wall-time limit. " +
    "You must verify actual exit status, source changes, and report unresolved failures. " +
    "TASK: " + task.description + " ";
  if (arm === "baseline") return basic +
    "CONTROL: use ordinary engineering practice without invoking any GodPrompt MCP/skill/prompt.";
  if (arm === "conditional_mcp") return basic +
    "TREATMENT: use evidence-triggered GodPrompt. Code and run native tests " +
    "normally without MCP. If ANY native pytest command fails with nonzero exit " +
    "AFTER your first code edit, call the local godprompt MCP " +
    "get_tailored_guidance EXACTLY ONCE with task_type=DEBUG, phase=verify, " +
    "compact=true, max_chars=600; apply only relevant diagnostics and retest. " +
    "If NO post-edit native pytest failure occurs, do not call ANY GodPrompt MCP " +
    "tool; inspect the diff and finish. Do not call classify_task or plan/execute " +
    "guidance. Missing test evidence means run the native test, not call MCP. " +
    "An expected pre-fix RED failure does not trigger MCP; do not fake tool receipts.";
  return basic + "TREATMENT: BEFORE edits, call the local godprompt MCP " +
    "classify_task, then get_tailored_guidance with its task_type, phase=execute, " +
    "max_chars=1800, compact=false. Apply this guidance; do scoped edits and run real tests. " +
    "AFTER tests, call get_tailored_guidance again with phase=verify, max_chars=1800, " +
    "compact=false and the same task_type. Verify actual evidence, and report if MCP fails.";
}
function mcpConfigArgs(arm) {
  const args = [];
  for (const server of STUDY.environment.configured_mcp_disabled_per_run)
    args.push("-c", "mcp_servers." + server + ".enabled=false");
  // Never create a new disabled server without a transport: Codex rejects
  // even disabled, undefined MCP entries as `invalid transport` (V14).
  if (arm !== "baseline") {
    args.push("-c", "mcp_servers.godprompt.enabled=true",
      "-c", "mcp_servers.godprompt.command='node'",
      "-c", "mcp_servers.godprompt.args=['" + GOD_STDIO.replaceAll("\\", "/") + "']",
      "-c", "mcp_servers.godprompt.enabled_tools=['get_version','classify_task','get_tailored_guidance']");
  }
  return args;
}
function preflightMcpConfig(arm) {
  // This parses Codex config without invoking a model, writing files or
  // starting MCP servers; use exactly the overrides passed to `exec`.
  const configured = JSON.parse(execFileSync(process.execPath, [
    join(CLI, "bin", "codex.js"), "mcp", "list", "--json", ...mcpConfigArgs(arm),
  ], { cwd: PROJECT, encoding: "utf8", windowsHide: true, timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }));
  assert.ok(Array.isArray(configured), "Codex did not return MCP config list");
  const active = configured.filter(x => x.enabled).map(x => x.name).sort();
  assert.deepEqual(active, arm === "baseline" ? [] : ["godprompt"],
    "Unexpected active MCP sources or ill-formed Codex config for " + arm);
  return active;
}
function modelArgs(task, arm, dir) {
  const args = [join(CLI, "bin", "codex.js"), "exec", "--ephemeral", "--sandbox",
    STUDY.environment.sandbox, "--model", STUDY.environment.requested_model,
    "-c", "model_reasoning_effort='high'",
    "-c", "sandbox_workspace_write.network_access=false",
    ...mcpConfigArgs(arm)];
  return [...args, "-C", dir, "--json", makePrompt(task, arm)];
}
function changedPaths(dir) {
  return changedGitPaths(dir);
}
function run(task, arm) {
  const idx = task.order.indexOf(arm);
  assert.ok(idx >= 0, "Invalid arm order");
  for (const prev of task.order.slice(0, idx)) {
    const file = receiptPath(task, prev);
    assert.ok(existsSync(file), "Earlier frozen arm not complete: " + prev);
    const prior = JSON.parse(readFileSync(file, "utf8"));
    assert.ok(!prior.policy_denial && !prior.rubric_bias_suspected,
      "Previous arm encountered host policy or rubric bias; stop study");
  }
  const enabledMcpAtPreflight = preflightMcpConfig(arm);
  const dir = checkClone(task, arm, true);
  const outDir = join(RECEIPTS, task.id);
  mkdirSync(outDir, { recursive: true }); ordinaryDirectory(outDir);
  const output = receiptPath(task, arm);
  const stdoutPath = join(outDir, arm + ".jsonl");
  const stderrPath = join(outDir, arm + ".stderr.txt");
  for (const file of [output, stdoutPath, stderrPath])
    assert.ok(!existsSync(file), "No replay/overwrite: " + file);
  const env = { ...process.env, PYTHONDONTWRITEBYTECODE: "1",
    PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8",
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
  const events = inspectV16Events(stdout);
  let paths = null, pathScanError = null;
  try { paths = changedPaths(dir); }
  catch (err) { pathScanError = String(err?.message || err).slice(0, 320); }
  const outside = paths?.filter(p => !task.allowed_paths.includes(p)) ?? null;
  const denial = /blocked by policy|rejected by host policy|permission denied by host/iu.test(stdout + "\n" + stderr);
  const grading = spawnSync("python", ["-B", GRADER, task.id.replace(/-v16$/u, ""), dir], {
    cwd: PROJECT, env, encoding: "utf8", windowsHide: true,
    timeout: 120000, maxBuffer: 3 * 1024 * 1024,
  });
  let grade = null;
  try { grade = JSON.parse(String(grading.stdout || "")); } catch { /* Fail closed */ }
  const tests = spawnSync("python", ["-m", "pytest", "-q", "-p", "no:cacheprovider",
    ...task.native_test_args], {
    cwd: dir, env: { ...env, PYTHONPATH: join(dir, task.native_py_path) },
    encoding: "utf8", windowsHide: true,
    timeout: 120000, maxBuffer: 3 * 1024 * 1024,
  });
  const godCalls = events.mcp_calls.filter(c => c.server === "godprompt");
  const otherMcp = events.mcp_calls.filter(c => c.server !== "godprompt");
  const protocol = validV16TreatmentProtocol(arm, events);
  const timeout = model.error?.code === "ETIMEDOUT" || seconds > task.timeout_seconds;
  const accepted = model.status === 0 && !model.error && !denial && !timeout &&
    events.turns > 0 && events.successful_shell > 0 && events.successful_edits > 0 &&
    events.successful_post_edit_pytest > 0 &&
    protocol && !otherMcp.length && Array.isArray(paths) &&
    paths.includes(task.code_path) && paths.some(p => p.startsWith("tests/")) &&
    outside.length === 0 &&
    grading.status === 0 && grade?.schema === STUDY.private_grader_schema &&
    grade?.task === task.id.replace(/-v16$/u, "") &&
    grade?.checked === task.hidden_checks && grade?.passed === task.hidden_checks &&
    tests.status === 0;
  const status = accepted ? "VALID_CORRECT" :
    denial ? "INVALID_POLICY" : timeout ? "INVALID_TIMEOUT" :
    model.status === 0 && grading.status === 0 && grade?.checked === task.hidden_checks &&
      grade.passed < task.hidden_checks ? "VALID_INCORRECT" :
      model.status === 0 && !protocol ? "INVALID_PROTOCOL" : "INVALID_OTHER";
  const record = {
    schema: "godprompt.v16.original-first-run.v1",
    study: STUDY.study_id, task_id: task.id, issue: task.issue, arm,
    manifest_sha256: sha(MANIFEST_BYTES), frozen_grader_sha256: STUDY.private_grader_sha256,
    prompt_sha256: sha(makePrompt(task, arm)), source_sha: task.source_sha,
    repo:task.repo, requested_model: STUDY.environment.requested_model,
    requested_effort: STUDY.environment.requested_effort,
    requested_sandbox: STUDY.environment.sandbox,
    original_status: status, accepted,
    wall_seconds: seconds, model_exit_code: model.status, signal: model.signal || null,
    process_error: model.error ? String(model.error.message) : null,
    timeout, policy_denial: denial, rubric_bias_suspected: false,
    model_turns: events.turns, successful_native_commands: events.successful_shell,
    successful_file_edits: events.successful_edits,
    model_reported_usage: events.model_reported_usage,
    post_edit_pytest_failures: events.post_edit_pytest_failures,
    successful_post_edit_pytest: events.successful_post_edit_pytest,
    malformed_jsonl_lines: events.malformed_lines,
    enabled_mcp_at_preflight: enabledMcpAtPreflight,
    mcp_calls: events.mcp_calls, other_mcp_count: otherMcp.length,
    protocol_valid: protocol, changed_paths: paths, out_of_scope_paths: outside,
    path_scan_error: pathScanError,
    hidden_passed: grade?.passed ?? null, hidden_total: grade?.checked ?? null,
    failed_checks: grade?.cases?.filter(c => !c.passed).map(c => c.name) ?? null,
    grader_exit_code: grading.status, ordinary_tests_exit_code: tests.status,
    ordinary_tests_tail: String(tests.stdout || tests.stderr || "").split(/\r?\n/u).slice(-8),
    stdout_sha256: sha(stdout), stderr_sha256: sha(stderr),
    caveats: [
      "Model/effort/Windows execution profile requested, not independently attested",
      "Previously unused external public issue with same-author behavioral grader and no independent blinded adjudication",
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
      x.schema === "godprompt.v16.original-first-run.v1");
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
    schema: "godprompt.v16.first-run-full-denominator-score.v1",
    study: STUDY.study_id, planned: rows.length,
    first_runs: rows.filter(x => x.schema === "godprompt.v16.original-first-run.v1").length,
    by_arm: totals,
    rows: rows.map(x => ({ task: x.task_id, arm: x.arm, status: x.original_status,
      seconds: x.wall_seconds ?? null, hidden: x.hidden_passed ?? null,
      model_reported_input_tokens: x.model_reported_usage?.input_tokens ?? null })),
    general_replicable_productivity_improvement_proven: false,
    caveat: "Three previously unused public issues; self-authored reference graders lack blinded peer review, incomplete/failed arms never imputed as successes."
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
    known_red: t.untouched_passed, green_references:[t.reference_a_passed,t.reference_b_passed],
    wrong_mutant:t.mutant_passed,hidden_checks:t.hidden_checks }))
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
else throw Error("Usage: v16-prospective-runner.mjs plan|prepare|run TASK_ID ARM|score|receipt TASK_ID ARM");
console.log(JSON.stringify(result, null, 2));
