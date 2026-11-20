import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createWorkContract } from "../dist/work-contract.js";
import { evaluateCheckpoint } from "../experiments/codexify-checkpoints/checkpoint.mjs";

async function checkpoint(stage = "handoff") {
  const result = await createWorkContract({
    task: "Review a bounded synthetic parser test with actual receipt provenance",
    task_type: "BUILD",
    risk_level: "medium",
    allowed_paths: ["src/"],
    forbidden_actions: ["merge", "deploy"],
    success_criteria: ["The synthetic parser runs all required tests"],
    verification_commands: ["node --version"],
  });
  assert.equal(result.definition_status, "DEFINED");
  return {
    stage,
    contract: result.contract,
    codexify_export: {
      changed_files: ["src/parser.mjs"],
      operations_performed: ["edited source"],
      checks: [{
        id: "VC-01", command: "node --version",
        tool: "mcp__God_v5__exec_command",
        response: { upstream_result: { exit_code: 0, output: "PRIVATE_SENTINEL_TEST" } },
      }],
    },
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
  };
}

test("nested Codexify MCP isError overrides a claimed successful exit_code", async () => {
  const args = await checkpoint();
  args.codexify_export.checks[0].response.isError = true;
  const result = await evaluateCheckpoint(args);
  assert.equal(result.status, "HOLD");
  assert.ok(result.recheck.some((issue) => issue.code === "VERIFICATION_FAILED"));
  assert.equal(result.completion_authorized, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL_TEST/);
});

test("top-level Codexify MCP isError also overrides a successful response", async () => {
  const args = await checkpoint("verification");
  args.codexify_export.checks[0].isError = true;
  const result = await evaluateCheckpoint(args);
  assert.equal(result.status, "RECHECK");
  assert.ok(result.recheck.some((issue) => issue.code === "VERIFICATION_FAILED"));
  assert.equal(result.completion_authorized, false);
});

test("unsuccessful nested upstream tool result never counts as verified success", async () => {
  const args = await checkpoint();
  args.codexify_export.checks[0].response.upstream_result.isError = true;
  const result = await evaluateCheckpoint(args);
  assert.equal(result.status, "HOLD");
  assert.ok(result.recheck.some((issue) => issue.code === "VERIFICATION_FAILED"));
});

test("one-shot pilot does not forward ambient Node preload to child MCP", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-pilot-hardening-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const input = join(folder, "input.json");
  const preload = join(folder, "preload.cjs");
  const marker = join(folder, "unexpected-child-preload.txt");
  await writeFile(input, JSON.stringify(await checkpoint("verification")));
  // A preloader inherited by the MCP child would write an observable marker.
  await writeFile(preload, [
    "if ((process.argv[1] || '').includes('mcp-stdio.mjs')) {",
    "  require('node:fs').writeFileSync(" + JSON.stringify(marker) + ", 'unexpected');",
    "}",
  ].join("\n"));
  const script = fileURLToPath(new URL("../experiments/codexify-checkpoints/pilot-call.mjs", import.meta.url));
  const server = fileURLToPath(new URL("../experiments/codexify-checkpoints/mcp-stdio.mjs", import.meta.url));
  const env = { ...process.env, NODE_OPTIONS: "--require=" + preload,
    TEST_ONLY_CREDENTIAL_CANARY: "DO_NOT_FORWARD" };
  // Positive control: prove this preload really would execute if forwarded.
  const control = spawnSync(process.execPath, [server], {
    env, encoding: "utf8", timeout: 90000, input: "",
  });
  assert.equal(control.status, 0, control.stderr.slice(0, 400));
  assert.equal(await readFile(marker, "utf8"), "unexpected");
  await rm(marker);
  const child = spawnSync(process.execPath, [script, "--input", input], {
    env, encoding: "utf8", timeout: 90000,
  });
  assert.equal(child.status, 0, child.stderr.slice(0, 400));
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, "CONTINUE_WITH_PENDING_ITEMS");
  await assert.rejects(stat(marker), (error) => error.code === "ENOENT");
  assert.doesNotMatch(child.stdout + child.stderr, /TEST_ONLY_CREDENTIAL_CANARY/);
});
