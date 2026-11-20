import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkContract } from "../dist/work-contract.js";
import { codexifyEvidence } from "../dist/codexify-evidence.js";
import { correlateCodexifyAudit, correlateCodexifyAuditBatch } from "../dist/codexify-host-audit.js";
import { evaluateCheckpoint } from "../dist/codexify-checkpoint.js";

const REF = Object.freeze({
  run_id: "a".repeat(32), call_id: 49, transport_session_id: 19,
  conversation_id: "b".repeat(24), project_id: "c".repeat(24),
});
const FIXED = {
  tool: "exec_command", resolved_tool: "exec_command",
  run_id: REF.run_id, call_id: REF.call_id,
};
const now = () => new Date().toISOString();
function events() {
  return [
    { ...FIXED, schema_version: 2, event: "tool_start", timestamp: now(),
      transport_session_id: REF.transport_session_id,
      conversation_id: REF.conversation_id, project_id: REF.project_id,
      command_preview: "node --version" },
    { schema_version: 2, event: "tool_worker_exit", timestamp: now(),
      run_id: REF.run_id, call_id: REF.call_id,
      worker_kind: "exec", success: true, exit_code: 0, wait_error: null },
    { ...FIXED, schema_version: 2, event: "tool_finish", timestamp: now(),
      transport_session_id: REF.transport_session_id,
      conversation_id: REF.conversation_id, project_id: REF.project_id,
      status: "ok" },
  ];
}
async function fixture(t, source = events()) {
  const dir = await mkdtemp(join(tmpdir(), "godprompt-audit-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, "audit.jsonl");
  await writeFile(file, source.map((item) => JSON.stringify(item)).join("\n") + "\n");
  return file;
}
const request = (file, changes = {}) => ({
  path: file, ref: REF, expected_command: "node --version",
  conversation_id: REF.conversation_id, project_id: REF.project_id,
  ...changes,
});

test("correlates a real host-shaped start, process exit and tool finish without copying output", async (t) => {
  const file = await fixture(t);
  const matched = await correlateCodexifyAudit(request(file));
  assert.deepEqual(matched, { exit_code: 0, source: "host_audit_correlated" });
  assert.doesNotMatch(JSON.stringify(matched), /node --version|command_preview/i);
});

test("does not treat an embedded repeated call_id as another host event", async (t) => {
  const source = events();
  source[0].arguments_summary = { call_id: REF.call_id };
  source[2].output_summary = { nested: { call_id: REF.call_id } };
  const file = await fixture(t, source);
  assert.deepEqual(await correlateCodexifyAudit(request(file)), {
    exit_code: 0, source: "host_audit_correlated",
  });
});

test("batch audit correlation validates each command independently from one host log", async (t) => {
  const source = [49, 50, 51].flatMap((call_id) => events().map((item) => ({
    ...item, call_id,
    ...(item.event === "tool_start"
      ? { command_preview: "node --version -" + call_id } : {}),
  })));
  const file = await fixture(t, source);
  const checks = [
    ...[49, 50, 51].map((call_id) => ({
      ref: { ...REF, call_id },
      expected_command: "node --version -" + call_id,
    })),
    { ref: { ...REF, call_id: 51 }, expected_command: "npm publish" },
    { ref: { ...REF, call_id: 999 }, expected_command: "node --version -999" },
  ];
  const results = await correlateCodexifyAuditBatch({
    path: file, checks,
    conversation_id: REF.conversation_id, project_id: REF.project_id,
  });
  assert.deepEqual(results.map((entry) => entry?.exit_code ?? null),
    [0, 0, 0, null, null]);
});

test("rejects an out-of-order or reversed host execution lifecycle", async (t) => {
  const [start, exit, finish] = events();
  const wrongFileOrder = await fixture(t, [finish, exit, start]);
  assert.equal(await correlateCodexifyAudit(request(wrongFileOrder)), null);
  const wrongTimestamps = await fixture(t, [
    { ...start, timestamp: new Date(Date.now() - 1000).toISOString() },
    { ...exit, timestamp: new Date(Date.now() - 3000).toISOString() },
    { ...finish, timestamp: new Date(Date.now() - 2000).toISOString() },
  ]);
  assert.equal(await correlateCodexifyAudit(request(wrongTimestamps)), null);
});

test("host correlation refuses missing, wrong-session, cross-chat and replayed evidence", async (t) => {
  const file = await fixture(t);
  for (const changes of [
    { ref: { ...REF, call_id: 50 } },
    { ref: { ...REF, transport_session_id: 20 } },
    { ref: { ...REF, conversation_id: "d".repeat(24) } },
    { ref: { ...REF, project_id: "d".repeat(24) } },
    { conversation_id: "d".repeat(24) },
    { project_id: "d".repeat(24) },
    { expected_command: "npm publish" },
    { not_before: "2999-01-01T00:00:00Z" },
  ]) assert.equal(await correlateCodexifyAudit(request(file, changes)), null);
  const duplicates = [...events(), ...events()];
  const dupe = await fixture(t, duplicates);
  assert.equal(await correlateCodexifyAudit(request(dupe)), null);
});

test("cannot promote fabricated or incomplete host execution to successful verification", async (t) => {
  const start = events();
  const versions = [
    start.filter((x) => x.event !== "tool_worker_exit"),
    start.filter((x) => x.event !== "tool_finish"),
    start.map((x) => x.event === "tool_worker_exit" ? { ...x, success: false, exit_code: 0 } : x),
    start.map((x) => x.event === "tool_finish" ? { ...x, status: "error" } : x),
    start.map((x) => x.event === "tool_worker_exit" ? { ...x, exit_code: null } : x),
    start.map((x) => x.event === "tool_start" ? { ...x, command_preview: "[REDACTED]" } : x),
    start.map((x) => x.event === "tool_start" ? { ...x, timestamp: "2020-01-01T00:00:00Z" } : x),
  ];
  for (const source of versions) {
    const file = await fixture(t, source);
    assert.equal(await correlateCodexifyAudit(request(file)), null);
  }
});

test("genuine nonzero host exit is preserved as failed verification, not missing provenance", async (t) => {
  const source = events();
  source[1].success = false;
  source[1].exit_code = 7;
  source[2].status = "error";
  const file = await fixture(t, source);
  assert.deepEqual(await correlateCodexifyAudit(request(file)), {
    exit_code: 7, source: "host_audit_correlated",
  });
  const contract = (await createWorkContract({
    task: "Report a failed host command instead of inventing successful evidence",
    task_type: "ANALYZE", risk_level: "low",
    allowed_paths: ["src/"], forbidden_actions: ["deploy"],
    success_criteria: ["Command succeeded"], verification_commands: ["node --version"],
  })).contract;
  const previous = {
    GODPROMPT_CODEXIFY_AUDIT_FILE: process.env.GODPROMPT_CODEXIFY_AUDIT_FILE,
    GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID: process.env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID,
    GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID: process.env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID,
  };
  try {
    process.env.GODPROMPT_CODEXIFY_AUDIT_FILE = file;
    process.env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID = REF.conversation_id;
    process.env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID = REF.project_id;
    const codexify_export = {
      changed_files: [],
      checks: [{
        id: "VC-01", command: "node --version", host_audit_ref: REF,
        tool: "mcp__God_v5__exec_command",
        response: { isError: true, upstream_result: { exit_code: 7 } },
      }],
    };
    const bundle = await codexifyEvidence({ contract, exportData: codexify_export });
    assert.equal(bundle.review_input.checks[0].exit_code, 7);
    assert.equal(bundle.review_input.checks[0].source, "tool_output");
    const checkpoint = await evaluateCheckpoint({
      stage: "verification", contract, codexify_export,
    });
    assert.equal(checkpoint.status, "RECHECK");
    assert.ok(checkpoint.recheck.some((hint) => hint.code === "VERIFICATION_FAILED"));
    assert.ok(!checkpoint.recheck.some((hint) =>
      hint.code === "HOST_AUDIT_MISSING_OR_MISMATCH"));
    assert.equal(checkpoint.completion_authorized, false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("host audit rejects contradictory exit metadata even with matching run and command", async (t) => {
  const cases = [
    { success: false, exit_code: 0, finish: "error" },
    { success: true, exit_code: 7, finish: "error" },
    { success: false, exit_code: 7, finish: "ok" },
  ];
  for (const variant of cases) {
    const source = events();
    source[1].success = variant.success;
    source[1].exit_code = variant.exit_code;
    source[2].status = variant.finish;
    const file = await fixture(t, source);
    assert.equal(await correlateCodexifyAudit(request(file)), null);
  }
});

test("host-linked audit receipt fails closed when no trusted local scope or file is configured", async (t) => {
  const file = await fixture(t);
  const contract = (await createWorkContract({
    task: "Check local host audit provenance for a scoped verification",
    task_type: "ANALYZE", risk_level: "low", allowed_paths: ["src/"],
    forbidden_actions: ["deploy"], success_criteria: ["Node version seen"],
    verification_commands: ["node --version"],
  })).contract;
  const raw = { changed_files: [], checks: [{
    id: "VC-01", command: "node --version", host_audit_ref: REF,
    response: { upstream_result: { exit_code: 0, output: "A FAKE SUCCESS" } },
  }] };
  const old = {
    path: process.env.GODPROMPT_CODEXIFY_AUDIT_FILE,
    conv: process.env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID,
    project: process.env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID,
  };
  try {
    delete process.env.GODPROMPT_CODEXIFY_AUDIT_FILE;
    delete process.env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID;
    delete process.env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID;
    const missing = await codexifyEvidence({ contract, exportData: raw });
    assert.equal(missing.review_input.checks[0].exit_code, null);
    assert.equal(missing.review_input.checks[0].source, "self_report");
    const held = await evaluateCheckpoint({
      stage: "handoff", contract, codexify_export: raw,
      acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
    });
    assert.equal(held.status, "HOLD");
    assert.ok(held.recheck.some((item) =>
      item.code === "HOST_AUDIT_MISSING_OR_MISMATCH"));
    process.env.GODPROMPT_CODEXIFY_AUDIT_FILE = file;
    process.env.GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID = REF.conversation_id;
    process.env.GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID = REF.project_id;
    const observed = await codexifyEvidence({ contract, exportData: raw });
    assert.equal(observed.review_input.checks[0].exit_code, 0);
    assert.equal(observed.review_input.checks[0].source, "tool_output");
    assert.doesNotMatch(JSON.stringify(observed), /A FAKE SUCCESS/);
    for (const contradiction of [
      { isError: true },
      { tool: "mcp__God_v5__apply_patch" },
      { response: { isError: true, upstream_result: { exit_code: 0 } } },
    ]) {
      const conflicted = await codexifyEvidence({
        contract, exportData: {
          ...raw, checks: [{ ...raw.checks[0], ...contradiction }],
        },
      });
      assert.equal(conflicted.review_input.checks[0].exit_code, null);
      assert.equal(conflicted.review_input.checks[0].source, "self_report");
    }
    const checkpoint = await evaluateCheckpoint({
      stage: "handoff", contract, codexify_export: raw,
      acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
    });
    assert.equal(checkpoint.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
    assert.equal(checkpoint.independently_verified, false);
    assert.equal(checkpoint.completion_authorized, false);
  } finally {
    const vars = [
      ["GODPROMPT_CODEXIFY_AUDIT_FILE", old.path],
      ["GODPROMPT_CODEXIFY_AUDIT_CONVERSATION_ID", old.conv],
      ["GODPROMPT_CODEXIFY_AUDIT_PROJECT_ID", old.project],
    ];
    for (const [key, value] of vars) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
