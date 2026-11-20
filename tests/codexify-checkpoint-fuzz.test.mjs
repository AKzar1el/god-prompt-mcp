import test from "node:test";
import assert from "node:assert/strict";
import { createWorkContract } from "../dist/work-contract.js";
import {
  evaluateCheckpoint, cloudSafeCheckpointSummary,
} from "../experiments/codexify-checkpoints/checkpoint.mjs";

test("192 deterministic adversarial checkpoint combinations stay fail-closed and privacy-safe", async () => {
  const contracts = {};
  for (const risk of ["medium", "high"]) {
    contracts[risk] = (await createWorkContract({
      task: "Verify deterministic stress fixtures without changing real code",
      task_type: "BUILD",
      risk_level: risk,
      allowed_paths: ["src/", "tests/"],
      forbidden_actions: ["deploy", "merge", "publish"],
      success_criteria: ["Synthetic check evidence matches the contracted command"],
      verification_commands: ["node --version"],
    })).contract;
  }
  const stages = ["plan", "implementation", "verification", "handoff"];
  for (let i = 0; i < 192; i++) {
    const risk = i % 9 === 0 ? "high" : "medium";
    const stage = stages[i % stages.length];
    const outOfScope = i % 4 === 1;
    const forbidden = i % 5 === 0;
    const flaggedError = i % 7 === 0;
    const drift = i % 11 === 0;
    const withReceipt = i % 3 !== 0 || flaggedError;
    const args = {
      stage,
      contract: structuredClone(contracts[risk]),
      codexify_export: {
        changed_files: [outOfScope ? "private/PRIVATE_CANARY_" + i + ".txt" : "src/parser.mjs"],
        operations_performed: forbidden ? ["deployed PRIVATE_CANARY_" + i] : ["edited source"],
        checks: withReceipt ? [{
          id: "VC-01", command: "node --version",
          tool: "mcp__God_v5__exec_command",
          response: {
            ...(flaggedError ? { isError: true } : {}),
            upstream_result: {
              exit_code: 0, output: "PRIVATE_CANARY_OUTPUT_" + i,
            },
          },
        }] : [],
      },
      acceptance: i % 2 === 0
        ? [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }]
        : [],
    };
    if (drift) args.contract.task = "PRIVATE_CANARY_DRIFT_" + i;
    const report = await evaluateCheckpoint(args);
    const summary = cloudSafeCheckpointSummary(report);
    assert.equal(report.stage, stage);
    assert.equal(report.independently_verified, false);
    assert.equal(report.completion_authorized, false);
    assert.equal(summary.independently_verified, false);
    assert.equal(summary.completion_authorized, false);
    assert.doesNotMatch(JSON.stringify({ report, summary }), /PRIVATE_CANARY/);
    assert.deepEqual(summary.recheck_codes, report.recheck.map((x) => x.code));
    assert.deepEqual(summary.pending_codes, report.pending.map((x) => x.code));
    if (outOfScope) {
      assert.ok(report.recheck.some((x) => x.code === "OUT_OF_SCOPE_CHANGE"), "iteration " + i);
    }
    if (forbidden) {
      assert.ok(report.recheck.some((x) => x.code === "PROHIBITED_ACTION_REPORTED"), "iteration " + i);
    }
    if (flaggedError) {
      assert.ok(report.recheck.some((x) => x.code === "VERIFICATION_FAILED"), "iteration " + i);
    }
    if (drift) {
      assert.ok(report.recheck.some((x) => x.code === "CONTRACT_DRIFT"), "iteration " + i);
    }
    if (risk === "high" && stage === "handoff") {
      assert.equal(report.status, "HOLD", "high-risk handoff " + i);
      assert.ok(report.recheck.some((x) => x.code === "REVIEW_REQUIRED"), "iteration " + i);
    }
    if (stage === "handoff" && report.recheck.length) {
      assert.equal(report.status, "HOLD");
    }
  }
});

test("2,048 seeded checkpoint scenarios preserve fail-closed decisions and private-data boundaries", async () => {
  const contracts = {};
  for (const risk_level of ["medium", "high"]) {
    contracts[risk_level] = (await createWorkContract({
      task: "Exercise deterministic checkpoint scenarios without authorizing any real action",
      task_type: "BUILD", risk_level, allowed_paths: ["src/"],
      forbidden_actions: ["deploy", "merge", "publish"],
      success_criteria: ["Synthetic version check is recorded"],
      verification_commands: ["node --version"],
    })).contract;
  }
  const stages = ["plan", "implementation", "verification", "handoff"];
  const cases = [
    ["pass", null], ["missing", "MISSING_VERIFICATION"],
    ["mismatched", "COMMAND_MISMATCH"], ["nonzero", "VERIFICATION_FAILED"],
    ["outer_error", "VERIFICATION_FAILED"],
    ["structured_error", "VERIFICATION_FAILED"],
    ["wrong_tool", "VERIFICATION_FAILED"],
    ["outside_scope", "OUT_OF_SCOPE_CHANGE"],
    ["unsafe_path", "INVALID_CHANGED_PATH"],
    ["forbidden", "PROHIBITED_ACTION_REPORTED"],
    ["contract_drift", "CONTRACT_DRIFT"],
    ["duplicate_check", "DUPLICATE_CHECK_RECEIPT"],
    ["missing_acceptance", "ACCEPTANCE_NOT_MET"],
  ];
  let seed = 0x6a09e667;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  let readyReports = 0;
  for (let i = 0; i < 2048; i++) {
    const stage = stages[i % stages.length];
    const [scenario, expectedCode] = cases[Math.floor(i / stages.length) % cases.length];
    const risk = next() % 7 === 0 ? "high" : "medium";
    const human_review_reported = next() % 5 === 0;
    const secret = `PRIVATE_CANARY_${i}_${next()}`;
    const contract = structuredClone(contracts[risk]);
    const receipt = {
      id: "VC-01", command: scenario === "mismatched" ? "npm publish" : "node --version",
      tool: scenario === "wrong_tool" ? "untrusted_tool" : "mcp__God_v5__exec_command",
      response: {
        ...(scenario === "outer_error" ? { isError: true } : {}),
        ...(scenario === "structured_error" ? { structuredContent: { error: { code: "DENIED" } } } : {}),
        upstream_result: {
          exit_code: scenario === "nonzero" ? 12 : 0,
          output: secret,
        },
      },
    };
    const input = {
      stage, contract, human_review_reported,
      codexify_export: {
        changed_files: [scenario === "outside_scope" ? `private/${secret}` :
          scenario === "unsafe_path" ? `../${secret}` : "src/parser.mjs"],
        operations_performed: scenario === "forbidden" ? [`deployed ${secret}`] : ["edited source"],
        checks: scenario === "missing" ? [] : scenario === "duplicate_check" ? [receipt, receipt] : [receipt],
      },
      acceptance: scenario === "missing_acceptance" ? [] :
        [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
    };
    if (scenario === "contract_drift") input.contract.task = secret;
    const result = await evaluateCheckpoint(input);
    const summary = cloudSafeCheckpointSummary(result);
    const codes = [...result.recheck, ...result.pending].map((item) => item.code);
    if (expectedCode) assert.ok(codes.includes(expectedCode), `case ${i}: ${expectedCode}`);
    const canBeReady = stage === "handoff" && scenario === "pass" &&
      (risk !== "high" || human_review_reported);
    if (canBeReady) {
      assert.equal(result.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW", `case ${i}`);
      readyReports++;
    } else {
      assert.notEqual(result.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW", `case ${i}`);
    }
    assert.equal(result.independently_verified, false);
    assert.equal(result.completion_authorized, false);
    assert.equal(summary.independently_verified, false);
    assert.equal(summary.completion_authorized, false);
    assert.deepEqual(summary.recheck_codes, result.recheck.map((item) => item.code));
    assert.deepEqual(summary.pending_codes, result.pending.map((item) => item.code));
    assert.doesNotMatch(JSON.stringify({ result, summary }), /PRIVATE_CANARY_/);
  }
  assert.ok(readyReports > 0, "the matrix must also exercise clean handoff");
});
