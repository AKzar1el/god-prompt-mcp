#!/usr/bin/env node
// V9 genuine-public-issue first-run executor. No publish, deploy, or clean-up.
import { createHash } from "node:crypto";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(HERE, "../../..");
const ROOT = resolve(HERE, "../real-runs/replication-v9");
const SOURCE = join(ROOT, "sources", "mcp-trendpulse");
const PRIVATE = join(ROOT, "private");
const GRADER = join(PRIVATE, "v9-grade.py");
const RECEIPTS = join(PRIVATE, "receipts");
const MANIFEST = join(HERE, "v9-frozen-public-issues-20261123.json");
const manifestBytes = readFileSync(MANIFEST);
const manifest = JSON.parse(manifestBytes);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const check = (good, message) => { if (!good) throw new Error(message); };
const git = (dir, args) => execFileSync("git", args, {
  cwd: dir, encoding: "utf8", windowsHide: true, timeout: 60000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
}).trim();
const isWithin = (parent, target) => {
  const r = relative(parent, target);
  return Boolean(r) && r !== ".." && !r.startsWith(".." + sep) && !isAbsolute(r);
};
function ordinaryDir(path) {
  const st = lstatSync(path);
  check(st.isDirectory() && !st.isSymbolicLink(), "Linked/non-directory path: " + path);
  check(resolve(realpathSync(path)).toLowerCase() === resolve(path).toLowerCase(),
    "Unexpected physical alias: " + path);
}
function verifyFrozen() {
  check(manifest.schema === "godprompt.v9.frozen-public-issues.triarm.v1", "Wrong manifest");
  check(manifest.source_sha === "3a742c73d0bd7b44e3493129412eb2ca40f474cc", "Wrong source pin");
  check(manifest.godprompt_revision === "f0b220791267017866ba04aad6b1adc59d7cf173",
    "Wrong GodPrompt pin");
  check(manifest.tasks.length === 2, "Wrong task count");
  for (const dir of [PROJECT, ROOT, SOURCE, join(SOURCE, ".git"), PRIVATE]) ordinaryDir(dir);
  check(sha(readFileSync(GRADER)) === manifest.private_grader_sha256, "Frozen grader changed");
  check(sha(readFileSync(join(PROJECT, "dist/stdio.js"))) ===
    manifest.godprompt_stdio_sha256, "Built MCP changed");
  check(git(SOURCE, ["rev-parse", "HEAD"]) === manifest.source_sha, "Source SHA changed");
  check(git(SOURCE, ["status", "--porcelain=v1"]) === "", "Frozen source is dirty");
  check(git(SOURCE, ["remote", "get-url", "origin"]) === manifest.remote,
    "Source origin changed");
}
const taskFor = id => {
  const t = manifest.tasks.find(x => x.task_id === id);
  check(t, "Unknown task: " + id);
  return t;
};
const armPath = (task, arm) => join(ROOT, "arms", task.task_id, arm);
const receiptPath = (task, arm) => join(RECEIPTS, task.task_id, arm + ".json");
const logPath = (task, arm) => join(RECEIPTS, task.task_id, arm + ".jsonl");
const branchName = (task, arm) => "gp-v9/" + task.issue_number + "-" + arm;
function verifyArm(task, arm, needClean) {
  check(manifest.arms.includes(arm), "Unexpected arm");
  const target = armPath(task, arm);
  check(isWithin(ROOT, target), "Target escaped experiment root");
  ordinaryDir(target); ordinaryDir(join(target, ".git"));
  check(git(target, ["rev-parse", "HEAD"]) === manifest.source_sha, "Wrong arm source");
  check(git(target, ["branch", "--show-current"]) === branchName(task, arm),
    "Wrong trial branch");
  check(git(target, ["remote", "get-url", "origin"]) === manifest.remote,
    "Wrong trial remote");
  check(!existsSync(join(target, ".git/objects/info/alternates")),
    "Git object alternates forbidden");
  if (needClean) check(git(target, ["status", "--porcelain=v1"]) === "",
    "Trial is dirty before first attempt");
  return target;
}
function prepare() {
  const root = join(ROOT, "arms");
  mkdirSync(root, { recursive: true }); ordinaryDir(root);
  const created = [];
  for (const task of manifest.tasks) {
    const parent = join(root, task.task_id);
    mkdirSync(parent, { recursive: true }); ordinaryDir(parent);
    for (const arm of task.order) {
      const dest = armPath(task, arm);
      check(!existsSync(dest), "Trial already exists; refusing overwrite: " + dest);
      git(PROJECT, ["clone", "--quiet", "--no-hardlinks", "--no-local", SOURCE, dest]);
      git(dest, ["remote", "set-url", "origin", manifest.remote]);
      git(dest, ["switch", "-c", branchName(task, arm)]);
      verifyArm(task, arm, true);
      created.push({ task: task.task_id, arm });
    }
  }
  return { new_trials: created.length, created };
}
function makePrompt(task, arm) {
  const common = "Fix genuine GitHub issue " + task.issue_url + " in the pinned public " +
    "repository. First check current git HEAD equals " + manifest.source_sha + "." +
    " Work ONLY on " + task.allowed_paths.join(", ") + " in THIS checkout." +
    " Do not read/modify sibling arm clones, parent directories, hidden graders, " +
    "private files, secrets, or outside projects. Do not run shell network, invoke " +
    "external providers, use paid API keys, push branches, alter GitHub, release, " +
    "deploy, or modify running services. Add focused tests, run actual existing " +
    "offline tests, and accurately state results. TASK: " + task.description;
  if (arm === "baseline") return common +
    " Baseline: normal engineering. Do not invoke or seek any GodPrompt skill, " +
    "reference, MCP tool or protocol.";
  const compact = arm === "compact_mcp";
  return common + " Before editing, call the local godprompt MCP classify_task, then " +
    "get_tailored_guidance for its task_type with phase=execute, max_chars=" +
    (compact ? "600, compact=true" : "1800, compact=false") +
    ". Apply those instructions faithfully. AFTER actual tests call the same " +
    "MCP get_tailored_guidance with phase=verify, max_chars=" +
    (compact ? "600, compact=true" : "1800, compact=false") +
    ". Follow the verification gate. If MCP tools fail, report that failure rather " +
    "than substituting generic guidance.";
}
function eventSummary(text) {
  const events = text.split(/\r?\n/u).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  let turns = 0, editsOrCommands = 0;
  const godprompt = [];
  for (const e of events) {
    if (e.type === "turn.completed") {
      turns++;
      for (const k of Object.keys(usage)) usage[k] += e.usage?.[k] || 0;
    }
    if (e.type === "item.completed" && ["command_execution","file_change"].includes(e.item?.type) &&
        e.item?.status === "completed" && !e.item?.error &&
        (e.item?.exit_code === undefined || e.item.exit_code === 0)) {
      editsOrCommands++;
    }
    if (e.type === "item.completed" && e.item?.type === "mcp_tool_call" &&
        e.item?.server === "godprompt") {
      godprompt.push({ tool: e.item.tool, success: e.item.status === "completed" && !e.item.error });
    }
  }
  return { events: events.length, turns, edits_or_commands: editsOrCommands,
    godprompt_calls: godprompt, usage };
}
function changedPaths(path) {
  return git(path, ["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u)
    .filter(Boolean).map(line => {
      const x = line.slice(3).split(" -> ").at(-1);
      return x.replaceAll("\\", "/").replaceAll('"', "");
    });
}
async function run(task, arm) {
  // The first actual V9 run hit an explicit host policy denial. Never sidestep
  // that restriction by launching treatment arms or replaying the failed control.
  // A new preregistered study requires a legitimately enabled command tool.
  const firstTask = manifest.tasks[0];
  const firstReceipt = receiptPath(firstTask, firstTask.order[0]);
  if (existsSync(firstReceipt)) {
    const first = JSON.parse(readFileSync(firstReceipt, "utf8"));
    check(!(first.accepted === false && first.command_or_edit_events === 0),
      "V9 halted: native coding commands were blocked by host policy. " +
      "Do not bypass or replay the frozen control; create a NEW study " +
      "only after the authorized tool execution policy is repaired.");
  }
  const pos = task.order.indexOf(arm);
  check(pos >= 0, "Arm not in frozen order");
  for (const prev of task.order.slice(0, pos)) {
    check(existsSync(receiptPath(task, prev)), "Earlier arm has not completed: " + prev);
  }
  const dir = verifyArm(task, arm, true);
  check(!existsSync(logPath(task, arm)) && !existsSync(receiptPath(task, arm)),
    "Original attempt exists; no replays");
  mkdirSync(join(RECEIPTS, task.task_id), { recursive: true });
  ordinaryDir(join(RECEIPTS, task.task_id));
  const npx = join(dirname(process.execPath), "node_modules/npm/bin/npx-cli.js");
  check(existsSync(npx), "Pinned npx CLI unavailable");
  const args = ["--yes", "--package", "@openai/codex@" + manifest.cli_version,
    "codex", "exec", "--ignore-user-config", "--ephemeral", "--sandbox",
    manifest.sandbox, "--model", manifest.model_requested, "-c",
    "model_reasoning_effort='high'", "-c",
    "sandbox_workspace_write.network_access=false", "-C", dir];
  if (arm !== "baseline") {
    const mcp = resolve(PROJECT, "dist/stdio.js").replaceAll("\\", "/");
    args.push("-c", "mcp_servers.godprompt.command='node'",
      "-c", "mcp_servers.godprompt.args=['" + mcp + "']",
      "-c", "mcp_servers.godprompt.enabled_tools=['get_version','classify_task','get_tailored_guidance']");
  }
  const prompt = makePrompt(task, arm);
  args.push("--json", prompt);
  const output = createWriteStream(logPath(task, arm), { flags: "wx" });
  const err = createWriteStream(join(RECEIPTS, task.task_id, arm + ".stderr.txt"),
    { flags: "wx" });
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  for (const key of ["OPENAI_API_KEY","ANTHROPIC_API_KEY","GITHUB_TOKEN","GH_TOKEN"]) delete env[key];
  const startTime = performance.now();
  const child = spawn(process.execPath, [npx, ...args], {
    cwd: dir, env, windowsHide: true, stdio: ["pipe","pipe","pipe"],
  });
  child.stdin.end();
  child.stdout.pipe(output);
  child.stderr.pipe(err);
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; child.kill(); },
    manifest.max_wall_seconds_per_arm * 1000);
  let error = null;
  const [exit, signal] = await new Promise(resolve => {
    child.on("error", e => { error = String(e.message); resolve([null,null]); });
    child.on("close", (code, sig) => resolve([code,sig]));
  });
  clearTimeout(timeout);
  if (!output.closed) await once(output, "close");
  if (!err.closed) await once(err, "close");
  const elapsed_seconds = Number(((performance.now()-startTime)/1000).toFixed(3));
  const log = readFileSync(logPath(task, arm), "utf8");
  const ev = eventSummary(log);
  const changed_files = changedPaths(dir);
  const outside = changed_files.filter(name => !task.allowed_paths.includes(name));
  const grader = spawnSync("python", [GRADER, String(task.issue_number), dir], {
    cwd: PROJECT, encoding: "utf8", windowsHide: true, timeout: 120000,
    // Python tooling lives in the user's Python user site; hiding it turns
    // correctly failing RED grader checks into a spurious import error.
    env: { ...env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  let grade = null;
  try { grade = JSON.parse(grader.stdout); } catch { /* An invalid result stays invalid. */ }
  const tests = spawnSync("python", ["-m","pytest","-q","tests/test_rss_compare.py"], {
    cwd: dir, encoding: "utf8", windowsHide: true, timeout: 120000,
    env: { ...env, PYTHONPATH: "src", PYTHONDONTWRITEBYTECODE: "1" },
  });
  const mcpValid = arm === "baseline" ? ev.godprompt_calls.length === 0 :
    ["classify_task", "get_tailored_guidance"].every(name =>
      ev.godprompt_calls.some(c => c.tool === name && c.success));
  const accepted = !timedOut && exit === 0 && ev.turns > 0 && ev.edits_or_commands > 0 &&
    mcpValid && outside.length === 0 && grader.status === 0 &&
    grade?.schema === "godprompt.v9.hidden-grade.v1" &&
    grade.issue === task.issue_number && grade.passed === task.hidden_checks &&
    grade.checks === task.hidden_checks && tests.status === 0;
  const receipt = {
    schema: "godprompt.v9.original-first-run.v1", manifest_sha256: sha(manifestBytes),
    task_id: task.task_id, issue: task.issue_number, arm,
    source_sha: manifest.source_sha, private_grader_sha256: manifest.private_grader_sha256,
    prompt_sha256: sha(prompt), model_requested: manifest.model_requested,
    effort_requested: manifest.reasoning_effort, sandbox_requested: manifest.sandbox,
    elapsed_seconds, exit_code: exit, signal, timed_out: timedOut, process_error: error,
    usage: ev.usage, turns_completed: ev.turns, command_or_edit_events: ev.edits_or_commands,
    godprompt_calls: ev.godprompt_calls, changed_files, outside_scope_changes: outside,
    grade, grader_exit_code: grader.status, ordinary_tests_exit_code: tests.status,
    ordinary_tests_tail: String(tests.stdout || tests.stderr || "").slice(-700),
    jsonl_sha256: sha(log), accepted: Boolean(accepted),
    limitations: [
      "Model, effort, and Windows sandbox settings requested from CLI, not independently attested.",
      "Same-user Windows filesystem isolation of private grader not guaranteed.",
      "Tool-use receipts are behavioral evidence, not a proof of causality.",
    ],
  };
  writeFileSync(receiptPath(task, arm), JSON.stringify(receipt,null,2)+"\n", {flag:"wx"});
  return receipt;
}
function score() {
  const records = manifest.tasks.flatMap(t => t.order.map(arm => {
    const path = receiptPath(t, arm);
    return existsSync(path) ? JSON.parse(readFileSync(path,"utf8")) :
      { task_id:t.task_id, arm, status:"NOT_RUN" };
  }));
  const byArm = Object.fromEntries(manifest.arms.map(arm => {
    const rr = records.filter(x => x.arm === arm);
    const attempted = rr.filter(x => x.schema === "godprompt.v9.original-first-run.v1");
    const accepted = attempted.filter(x => x.accepted);
    const seconds = attempted.reduce((sum,x) => sum+x.elapsed_seconds,0);
    const tokens = attempted.reduce((sum,x) => sum+(x.usage.input_tokens || 0),0);
    return [arm, {
      attempted: attempted.length, accepted: accepted.length,
      observed_total_seconds: Number(seconds.toFixed(2)), model_reported_input_tokens: tokens,
      seconds_per_accepted_fix: attempted.length === manifest.tasks.length && accepted.length
        ? Number((seconds/accepted.length).toFixed(2)) : null,
      tokens_per_accepted_fix: attempted.length === manifest.tasks.length && accepted.length
        ? Math.round(tokens/accepted.length) : null,
    }];
  }));
  return { schema:"godprompt.v9.partial-first-run-score.v1", manifest_sha256:sha(manifestBytes),
    expected_trials:manifest.tasks.length*manifest.arms.length,
    completed_trials:records.filter(x=>x.schema === "godprompt.v9.original-first-run.v1").length,
    by_arm:byArm, attempts:records.map(x=>({task_id:x.task_id, arm:x.arm,
      status:x.status || (x.timed_out ? "TIMEOUT" : "RECORDED"),
      accepted:x.accepted ?? null, hidden_passed:x.grade?.passed ?? null,
      hidden_total:x.grade?.checks ?? null, elapsed_seconds:x.elapsed_seconds ?? null,
      input_tokens:x.usage?.input_tokens ?? null})),
    interpretation:"Incomplete/small experiment; never claim general productivity uplift."};
}
verifyFrozen();
const [command="plan", id, arm] = process.argv.slice(2);
let out;
if(command==="plan") out={manifest_sha256:sha(manifestBytes),source_sha:manifest.source_sha,
  grader_sha256:manifest.private_grader_sha256,
  tasks:manifest.tasks.map(t=>({task:t.task_id,issue:t.issue_url,order:t.order,checks:t.hidden_checks}))};
else if(command==="prepare") out=prepare();
else if(command==="run") out=await run(taskFor(id),arm);
else if(command==="score") out=score();
else if(command==="receipt") out=JSON.parse(readFileSync(receiptPath(taskFor(id),arm),"utf8"));
else throw new Error("Usage: v9-runner.mjs plan|prepare|run TASK ARM|score|receipt TASK ARM");
console.log(JSON.stringify(out,null,2));
