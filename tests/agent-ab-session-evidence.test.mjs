import assert from "node:assert/strict";
import test from "node:test";
import { decodeReceiptBytes, reviewCodexSession } from "../benchmarks/agent-ab/real-repos/session-evidence.mjs";

const jsonl = (...events) => events.map(event => JSON.stringify(event)).join("\n") + "\n";
const started = { type: "thread.started", thread_id: "test-only" };
const turn = { type: "turn.started" };
const completed = { type: "turn.completed", usage: {
  input_tokens: 131034, cached_input_tokens: 127872, output_tokens: 575,
} };
const finalAnswer = { type: "item.completed", item: {
  id: "answer", type: "agent_message", text: "I repaired everything; all tests pass.",
} };

test("exit-zero completed Codex answer without successful tools never counts", () => {
  const receipt = reviewCodexSession(jsonl(started, turn, finalAnswer, completed));
  assert.equal(receipt.status, "NO_SUCCESSFUL_TOOLS");
  assert.equal(receipt.tool_use_preflight_passed, false);
  assert.equal(receipt.observed.successful_tools, 0);
  assert.equal(receipt.reported_usage.input_tokens, 131034);
  assert.equal(receipt.causal_productivity_proven, false);
});

test("real observed Windows policy denial overrides apparent completed turn", () => {
  const stderr = 'exec_command failed: rejected: blocked by policy\n' +
    "apply_patch rejected: writing is blocked by read-only sandbox; rejected by user approval settings";
  const receipt = reviewCodexSession(jsonl(started, turn, finalAnswer, completed), stderr);
  assert.equal(receipt.status, "POLICY_DENIED");
  assert.equal(receipt.observed.policy_denial_detected, true);
  assert.equal(receipt.tool_use_preflight_passed, false);
  assert.match(receipt.evidence_sha256.stderr, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(receipt), /rejected by user approval settings/);
});

test("successful bounded shell execution is observed but not treated as product proof", () => {
  const command = { type: "item.completed", item: { id: "tool",
    type: "command_execution", command: "node --test", status: "completed",
    exit_code: 0, aggregated_output: "3 tests passed" } };
  const receipt = reviewCodexSession(jsonl(started, turn, command, finalAnswer, completed));
  assert.equal(receipt.status, "TOOL_USE_OBSERVED_ONLY");
  assert.equal(receipt.tool_use_preflight_passed, true);
  assert.equal(receipt.observed.successful_tools, 1);
  assert.equal(receipt.independently_graded, false);
  assert.equal(receipt.effective_model_and_effort_verified, false);
  assert.equal(receipt.causal_productivity_proven, false);
});

test("nonzero shell exit and failed tool result do not qualify as successful tool use", () => {
  const failed = { type: "item.completed", item: { type: "command_execution",
    command: "node --test", status: "completed", exit_code: 1 } };
  const receipt = reviewCodexSession(jsonl(started, turn, failed, completed));
  assert.equal(receipt.status, "NO_SUCCESSFUL_TOOLS");
  assert.equal(receipt.observed.failed_tools, 1);
});

test("actual completed patch event can satisfy tool-use preflight but not hidden grading", () => {
  const patched = { type: "item.completed", item: { id: "patch", type: "file_change",
    status: "completed", changes: [{ path: "src/module.js", kind: "update" }] } };
  const receipt = reviewCodexSession(jsonl(started, turn, patched, completed));
  assert.equal(receipt.status, "TOOL_USE_OBSERVED_ONLY");
  assert.equal(receipt.observed.successful_tools, 1);
  assert.equal(receipt.independently_graded, false);
});

test("failed MCP calls, missing tool changes and malformed output fail closed", () => {
  const mcpError = { type: "item.completed", item: { type: "mcp_tool_call",
    status: "failed", error: "unavailable" } };
  const emptyChange = { type: "item.completed", item: { type: "file_change",
    status: "completed", changes: [] } };
  assert.equal(reviewCodexSession(jsonl(started, turn, mcpError, emptyChange, completed))
    .status, "NO_SUCCESSFUL_TOOLS");
  assert.equal(reviewCodexSession(jsonl(started, turn, completed), "sandbox unavailable")
    .status, "POLICY_DENIED");
  assert.equal(reviewCodexSession(jsonl(started, turn)).status, "INCOMPLETE_OR_FAILED_TURN");
  assert.equal(reviewCodexSession(jsonl(started, turn, { type: "turn.failed" }, completed))
    .status, "INCOMPLETE_OR_FAILED_TURN");
  assert.throws(() => reviewCodexSession('{"type":\n'), /Malformed JSONL/);
  assert.throws(() => reviewCodexSession(""), /Empty or oversized/);
});

test("more than one valid turn combines usage without inventing a billing invoice", () => {
  const cmd = { type: "item.completed", item: { type: "command_execution",
    status: "completed", exit_code: 0 } };
  const receipt = reviewCodexSession(jsonl(started, turn, cmd, completed, turn, cmd, completed));
  assert.equal(receipt.observed.completed_turns, 2);
  assert.equal(receipt.observed.successful_tools, 2);
  assert.equal(receipt.reported_usage.input_tokens, 262068);
  assert.equal(receipt.reported_usage.output_tokens, 1150);
  assert.equal(receipt.causal_productivity_proven, false);
});

test("policy rejection embedded in a tool event overrides an unrelated successful tool", () => {
  const command = { type: "item.completed", item: { type: "command_execution",
    status: "completed", exit_code: 0, aggregated_output: "ok" } };
  const refused = { type: "item.failed", item: { type: "command_execution",
    error: "exec_command rejected: blocked by policy" } };
  const receipt = reviewCodexSession(jsonl(started, turn, command, refused, completed));
  assert.equal(receipt.observed.successful_tools, 1);
  assert.equal(receipt.status, "POLICY_DENIED");
  assert.equal(receipt.tool_use_preflight_passed, false);
});

test("Windows PowerShell 5.1 UTF-16LE JSONL and UTF-8 BOM decode explicitly", () => {
  const body = jsonl(started, turn, finalAnswer, completed);
  const windows = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(body, "utf16le")]);
  const modern = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(body)]);
  const decodedWindows = decodeReceiptBytes(windows);
  assert.equal(decodedWindows.encoding, "utf-16le");
  assert.equal(decodedWindows.text, body);
  assert.equal(reviewCodexSession(decodedWindows.text).status, "NO_SUCCESSFUL_TOOLS");
  assert.equal(decodeReceiptBytes(modern).text, body);
  assert.throws(() => decodeReceiptBytes(windows.subarray(0, -1)), /Truncated/);
  assert.throws(() => decodeReceiptBytes(Buffer.from([0xff, 0xfe, 0x00, 0xd8])), /invalid text encoding/);
});
