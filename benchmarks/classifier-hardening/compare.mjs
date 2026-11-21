/**
 * In-process A/B of deterministic GodPrompt classifier revisions.
 * Intentionally NOT a coding-agent experiment. No network, model calls, or writes.
 * Both classifiers run against the exact same examples in one Node process.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const PREVIOUS_SHA = "3e070c506b3a2a3ff25bf772c08a09714868bc91";
const datasets = ["cases", "holdout", "forward", "adversarial"];
const percentile = (items, p) => {
  const ordered = [...items].sort((a, b) => a - b);
  return Math.round(ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)] * 1000) / 1000;
};
function compileClassifier(source) {
  const start = source.indexOf("const TASK_TYPES =");
  const end = source.indexOf("export function registerGodPromptTools");
  if (start < 0 || end < start) throw new Error("Classifier region boundaries changed");
  const isolated = source.slice(start, end) + "\nexport const benchmarkClassifyTask = classifyTask;\n";
  const transpiled = ts.transpileModule(isolated, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  if (transpiled.diagnostics?.length) {
    throw new Error("Cannot transpile classifier slice: " + transpiled.diagnostics.length);
  }
  const module = { exports: {} };
  new Function("module", "exports", transpiled.outputText)(module, module.exports);
  assert.equal(typeof module.exports.benchmarkClassifyTask, "function");
  return module.exports.benchmarkClassifyTask;
}
const previousSource = execFileSync("git", ["show", PREVIOUS_SHA + ":src/server.ts"], {
  encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024,
});
const currentSource = await readFile(new URL("../../src/server.ts", import.meta.url), "utf8");
const previous = compileClassifier(previousSource);
const candidate = compileClassifier(currentSource);
const cases = [];
for (const name of datasets) {
  const fixture = JSON.parse(await readFile(new URL("./" + name + ".json", import.meta.url), "utf8"));
  if (fixture.cases.length < 40) throw new Error("Unexpectedly short test fixture: " + name);
  for (const entry of fixture.cases) cases.push({ ...entry, dataset: name });
}
const rounds = Number(process.argv[2] ?? "12");
if (!Number.isInteger(rounds) || rounds < 1 || rounds > 30) throw new Error("Rounds must be 1..30");

// Warm both implementations before sampling (JIT and regexp-cache population).
for (let i = 0; i < 3; i++) {
  for (const entry of cases) {
    previous(entry.description);
    candidate(entry.description);
  }
}
const samples = { previous: [], candidate: [] };
const mistakes = { previous: new Map(), candidate: new Map() };
const versions = { previous, candidate };
for (let round = 0; round < rounds; round++) {
  for (const entry of cases) {
    for (const arm of round % 2 === 0 ? ["previous", "candidate"] : ["candidate", "previous"]) {
      const t0 = performance.now();
      const result = versions[arm](entry.description);
      samples[arm].push(performance.now() - t0);
      if (result.type !== entry.expected && !mistakes[arm].has(entry.id)) {
        mistakes[arm].set(entry.id, { id: entry.id, dataset: entry.dataset, expected: entry.expected, actual: result.type });
      }
    }
  }
}
const summary = {
  status: "SAME_PROCESS_DETERMINISTIC_CLASSIFIER_COMPARISON",
  previous_sha: PREVIOUS_SHA,
  cases: cases.length,
  rounds,
  runs_per_arm: cases.length * rounds,
  previous: {
    correct: cases.length - mistakes.previous.size,
    first_mismatches: [...mistakes.previous.values()],
    p50_us: percentile(samples.previous, 0.5) * 1000,
    p95_us: percentile(samples.previous, 0.95) * 1000,
  },
  candidate: {
    correct: cases.length - mistakes.candidate.size,
    first_mismatches: [...mistakes.candidate.values()],
    p50_us: percentile(samples.candidate, 0.5) * 1000,
    p95_us: percentile(samples.candidate, 0.95) * 1000,
  },
  caveat: "Adversarial set used for refinement. Timing is local classifier CPU only, not an MCP or AI coding-agent speedup.",
};
console.log(JSON.stringify(summary, null, 2));
if (summary.candidate.correct < summary.previous.correct) process.exitCode = 1;
