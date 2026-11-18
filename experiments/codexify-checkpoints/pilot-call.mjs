#!/usr/bin/env node
/** One-shot offline Codexify -> isolated local checkpoint MCP client. */
import { spawn } from "node:child_process";
import { lstat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readSmallJson } from "../../bin/godprompt-proof.mjs";

const SAFE_CHILD_ENV = new Set([
  "systemroot", "windir", "temp", "tmp", "tmpdir", "path",
  "home", "userprofile", "lang", "lc_all", "node_disable_colors",
]);
const EXPECTED_STATUSES = new Set([
  "CONTINUE_WITH_PENDING_ITEMS", "RECHECK", "HOLD",
  "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
]);

function isolatedEnvironment() {
  // This MCP is pure Node and has no need for API credentials or startup hooks.
  return Object.fromEntries(Object.entries(process.env)
    .filter(([key]) => SAFE_CHILD_ENV.has(key.toLowerCase())));
}

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") {
    throw new Error("Usage: node experiments/codexify-checkpoints/pilot-call.mjs --input private-checkpoint.json");
  }
  const path = process.argv[3];
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024) {
    throw new Error("Checkpoint input must be a small regular file");
  }
  const input = await readSmallJson(path);
  const script = fileURLToPath(new URL("./mcp-stdio.mjs", import.meta.url));
  const child = spawn(process.execPath, [script], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: isolatedEnvironment(),
  });

  const queue = new Map();
  let id = 1;
  const rejectAll = (message) => {
    for (const item of queue.values()) {
      clearTimeout(item.timer);
      item.reject(new Error(message));
    }
    queue.clear();
  };
  const lines = createInterface({ input: child.stdout });
  // Drain stderr so a noisy MCP child cannot block on a full OS pipe.
  // Never echo stderr: it could contain unredacted input or credentials.
  child.stderr.on("data", () => {});
  child.on("error", () => rejectAll("Checkpoint MCP failed to start"));
  child.on("exit", () => rejectAll("Checkpoint MCP exited before completing the request"));
  child.stdin.on("error", () => rejectAll("Checkpoint MCP stdin closed"));

  lines.on("line", (line) => {
    if (Buffer.byteLength(line, "utf8") > 256 * 1024) {
      rejectAll("Oversized checkpoint MCP response");
      return;
    }
    let message;
    try { message = JSON.parse(line); }
    catch { rejectAll("Invalid JSON-RPC frame"); return; }
    if (!Object.hasOwn(message, "id") || !queue.has(message.id)) return;
    const item = queue.get(message.id);
    queue.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error("MCP request failed: " + message.error.code));
    else item.resolve(message.result);
  });

  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const number = id++;
    const timer = setTimeout(() => {
      queue.delete(number);
      reject(new Error("Checkpoint MCP response timed out"));
    }, 30000);
    queue.set(number, { resolve, reject, timer });
    try {
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: number, method, params }) + "\n");
    } catch {
      clearTimeout(timer);
      queue.delete(number);
      reject(new Error("Checkpoint MCP request write failed"));
    }
  });

  try {
    const initialized = await request("initialize", {
      protocolVersion: "2026-07-28", capabilities: {},
      clientInfo: { name: "godprompt-checkpoint-pilot-client", version: "0.0.0-test" },
    });
    if (initialized.serverInfo?.name !== "godprompt-checkpoint-pilot" ||
        initialized.serverInfo?.version !== "0.0.0-test") {
      throw new Error("Unexpected MCP peer");
    }
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0", method: "notifications/initialized",
    }) + "\n");
    const catalog = await request("tools/list");
    if (catalog.tools?.length !== 1 ||
        catalog.tools[0]?.name !== "review_codexify_checkpoint") {
      throw new Error("Unexpected checkpoint MCP tool inventory");
    }
    const result = await request("tools/call", {
      name: "review_codexify_checkpoint", arguments: input,
    });
    if (result.isError) throw new Error("Checkpoint MCP rejected the input");
    const report = result.structuredContent ??
      JSON.parse(result.content.find((item) => item.type === "text").text);
    if (report.schema !== "godprompt.codexify_checkpoint_preview.v1" ||
        !EXPECTED_STATUSES.has(report.status) ||
        report.completion_authorized !== false ||
        report.independently_verified !== false ||
        report.cloud_storage_preview?.completion_authorized !== false) {
      throw new Error("Checkpoint report integrity mismatch");
    }
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } finally {
    // Only this one-shot process is owned by the caller, never existing agents.
    child.stdin.end();
    if (child.exitCode === null && !child.killed) child.kill();
  }
}

main().catch(() => {
  // This is intentionally generic: no raw tool outputs or private paths.
  process.stderr.write("GodPrompt checkpoint pilot failed; verify the input schema and local MCP availability.\n");
  process.exitCode = 1;
});
