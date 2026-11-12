import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);

const EXPECTED_TOOLS = [
  "classify_task",
  "get_anti_patterns",
  "get_core_skill",
  "get_gates",
  "get_god_prompt",
  "get_protocols",
  "get_version",
];

const REQUEST_TIMEOUT_MS = 15000;

function request(child, pending, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`
    );
  });
}

function toolText(result) {
  const item = result.content.find((entry) => entry.type === "text");
  assert.ok(item, "Expected text content from MCP tool");
  return item.text;
}

async function classify(child, pending, id, description) {
  const result = await request(child, pending, id, "tools/call", {
    name: "classify_task",
    arguments: { description },
  });
  assert.notEqual(result.isError, true, toolText(result));
  return JSON.parse(toolText(result));
}

test("builds a stdio MCP server exposing current GodPrompt content", async (t) => {
  const child = spawn(process.execPath, ["dist/stdio.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(() => child.kill());

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const pending = new Map();
  let protocolError = null;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          waiter.reject(new Error(JSON.stringify(message.error)));
        } else {
          waiter.resolve(message.result);
        }
      }
    } catch (error) {
      protocolError = error;
    }
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      for (const waiter of pending.values()) {
        waiter.reject(
          new Error(`stdio server exited with code ${code}\nstderr:\n${stderr}`)
        );
      }
      pending.clear();
    }
  });

  const initialized = await request(child, pending, 1, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "god-prompt-mcp-test", version: "1.0.0" },
  });

  assert.equal(initialized.serverInfo.name, "god-prompt-mcp");
  assert.equal(initialized.serverInfo.version, packageJson.version);
  assert.match(initialized.instructions, /Start with get_core_skill/i);
  assert.match(initialized.instructions, /classify_task/i);
  assert.match(initialized.instructions, /All GodPrompt tools are read-only/i);

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    })}\n`
  );

  const listed = await request(child, pending, 2, "tools/list");
  const toolNames = listed.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, EXPECTED_TOOLS);
  for (const tool of listed.tools) {
    assert.equal(typeof tool.title, "string", `${tool.name} must expose a title`);
    assert.ok(tool.title.trim(), `${tool.name} must expose a non-empty title`);
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} must be read-only`);
    assert.equal(tool.annotations?.destructiveHint, false, `${tool.name} must be non-destructive`);
  }

  const coreTool = listed.tools.find((tool) => tool.name === "get_core_skill");
  assert.ok(coreTool, "get_core_skill must be listed");
  assert.match(coreTool.description, /start of a task|context reset/i);
  assert.doesNotMatch(coreTool.description, /loaded on every message/i);

  const classifyTool = listed.tools.find((tool) => tool.name === "classify_task");
  assert.ok(classifyTool, "classify_task must be listed");
  assert.match(classifyTool.description, /returns JSON/i);
  assert.match(classifyTool.description, /matched_signals/i);
  assert.match(classifyTool.description, /routing/i);

  const versionTool = listed.tools.find((tool) => tool.name === "get_version");
  assert.ok(versionTool, "get_version must be listed");
  assert.match(versionTool.description, /returns JSON/i);
  assert.match(versionTool.description, /verify which GodPrompt content\/server version/i);
  assert.match(versionTool.description, /content retrieval tools/i);

  const core = await request(child, pending, 3, "tools/call", {
    name: "get_core_skill",
    arguments: {},
  });
  const coreText = toolText(core);
  assert.match(coreText, /references\/01-PROTOCOLS\.md/);
  assert.match(coreText, /references\/02-GATES\.md/);
  assert.match(coreText, /references\/03-ANTI-PATTERNS\.md/);
  assert.doesNotMatch(coreText, /core\/01-PROTOCOLS\.md/);
  assert.doesNotMatch(coreText, /core\/02-GATES\.md/);
  assert.doesNotMatch(coreText, /core\/03-ANTI-PATTERNS\.md/);

  const planClassification = await request(child, pending, 4, "tools/call", {
    name: "classify_task",
    arguments: { description: "Plan the project rollout" },
  });
  const planResult = JSON.parse(toolText(planClassification));
  assert.equal(planResult.task_type, "PLAN");

  const clearCases = [
    ["build a REST API for user auth", "BUILD"],
    ["fix the login bug", "DEBUG"],
    ["troubleshoot intermittent login failures", "DEBUG"],
    ["diagnose unexpected startup behavior", "DEBUG"],
    ["refactor payment processing without behavior changes", "REFACTOR"],
    ["documentation for the authentication API", "CONTENT"],
    ["design the settings screen", "DESIGN"],
    ["deploy payment service to production", "SHIP"],
    ["audit database indexes", "ANALYZE"],
    ["verify the endpoint response", "ANALYZE"],
    ["validate cache headers", "ANALYZE"],
    ["test API response behavior", "ANALYZE"],
    ["automate nightly backups", "AUTOMATE"],
    ["plan the database migration", "PLAN"],
  ];
  for (const [description, expected] of clearCases) {
    const result = await classify(
      child,
      pending,
      `clear-${expected}`,
      description
    );
    assert.equal(result.task_type, expected, description);
    assert.equal(result.ambiguous, false, description);
    assert.ok(parseInt(result.confidence, 10) >= 70, description);
    assert.ok(result.matched_signals.length > 0, description);
  }

  const negatedShipCases = [
    ["audit the authentication code but do not deploy it", "ANALYZE"],
    ["fix login validation, never publish or ship it", "DEBUG"],
    ["review the checkout checklist without push or merge", "ANALYZE"],
    ["deploy the approved change but do not publish a release", "SHIP"],
    ["Don\u2019t deploy the endpoint; audit it instead", "ANALYZE"],
    ["Don\u2019t deploy the old release; deploy the approved patch instead", "SHIP"],
  ];
  for (const [description, expected] of negatedShipCases) {
    const result = await classify(child, pending, `negated-ship-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
    if (expected !== "SHIP") {
      assert.ok(!result.matched_signals.includes("deploy"), description);
    }
  }

  const standaloneNotCases = [
    ["Not deploy this change", "UNCLASSIFIED"],
    ["Not deploy or publish any release", "UNCLASSIFIED"],
    ["Not deploy this change; review the diff instead", "ANALYZE"],
    ["Not build anything; inspect existing behavior", "ANALYZE"],
    ["Not fix the login bug; inspect logs first", "ANALYZE"],
    ["Not deploy the old patch; deploy the approved hotfix instead", "SHIP"],
  ];
  for (const [description, expected] of standaloneNotCases) {
    const result = await classify(child, pending, `standalone-not-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
  }

  const affirmativeNotOnlyCases = [
    ["Not only deploy this release", "SHIP"],
    ["Please not just ship it", "SHIP"],
    ["Do not just deploy the approved release", "SHIP"],
    ["Don't only deploy the approved release", "SHIP"],
    ["Not only build the requested API", "BUILD"],
    ["Not just fix the failing login", "DEBUG"],
  ];
  for (const [description, expected] of affirmativeNotOnlyCases) {
    const result = await classify(child, pending, `affirmative-not-only-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
  }

  const negatedBuildCases = [
    ["Do not implement or build anything. Review this existing module only.", "ANALYZE"],
    ["Do not create a new feature; inspect the current behavior instead.", "ANALYZE"],
    ["Do not build the old interface; build a new API instead.", "BUILD"],
    ["Don\u2019t build a new feature; inspect existing logic.", "ANALYZE"],
  ];
  for (const [description, expected] of negatedBuildCases) {
    const result = await classify(child, pending, `negated-build-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
    assert.equal(result.ambiguous, false, description);
  }

  const negatedDebugCases = [
    ["Do not fix the bug. Review the existing code only.", "ANALYZE"],
    ["Never debug the issue; inspect the current behavior instead.", "ANALYZE"],
    ["Do not fix the old bug; fix the current crash instead.", "DEBUG"],
    ["Don\u2019t fix this issue; inspect the logs instead.", "ANALYZE"],
  ];
  for (const [description, expected] of negatedDebugCases) {
    const result = await classify(child, pending, `negated-debug-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
  }

  const inspectionIntentCases = [
    ["Review the feature flag permissions before making changes", "ANALYZE"],
    ["Audit the open bug reports and summarize findings", "ANALYZE"],
    ["Inspect the error logs for a root cause", "ANALYZE"],
    ["Audit the CI pipeline configuration", "ANALYZE"],
    ["Review the cron workflow setup", "ANALYZE"],
    ["Audit and automate the CI pipeline", "AUTOMATE"],
    ["Build a CI pipeline and verify the result", "AUTOMATE"],
    ["Build a new feature flag system and review it", "BUILD"],
    ["Fix the login bug and verify the result", "DEBUG"],
  ];
  for (const [description, expected] of inspectionIntentCases) {
    const result = await classify(child, pending, `inspection-intent-${description.length}`, description);
    assert.equal(result.task_type, expected, description);
    assert.equal(result.ambiguous, false, description);
  }

  const specificityCases = [
    ["create documentation for the API", "CONTENT"],
    ["make docs for the login flow", "CONTENT"],
    ["design system for our app", "PLAN"],
    ["create content for the onboarding page", "CONTENT"],
    ["draft a customer-facing explanation", "CONTENT"],
    ["debug the authentication handler", "DEBUG"],
    ["debugging a crash in production", "DEBUG"],
  ];
  for (const [description, expected] of specificityCases) {
    const result = await classify(
      child,
      pending,
      `specific-${expected}-${description.length}`,
      description
    );
    assert.equal(result.task_type, expected, description);
    assert.equal(result.ambiguous, false, description);
  }

  const ambiguityCases = [
    ["build and fix authentication", ["BUILD", "DEBUG"]],
    ["review and refactor checkout", ["ANALYZE", "REFACTOR"]],
  ];
  for (const [description, expectedTypes] of ambiguityCases) {
    const result = await classify(
      child,
      pending,
      `ambiguous-${description.length}`,
      description
    );
    assert.equal(result.ambiguous, true, description);
    assert.ok(expectedTypes.includes(result.task_type), description);
    assert.ok(
      expectedTypes.some((type) => result.alternative_task_types.includes(type)),
      description
    );
    assert.ok(parseInt(result.confidence, 10) < 50, description);
  }

  const invalidCases = [
    [{ description: "   " }, /at least 3 characters/i],
    [{ description: "!!!" }, /letter or number/i],
    [{ description: "ab" }, /at least 3 characters/i],
    [{ description: "a".repeat(1001) }, /at most 1000 characters/i],
    [{}, /description/i],
    [{ description: 42 }, /string/i],
  ];
  for (let index = 0; index < invalidCases.length; index++) {
    const [arguments_, pattern] = invalidCases[index];
    const result = await request(child, pending, `invalid-${index}`, "tools/call", {
      name: "classify_task",
      arguments: arguments_,
    });
    assert.equal(result.isError, true);
    assert.match(toolText(result), pattern);
  }

  const exactLimit = await classify(
    child,
    pending,
    "exact-limit",
    "a".repeat(1000)
  );
  assert.equal(exactLimit.task_type, "UNCLASSIFIED");
  assert.equal(exactLimit.confidence, "0%");

  const unicodeNoMatch = await classify(
    child,
    pending,
    "unicode-no-match",
    "修复登录错误并验证回归测试"
  );
  assert.equal(unicodeNoMatch.task_type, "UNCLASSIFIED");
  assert.equal(unicodeNoMatch.confidence, "0%");
  assert.deepEqual(unicodeNoMatch.matched_signals, []);

  for (const [index, description] of [
    "debugger tooling",
    "shipment tracker",
    "featureless module",
  ].entries()) {
    const result = await classify(
      child,
      pending,
      `boundary-${index}`,
      description
    );
    assert.equal(result.task_type, "UNCLASSIFIED", description);
  }

  const deterministicResults = [];
  for (let index = 0; index < 20; index++) {
    deterministicResults.push(
      await classify(
        child,
        pending,
        `determinism-${index}`,
        "create documentation for the API"
      )
    );
  }
  assert.equal(
    new Set(deterministicResults.map((result) => JSON.stringify(result))).size,
    1
  );

  const versionResult = await request(child, pending, 5, "tools/call", {
    name: "get_version",
    arguments: {},
  });
  const version = JSON.parse(toolText(versionResult));
  assert.equal(version.server_version, packageJson.version);
  assert.equal(typeof version.version, "string");
  assert.ok(version.version.length > 0);
  assert.ok(version.files["SKILL.md"]);
  assert.match(version.files["SKILL.md"], /load when relevant/i);
  assert.doesNotMatch(version.files["SKILL.md"], /always-on/i);
  assert.ok(version.files["references/01-PROTOCOLS.md"]);
  assert.ok(version.files["references/02-GATES.md"]);
  assert.ok(version.files["references/03-ANTI-PATTERNS.md"]);
  assert.equal(version.files["core/00-THE-SKILL.md"], undefined);

  const { default: worker } = await import(`../dist/index.js?smoke=${Date.now()}`);
  const workerInitialize = new Request("https://example.test/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "god-prompt-worker-test", version: "1.0.0" },
      },
    }),
  });
  const workerResponse = await worker.fetch(workerInitialize, {}, {});
  assert.equal(workerResponse.status, 200);
  const workerInitializeText = await workerResponse.text();
  assert.match(workerInitializeText, /god-prompt-mcp/);
  assert.match(workerInitializeText, /Start with get_core_skill/i);
  assert.match(workerInitializeText, /All GodPrompt tools are read-only/i);

  const workerModernDiscover = new Request("https://example.test/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-method": "server/discover",
      "mcp-protocol-version": "2026-07-28",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "worker-modern-discover",
      method: "server/discover",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "god-prompt-modern-worker-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
  const workerModernResponse = await worker.fetch(workerModernDiscover, {}, {});
  assert.equal(workerModernResponse.status, 200);
  const workerModern = await workerModernResponse.json();
  assert.deepEqual(workerModern.result?.supportedVersions, ["2026-07-28"]);
  assert.equal(
    workerModern.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name,
    "god-prompt-mcp"
  );
  assert.equal(
    workerModern.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.version,
    packageJson.version
  );
  assert.match(workerModern.result?.instructions, /Start with get_core_skill/i);
  assert.match(workerModern.result?.instructions, /classify_task/i);
  assert.match(workerModern.result?.instructions, /All GodPrompt tools are read-only/i);

  const wrongPathResponse = await worker.fetch(
    new Request("https://example.test/not-mcp", { method: "GET" }),
    {},
    {}
  );
  assert.equal(wrongPathResponse.status, 404);

  assert.equal(protocolError, null, `Non-JSON output on stdout: ${protocolError}`);
});

test("serves the MCP 2026-07-28 era over stdio", async (t) => {
  const child = spawn(process.execPath, ["dist/stdio.js"], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  t.after(() => child.kill());

  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const pending = new Map();
  let protocolError = null;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(message.id)) {
        const waiter = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          waiter.reject(new Error(JSON.stringify(message.error)));
        } else {
          waiter.resolve(message.result);
        }
      }
    } catch (error) {
      protocolError = error;
    }
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      for (const waiter of pending.values()) {
        waiter.reject(
          new Error(`stdio server exited with code ${code}\nstderr:\n${stderr}`)
        );
      }
      pending.clear();
    }
  });

  const requestMeta = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientInfo": {
      name: "god-prompt-modern-stdio-test",
      version: "1.0.0",
    },
    "io.modelcontextprotocol/clientCapabilities": {},
  };

  const discovered = await request(
    child,
    pending,
    "modern-discover",
    "server/discover",
    { _meta: requestMeta }
  );
  assert.deepEqual(discovered.supportedVersions, ["2026-07-28"]);
  assert.equal(
    discovered._meta?.["io.modelcontextprotocol/serverInfo"]?.name,
    "god-prompt-mcp"
  );
  assert.equal(
    discovered._meta?.["io.modelcontextprotocol/serverInfo"]?.version,
    packageJson.version
  );
  assert.match(discovered.instructions, /Start with get_core_skill/i);
  assert.match(discovered.instructions, /classify_task/i);
  assert.match(discovered.instructions, /All GodPrompt tools are read-only/i);

  const listed = await request(child, pending, "modern-tools", "tools/list", {
    _meta: requestMeta,
  });
  assert.deepEqual(
    listed.tools.map((tool) => tool.name).sort(),
    EXPECTED_TOOLS
  );
  assert.equal(protocolError, null, `Non-JSON output on stdout: ${protocolError}`);
});
