import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyPublicV9 } from "../benchmarks/agent-ab/real-repos/v9-verify-public.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const root = join(HERE, "../benchmarks/agent-ab/real-repos");
const manifestBytes = readFileSync(join(root, "v9-frozen-public-issues-20261123.json"));
const manifest = JSON.parse(manifestBytes);
const base = JSON.parse(readFileSync(join(root, "v9-public-results-20261123.json")));
const inspect = x => verifyPublicV9(manifest, x, manifestBytes);
const changed = edit => {
  const copy = structuredClone(base);
  edit(copy);
  return copy;
};

test("V9 public audit verifies preregistered denominator while preserving failed attempt", () => {
  const status = inspect(base);
  assert.equal(status.status, "VERIFIED_STOPPED_NO_PRODUCTIVITY_CLAIM");
  assert.equal(status.frozen_planned, 6);
  assert.equal(status.original_first_run_attempts, 1);
  assert.equal(status.unrun, 5);
  assert.equal(status.accepted_fixes, 0);
  assert.equal(status.manifest_sha256,
    createHash("sha256").update(manifestBytes).digest("hex"));
});

test("V9 rejects changed task manifest, source SHA, missing or duplicated arm", () => {
  assert.throws(() => verifyPublicV9({ ...manifest, tasks: manifest.tasks.slice(1) },
    base, Buffer.from("{}")), /manifest bytes changed/i);
  assert.throws(() => inspect(changed(x => { x.frozen_source_sha = "a".repeat(40); })),
    /source\/grader/i);
  assert.throws(() => inspect(changed(x => { x.trials.pop(); })),
    /dropped original/i);
  assert.throws(() => inspect(changed(x => {
    x.trials[1].task_id = x.trials[0].task_id;
    x.trials[1].arm = x.trials[0].arm;
  })), /duplicate/i);
});

test("V9 rejects self-claimed coding success without accepted tool or hidden checks", () => {
  assert.throws(() => inspect(changed(x => { x.trials[0].accepted = true; })),
    /invalid or fabricated/i);
  assert.throws(() => inspect(changed(x => {
    x.trials[0].observed_successful_command_or_file_changes = 1;
  })), /invalid or fabricated/i);
  assert.throws(() => inspect(changed(x => {
    x.trials[0].independent_offline_regrade.passed = 19;
  })), /offline RED/i);
});

test("V9 refuses a spurious causal speed or token advantage", () => {
  assert.throws(() => inspect(changed(x => {
    x.productivity.seconds_per_accepted_fix = 30;
  })), /productivity/i);
  assert.throws(() => inspect(changed(x => {
    x.productivity.causal_uplift_proven = true;
  })), /productivity/i);
  assert.throws(() => inspect(changed(x => {
    x.trials[2].status = "NOT_RUN"; x.trials[2].reported_input_tokens = 0;
  })), /fabricated/i);
  assert.throws(() => inspect(changed(x => {
    x.verified_preflight.native_coding_tool_execution_succeeded = true;
  })), /stopped-policy/i);
});

test("V9 cannot turn a green MCP probe into a publishing or deployment claim", () => {
  assert.throws(() => inspect(changed(x => {
    x.release_effects.deployed = true;
  })), /release effects/i);
  assert.throws(() => inspect(changed(x => {
    x.status = "PRODUCTIVITY_GAIN_PROVEN";
  })), /stopped-policy/i);
});
