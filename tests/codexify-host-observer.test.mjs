import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFile, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createWorkContract } from "../dist/work-contract.js";

const conversation = "b".repeat(24), project = "c".repeat(24);
const run = "a".repeat(32);
const time = () => new Date().toISOString();
const scope = { schema_version: 2, run_id: run,
  transport_session_id: 19, conversation_id: conversation, project_id: project };

function toolEvents(tool, id, options = {}) {
  const base = { ...scope, call_id: id, tool, resolved_tool: tool };
  const start = { ...base, event: "tool_start", timestamp: time(),
    ...(tool === "exec_command" ? { command_preview: "node --version" } : {}) };
  const finish = { ...base, event: "tool_finish", timestamp: time(), status: "ok" };
  return tool === "exec_command"
    ? [start, {
      schema_version: 2, event: "tool_worker_exit", timestamp: time(),
      run_id: run, call_id: id, worker_kind: "exec",
      exit_code: options.exit_code ?? 0,
      success: options.exit_code === undefined || options.exit_code === 0,
      wait_error: null,
    }, finish]
    : [start, finish];
}

test("observer preserves a scoped verification under 4,100 unrelated host events", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "godprompt-observer-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const audit = join(dir, "audit.jsonl");
  const contractPath = join(dir, "contract.json");
  const out = join(dir, "reviews.jsonl");
  const readyPath = join(dir, "observer.ready");
  const contract = (await createWorkContract({
    task: "Read-only inspect host-observed Node runtime",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Version is checked"],
    verification_commands: ["node --version"],
  })).contract;
  await writeFile(contractPath, JSON.stringify(contract));
  await writeFile(audit, JSON.stringify({
    schema_version: 2, event: "audit_started",
    timestamp: time(), run_id: run,
  }) + "\n");

  const child = spawn(process.execPath, [
    "scripts/codexify-audit-checkpoint-observer.mjs",
    "--watch", "--duration-ms", "5500",
  ], {
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: {
      ...process.env,
      GODPROMPT_CODEXIFY_AUDIT_FILE: audit,
      GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: conversation,
      GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: project,
      GODPROMPT_CODEXIFY_CONTRACT_FILE: contractPath,
      GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE: out,
      GODPROMPT_CODEXIFY_OBSERVER_READY_FILE: readyPath,
    },
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  let ready = false;
  for (let index = 0; index < 150; index++) {
    try { await stat(readyPath); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.equal(ready, true, "Observer must be ready before appending host events");
  const [checkStart, checkExit, checkFinish] = toolEvents("exec_command", 2);
  // A shared Codexify audit receives many other agents' tool events. None
  // may evict a pending verification belonging to this conversation.
  const unrelated = Array.from({ length: 4100 }, (_, i) => ({
    schema_version: 2, event: "tool_worker_exit", run_id: run, call_id: i + 10000,
  }));
  const unrelatedScoped = Array.from({ length: 4100 }, (_, i) => ({
    ...scope, event: "tool_start", call_id: i + 20000,
    tool: "get_version", resolved_tool: "get_version",
  }));
  await appendFile(audit, [
    ...toolEvents("update_plan", 1),
    checkStart, ...unrelated, ...unrelatedScoped, checkExit, checkFinish,
    ...toolEvents("goal_finish", 3),
    ...Array.from({ length: 40 }, (_, i) => toolEvents("update_plan", i + 4)).flat(),
  ].map((row) => JSON.stringify(row)).join("\n") + "\n");
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr);
  const report = (await readFile(out, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(report.slice(0, 3).map((entry) => entry.stage),
    ["plan", "verification", "handoff"]);
  assert.equal(report.length, 43, "all milestone reports must still be persisted");
  const summary = JSON.parse(stdout.trim());
  assert.equal(summary.observed_checkpoints, 43);
  assert.equal(summary.stages.length, 32, "memory-only stage history must be bounded");
  assert.equal(report[0].status, "CONTINUE_WITH_PENDING_ITEMS");
  assert.equal(report[1].counts.supplied_checks, 1);
  assert.equal(report[2].status, "HOLD");
  assert.ok(report[2].recheck_codes.includes("ACCEPTANCE_NOT_MET"));
  assert.ok(report.every((entry) =>
    entry.independently_verified === false && entry.completion_authorized === false));
  assert.doesNotMatch(JSON.stringify(report) + stdout, /node --version|contract_id|conversation_id/);
});

test("observer distinguishes missing worker exit from a confirmed failed command", async (t) => {
  const base = toolEvents("exec_command", 55);
  const failed = toolEvents("exec_command", 56, { exit_code: 7 });
  const scenarios = [
    {
      label: "missing-exit",
      records: [base[0], { ...base[2], status: "error" }],
      issue: "HOST_AUDIT_MISSING_OR_MISMATCH",
    },
    {
      label: "nonzero-exit",
      records: [failed[0], failed[1], { ...failed[2], status: "error" }],
      issue: "VERIFICATION_FAILED",
    },
  ];
  const contract = (await createWorkContract({
    task: "Distinguish failed commands from missing Codexify process records",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Node check succeeded"], verification_commands: ["node --version"],
  })).contract;
  for (const scenario of scenarios) {
    const dir = await mkdtemp(join(tmpdir(), "godprompt-" + scenario.label + "-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const audit = join(dir, "audit.jsonl");
    const contractFile = join(dir, "contract.json");
    const reportFile = join(dir, "reviews.jsonl");
    await writeFile(contractFile, JSON.stringify(contract));
    await writeFile(audit, scenario.records.map(JSON.stringify).join("\n") + "\n");

    const child = spawn(process.execPath,
      ["scripts/codexify-audit-checkpoint-observer.mjs"], {
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
        env: {
          ...process.env,
          GODPROMPT_CODEXIFY_AUDIT_FILE: audit,
          GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: conversation,
          GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: project,
          GODPROMPT_CODEXIFY_CONTRACT_FILE: contractFile,
          GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE: reportFile,
        },
      });
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let output = "", errors = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    const [code] = await once(child, "exit");
    assert.equal(code, 0, scenario.label + ": " + errors);
    const summary = JSON.parse(output.trim());
    assert.equal(summary.observed_checkpoints, 1, scenario.label);
    const reports = (await readFile(reportFile, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(reports.length, 1, scenario.label);
    assert.equal(reports[0].stage, "verification");
    assert.equal(reports[0].status, "RECHECK");
    assert.ok(reports[0].recheck_codes.includes(scenario.issue), scenario.label);
    if (scenario.label === "nonzero-exit") {
      assert.ok(!reports[0].recheck_codes.includes("HOST_AUDIT_MISSING_OR_MISMATCH"));
    }
    assert.equal(reports[0].completion_authorized, false);
  }
});

test("invalid explicit observer duration must not silently enable an endless watch", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "godprompt-invalid-watch-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const audit = join(dir, "audit.jsonl");
  const contractFile = join(dir, "contract.json");
  const reportFile = join(dir, "reviews.jsonl");
  const contract = (await createWorkContract({
    task: "Validate that bounded observer mode has an actual deadline",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Watch ends"], verification_commands: ["node --version"],
  })).contract;
  await writeFile(contractFile, JSON.stringify(contract));
  await writeFile(audit, "");
  const invalidCases = [
    ["0", ["--watch", "--duration-ms", "0"]],
    ["nonsense", ["--watch", "--duration-ms", "nonsense"]],
    ["-1", ["--watch", "--duration-ms", "-1"]],
    ["misspelled flag", ["--watch", "--duraton-ms", "5000"]],
  ];
  for (const [invalid, flags] of invalidCases) {
    const result = spawnSync(process.execPath, [
      "scripts/codexify-audit-checkpoint-observer.mjs",
      ...flags,
    ], {
      // Node startup can be delayed by the full parallel test suite and a
      // concurrent Codexify build; allow enough time to detect a real hang.
      timeout: 15000, encoding: "utf8", windowsHide: true,
      env: {
        ...process.env,
        GODPROMPT_CODEXIFY_AUDIT_FILE: audit,
        GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: conversation,
        GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: project,
        GODPROMPT_CODEXIFY_CONTRACT_FILE: contractFile,
        GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE: reportFile,
      },
    });
    assert.equal(result.status, 2, "invalid duration " + invalid + " must exit safely");
    assert.match(result.stderr, /duration|argument/i);
  }
});

test("watcher preserves new checks after truncation, rotation, log absence, or growing rewrite", async (t) => {
  const contract = (await createWorkContract({
    task: "Follow one scoped verification after host audit truncation or rotation",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Node command was checked"], verification_commands: ["node --version"],
  })).contract;
  for (const mode of ["truncate", "rotate", "rotate-gap", "overwrite-grow"]) {
    const dir = await mkdtemp(join(tmpdir(), "godprompt-rotated-audit-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const audit = join(dir, "audit.jsonl");
    const contractFile = join(dir, "contract.json");
    const reportFile = join(dir, "reviews.jsonl");
    const readyFile = join(dir, "watcher.ready");
    await writeFile(contractFile, JSON.stringify(contract));
    // A shrink, replacement inode, or same-inode rewrite growing beyond the
    // old cursor must all retain the first new event, not silently skip it.
    await writeFile(audit, JSON.stringify({
      schema_version: 2, event: "audit_started", padding: "x".repeat(
        mode === "truncate" ? 5000 : 8),
    }) + "\n");
    const child = spawn(process.execPath, [
      "scripts/codexify-audit-checkpoint-observer.mjs",
      "--watch", "--duration-ms", "4700",
    ], {
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
      env: {
        ...process.env,
        GODPROMPT_CODEXIFY_AUDIT_FILE: audit,
        GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: conversation,
        GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: project,
        GODPROMPT_CODEXIFY_CONTRACT_FILE: contractFile,
        GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE: reportFile,
        GODPROMPT_CODEXIFY_OBSERVER_READY_FILE: readyFile,
      },
    });
    const exitPromise = once(child, "exit");
    t.after(() => { if (child.exitCode === null) child.kill(); });
    let output = "", errors = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { await stat(readyFile); ready = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    assert.equal(ready, true, mode + ": watcher did not start");
    const replacement = toolEvents("exec_command", 105).map(JSON.stringify).join("\n") + "\n";
    if (mode.startsWith("rotate")) {
      await rename(audit, join(dir, "audit-previous.jsonl"));
      if (mode === "rotate-gap") {
        // The new audit path may not exist during an actual rotation.
        // Give the poll loop time to observe that temporary gap.
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
    }
    await writeFile(audit, replacement);
    const [code] = await exitPromise;
    assert.equal(code, 0, mode + ": " + errors);
    const summary = JSON.parse(output.trim());
    assert.equal(summary.observed_checkpoints, 1,
      mode + ": rotated audit must not discard a new command");
    const reviews = (await readFile(reportFile, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].stage, "verification");
    assert.equal(reviews[0].counts.supplied_checks, 1);
    assert.equal(reviews[0].completion_authorized, false);
  }
});

test("observer preserves UTF-8 JSONL split across its bounded read window", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "godprompt-utf8-audit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const audit = join(dir, "audit.jsonl");
  const contractFile = join(dir, "contract.json");
  const reportFile = join(dir, "reviews.jsonl");
  const readyFile = join(dir, "watcher.ready");
  const unicode = "\u2603";
  const command = `node -e "console.log('${unicode}')"`;
  const contract = (await createWorkContract({
    task: "Verify a UTF-8 command against an observed host audit",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Unicode command checked"], verification_commands: [command],
  })).contract;
  await writeFile(contractFile, JSON.stringify(contract));
  await writeFile(audit, "");
  const child = spawn(process.execPath, [
    "scripts/codexify-audit-checkpoint-observer.mjs",
    "--watch", "--duration-ms", "3500",
  ], {
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    env: {
      ...process.env,
      GODPROMPT_CODEXIFY_AUDIT_FILE: audit,
      GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: conversation,
      GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: project,
      GODPROMPT_CODEXIFY_CONTRACT_FILE: contractFile,
      GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE: reportFile,
      GODPROMPT_CODEXIFY_OBSERVER_READY_FILE: readyFile,
    },
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const exitPromise = once(child, "exit");
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { await stat(readyFile); ready = true; break; }
    catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.equal(ready, true);
  const events = toolEvents("exec_command", 187);
  events[0].command_preview = command;
  const start = JSON.stringify(events[0]) + "\n";
  // Place the first byte of the multibyte character at offset MAX_READ-1.
  // The second read must finish decoding it before JSON parsing or matching.
  let remaining = 512 * 1024 - 1 - Buffer.byteLength(start.slice(0, start.indexOf(unicode)));
  assert.ok(remaining > 0);
  let padding = "";
  while (remaining > 0) {
    const size = Math.min(remaining - 1, 60 * 1024);
    padding += "x".repeat(size) + "\n";
    remaining -= size + 1;
  }
  const payload = padding + events.map(JSON.stringify).join("\n") + "\n";
  assert.equal(Buffer.from(payload).indexOf(Buffer.from(unicode)), 512 * 1024 - 1);
  await appendFile(audit, payload);
  const [code] = await exitPromise;
  assert.equal(code, 0, stderr);
  const summary = JSON.parse(stdout.trim());
  assert.equal(summary.observed_checkpoints, 1);
  const report = JSON.parse((await readFile(reportFile, "utf8")).trim());
  assert.equal(report.stage, "verification");
  assert.equal(report.counts.supplied_checks, 1);
  assert.equal(report.completion_authorized, false);
});
