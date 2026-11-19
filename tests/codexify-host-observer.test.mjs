import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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

test("observer sees scoped host events and triggers plan, verification and handoff without model calls", async (t) => {
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
  await appendFile(audit, [
    ...toolEvents("update_plan", 1),
    ...toolEvents("exec_command", 2),
    ...toolEvents("goal_finish", 3),
  ].map((row) => JSON.stringify(row)).join("\n") + "\n");
  const [code] = await once(child, "exit");
  assert.equal(code, 0, stderr);
  const report = (await readFile(out, "utf8")).trim().split("\n").map(JSON.parse);
  assert.deepEqual(report.map((entry) => entry.stage),
    ["plan", "verification", "handoff"]);
  assert.equal(report[0].status, "CONTINUE_WITH_PENDING_ITEMS");
  assert.equal(report[1].counts.supplied_checks, 1);
  assert.equal(report[2].status, "HOLD");
  assert.ok(report[2].recheck_codes.includes("ACCEPTANCE_NOT_MET"));
  assert.ok(report.every((entry) =>
    entry.independently_verified === false && entry.completion_authorized === false));
  assert.doesNotMatch(JSON.stringify(report) + stdout, /node --version|contract_id|conversation_id/);
});
