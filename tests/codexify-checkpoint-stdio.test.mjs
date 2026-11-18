import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createWorkContract } from "../dist/work-contract.js";

const pilotPath = fileURLToPath(new URL("../experiments/codexify-checkpoints/mcp-stdio.mjs", import.meta.url));

async function clientForPilot(t) {
  const child = spawn(process.execPath, [pilotPath], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env },
  });
  let nextId = 10;
  let stderr = "";
  const waiting = new Map();
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (part) => { stderr = (stderr + part).slice(-4000); });
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); }
    catch { for (const item of waiting.values()) item.reject(new Error("Invalid JSON-RPC frame")); waiting.clear(); return; }
    if (!Object.hasOwn(msg, "id") || !waiting.has(msg.id)) return;
    const pending = waiting.get(msg.id);
    waiting.delete(msg.id);
    clearTimeout(pending.timer);
    if (msg.error) pending.reject(new Error("MCP error " + msg.error.code));
    else pending.resolve(msg.result);
  });
  child.on("error", (error) => { for (const item of waiting.values()) item.reject(error); waiting.clear(); });
  child.on("exit", (code) => {
    for (const item of waiting.values()) item.reject(new Error("MCP pilot process exited " + code + "; " + stderr.slice(0,300)));
    waiting.clear();
  });
  function request(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => { waiting.delete(id); reject(new Error("MCP stdio timed out: " + method)); }, 15000);
      waiting.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }
  function notify(method) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method }) + "\n");
  }
  t.after(() => {
    // Terminate only this test's own child, never existing Codexify agents.
    child.stdin.end();
    if (child.exitCode === null) child.kill();
  });
  const init = await request("initialize", {
    protocolVersion: "2026-07-28",
    capabilities: {},
    clientInfo: { name: "checkpoint-pilot-stdio-test", version: "0.0.1" },
  });
  assert.equal(init.serverInfo.name, "godprompt-checkpoint-pilot");
  notify("notifications/initialized");
  return { request };
}

async function input(stage, changes = ["src/parser.mjs"]) {
  const generated = await createWorkContract({
    task: "Implement and review a fictional parser test in a local sandbox",
    task_type: "BUILD",
    risk_level: "medium",
    allowed_paths: ["src/", "tests/"],
    forbidden_actions: ["deploy", "merge"],
    success_criteria: ["Parser handles synthetic input without regressions"],
    verification_commands: ["npm test"],
  });
  assert.equal(generated.definition_status, "DEFINED");
  return {
    stage, contract: generated.contract,
    codexify_export: { changed_files: changes, checks: [], operations_performed: ["edited source files"] },
  };
}

function resultData(response) {
  if (response?.structuredContent) return response.structuredContent;
  const content = response?.content?.find((x) => x.type === "text")?.text;
  if (!content) throw new Error("No MCP response body");
  return JSON.parse(content);
}

test("real stdio MCP handshake exposes one isolated checkpoint tool", async (t) => {
  const client = await clientForPilot(t);
  const tools = await client.request("tools/list");
  assert.deepEqual(tools.tools.map((x) => x.name), ["review_codexify_checkpoint"]);
  assert.equal(tools.tools[0].annotations.readOnlyHint, true);
});

test("real stdio MCP returns RECHECK for missing verification and safe summary", async (t) => {
  const client = await clientForPilot(t);
  const response = await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: await input("verification"),
  });
  assert.equal(response.isError, undefined);
  const data = resultData(response);
  assert.equal(data.status, "RECHECK");
  assert.ok(data.recheck.some((x) => x.code === "MISSING_VERIFICATION"));
  assert.equal(data.cloud_storage_preview.completion_authorized, false);
  assert.equal(data.completion_authorized, false);
});

test("parallel Codexify-style calls do not mix changed-file scope or checkpoint stages", async (t) => {
  const client = await clientForPilot(t);
  const [plan, bad] = await Promise.all([
    client.request("tools/call", { name: "review_codexify_checkpoint", arguments: await input("plan") }),
    client.request("tools/call", { name: "review_codexify_checkpoint", arguments: await input("implementation", ["private/secret.txt"]) }),
  ]);
  const a = resultData(plan);
  const b = resultData(bad);
  assert.equal(a.stage, "plan");
  assert.equal(a.status, "CONTINUE_WITH_PENDING_ITEMS");
  assert.equal(b.stage, "implementation");
  assert.equal(b.status, "RECHECK");
  assert.ok(b.recheck.some((x) => x.code === "OUT_OF_SCOPE_CHANGE"));
  assert.doesNotMatch(JSON.stringify(b), /private\/secret\.txt/);
});

test("reported synthetic passing receipt remains non-authoritative across stdio", async (t) => {
  const client = await clientForPilot(t);
  const args = await input("handoff");
  args.codexify_export.checks = [{
    id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
    response: { upstream_result: { exit_code: 0, output: "SYNTHETIC ONLY" } },
  }];
  args.acceptance = [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }];
  const data = resultData(await client.request("tools/call", { name: "review_codexify_checkpoint", arguments: args }));
  assert.equal(data.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(data.independently_verified, false);
  assert.equal(data.completion_authorized, false);
  assert.doesNotMatch(JSON.stringify(data), /SYNTHETIC ONLY/);
});

test("MCP tool rejects a malformed phase without leaking task content", async (t) => {
  const client = await clientForPilot(t);
  const args = await input("verification");
  args.stage = "PRIVATE_TOKEN_UNKNOWN_PHASE";
  let response;
  try { response = await client.request("tools/call", { name: "review_codexify_checkpoint", arguments: args }); }
  catch (error) {
    assert.doesNotMatch(String(error), /PRIVATE_TOKEN/);
    return;
  }
  assert.ok(response.isError || !response.structuredContent);
  assert.doesNotMatch(JSON.stringify(response), /PRIVATE_TOKEN/);
});

test("one-shot local caller pipes a real JSON fixture through the MCP and returns RECHECK", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "godprompt-pilot-client-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = join(dir, "checkpoint.json");
  await writeFile(filename, JSON.stringify(await input("verification")));
  const script = fileURLToPath(new URL("../experiments/codexify-checkpoints/pilot-call.mjs", import.meta.url));
  const child = spawnSync(process.execPath, [script, "--input", filename], {
    encoding: "utf8", timeout: 25000,
  });
  assert.equal(child.status, 0, child.stderr);
  const output = JSON.parse(child.stdout);
  assert.equal(output.status, "RECHECK");
  assert.equal(output.completion_authorized, false);
  assert.equal(output.cloud_storage_preview.completion_authorized, false);
});

test("transport-level error flag with exit_code zero forces HOLD, not reported-ready", async (t) => {
  const client = await clientForPilot(t);
  const args = await input("handoff");
  args.codexify_export.checks = [{
    id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
    response: {
      isError: true,
      upstream_result: { exit_code: 0, output: "MCP_PRIVATE_CANARY_NEVER_ECHO" },
    },
  }];
  args.acceptance = [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }];
  const result = resultData(await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: args,
  }));
  assert.equal(result.status, "HOLD");
  assert.ok(result.recheck.some((entry) => entry.code === "VERIFICATION_FAILED"));
  assert.equal(result.independently_verified, false);
  assert.equal(result.completion_authorized, false);
  assert.doesNotMatch(JSON.stringify(result), /MCP_PRIVATE_CANARY/);
});

test("parallel burst keeps 24 checkpoint results isolated without state bleed", async (t) => {
  const client = await clientForPilot(t);
  const prepared = await input("plan");
  const cases = Array.from({ length: 24 }, (_, index) => ({
    ...prepared,
    stage: "plan",
    codexify_export: {
      changed_files: [index % 2 ? "restricted/private_" + index + ".txt" : "src/valid_" + index + ".mjs"],
      operations_performed: [],
      checks: [],
    },
  }));
  const responses = await Promise.all(cases.map((args) =>
    client.request("tools/call", {
      name: "review_codexify_checkpoint", arguments: args,
    })));
  assert.equal(responses.length, 24);
  for (let index = 0; index < responses.length; index++) {
    const output = resultData(responses[index]);
    assert.equal(output.stage, "plan");
    assert.equal(output.status, index % 2 ? "RECHECK" : "CONTINUE_WITH_PENDING_ITEMS");
    assert.equal(output.completion_authorized, false);
    assert.equal(output.cloud_storage_preview.completion_authorized, false);
    if (index % 2) assert.ok(output.recheck.some((entry) => entry.code === "OUT_OF_SCOPE_CHANGE"));
    else assert.deepEqual(output.recheck, []);
    assert.doesNotMatch(JSON.stringify(output), /restricted\/private_/);
  }
});

test("oversized secret-bearing request is rejected and the same MCP stays responsive", async (t) => {
  const client = await clientForPilot(t);
  const oversized = await input("verification");
  oversized.codexify_export.checks = [{
    id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
    response: {
      upstream_result: { exit_code: 0, output: "SECRET_CANARY_" + "x".repeat(300 * 1024) },
    },
  }];
  const refused = await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: oversized,
  });
  assert.equal(refused.isError, true);
  assert.doesNotMatch(JSON.stringify(refused), /SECRET_CANARY/);
  const valid = resultData(await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: await input("verification"),
  }));
  assert.equal(valid.status, "RECHECK");
  assert.ok(valid.recheck.some((entry) => entry.code === "MISSING_VERIFICATION"));
});

test("forbidden reported actions produce immediate RECHECK without echoing raw operations", async (t) => {
  const client = await clientForPilot(t);
  const args = await input("implementation");
  args.codexify_export.operations_performed = ["deployed forbidden action PRIVATE_CANARY"];
  const data = resultData(await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: args,
  }));
  assert.equal(data.status, "RECHECK");
  assert.ok(data.recheck.some((entry) => entry.code === "PROHIBITED_ACTION_REPORTED"));
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_CANARY/);
});

test("tampered task contract cannot pass an MCP handoff", async (t) => {
  const client = await clientForPilot(t);
  const args = await input("handoff");
  args.contract.task = "MALICIOUS_DRIFT_PRIVATE_SENTINEL";
  const data = resultData(await client.request("tools/call", {
    name: "review_codexify_checkpoint", arguments: args,
  }));
  assert.equal(data.status, "HOLD");
  assert.ok(data.recheck.some((entry) => entry.code === "CONTRACT_DRIFT"));
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE_SENTINEL/);
});
