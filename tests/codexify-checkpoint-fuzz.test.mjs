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
