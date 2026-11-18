import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createWorkContract } from "../dist/work-contract.js";
import {
  evaluateCheckpoint, cloudSafeCheckpointSummary,
} from "../experiments/codexify-checkpoints/checkpoint.mjs";

async function sample(stage, opts = {}) {
  const prepared = await createWorkContract({
    task: "Validate an imaginary parser before finishing its task",
    task_type: "BUILD",
    risk_level: opts.risk || "medium",
    allowed_paths: ["src/", "tests/"],
    forbidden_actions: ["merge", "deploy", "publish"],
    success_criteria: ["Parser rejects malformed input without errors"],
    verification_commands: ["npm test"],
  });
  assert.equal(prepared.definition_status, "DEFINED");
  return {
    stage,
    contract: prepared.contract,
    codexify_export: {
      changed_files: ["src/parser.mjs"],
      operations_performed: ["edited the parser"],
      checks: [],
    },
  };
}

function successfulReceipt(input) {
  return {
    id: "VC-01",
    command: "npm test",
    tool: "mcp__God_v5__exec_command",
    response: { upstream_result: { exit_code: 0, output: "Synthetic test success" } },
  };
}

test("planning checkpoint shows missing later work without pretending it is complete", async () => {
  const output = await evaluateCheckpoint(await sample("plan"));
  assert.equal(output.status, "CONTINUE_WITH_PENDING_ITEMS");
  assert.deepEqual(output.recheck, []);
  assert.ok(output.pending.some((x) => x.code === "MISSING_VERIFICATION"));
  assert.equal(output.completion_authorized, false);
});

test("implementation checkpoint stops and requests recheck for scope violations", async () => {
  const input = await sample("implementation");
  input.codexify_export.changed_files.push("private/secrets.txt");
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "RECHECK");
  assert.ok(output.recheck.some((x) => x.code === "OUT_OF_SCOPE_CHANGE"));
  assert.ok(output.pending.some((x) => x.code === "MISSING_VERIFICATION"));
  assert.doesNotMatch(JSON.stringify(output), /private\/secrets\.txt/);
});

test("forbidden operations are not deferred until the final checkpoint", async () => {
  const input = await sample("implementation");
  input.codexify_export.operations_performed = ["deployed production"];
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "RECHECK");
  assert.ok(output.recheck.some((x) => x.code === "PROHIBITED_ACTION_REPORTED"));
});

test("verification stage asks for a recheck when a required command has not run", async () => {
  const output = await evaluateCheckpoint(await sample("verification"));
  assert.equal(output.status, "RECHECK");
  assert.ok(output.recheck.some((x) => x.code === "MISSING_VERIFICATION"));
  assert.ok(output.pending.some((x) => x.code === "ACCEPTANCE_NOT_MET"));
});

test("Codexify MCP error is never mistaken for a passing command", async () => {
  const input = await sample("verification");
  input.codexify_export.checks = [{
    id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
    response: { isError: true, content: [{ type: "text", text: '{"exit_code":0,"secret":"DONOTLEAK"}' }] },
  }];
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "RECHECK");
  assert.ok(output.recheck.some((x) => x.code === "VERIFICATION_FAILED"));
  assert.doesNotMatch(JSON.stringify(output), /DONOTLEAK/);
});

test("reported checks do not establish independent verification or authorization", async () => {
  const input = await sample("handoff");
  input.codexify_export.checks = [successfulReceipt(input)];
  input.acceptance = [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }];
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.deepEqual(output.recheck, []);
  assert.equal(output.independently_verified, false);
  assert.equal(output.completion_authorized, false);
  assert.match(output.next_step, /independently/);
});

test("incomplete final handoff stays on HOLD", async () => {
  const output = await evaluateCheckpoint(await sample("handoff"));
  assert.equal(output.status, "HOLD");
  assert.ok(output.recheck.some((x) => x.code === "ACCEPTANCE_NOT_MET"));
});

test("contract drift is flagged at the very first checkpoint", async () => {
  const input = await sample("plan");
  input.contract.task = "Changed task without reapproval";
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "RECHECK");
  assert.ok(output.recheck.some((x) => x.code === "CONTRACT_DRIFT"));
});

test("high risk handoff does not silently count missing review as approval", async () => {
  const input = await sample("handoff", { risk: "high" });
  input.codexify_export.checks = [successfulReceipt(input)];
  input.acceptance = [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }];
  const output = await evaluateCheckpoint(input);
  assert.equal(output.status, "HOLD");
  assert.ok(output.recheck.some((x) => x.code === "REVIEW_REQUIRED"));
});

test("a cloud-ready summary never includes task content, paths, commands or raw receipts", async () => {
  const input = await sample("verification");
  input.codexify_export.changed_files = ["src/VERY_PRIVATE_ISSUE.mjs"];
  input.codexify_export.checks = [{
    id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
    response: { upstream_result: { exit_code: 5, output: "SECRET_SENTINEL" } },
  }];
  const summary = cloudSafeCheckpointSummary(await evaluateCheckpoint(input));
  assert.equal(summary.schema, "godprompt.checkpoint_summary.v1");
  const encoded = JSON.stringify(summary);
  for (const forbidden of ["PRIVATE", "SECRET_SENTINEL", "npm test", "parser", "contract_id", "user"]) {
    assert.equal(encoded.includes(forbidden), false, "Disallowed field/content: " + forbidden);
  }
  assert.equal(summary.completion_authorized, false);
});

test("cloud-safe summary rejects forged stage, issue code and non-numeric counts", async () => {
  const input = await sample("verification");
  const valid = await evaluateCheckpoint(input);
  assert.throws(() => cloudSafeCheckpointSummary({
    ...valid, stage: "PRIVATE_USER_TOKEN",
  }), /Invalid checkpoint summary/);
  assert.throws(() => cloudSafeCheckpointSummary({
    ...valid, recheck: [{ code: "SECRET_FROM_USER" }],
  }), /Unknown issue code/);
  assert.throws(() => cloudSafeCheckpointSummary({
    ...valid, counts: { ...valid.counts, required_checks: "PRIVATE" },
  }), /Invalid checkpoint count/);
});

test("malformed phase and unexpected fields are rejected rather than ignored", async () => {
  const valid = await sample("plan");
  await assert.rejects(evaluateCheckpoint({ ...valid, stage: "deploy" }), /stage/);
  await assert.rejects(evaluateCheckpoint({ ...valid, credentials: "SECRET" }), /Unexpected/);
});

test("CLI reports HOLD in JSON while exiting zero for an evaluated checkpoint", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-checkpoint-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "checkpoint-input.json");
  await writeFile(filename, JSON.stringify(await sample("handoff")));
  const script = fileURLToPath(new URL("../experiments/codexify-checkpoints/checkpoint.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [script, "--input", filename], {
    encoding: "utf8", timeout: 20000,
  });
  assert.equal(child.status, 0, child.stderr);
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "HOLD");
  assert.equal(child.stderr, "");
});

test("no-write synthetic demonstration exercises all three checkpoint stages", () => {
  const demo = fileURLToPath(new URL("../experiments/codexify-checkpoints/demo.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [demo], {
    encoding: "utf8", timeout: 20000,
  });
  assert.equal(child.status, 0, child.stderr);
  const output = JSON.parse(child.stdout);
  assert.equal(output.mode, "SYNTHETIC_OFFLINE_DEMO");
  assert.equal(output.no_writes, true);
  assert.deepEqual(output.checkpoints.map((entry) => entry.status), [
    "CONTINUE_WITH_PENDING_ITEMS",
    "RECHECK",
    "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
  ]);
  assert.equal(output.checkpoints[2].independently_verified, false);
  assert.equal(output.checkpoints[2].completion_authorized, false);
});
