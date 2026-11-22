#!/usr/bin/env node
/**
 * Fail-closed review of Codex CLI JSONL. A completed agent turn is not proof
 * that the agent could invoke tools or modify source.
 * This is a session preflight only; independent grading is always required.
 */
import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_RUNS = resolve(HERE, "../real-runs");
const TOOL_TYPES = new Set(["command_execution", "file_change", "mcp_tool_call", "dynamic_tool_call"]);
const POLICY_DENIAL = /blocked by policy|read.only sandbox|rejected by user approval settings|sandbox(?:ing)? (?:is )?unavailable/i;
const hash = value => createHash("sha256").update(value).digest("hex");

function acceptedTool(item) {
  if (!item || !TOOL_TYPES.has(item.type) || item.status === "failed") return false;
  if (item.type === "command_execution") {
    return item.exit_code === 0 && (item.status === undefined || item.status === "completed");
  }
  if (item.type === "file_change") {
    return (item.status === undefined || item.status === "completed") &&
      Array.isArray(item.changes) && item.changes.length > 0;
  }
  return item.status === "completed" && !item.error && item.result?.isError !== true;
}

export function reviewCodexSession(stdout, stderr = "") {
  if (typeof stdout !== "string" || typeof stderr !== "string" ||
      Buffer.byteLength(stdout) > 16 * 1024 * 1024 ||
      Buffer.byteLength(stderr) > 4 * 1024 * 1024) {
    throw new Error("Invalid or oversized Codex session input");
  }
  const lines = stdout.split(/\r?\n/u).filter(line => line.trim().length > 0);
  if (lines.length === 0 || lines.length > 20000) throw new Error("Empty or oversized JSONL session");
  let threadStarted = false, turnStarted = 0, turnCompleted = 0, turnFailed = 0;
  let successfulTools = 0, failedTools = 0, observedToolEvents = 0;
  let toolPolicyDenied = false;
  const usage = { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
  for (const [i, line] of lines.entries()) {
    let event;
    try { event = JSON.parse(line); }
    catch { throw new Error("Malformed JSONL event at line " + (i + 1)); }
    if (!event || typeof event !== "object" || typeof event.type !== "string") {
      throw new Error("Invalid Codex event at line " + (i + 1));
    }
    if (event.type === "thread.started") threadStarted = true;
    if (event.type === "turn.started") turnStarted++;
    if (event.type === "turn.failed") turnFailed++;
    if (event.type === "turn.completed") {
      turnCompleted++;
      for (const key of Object.keys(usage)) {
        const value = event.usage?.[key];
        if (Number.isSafeInteger(value) && value >= 0) usage[key] += value;
      }
    }
    if (event.type === "item.failed" && TOOL_TYPES.has(event.item?.type)) {
      observedToolEvents++;
      failedTools++;
    }
    if (event.type === "item.completed" && TOOL_TYPES.has(event.item?.type)) {
      observedToolEvents++;
      if (acceptedTool(event.item)) successfulTools++;
      else failedTools++;
    }
    if ((event.type === "item.failed" || event.type === "item.completed") &&
        TOOL_TYPES.has(event.item?.type)) {
      const errorText = typeof event.item.error === "string" ? event.item.error : "";
      const toolOutput = typeof event.item.aggregated_output === "string"
        ? event.item.aggregated_output : "";
      if (POLICY_DENIAL.test(errorText) || POLICY_DENIAL.test(toolOutput)) {
        toolPolicyDenied = true;
      }
    }
  }
  // Some Codex failures are written exclusively to stderr even when process
  // exit status is 0 and the JSONL contains turn.completed.
  const policyDenied = toolPolicyDenied || POLICY_DENIAL.test(stderr);
  let status = "TOOL_USE_OBSERVED_ONLY";
  if (!threadStarted || !turnStarted || !turnCompleted || turnFailed ||
      turnCompleted > turnStarted) status = "INCOMPLETE_OR_FAILED_TURN";
  else if (policyDenied) status = "POLICY_DENIED";
  else if (successfulTools === 0) status = "NO_SUCCESSFUL_TOOLS";
  return {
    schema: "godprompt.codex-session-evidence.v1",
    status,
    tool_use_preflight_passed: status === "TOOL_USE_OBSERVED_ONLY",
    independently_graded: false,
    effective_model_and_effort_verified: false,
    causal_productivity_proven: false,
    observed: { thread_started: threadStarted, started_turns: turnStarted,
      completed_turns: turnCompleted, failed_turns: turnFailed,
      tool_events: observedToolEvents, successful_tools: successfulTools,
      failed_tools: failedTools, policy_denial_detected: policyDenied },
    reported_usage: usage,
    evidence_sha256: { stdout: hash(stdout), stderr: hash(stderr) },
    note: "A successful session preflight does not prove code correctness, matched execution, or productivity. Require independent source-diff, grader, model/effort, wall-time and cost receipts.",
  };
}

export function decodeReceiptBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) throw new Error("Receipt must contain raw bytes");
  // Windows PowerShell 5.1 Tee-Object emits UTF-16LE even for JSONL.
  // Decode it explicitly rather than silently treating an agent run as corrupt.
  const utf16le = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  if (utf16le && bytes.length % 2 !== 0) throw new Error("Truncated UTF-16LE receipt");
  const encoding = utf16le ? "utf-16le" : "utf-8";
  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(
      utf16le ? bytes.subarray(2) : bytes,
    ).replace(/^\uFEFF/u, "");
  } catch {
    throw new Error("Receipt contains invalid text encoding");
  }
  return { text, encoding };
}

async function safeReceipt(path, maxBytes) {
  if (typeof path !== "string" || !path) throw new Error("Receipt path required");
  const root = await realpath(REAL_RUNS);
  const target = resolve(path);
  const physical = await realpath(target);
  const rel = relative(root, physical);
  if (!rel || rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)) {
    throw new Error("Receipt must be an ordinary file inside ignored real-runs");
  }
  const info = await lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size > maxBytes) {
    throw new Error("Receipt is linked, not a regular file, or oversized");
  }
  const bytes = await readFile(target);
  return { ...decodeReceiptBytes(bytes), raw_sha256: hash(bytes) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 1 && !(args.length === 3 && args[1] === "--stderr")) {
    console.error("Usage: node session-evidence.mjs REAL_RUNS/agent.jsonl [--stderr REAL_RUNS/agent.stderr.txt]");
    process.exitCode = 2;
  } else {
    try {
      const out = await safeReceipt(args[0], 16 * 1024 * 1024);
      const err = args[2] ? await safeReceipt(args[2], 4 * 1024 * 1024) : null;
      const report = reviewCodexSession(out.text, err?.text ?? "");
      report.raw_receipt_sha256 = { stdout: out.raw_sha256, stderr: err?.raw_sha256 ?? null };
      report.receipt_encodings = { stdout: out.encoding, stderr: err?.encoding ?? null };
      console.log(JSON.stringify(report, null, 2));
      if (!report.tool_use_preflight_passed) process.exitCode = 1;
    } catch (error) {
      console.error("Codex session receipt refused: " + String(error.message).slice(0, 180));
      process.exitCode = 2;
    }
  }
}
