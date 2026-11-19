import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createWorkContract } from "../dist/work-contract.js";
import { codexifyEvidence } from "../bin/godprompt-proof.mjs";

const TOOL = "review_codexify_checkpoint";

async function fixture(stage = "verification") {
  const result = await createWorkContract({
    task: "Check fictional scoped parser implementation at declared milestones",
    task_type: "BUILD",
    risk_level: "medium",
    allowed_paths: ["src/", "tests/"],
    forbidden_actions: ["deploy", "merge", "publish"],
    success_criteria: ["Parser accepts only valid sample input"],
    verification_commands: ["node --version"],
  });
  return {
    stage,
    contract: result.contract,
    codexify_export: { changed_files: ["src/parser.mjs"], operations_performed: [], checks: [] },
  };
}

async function connect(t, script, extraEnv = {}) {
  const child = spawn(process.execPath, [script], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    env: { ...process.env, ...extraEnv },
  });
  t.after(() => { child.stdin.end(); if (child.exitCode === null) child.kill(); });
  const pending = new Map();
  let id = 0;
  child.stderr.on("data", () => {});
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const item = pending.get(msg.id);
    if (!item) return;
    pending.delete(msg.id);
    clearTimeout(item.timer);
    if (msg.error) item.reject(new Error("MCP error"));
    else item.resolve(msg.result);
  });
  const fail = () => {
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error("MCP child exited")); }
    pending.clear();
  };
  child.on("error", fail);
  child.on("exit", fail);
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    const timer = setTimeout(() => { pending.delete(next); reject(new Error("MCP timeout")); }, 20000);
    pending.set(next, { timer, resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: next, method, params }) + "\n");
  });
  const initialized = await send("initialize", {
    protocolVersion: "2026-07-28", capabilities: {},
    clientInfo: { name: "godprompt-unified-test", version: "0.0.1" },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  return { send, initialized };
}

function report(result) {
  assert.notEqual(result.isError, true);
  return result.structuredContent ?? JSON.parse(result.content.find((c) => c.type === "text").text);
}

test("default published-style stdio stays at nine tools without opt-in", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "0" });
  assert.equal(client.initialized.serverInfo.version, "1.1.1");
  const listed = await client.send("tools/list");
  assert.equal(listed.tools.length, 9);
  assert.equal(listed.tools.some((x) => x.name === TOOL), false);
});

test("opt-in main stdio reuses checkpoint logic while preserving nine existing tools", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "1" });
  assert.equal(client.initialized.serverInfo.name, "god-prompt-mcp");
  assert.equal(client.initialized.serverInfo.version, "1.1.1-checkpoint-preview.5");
  assert.match(client.initialized.instructions, /review_codexify_checkpoint/);
  assert.match(client.initialized.instructions, /rollout_checkpoint_required/);
  assert.match(client.initialized.instructions, /rollout_update/);
  const listed = await client.send("tools/list");
  assert.equal(listed.tools.length, 10);
  assert.equal(listed.tools.filter((x) => x.name === TOOL).length, 1);
  const checkpointTool = listed.tools.find((x) => x.name === TOOL);
  assert.equal(checkpointTool.annotations.readOnlyHint, true);
  assert.equal(checkpointTool.annotations.destructiveHint, false);
  assert.deepEqual(checkpointTool.inputSchema.properties.stage.enum,
    ["plan", "implementation", "verification", "handoff"]);
  assert.ok(checkpointTool.inputSchema.required.includes("contract"));

  const plan = report(await client.send("tools/call", { name: TOOL, arguments: await fixture("plan") }));
  assert.equal(plan.status, "CONTINUE_WITH_PENDING_ITEMS");
  assert.equal(plan.completion_authorized, false);
  const needsCheck = report(await client.send("tools/call", { name: TOOL, arguments: await fixture() }));
  assert.equal(needsCheck.status, "RECHECK");
  assert.ok(needsCheck.recheck.some((x) => x.code === "MISSING_VERIFICATION"));

  const fail = await fixture("handoff");
  fail.codexify_export.checks = [{
    id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
    response: { isError: true, upstream_result: { exit_code: 0, output: "PRIVATE_HIDDEN_CANARY" } },
  }];
  fail.acceptance = [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }];
  const held = report(await client.send("tools/call", { name: TOOL, arguments: fail }));
  assert.equal(held.status, "HOLD");
  assert.ok(held.recheck.some((x) => x.code === "VERIFICATION_FAILED"));
  assert.equal(held.independently_verified, false);
  assert.equal(held.completion_authorized, false);
  assert.doesNotMatch(JSON.stringify(held), /PRIVATE_HIDDEN_CANARY/);

  const forbidden = await fixture("implementation");
  forbidden.codexify_export.operations_performed = ["deployed new code"];
  const blocked = report(await client.send("tools/call", { name: TOOL, arguments: forbidden }));
  assert.equal(blocked.status, "RECHECK");
  assert.ok(blocked.recheck.some((x) => x.code === "PROHIBITED_ACTION_REPORTED"));
});

test("legacy pilot and main MCP use the same single checkpoint evaluator", async (t) => {
  const { evaluateCheckpoint } = await import("../dist/codexify-checkpoint.js");
  const fromExperiment = await import("../experiments/codexify-checkpoints/checkpoint.mjs");
  assert.strictEqual(fromExperiment.evaluateCheckpoint, evaluateCheckpoint);
  const client = await connect(t, "experiments/codexify-checkpoints/mcp-stdio.mjs");
  const listed = await client.send("tools/list");
  assert.deepEqual(listed.tools.map((x) => x.name), [TOOL]);
  const res = report(await client.send("tools/call", { name: TOOL, arguments: await fixture() }));
  assert.equal(res.status, "RECHECK");
});

test("direct Codexify evidence adapter never promotes error envelopes with successful exit codes", async () => {
  const args = await fixture("handoff");
  args.codexify_export.checks = [{
    id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
    isError: true, response: { upstream_result: { exit_code: 0, output: "HIDDEN_ERROR_LOG" } },
  }];
  const bundle = await codexifyEvidence({ contract: args.contract, exportData: args.codexify_export });
  assert.equal(bundle.review_input.checks[0].exit_code, null);
  assert.equal(bundle.review_input.checks[0].source, "self_report");
  assert.doesNotMatch(JSON.stringify(bundle), /HIDDEN_ERROR_LOG/);
});

test("standalone evidence adapter rejects malformed operation lists instead of discarding prohibited actions", async () => {
  const base = await fixture("handoff");
  for (const operations_performed of [
    ["deployed production", 42],
    ["deployed production", "x".repeat(501)],
    ["deployed production", ...Array(101).fill("edited source")],
    null,
  ]) {
    await assert.rejects(
      codexifyEvidence({ contract: base.contract, exportData: {
        changed_files: [], checks: [], operations_performed,
      } }),
      /operations_performed|operation/i,
    );
  }
  const valid = await codexifyEvidence({ contract: base.contract, exportData: {
    changed_files: [], checks: [], operations_performed: ["deployed production"],
  } });
  assert.deepEqual(valid.review_input.operations_performed, ["deployed production"]);
});

test("structured error metadata cannot disguise a failed check as exit_code zero", async () => {
  const base = await fixture("handoff");
  for (const response of [
    { structuredContent: { isError: true }, upstream_result: { exit_code: 0, output: "SECRET_NESTED_1" } },
    { upstream_result: { exit_code: 0, structuredContent: { error: { code: "DENIED" } }, output: "SECRET_NESTED_2" } },
  ]) {
    const bundle = await codexifyEvidence({ contract: base.contract, exportData: {
      changed_files: [], checks: [{ id: "VC-01", command: "node --version",
        tool: "mcp__God_v5__exec_command", response }],
    } });
    assert.equal(bundle.review_input.checks[0].exit_code, null);
    assert.equal(bundle.review_input.checks[0].source, "self_report");
    assert.doesNotMatch(JSON.stringify(bundle), /SECRET_NESTED_/);
  }
});

test("malformed or nested error flags fail closed despite exit_code zero", async () => {
  const base = await fixture("handoff");
  const variants = [
    { isError: "true" },
    { response: { isError: "true" } },
    { response: { upstream_result: { isError: "true" } } },
    { response: { upstream_result: { status: "error" } } },
    { response: { upstream_result: { success: false } } },
    { response: { upstream_result: { success: "false" } } },
    { response: { upstream_result: { success: 0 } } },
    { response: { upstream_result: { status: "cancelled" } } },
    { response: { upstream_result: { status: "running" } } },
    { response: { error: { code: -32000 } } },
  ];
  for (const adversarial of variants) {
    const baseResponse = {
      upstream_result: { exit_code: 0, output: "NEVER_ECHO_CANARY" },
    };
    const receipt = {
      id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
      response: baseResponse,
      ...adversarial,
    };
    if (adversarial.response) {
      receipt.response = {
        ...baseResponse,
        ...adversarial.response,
        upstream_result: {
          ...baseResponse.upstream_result,
          ...(adversarial.response.upstream_result || {}),
        },
      };
    }
    const bundle = await codexifyEvidence({
      contract: base.contract,
      exportData: { changed_files: [], checks: [receipt] },
    });
    assert.equal(bundle.review_input.checks[0].exit_code, null);
    assert.equal(bundle.review_input.checks[0].source, "self_report");
    assert.doesNotMatch(JSON.stringify(bundle), /NEVER_ECHO_CANARY/);
  }
  const passing = await codexifyEvidence({ contract: base.contract, exportData: {
    changed_files: [], checks: [{
      id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
      response: { upstream_result: {
        exit_code: 0, success: true, status: "completed", output: "PRIVATE_PASS_CANARY",
      } },
    }],
  } });
  assert.equal(passing.review_input.checks[0].exit_code, 0);
  assert.equal(passing.review_input.checks[0].source, "tool_output");
  assert.doesNotMatch(JSON.stringify(passing), /PRIVATE_PASS_CANARY/);
});

test("opt-in main MCP stays stateless across 24 simultaneous checkpoint calls", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "1" });
  const base = await fixture("plan");
  const calls = Array.from({ length: 24 }, (_, index) => ({
    ...base,
    codexify_export: {
      changed_files: [index % 2 ? "outside/PRIVATE_CANARY_" + index : "src/good_" + index],
      operations_performed: [],
      checks: [],
    },
  }));
  const results = await Promise.all(calls.map((args) =>
    client.send("tools/call", { name: TOOL, arguments: args })));
  for (let index = 0; index < results.length; index++) {
    const value = report(results[index]);
    assert.equal(value.stage, "plan");
    assert.equal(value.status, index % 2 ? "RECHECK" : "CONTINUE_WITH_PENDING_ITEMS");
    assert.equal(value.completion_authorized, false);
    assert.equal(value.cloud_storage_preview.completion_authorized, false);
    assert.doesNotMatch(JSON.stringify(value), /PRIVATE_CANARY_/);
  }
});

test("main MCP rejects oversized private output, then recovers on the same connection", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "1" });
  const oversized = await fixture();
  oversized.codexify_export.checks = [{
    id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
    response: { upstream_result: { exit_code: 0, output: "PRIVATE_SECRET_CANARY_" + "Z".repeat(300 * 1024) } },
  }];
  const refused = await client.send("tools/call", {
    name: TOOL, arguments: oversized,
  });
  assert.equal(refused.isError, true);
  assert.doesNotMatch(JSON.stringify(refused), /PRIVATE_SECRET_CANARY_/);
  const healthy = report(await client.send("tools/call", {
    name: TOOL, arguments: await fixture(),
  }));
  assert.equal(healthy.status, "RECHECK");
  assert.ok(healthy.recheck.some((entry) => entry.code === "MISSING_VERIFICATION"));
});

test("MCP invalid-argument responses never echo untrusted secret fields or values", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "1" });
  const valid = await fixture();
  const cases = [
    { ...valid, PRIVATE_CANARY_KEY_2034: "PRIVATE_CANARY_VALUE_2034" },
    { ...valid, stage: "PRIVATE_CANARY_STAGE_2034" },
    { ...valid, codexify_export: {
      ...valid.codexify_export, changed_files: ["PRIVATE_CANARY_PATH_2034".repeat(15)],
    } },
  ];
  for (const args of cases) {
    const response = await client.send("tools/call", { name: TOOL, arguments: args });
    assert.equal(response.isError, true);
    assert.doesNotMatch(JSON.stringify(response), /PRIVATE_CANARY_/);
  }
  const recovered = report(await client.send("tools/call", {
    name: TOOL, arguments: valid,
  }));
  assert.equal(recovered.status, "RECHECK");
});

test("one MCP connection survives 120 mixed concurrent valid, invalid and failing checkpoints", async (t) => {
  const client = await connect(t, "dist/stdio.js", { GODPROMPT_CODEXIFY_CHECKPOINT: "1" });
  const contract = (await fixture("handoff")).contract;
  const requests = Array.from({ length: 120 }, (_, index) => {
    const scenario = index % 6;
    const secret = "PRIVATE_CONCURRENT_CANARY_" + index;
    const args = {
      stage: "handoff", contract,
      codexify_export: {
        changed_files: [scenario === 4 ? "private/" + secret : "src/parser.mjs"],
        operations_performed: scenario === 3 ? ["deployed " + secret] : [],
        checks: scenario === 5 ? [] : [{
          id: "VC-01", command: "node --version", tool: "mcp__God_v5__exec_command",
          response: {
            ...(scenario === 1 ? { structuredContent: { isError: true } } : {}),
            upstream_result: { exit_code: 0, output: secret },
          },
        }],
      },
      acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
      ...(scenario === 2 ? { [secret]: "untrusted key" } : {}),
    };
    return { scenario, secret, args };
  });
  const results = await Promise.all(requests.map(({ args }) =>
    client.send("tools/call", { name: TOOL, arguments: args })));
  for (let index = 0; index < results.length; index++) {
    const { scenario, secret } = requests[index];
    const response = results[index];
    assert.doesNotMatch(JSON.stringify(response), new RegExp(secret));
    if (scenario === 2) assert.equal(response.isError, true);
    else {
      const result = report(response);
      assert.equal(result.status, scenario === 0 ?
        "REPORTED_READY_FOR_INDEPENDENT_REVIEW" : "HOLD");
      assert.equal(result.completion_authorized, false);
      assert.equal(result.independently_verified, false);
    }
  }
  const recovered = report(await client.send("tools/call", {
    name: TOOL, arguments: await fixture(),
  }));
  assert.equal(recovered.status, "RECHECK");
});

test("public stateless HTTP MCP cannot expose the local tool, even when opt-in environment is set", async () => {
  const previous = process.env.GODPROMPT_CODEXIFY_CHECKPOINT;
  process.env.GODPROMPT_CODEXIFY_CHECKPOINT = "1";
  try {
    const worker = (await import(`../dist/index.js?local-opt-in-check=${Date.now()}`)).default;
    const body = {
      jsonrpc: "2.0", id: "public-catalog-check", method: "tools/list",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "public-boundary-test", version: "0.0.1",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    };
    const response = await worker.fetch(new Request("https://example.test/mcp", {
      method: "POST", headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/list",
      },
      body: JSON.stringify(body),
    }), {}, {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    const names = payload.result.tools.map((item) => item.name);
    assert.equal(names.length, 9);
    assert.ok(!names.includes(TOOL));
  } finally {
    if (previous === undefined) delete process.env.GODPROMPT_CODEXIFY_CHECKPOINT;
    else process.env.GODPROMPT_CODEXIFY_CHECKPOINT = previous;
  }
});
