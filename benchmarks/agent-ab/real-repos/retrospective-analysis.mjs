#!/usr/bin/env node
/** Exploratory analysis of four already-completed real agent pairs. No AI calls. */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

function sum(items) { return items.reduce((a, b) => a + b, 0); }
function relative(candidate, baseline) { return candidate / baseline - 1; }

function exactSignFlipP(deltas) {
  // Valid as a randomization-style diagnostic only under sign-exchangeability.
  if (deltas.length > 20 || !deltas.length) throw new Error("Invalid exact-test size");
  const actual = Math.abs(sum(deltas));
  let atLeastAsExtreme = 0;
  const trials = 2 ** deltas.length;
  for (let mask = 0; mask < trials; mask++) {
    let total = 0;
    for (let i = 0; i < deltas.length; i++) {
      total += (mask & (1 << i)) ? deltas[i] : -deltas[i];
    }
    if (Math.abs(total) >= actual - 1e-9) atLeastAsExtreme++;
  }
  return atLeastAsExtreme / trials;
}

function quantile(sorted, q) {
  const position = (sorted.length - 1) * q;
  const lo = Math.floor(position), hi = Math.ceil(position);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (position - lo);
}

function exhaustiveResamplingRange(tasks, baselineKey, candidateKey) {
  // Exact enumeration over 4^4 possible paired task resamples, not a
  // confidence interval for all software-engineering tasks.
  const n = tasks.length;
  if (n > 7) return null;
  const ratios = [];
  const count = n ** n;
  for (let draw = 0; draw < count; draw++) {
    let v = draw, baseline = 0, candidate = 0;
    for (let i = 0; i < n; i++) {
      const task = tasks[v % n];
      v = Math.floor(v / n);
      baseline += task[baselineKey];
      candidate += task[candidateKey];
    }
    ratios.push(relative(candidate, baseline));
  }
  ratios.sort((a, b) => a - b);
  return { lower_2_5_percentile: quantile(ratios, 0.025),
    upper_97_5_percentile: quantile(ratios, 0.975), resamples: count };
}

export function analyzeRetrospective(raw) {
  if (raw?.schema !== "godprompt.retrospective-real-agent-pairs.v1" ||
      !Array.isArray(raw.tasks) || raw.tasks.length < 2 || raw.tasks.length > 20 ||
      !String(raw.origin).includes("NOT_A_NEW_HOLDOUT")) {
    throw new Error("Not the explicitly labeled retrospective benchmark dataset");
  }
  const ids = new Set();
  for (const t of raw.tasks) {
    if (typeof t.id !== "string" || ids.has(t.id) ||
        !/^AKzar1el\/[a-zA-Z0-9_.-]+$/.test(t.repo) ||
        !["baseline_seconds", "candidate_seconds", "baseline_tokens", "candidate_tokens",
          "baseline_hidden", "candidate_hidden"].every(key =>
          Number.isSafeInteger(t[key]) && t[key] >= 0) ||
        t.baseline_seconds === 0 || t.candidate_seconds === 0 ||
        typeof t.posthoc_candidate_compat_regression !== "boolean") {
      throw new Error("Invalid or duplicate paired observation");
    }
    ids.add(t.id);
  }
  const tasks = raw.tasks;
  const baselineSeconds = sum(tasks.map(t => t.baseline_seconds));
  const candidateSeconds = sum(tasks.map(t => t.candidate_seconds));
  const baselineTokens = sum(tasks.map(t => t.baseline_tokens));
  const candidateTokens = sum(tasks.map(t => t.candidate_tokens));
  const baselineHidden = sum(tasks.map(t => t.baseline_hidden));
  const candidateHidden = sum(tasks.map(t => t.candidate_hidden));
  const secondsDeltas = tasks.map(t => t.candidate_seconds - t.baseline_seconds);
  const tokensDeltas = tasks.map(t => t.candidate_tokens - t.baseline_tokens);
  const repoClusters = new Map();
  for (const t of tasks) {
    repoClusters.set(t.repo, (repoClusters.get(t.repo) ?? 0) +
      (t.candidate_seconds - t.baseline_seconds));
  }
  return {
    schema: "godprompt.retrospective-paired-analysis.v1",
    status: "EXPLORATORY_NOT_PROVEN",
    sample: { paired_tasks: tasks.length, independent_repositories: repoClusters.size,
      full_hidden_checks_baseline: baselineHidden, full_hidden_checks_candidate: candidateHidden,
      posthoc_candidate_compat_regressions: tasks.filter(t => t.posthoc_candidate_compat_regression).length },
    runtime_seconds: { baseline_total: baselineSeconds, godprompt_total: candidateSeconds,
      candidate_relative_change: relative(candidateSeconds, baselineSeconds),
      candidate_faster_tasks: secondsDeltas.filter(x => x < 0).length,
      candidate_slower_tasks: secondsDeltas.filter(x => x > 0).length,
      exploratory_exact_signflip_p_by_task: exactSignFlipP(secondsDeltas),
      exploratory_exact_signflip_p_by_repo_cluster: exactSignFlipP([...repoClusters.values()]),
      descriptive_paired_resampling: exhaustiveResamplingRange(tasks, "baseline_seconds", "candidate_seconds") },
    reported_tokens: { baseline_total: baselineTokens, godprompt_total: candidateTokens,
      candidate_relative_change: relative(candidateTokens, baselineTokens),
      candidate_more_tokens_tasks: tokensDeltas.filter(x => x > 0).length,
      descriptive_paired_resampling: exhaustiveResamplingRange(tasks, "baseline_tokens", "candidate_tokens") },
    causal_productivity_proven: false,
    limitations: [
      "Only four purposively chosen tasks from three repositories; two share a source repository.",
      "Candidate used extra pre-session GodPrompt context, not dynamic in-session MCP calls.",
      "One candidate had a post-hoc behavioral compatibility regression missed by frozen grading.",
      "Reported token counts are not provider invoices or normalized cost.",
      "Exploratory sign-flip tests assume exchangeable signs; descriptive resampling is not population inference.",
      "Retrospective observations were transcribed from the prior reports; source raw receipts remain local ignored.",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const raw = JSON.parse(await readFile(new URL("./retrospective-four-pairs-20261121.json", import.meta.url), "utf8"));
  console.log(JSON.stringify(analyzeRetrospective(raw), null, 2));
}
