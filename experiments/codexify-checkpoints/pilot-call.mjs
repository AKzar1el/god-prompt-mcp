#!/usr/bin/env node
/** One-shot offline Codexify -> local checkpoint MCP integration caller. */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { readSmallJson } from "../../bin/godprompt-proof.mjs";

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== "--input") {
    throw new Error("Usage: node experiments/codexify-checkpoints/pilot-call.mjs --input private-checkpoint.json");
  }
  const input = await readSmallJson(process.argv[3]);
  const script = fileURLToPath(new URL("./mcp-stdio.mjs", import.meta.url));
  const child = spawn(process.execPath, [script], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const queue = new Map();
  let id = 1;
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    let message;
    try { message = JSON.parse(line); }
    catch { for (const item of queue.values()) item.reject(new Error("Invalid JSON-RPC frame")); queue.clear(); return; }
    if (!Object.hasOwn(message, "id") || !queue.has(message.id)) return;
    const item = queue.get(message.id);
    queue.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error("MCP request failed: " + message.error.code));
    else item.resolve(message.result);
  });
  child.on("exit", () => {
    for (const item of queue.values()) item.reject(new Error("Checkpoint MCP exited before completing the request"));
    queue.clear();
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const number = id++;
    const timer = setTimeout(() => { queue.delete(number); reject(new Error("Checkpoint MCP response timed out")); }, 15000);
    queue.set(number, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: number, method, params }) + "\n");
  });
  try {
    const initialized = await request("initialize", {
      protocolVersion: "2026-07-28", capabilities: {},
      clientInfo: { name: "godprompt-checkpoint-pilot-client", version: "0.0.0-test" },
    });
    if (initialized.serverInfo?.name !== "godprompt-checkpoint-pilot") throw new Error("Unexpected MCP peer");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
    const catalog = await request("tools/list");
    if (!catalog.tools?.some((tool) => tool.name === "review_codexify_checkpoint")) {
      throw new Error("Checkpoint MCP tool not in catalog");
    }
    const result = await request("tools/call", { name: "review_codexify_checkpoint", arguments: input });
    if (result.isError) throw new Error("Checkpoint MCP rejected the input");
    const report = result.structuredContent || JSON.parse(result.content.find((item) => item.type === "text").text);
    if (report.schema !== "godprompt.codexify_checkpoint_preview.v1" || report.completion_authorized !== false) {
      throw new Error("Checkpoint report integrity mismatch");
    }
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } finally {
    child.stdin.end();
    // Kill ONLY the child process spawned by this one-shot local pilot.
    if (child.exitCode === null) child.kill();
  }
}

main().catch(() => {
  // Do not print user-supplied input or tool contents.
  process.stderr.write("GodPrompt checkpoint pilot failed; verify the input schema and local MCP availability.\n");
  process.exitCode = 1;
});