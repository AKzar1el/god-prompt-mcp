import test from "node:test";
import assert from "node:assert/strict";

const META = {
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientInfo": { name: "godprompt-public-toolkit-test", version: "1.0.0" },
  "io.modelcontextprotocol/clientCapabilities": {},
};

async function post(worker, method, params, id) {
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
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params: { ...params, _meta: META } }),
    }),
    {},
    {}
  );
  assert.equal(response.status, 200);
  return response.json();
}

test("hosted Worker exposes all four public tools without Codexify or local host", async () => {
  const { default: worker } = await import(`../dist/index.js?public-engineering=${Date.now()}`);
  const listed = await post(worker, "tools/list", {}, 1);
  const tools = listed.result?.tools ?? [];
  for (const name of [
    "review_code_change", "audit_requirements", "build_test_matrix", "get_tailored_guidance",
    "diagnose_failure", "assess_release_readiness", "create_context_handoff", "compare_evaluation_runs",
  ]) {
    const tool = tools.find((item) => item.name === name);
    assert.ok(tool, name);
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
  }
  const diff = ["diff --git a/src/main.ts b/src/main.ts", "--- a/src/main.ts", "+++ b/src/main.ts", "@@ -1 +1,2 @@", " console.log('hi');", "+eval(input);"].join("\n");
  const review = await post(worker, "tools/call", { name: "review_code_change", arguments: { diff } }, 2);
  assert.equal(review.result?.structuredContent?.status, "REVIEW_HINTS_ONLY");
  assert.ok(review.result.structuredContent.findings.some((item) => item.code === "DYNAMIC_CODE_EXECUTION"));
  assert.equal(review.result.structuredContent.independently_verified, false);

  const specification = "- The user interface must be fast and easy.\n- The API must return 429 for rate-limited users.\nAcceptance: return 429 after ten requests.";
  const audited = await post(worker, "tools/call", { name: "audit_requirements", arguments: { specification } }, 3);
  assert.equal(audited.result?.structuredContent?.status, "NEEDS_CLARIFICATION");
  const matrix = await post(worker, "tools/call", { name: "build_test_matrix", arguments: { specification, max_cases: 8 } }, 4);
  assert.equal(matrix.result?.structuredContent?.cases.length, 8);
  assert.equal(matrix.result?.structuredContent?.tests_executed, 0);
  const guidance = await post(worker, "tools/call", { name: "get_tailored_guidance", arguments: { task_type: "BUILD", phase: "verify", max_chars: 600 } }, 5);
  assert.ok(guidance.result?.structuredContent?.content.length > 100);
  assert.ok(guidance.result?.structuredContent?.content.length <= 600);

  const diagnosed = await post(worker, "tools/call", {
    name: "diagnose_failure", arguments: { symptoms: "Production request failed", logs: "EACCES secret=PRIVATE_CANARY_123" },
  }, 6);
  assert.equal(diagnosed.result?.structuredContent?.hypotheses[0].signal, "PERMISSION");
  assert.doesNotMatch(JSON.stringify(diagnosed.result?.structuredContent), /PRIVATE_CANARY_123/);

  const release = await post(worker, "tools/call", {
    name: "assess_release_readiness", arguments: { target: "production", checks: [{ name: "smoke", status: "passed" }] },
  }, 7);
  assert.equal(release.result?.structuredContent?.status, "BLOCKED");
  assert.equal(release.result?.structuredContent?.deployment_authorized, false);

  const handoff = await post(worker, "tools/call", {
    name: "create_context_handoff", arguments: { goal: "Review the login change safely", decisions: ["Do not deploy"] },
  }, 8);
  assert.match(handoff.result?.structuredContent?.handoff_text, /Do not deploy/);

  const compare = await post(worker, "tools/call", {
    name: "compare_evaluation_runs", arguments: {
      baseline: [{ case_id: "case1", passed: false }],
      candidate: [{ case_id: "case1", passed: true }],
    },
  }, 9);
  assert.equal(compare.result?.structuredContent?.status, "LOW_SAMPLE_DIRECTIONAL");
  assert.equal(compare.result?.structuredContent?.improved, 1);
});

test("hosted Worker rejects oversized and invalid tool arguments", async () => {
  const { default: worker } = await import(`../dist/index.js?public-engineering-invalid=${Date.now()}`);
  const calls = [
    { name: "review_code_change", arguments: { diff: "x".repeat(120_001) } },
    { name: "audit_requirements", arguments: { specification: "tiny" } },
    { name: "build_test_matrix", arguments: { specification: "a valid requirement that is long enough", max_cases: -1 } },
    { name: "get_tailored_guidance", arguments: { task_type: "INVENTED", phase: "verify" } },
    { name: "diagnose_failure", arguments: { symptoms: "short" } },
    { name: "assess_release_readiness", arguments: { target: "production", checks: [] } },
    { name: "create_context_handoff", arguments: { goal: "tiny" } },
    { name: "compare_evaluation_runs", arguments: { baseline: [], candidate: [] } },
  ];
  for (let i = 0; i < calls.length; i++) {
    const res = await post(worker, "tools/call", calls[i], i + 10);
    assert.equal(res.result?.isError, true, calls[i].name);
  }
});
