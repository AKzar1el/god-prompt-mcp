import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { analyzeRetrospective } from "../benchmarks/agent-ab/real-repos/retrospective-analysis.mjs";

const input = JSON.parse(await readFile(
  new URL("../benchmarks/agent-ab/real-repos/retrospective-four-pairs-20261121.json", import.meta.url),
  "utf8",
));

test("retrospective pairs reproduce the original four measured trial totals exactly", () => {
  const report = analyzeRetrospective(input);
  assert.equal(report.status, "EXPLORATORY_NOT_PROVEN");
  assert.equal(report.sample.paired_tasks, 4);
  assert.equal(report.sample.independent_repositories, 3);
  assert.equal(report.sample.full_hidden_checks_baseline, 59);
  assert.equal(report.sample.full_hidden_checks_candidate, 59);
  assert.equal(report.runtime_seconds.baseline_total, 1149);
  assert.equal(report.runtime_seconds.godprompt_total, 1044);
  assert.equal(report.reported_tokens.baseline_total, 1809589);
  assert.equal(report.reported_tokens.godprompt_total, 2374401);
});

test("observed time gain is uncertain and does not support a productivity claim", () => {
  const report = analyzeRetrospective(input);
  const runtime = report.runtime_seconds;
  assert.ok(runtime.candidate_relative_change < -0.09 && runtime.candidate_relative_change > -0.092);
  assert.equal(runtime.candidate_faster_tasks, 2);
  assert.equal(runtime.candidate_slower_tasks, 2);
  assert.equal(runtime.exploratory_exact_signflip_p_by_task, 0.75);
  assert.equal(runtime.exploratory_exact_signflip_p_by_repo_cluster, 0.75);
  assert.equal(runtime.descriptive_paired_resampling.resamples, 256);
  assert.ok(runtime.descriptive_paired_resampling.lower_2_5_percentile < 0);
  assert.ok(runtime.descriptive_paired_resampling.upper_97_5_percentile > 0);
  assert.equal(report.causal_productivity_proven, false);
});

test("reported tokens increased and one post-hoc compatibility regression remains visible", () => {
  const report = analyzeRetrospective(input);
  assert.ok(report.reported_tokens.candidate_relative_change > 0.31);
  assert.equal(report.reported_tokens.candidate_more_tokens_tasks, 3);
  assert.equal(report.sample.posthoc_candidate_compat_regressions, 1);
  assert.equal(report.causal_productivity_proven, false);
});

test("tampered observation identities and nonretrospective provenance fail closed", () => {
  const modified = structuredClone(input);
  modified.tasks[1].id = modified.tasks[0].id;
  assert.throws(() => analyzeRetrospective(modified), /Invalid or duplicate/);
  const data = structuredClone(input);
  data.tasks[0].candidate_seconds = -1;
  assert.throws(() => analyzeRetrospective(data), /Invalid or duplicate/);
  const renamed = structuredClone(input);
  renamed.origin = "NEW_HOLDOUT_SUCCESS";
  assert.throws(() => analyzeRetrospective(renamed), /retrospective/);
});
