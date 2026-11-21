/** Deterministic local stdio routing benchmark; no models, network, or file writes. */
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const FIXTURE_NAMES = new Set(["cases", "holdout", "forward"]);
const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(p * sorted.length) - 1] * 1000) / 1000;
};

export async function evaluate({ repeats = 1, concurrency = 4, dataset = "cases",
  mutate = false, negative = false } = {}) {
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10 ||
      !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4 ||
      !FIXTURE_NAMES.has(dataset)) {
    throw new Error("repeats 1..10, concurrency 1..4, dataset cases|holdout|forward required");
  }
  if (typeof mutate !== "boolean" || typeof negative !== "boolean") {
    throw new Error("mutate and negative must be boolean");
  }
  const fixture = JSON.parse(await readFile(
    new URL("./" + dataset + ".json", import.meta.url), "utf8"));
  if (fixture.schema !== "godprompt.classifier.evaluation.v1" ||
      !Array.isArray(fixture.cases) || fixture.cases.length < 40) {
    throw new Error("Missing pinned classifier fixture");
  }
  const ids = new Set();
  for (const entry of fixture.cases) {
    if (typeof entry.description !== "string" || entry.description.length > 1000 ||
        !/^[A-Z][0-9]{2}$/.test(entry.id) || ids.has(entry.id)) {
      throw new Error("Invalid classifier fixture identity");
    }
    ids.add(entry.id);
  }
  const child = spawn(process.execPath, ["dist/stdio.js"], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  const pending = new Map();
  let sequence = 0;
  let stderr = "", exited = false, protocolErrors = 0;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (piece) => { stderr = (stderr + piece).slice(-4096); });
  child.on("exit", (code) => {
    exited = true;
    for (const waiter of pending.values()) {
      waiter.reject(new Error("MCP child exited with " + code));
    }
    pending.clear();
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const msg = JSON.parse(line);
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error)));
        else waiter.resolve(msg.result);
      }
    } catch {
      protocolErrors++;
    }
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    if (exited) return reject(new Error("MCP child is no longer running"));
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out: " + method));
    }, 15000);
    pending.set(id, {
      resolve: (value) => { clearTimeout(timer); resolve(value); },
      reject: (error) => { clearTimeout(timer); reject(error); },
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  try {
    const hello = await request("initialize", {
      protocolVersion: "2025-03-26", capabilities: {},
      clientInfo: { name: "godprompt-classifier-benchmark", version: "1.0.0" },
    });
    child.stdin.write(JSON.stringify({
      jsonrpc: "2.0", method: "notifications/initialized", params: {},
    }) + "\n");
    if (hello.serverInfo?.name !== "god-prompt-mcp") {
      throw new Error("Unexpected MCP identity");
    }

    const records = [];
    const transformations = mutate ? [
      ["original", (text) => text],
      ["upper", (text) => text.toUpperCase()],
      ["whitespace", (text) => "  " + text.replaceAll(" ", " \t  ") + "  "],
      ["suffix", (text) => text + " !"],
    ] : [["original", (text) => text]];
    const tasks = Array.from({ length: repeats }, (_, round) =>
      fixture.cases.flatMap((entry) => transformations.map(([variant, transform]) =>
        ({ ...entry, round, variant, description: transform(entry.description) })))).flat();
    let cursor = 0;
    const work = async () => {
      while (cursor < tasks.length) {
        const item = tasks[cursor++];
        const started = performance.now();
        const result = await request("tools/call", {
          name: "classify_task",
          arguments: { description: item.description },
        });
        const latency_ms = performance.now() - started;
        const text = result?.content?.find((entry) => entry.type === "text")?.text;
        if (result?.isError || typeof text !== "string") {
          throw new Error("MCP classify_task returned an error for " + item.id);
        }
        const parsed = JSON.parse(text);
        records.push({
          id: item.id, round: item.round, variant: item.variant, expected: item.expected,
          actual: parsed.task_type, confidence: parsed.confidence,
          ambiguous: parsed.ambiguous,
          matched_signals: parsed.matched_signals,
          semantic: JSON.stringify([parsed.task_type, parsed.confidence, parsed.ambiguous,
            parsed.matched_signals, parsed.alternative_task_types]),
          latency_ms, bytes: Buffer.byteLength(text, "utf8"),
          correct: parsed.task_type === item.expected,
        });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, work));
    const failures = records.filter((record) => !record.correct);
    const inconsistent = fixture.cases.filter(({ id }) =>
      new Set(records.filter((r) => r.id === id).map((r) => r.semantic)).size > 1);
    const ambiguous = [...new Set(records.filter((r) => r.ambiguous).map((r) => r.id))];
    const canary = "GODPROMPT-NEGATIVE-CANARY-Z7M92";
    const malformed = [undefined, null, 0, true, [], {}, "", "  ", "a", "ab",
      canary + "z".repeat(1050)];
    let rejected = 0, canaryEchoed = false;
    if (negative) {
      for (const description of malformed) {
        try {
          const result = await request("tools/call", {
            name: "classify_task", arguments: { description },
          });
          if (result?.isError === true) rejected++;
          if (JSON.stringify(result).includes(canary)) canaryEchoed = true;
        } catch {
          rejected++;
        }
      }
    }
    return {
      status: "LOCAL_CLASSIFIER_ONLY",
      dataset,
      server_version: hello.serverInfo.version,
      cases: fixture.cases.length,
      requests: records.length,
      variants: transformations.length,
      correct: records.length - failures.length,
      accuracy_percent: Math.round(10000 * (1 - failures.length / records.length)) / 100,
      failure_examples: failures.filter((v) => v.round === 0)
        .map(({ id, expected, actual, matched_signals, ambiguous }) =>
          ({ id, expected, actual, matched_signals, ambiguous })),
      inconsistent_cases: inconsistent.map((entry) => entry.id),
      ambiguous_cases: ambiguous,
      p50_ms: percentile(records.map((r) => r.latency_ms), 0.5),
      p95_ms: percentile(records.map((r) => r.latency_ms), 0.95),
      p50_response_bytes: percentile(records.map((r) => r.bytes), 0.5),
      p95_response_bytes: percentile(records.map((r) => r.bytes), 0.95),
      protocol_errors: protocolErrors,
      malformed_rejected: negative ? rejected : null,
      malformed_total: negative ? malformed.length : null,
      canary_echoed: negative ? canaryEchoed : null,
      stderr_empty: stderr.length === 0,
      caveat: "Deterministic hand-labeled task routing only; not a coding-agent accuracy or productivity metric.",
    };
  } finally {
    if (!exited) child.kill();
    lines.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const repeats = Number(process.argv[2] ?? "1");
  const concurrency = Number(process.argv[3] ?? "4");
  try {
    console.log(JSON.stringify(await evaluate({
      repeats, concurrency, dataset: process.argv[4] ?? "cases",
      mutate: process.argv.includes("--mutate"),
      negative: process.argv.includes("--negative"),
    }), null, 2));
  } catch (error) {
    console.error(String(error?.stack ?? error));
    process.exitCode = 1;
  }
}
