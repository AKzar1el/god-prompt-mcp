#!/usr/bin/env node
/**
 * LOCAL OPT-IN PILOT. Watches Codexify's privacy-preserving audit lifecycle
 * and emits checkpoint summaries without sending logs to a remote service.
 *
 * It does not interrupt Codexify, authenticate the log, or grant authority.
 * It never emits command previews, tool output, project paths or contract text.
 */
import { appendFile, open, readFile, writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { evaluateCheckpoint, cloudSafeCheckpointSummary } from "../dist/codexify-checkpoint.js";

const MAX_READ = 512 * 1024;
const MAX_LINE = 64 * 1024;
const POLL_MS = 400;
const CURSOR_ANCHOR_BYTES = 128;

async function cursorAnchor(handle, cursor) {
  const length = Math.min(cursor, CURSOR_ANCHOR_BYTES);
  if (!length) return Buffer.alloc(0);
  const bytes = Buffer.allocUnsafe(length);
  const { bytesRead } = await handle.read(bytes, 0, length, cursor - length);
  return bytesRead === length ? bytes : null;
}
const toolsByStage = new Map([
  ["update_plan", "plan"],
  ["rollout_update", "plan"],
  ["apply_patch", "implementation"],
  ["goal_finish", "handoff"],
  ["turn_completed", "handoff"],
]);

const env = process.env;
const auditFile = env.GODPROMPT_CODEXIFY_AUDIT_FILE;
const conversation = env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID;
const project = env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID;
const contractFile = env.GODPROMPT_CODEXIFY_CONTRACT_FILE;
const reportFile = env.GODPROMPT_CODEXIFY_CHECKPOINT_REPORT_FILE;
const flags = process.argv.slice(2);
const watch = flags.includes("--watch");
const pos = flags.indexOf("--duration-ms");
const validFlags = flags.filter((flag) => flag === "--watch").length <= 1 &&
  flags.filter((flag) => flag === "--duration-ms").length <= 1 &&
  flags.every((flag, index) => flag === "--watch" ||
    flag === "--duration-ms" || (pos >= 0 && index === pos + 1));
const validDuration = pos < 0 || /^[1-9]\d{0,5}$/.test(flags[pos + 1] ?? "");
const duration = pos >= 0 && validDuration
  ? Number(flags[pos + 1]) : watch ? 0 : 400;

if (!validFlags) {
  process.stderr.write("Invalid observer argument: use --watch and optional --duration-ms N.\n");
  process.exitCode = 2;
} else if (!validDuration) {
  process.stderr.write("Invalid --duration-ms: expected a positive integer in milliseconds.\n");
  process.exitCode = 2;
} else if (!auditFile || !contractFile || !reportFile || !conversation || !project ||
    ![auditFile, contractFile, reportFile].every(isAbsolute) ||
    !auditFile.endsWith(".jsonl") || !reportFile.endsWith(".jsonl")) {
  process.stderr.write("Opt-in audit scope and absolute local file paths are required.\n");
  process.exitCode = 2;
} else {
  const contract = JSON.parse(await readFile(contractFile, "utf8"));
  if (contract.schema !== "godprompt.work_contract.v1" ||
      !Array.isArray(contract.verification_commands)) {
    throw new Error("A v1 work contract is required");
  }
  const validContract = await evaluateCheckpoint({
    stage: "plan", contract, codexify_export: { changed_files: [], checks: [] },
  });
  if (validContract.recheck.some((item) => item.code === "CONTRACT_DRIFT")) {
    throw new Error("Contract fingerprint mismatch; refuse to observe work");
  }
  let started = Date.now();
  // Prevent historical audit records from satisfying this new observer run.
  if (watch) process.env.GODPROMPT_CODEXIFY_AUDIT_NOT_BEFORE =
    new Date(started).toISOString();
  const checks = new Map();
  const calls = new Map();
  const fired = new Set();
  let pending = "";
  let decoder = new StringDecoder("utf8");
  const initialHandle = await open(auditFile, "r");
  let originalStat, original, cursor, anchor;
  try {
    originalStat = await initialHandle.stat();
    original = originalStat.size;
    // Never replay historical events on watch startup, but retain a small
    // byte anchor to detect same-inode rewrites that grow past that cursor.
    cursor = watch ? original : Math.max(0, original - MAX_READ);
    anchor = await cursorAnchor(initialHandle, cursor);
    if (anchor === null) throw new Error("Audit file changed during observer startup");
  } finally {
    await initialHandle.close();
  }
  let fileIdentity = {
    dev: originalStat.dev, ino: originalStat.ino,
    birthtimeMs: originalStat.birthtimeMs,
  };
  // Never replay historical events when starting the watcher. The --once
  // mode scans the last bounded segment for a deterministic pilot replay.
  let first = !watch && cursor > 0;
  const readyFile = env.GODPROMPT_CODEXIFY_OBSERVER_READY_FILE;
  if (watch && readyFile) {
    if (!isAbsolute(readyFile)) throw new Error("Observer readiness file must be absolute");
    await writeFile(readyFile, "READY\n", { flag: "wx", mode: 0o600 });
  }
  started = Date.now();
  let submitted = 0;
  let reviewErrors = 0;
  let invalidRecords = 0;
  let holds = 0;
  let rechecks = 0;
  const recentStages = [];
  function capMemory() {
    while (calls.size > 4096) calls.delete(calls.keys().next().value);
    while (fired.size > 8192) fired.delete(fired.values().next().value);
  }

  async function emit(stage, trigger) {
    const review = await evaluateCheckpoint({
      stage, contract,
      codexify_export: { changed_files: [], checks: [...checks.values()] },
    });
    const summary = cloudSafeCheckpointSummary(review);
    const event = {
      timestamp: new Date().toISOString(),
      trigger, source: "opt_in_host_audit_observer",
      ...summary,
    };
    await appendFile(reportFile, JSON.stringify(event) + "\n", { mode: 0o600 });
    if (event.status === "HOLD") holds++;
    if (event.status === "RECHECK") rechecks++;
    recentStages.push(event.stage);
    if (recentStages.length > 32) recentStages.shift();
    submitted++;
  }

  async function processEvent(event) {
    if (!event || event.schema_version !== 2 ||
        typeof event.run_id !== "string" ||
        !Number.isSafeInteger(event.call_id)) return;
    const scoped = event.conversation_id === conversation &&
      event.project_id === project;
    // A shared host audit contains unrelated agents' events. Never allow
    // them to consume the bounded per-conversation call cache.
    if ((event.event === "tool_start" || event.event === "tool_finish") &&
        !scoped) return;
    // Only contracted command executions and milestone tools need tracking.
    // Other tools (including thousands of read-only discovery calls) must not
    // evict a long-running verification from the bounded cache.
    if (event.event === "tool_start" &&
        event.tool !== "exec_command" && !toolsByStage.has(event.tool)) return;
    const key = event.run_id + ":" + event.call_id;
    let call = calls.get(key);
    if (!call) {
      // Worker exits have no conversation/project scope; only accept them
      // after a matching scoped tool_start was already observed.
      if (event.event !== "tool_start") return;
      call = {};
      calls.set(key, call);
    }
    if (event.event === "tool_start") {
      call.start = event;
    }
    if (event.event === "tool_finish") {
      call.finish = event;
      const stage = toolsByStage.get(event.tool);
      if (stage && call.start?.tool === event.tool &&
          event.status === "ok" && !fired.has(key + ":stage")) {
        fired.add(key + ":stage");
        await emit(stage, event.tool);
      }
      if (event.tool !== "exec_command") {
        calls.delete(key); // Completed milestones need no retained payload.
        return;
      }
    }
    if (event.event === "tool_worker_exit" && event.worker_kind === "exec") {
      call.exit = event;
    }
    capMemory();
    const start = call.start, finish = call.finish, exit = call.exit;
    // A tool_finish without a worker-exit record can mean the worker died
    // before Codexify recorded its process status. Still review the scoped
    // contracted check: host correlation will fail closed with RECHECK.
    const finishedWithoutExit = event.event === "tool_finish" && !exit;
    if (!start || !finish || (!exit && !finishedWithoutExit) ||
        fired.has(key + ":verification") ||
        start.tool !== "exec_command" || finish.tool !== "exec_command" ||
        start.conversation_id !== conversation || start.project_id !== project ||
        finish.conversation_id !== conversation || finish.project_id !== project) return;
    const match = contract.verification_commands.find((check) =>
      check.command === start.command_preview);
    if (!match) { calls.delete(key); return; }
    fired.add(key + ":verification");
    checks.set(match.id, {
      id: match.id, command: match.command,
      host_audit_ref: {
        run_id: start.run_id, call_id: start.call_id,
        transport_session_id: start.transport_session_id,
        conversation_id: start.conversation_id, project_id: start.project_id,
      },
    });
    await emit("verification", "exec_command");
    calls.delete(key);
  }

  async function readNewEvents() {
    let handle;
    try {
      handle = await open(auditFile, "r");
    } catch (error) {
      // File rotation may briefly remove the audit path between closing the
      // old log and creating its replacement. Preserve the old cursor and
      // retry on the next poll instead of terminating the observer.
      if (error?.code === "ENOENT") return;
      throw error;
    }
    try {
      // Stat the *opened file*, not the pathname: a rotation between stat
      // and open must not pair the old inode's cursor with the new file.
      const info = await handle.stat();
      const size = info.size;
      let reset = size < cursor ||
        info.dev !== fileIdentity.dev || info.ino !== fileIdentity.ino ||
        info.birthtimeMs !== fileIdentity.birthtimeMs;
      if (!reset && anchor.length) {
        const observed = await cursorAnchor(handle, cursor);
        reset = observed === null || !observed.equals(anchor);
      }
      if (reset) {
        cursor = 0;
        pending = "";
        decoder = new StringDecoder("utf8");
        first = false;
        anchor = Buffer.alloc(0);
      }
      fileIdentity = { dev: info.dev, ino: info.ino, birthtimeMs: info.birthtimeMs };
      const amount = Math.min(size - cursor, MAX_READ);
      if (amount === 0) return;
      const bytes = Buffer.allocUnsafe(amount);
      const read = await handle.read(bytes, 0, amount, cursor);
      cursor += read.bytesRead;
      const nextAnchor = await cursorAnchor(handle, cursor);
      if (nextAnchor === null) {
        // The file changed during the read. Recheck from the beginning on
        // the next poll rather than accepting a discontinuous byte stream.
        cursor = 0;
        pending = "";
        decoder = new StringDecoder("utf8");
        first = false;
        anchor = Buffer.alloc(0);
        return;
      }
      anchor = nextAnchor;
      // Preserve multibyte code points split across MAX_READ boundaries.
      const text = pending + decoder.write(bytes.subarray(0, read.bytesRead));
      const lines = text.split(/\r?\n/);
      pending = lines.pop() ?? "";
      if (first) { lines.shift(); first = false; }
      if (pending.length > MAX_LINE) pending = "";
      for (const line of lines) {
        if (!line || line.length > MAX_LINE ||
            !line.includes('"event"')) continue;
        let event;
        try { event = JSON.parse(line); }
        catch { invalidRecords++; continue; }
        try { await processEvent(event); }
        catch {
          // Never fail open or leak a source error into local review output.
          reviewErrors++;
        }
      }
    } finally {
      await handle.close();
    }
  }

  do {
    await readNewEvents();
    if (!watch || (duration && Date.now() - started >= duration)) break;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  } while (true);
  // Only safe summaries leave the observer. No original audit or contract.
  process.stdout.write(JSON.stringify({
    mode: watch ? "watch" : "once", observed_checkpoints: submitted,
    stages: recentStages,
    holds, rechecks,
    review_errors: reviewErrors, invalid_records: invalidRecords,
  }) + "\n");
  if (reviewErrors) process.exitCode = 1;
}
