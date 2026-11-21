#!/usr/bin/env node
/**
 * Call the exact locally built GodPrompt stdio MCP, without reloading the live
 * Codexify source or invoking a paid provider. Use only in candidate arms.
 */
import { readFile } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(HERE, "../../..");
const PINNED_GODPROMPT_CODE_COMMIT =
  "ea72ac09e20b83c86d1b568533dd08e68341ba89";
const taskId = process.argv[2];
const suite = JSON.parse(await readFile(join(HERE, "suite.json"), "utf8"));
const task = suite.tasks.find(t => t.task_id === taskId);
if (!task) throw new Error("Provide a valid pinned task ID");
// The experiment controller lives on a separate stacked branch, but the
// candidate's actual protocol/source code must remain identical to PR #242.
const check = execFileSync("git", [
  "diff", "--name-only", PINNED_GODPROMPT_CODE_COMMIT, "--",
  "src", "package.json", "package-lock.json", "skills", "references", "core",
], { cwd: projectRoot, encoding: "utf8", windowsHide: true, timeout: 10000 }).trim();
if (check) throw new Error("The GodPrompt implementation changed from the pinned candidate");
const child = spawn(process.execPath, [join(projectRoot, "dist/stdio.js")], {
  cwd: projectRoot, stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
});
let id = 0, stderr = "", closed = false;
const pending = new Map();
const lineReader = createInterface({ input: child.stdout });
lineReader.on("line", line => {
  try {
    const msg = JSON.parse(line);
    if (!pending.has(msg.id)) return;
    const waiter = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(waiter.timer);
    if (msg.error) waiter.reject(new Error("MCP error: " + JSON.stringify(msg.error)));
    else waiter.resolve(msg.result);
  } catch { /* Only valid responses with expected IDs are accepted. */ }
});
child.stderr.setEncoding("utf8");
child.stderr.on("data", piece => { stderr = (stderr + piece).slice(-500); });
child.on("exit", code => {
  closed = true;
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error("MCP exited " + code)); }
  pending.clear();
});
function request(method, params = {}) {
  return new Promise((resolveResult, reject) => {
    if (closed) return reject(new Error("MCP process unavailable"));
    const next = ++id;
    // Cold Windows process launches can lag behind active Codexify workers;
    // reject explicitly rather than claiming a tool call succeeded.
    const timer = setTimeout(() => {
      pending.delete(next);
      reject(new Error("Timed out waiting for " + method));
    }, method === "initialize" ? 90000 : 30000);
    pending.set(next, { resolve: resolveResult, reject, timer });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: next, method, params }) + "\n");
  });
}
function parseTool(result) {
  if (result?.isError) throw new Error("GodPrompt tool failed");
  const text = result?.content?.find(entry => entry.type === "text")?.text;
  if (!text || text.length > 100000) throw new Error("Missing or oversized tool output");
  return JSON.parse(text);
}
try {
  const initialized = await request("initialize", {
    protocolVersion: "2025-03-26", capabilities: {},
    clientInfo: { name: "godprompt-real-repo-ab-candidate", version: "1.0.0" },
  });
  if (initialized?.serverInfo?.name !== "god-prompt-mcp") throw new Error("Unexpected MCP server identity");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} }) + "\n");
  const tool = async (name, args = {}) => parseTool(await request("tools/call", {
    name, arguments: args,
  }));
  const version = await tool("get_version");
  const route = await tool("classify_task", { description: task.description });
  const selectedType = route.task_type;
  if (!["BUILD", "DEBUG", "REFACTOR", "ANALYZE", "PLAN", "DESIGN", "CONTENT", "AUTOMATE", "SHIP"].includes(selectedType)) {
    throw new Error("Unclassified or invalid GodPrompt route");
  }
  const executionGuidance = await tool("get_tailored_guidance", {
    task_type: selectedType, phase: "execute", max_chars: 1800,
  });
  const verificationGuidance = await tool("get_tailored_guidance", {
    task_type: selectedType, phase: "verify", max_chars: 1800,
  });
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: projectRoot, encoding: "utf8", windowsHide: true, timeout: 10000,
  }).trim();
  const runtimeDigests = {};
  for (const file of ["dist/stdio.js", "dist/server.js"]) {
    runtimeDigests[file] = createHash("sha256").update(
      await readFile(join(projectRoot, file))).digest("hex");
  }
  const output = {
    status: "ACTUAL_LOCAL_MCP_STDIO_USED", source_commit: sourceCommit,
    pinned_godprompt_code_commit: PINNED_GODPROMPT_CODE_COMMIT,
    runtime_sha256: runtimeDigests,
    task_id: taskId, server: initialized.serverInfo,
    version, route, execution_guidance: executionGuidance,
    verification_guidance: verificationGuidance,
    model_or_agent_invoked_by_this_script: false,
    paid_provider_calls: 0,
  };
  output.receipt_sha256 = createHash("sha256").update(JSON.stringify(output)).digest("hex");
  console.log(JSON.stringify(output, null, 2));
  if (stderr) {
    console.error("MCP emitted nonempty stderr; inspect without dumping sensitive content");
    process.exitCode = 1;
  }
} finally {
  child.kill();
  lineReader.close();
}
