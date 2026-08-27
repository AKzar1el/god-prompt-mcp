import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const EXPECTED_TOOLS = [
  "classify_task",
  "get_anti_patterns",
  "get_core_skill",
  "get_gates",
  "get_god_prompt",
  "get_protocols",
  "get_version",
];

function request(child, pending, id, method, params = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for ${method}`));
    }, 5000);

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

test("builds a stdio MCP server exposing all GodPrompt tools", async (t) => {
  const build = spawnSync("npm", ["run", "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  assert.equal(
    build.status,
    0,
    `npm run build failed\nstdout:\n${build.stdout}\nstderr:\n${build.stderr}`
  );

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
  assert.equal(initialized.serverInfo.version, "1.0.0");

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
  assert.equal(protocolError, null, `Non-JSON output on stdout: ${protocolError}`);
});
