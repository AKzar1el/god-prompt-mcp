#!/usr/bin/env node
// Synthetic, read-only demonstration. No real Codexify calls or file writes.
import { createWorkContract } from "../../dist/work-contract.js";
import { evaluateCheckpoint } from "./checkpoint.mjs";

const { contract } = await createWorkContract({
  task: "Implement validation for a fictional CSV parser",
  task_type: "BUILD",
  risk_level: "medium",
  allowed_paths: ["src/", "tests/"],
  forbidden_actions: ["deploy", "merge", "publish"],
  success_criteria: ["The fictional parser rejects a malformed row"],
  verification_commands: ["npm test"],
});
const base = {
  contract,
  codexify_export: {
    changed_files: ["src/parser.mjs"],
    operations_performed: ["edited source files"],
    checks: [],
  },
};
const plan = await evaluateCheckpoint({ ...base, stage: "plan" });
const missing = await evaluateCheckpoint({ ...base, stage: "verification" });
const reported = await evaluateCheckpoint({
  ...base,
  stage: "handoff",
  codexify_export: {
    ...base.codexify_export,
    checks: [{
      id: "VC-01",
      command: "npm test",
      tool: "mcp__God_v5__exec_command",
      response: {
        upstream_result: {
          exit_code: 0,
          output: "SYNTHETIC DEMO SUCCESS; NOT REAL EXECUTION EVIDENCE",
        },
      },
    }],
  },
  acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
});
process.stdout.write(JSON.stringify({
  mode: "SYNTHETIC_OFFLINE_DEMO",
  no_writes: true,
  checkpoints: [
    { stage: plan.stage, status: plan.status, pending: plan.pending.map((x) => x.code) },
    { stage: missing.stage, status: missing.status, recheck: missing.recheck.map((x) => x.code) },
    {
      stage: reported.stage,
      status: reported.status,
      independently_verified: reported.independently_verified,
      completion_authorized: reported.completion_authorized,
    },
  ],
}, null, 2) + "\n");
