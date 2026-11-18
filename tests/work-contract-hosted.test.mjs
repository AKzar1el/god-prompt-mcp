import test from "node:test";
import assert from "node:assert/strict";

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": {
    name: "god-prompt-work-contract-hosted-test",
    version: "1.0.0",
  },
  "io.modelcontextprotocol/clientCapabilities": {},
};

test("hosted MCP exposes contract creation and evidence review without side effects", async () => {
  const { default: worker } = await import(`../dist/index.js?contracts=${Date.now()}`);

  async function post(method, params, id) {
    const response = await worker.fetch(
      new Request("https://example.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2026-07-28",
          "mcp-method": method,
          ...(method === "tools/call" ? { "mcp-name": params.name } : {}),
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          method,
          params: { ...params, _meta: META },
        }),
      }),
      {},
      {}
    );
    assert.equal(response.status, 200);
    return response.json();
  }

  const listed = await post("tools/list", {}, "tools");
  const tools = listed.result?.tools ?? [];
  for (const name of ["create_work_contract", "review_work_evidence"]) {
    const tool = tools.find((entry) => entry.name === name);
    assert.ok(tool, name);
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
  }

  const created = await post(
    "tools/call",
    {
      name: "create_work_contract",
      arguments: {
        task: "Add a validation test to the parser",
        task_type: "BUILD",
        risk_level: "low",
        allowed_paths: ["src/", "tests/"],
        forbidden_actions: ["deploy"],
        success_criteria: ["Invalid parser input is rejected"],
        verification_commands: ["npm test"],
      },
    },
    "create"
  );
  assert.equal(created.error, undefined);
  const result = created.result?.structuredContent;
  assert.equal(result?.definition_status, "DEFINED");
  assert.match(result?.contract?.contract_id ?? "", /^sha256:[a-f0-9]{64}$/);

  const reviewed = await post(
    "tools/call",
    {
      name: "review_work_evidence",
      arguments: {
        contract: result.contract,
        changed_files: ["src/validator.ts"],
        operations_performed: ["deploy"],
        checks: [{ id: "VC-01", command: "npm test", exit_code: 0, source: "self_report" }],
        acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
      },
    },
    "review"
  );
  assert.equal(reviewed.error, undefined);
  const audit = reviewed.result?.structuredContent;
  assert.equal(audit?.status, "HOLD");
  assert.equal(audit?.independently_verified, false);
  assert.equal(audit?.completion_authorized, false);
  assert.ok(audit.issues.some((issue) => issue.code === "SELF_REPORTED_CHECK"));
  assert.ok(audit.issues.some((issue) => issue.code === "PROHIBITED_ACTION_REPORTED"));
});

test("hosted contract endpoint rejects malformed inputs", async () => {
  const { default: worker } = await import(`../dist/index.js?invalid-contracts=${Date.now()}`);
  const response = await worker.fetch(
    new Request("https://example.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2026-07-28",
        "mcp-method": "tools/call",
        "mcp-name": "create_work_contract",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "invalid",
        method: "tools/call",
        params: {
          name: "create_work_contract",
          arguments: {
            task: "Build a validation test",
            task_type: "BUILD",
            allowed_paths: ["../../outside"],
          },
          _meta: META,
        },
      }),
    }),
    {},
    {}
  );
  assert.equal(response.status, 200);
  const message = await response.json();
  assert.equal(message.result?.isError, true);
});
