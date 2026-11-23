#!/usr/bin/env node
/**
 * Failure-aware, full-denominator reanalysis of frozen V6 and V7 public records.
 *
 * These records are retrospective. This script does not run an LLM, reconstruct
 * private hidden graders, infer bills, or establish a causal speed advantage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summariseV6 } from "./v6-verify-public.mjs";
import { verifyV7Public } from "./v7-verify-public.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const STATUSES = new Set(["VALID_CORRECT", "VALID_INCORRECT", "INVALID"]);
const load = (name) => JSON.parse(readFileSync(join(DIR, name), "utf8"));

function checkNumber(value, label, allowMissing) {
  if (value == null && allowMissing) return null;
  assert.ok(typeof value === "number" && Number.isFinite(value) && value >= 0,
    `${label} must be a finite nonnegative number`);
  return value;
}

function metric(rows, field, accepted, minimumPositive = false) {
  let known = 0;
  let missing = 0;
  for (const row of rows) {
    const value = row[field];
    if (value == null) {
      missing++;
      continue;
    }
    assert.ok(typeof value === "number" && Number.isFinite(value) &&
      (minimumPositive ? value > 0 : value >= 0), `Invalid metric ${field}`);
    known += value;
  }
  // Missing telemetry is never silently imputed as zero.
  const knownTotal = Number(known.toFixed(2));
  return {
    total: missing ? null : knownTotal,
    known_total: knownTotal,
    missing,
    per_accepted: accepted && !missing ? knownTotal / accepted : null,
    known_lower_bound_per_accepted: accepted ? knownTotal / accepted : null,
  };
}

export function scoreStudy(records, config) {
  const { study, taskIds, arms, timeoutSeconds, inputField, cacheField, outputField } = config;
  assert.ok(typeof study === "string" && study.length);
  assert.ok(Array.isArray(taskIds) && taskIds.length && new Set(taskIds).size === taskIds.length);
  assert.ok(Array.isArray(arms) && arms.length && new Set(arms).size === arms.length);
  assert.ok(Number.isFinite(timeoutSeconds) && timeoutSeconds > 0);
  assert.ok(Array.isArray(records));
  const tasks = new Set(taskIds);
  const treatments = new Set(arms);
  const seen = new Set();

  for (const record of records) {
    assert.ok(tasks.has(record.task_id), "Unknown frozen task");
    assert.ok(treatments.has(record.arm), "Unknown experiment arm");
    const key = JSON.stringify([record.task_id, record.arm]);
    assert.ok(!seen.has(key), `Duplicate task/arm: ${key}`);
    seen.add(key);
    assert.ok(STATUSES.has(record.status), "Unknown result status");
    assert.ok(Number.isInteger(record.hidden_total) && record.hidden_total > 0);
    assert.ok(Number.isInteger(record.hidden_passed) &&
      record.hidden_passed >= 0 && record.hidden_passed <= record.hidden_total);
    if (record.status === "VALID_CORRECT") {
      assert.equal(record.hidden_passed, record.hidden_total,
        "Accepted source must pass all recorded hidden checks");
    }
    if (record.status === "VALID_INCORRECT") {
      assert.ok(record.hidden_passed < record.hidden_total);
    }
    const invalid = record.status === "INVALID";
    const elapsed = checkNumber(record.elapsed_seconds, "elapsed_seconds", invalid);
    if (elapsed !== null) {
      assert.ok(elapsed > 0, "Elapsed time must be positive");
      if (!invalid) assert.ok(elapsed <= timeoutSeconds,
        "Valid result exceeded the frozen timeout");
    }
    const input = checkNumber(record[inputField], "input tokens", invalid);
    const cached = checkNumber(record[cacheField], "cached input tokens", invalid);
    const output = checkNumber(record[outputField], "output tokens", invalid);
    assert.ok((input === null && cached === null && output === null) ||
      (input !== null && cached !== null && output !== null),
    "Token telemetry must be complete or entirely missing on invalid arms");
    if (input !== null) assert.ok(cached <= input, "Cached input tokens exceed input tokens");
  }

  assert.equal(records.length, taskIds.length * arms.length, "Missing frozen arm record");
  for (const task of taskIds) for (const arm of arms) {
    assert.ok(seen.has(JSON.stringify([task, arm])), "Missing frozen task/arm pair");
  }

  const by_arm = {};
  for (const arm of arms) {
    const rows = records.filter((row) => row.arm === arm);
    const accepted = rows.filter((row) => row.status === "VALID_CORRECT").length;
    const invalid = rows.filter((row) => row.status === "INVALID").length;
    const incorrect = rows.filter((row) => row.status === "VALID_INCORRECT").length;
    by_arm[arm] = {
      attempted: rows.length,
      accepted,
      invalid,
      valid_incorrect: incorrect,
      acceptance_rate: accepted / rows.length,
      elapsed_seconds: metric(rows, "elapsed_seconds", accepted, true),
      input_tokens: metric(rows, inputField, accepted),
      output_tokens: metric(rows, outputField, accepted),
    };
  }
  return {
    study,
    attempts: records.length,
    tasks: taskIds.length,
    per_arm_timeout_seconds: timeoutSeconds,
    by_arm,
    limitations: [
      "First-party seeded tasks; not genuine public issue fixes",
      "Original model sessions and hidden graders are not publicly reproduced",
      "Input/output counts are model-reported, not independently billed",
      "Undefined or interrupted telemetry is missing, never zero",
      "Per-accepted averages include time and tokens spent on failed or invalid runs",
      "No confidence in broad causal productivity claims from these small samples",
    ],
  };
}

export function analyzeFrozenStudies() {
  const suite6 = load("v6-public-seeded-suite-20261122.json");
  const results6 = load("v6-public-results-20261122.json");
  const suite7 = load("v7-compact-guidance-suite-20261123.json");
  const results7 = load("v7-compact-guidance-results-20261123.json");
  summariseV6(suite6, results6);
  verifyV7Public(suite7, results7);
  return {
    v6: scoreStudy(results6.records, {
      study: "V6", taskIds: suite6.tasks.map((task) => task.task_id),
      arms: ["baseline", "preinjected", "live_mcp"],
      timeoutSeconds: results6.per_arm_timeout_seconds,
      inputField: "model_reported_input_tokens",
      cacheField: "model_reported_cached_input_tokens",
      outputField: "model_reported_output_tokens",
    }),
    v7: scoreStudy(results7.records, {
      study: "V7", taskIds: suite7.tasks.map((task) => task.task_id),
      arms: ["baseline", "live_full", "live_compact"],
      timeoutSeconds: results7.per_arm_timeout_seconds,
      inputField: "reported_input_tokens",
      cacheField: "reported_cached_input_tokens",
      outputField: "reported_output_tokens",
    }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(analyzeFrozenStudies(), null, 2));
}
