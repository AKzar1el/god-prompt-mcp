import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { localMetrics, saveFeedback, learnFromReview } from "../bin/godprompt-proof.mjs";

test("metrics reads the existing tiny local JSONL with no additional state or telemetry", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-metrics-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "private", "feedback.jsonl");
  const env = { GODPROMPT_FEEDBACK_FILE: filename };
  const empty = await localMetrics("secret-org/secret-repo", { days: 30 }, env);
  assert.equal(empty.file_bytes, 0);
  assert.equal(empty.reported_events_window, 0);
  assert.equal(empty.scope, "local_only");
  await saveFeedback({
    project: "secret-org/secret-repo",
    outcome: "failure", pattern: "missing_tests",
    lesson: "Run full tests before reporting completion",
  }, env);
  await saveFeedback({
    project: "secret-org/secret-repo",
    outcome: "blocked", pattern: "missing_tests",
    lesson: "Verify the exact contract command first", verified: true,
  }, env);
  await saveFeedback({
    project: "secret-org/secret-repo",
    outcome: "success", pattern: "fixed_tests",
    lesson: "Keep a reproducible test receipt", verified: true,
  }, env);
  await saveFeedback({
    project: "another-org/another-repo",
    outcome: "failure", pattern: "missing_tests",
    lesson: "Use complete and scoped evidence",
  }, env);
  const before = (await stat(filename)).size;
  const data = await localMetrics("secret-org/secret-repo", { days: 30 }, env);
  assert.equal((await stat(filename)).size, before);
  assert.equal(data.reported_events_all_time, 3);
  assert.equal(data.reported_events_window, 3);
  assert.deepEqual(data.reported_outcomes_window, { success: 1, failure: 1, blocked: 1 });
  assert.equal(data.reported_verifications_window, 2);
  assert.deepEqual(data.recurring_hold_patterns_window, [{ pattern: "missing_tests", reported_count: 2 }]);
  assert.equal(data.file_bytes, before);
  assert.equal(data.file_cap_bytes, 256 * 1024);
  assert.doesNotMatch(JSON.stringify(data), /secret-repo|another-repo|private\/feedback/);
  assert.match(data.warning, /not interpret these counts as task success rates/);
});
test("metrics windowing and invalid requests fail safely", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-metrics-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const env = { GODPROMPT_FEEDBACK_FILE: join(folder, "feedback.jsonl") };
  await saveFeedback({
    project: "project-name", outcome: "blocked", pattern: "missing_check",
    lesson: "Attach a genuine verification result",
  }, env);
  const future = await localMetrics("project-name", { days: 7, now: Date.now() + 15 * 86400000 }, env);
  assert.equal(future.reported_events_all_time, 1);
  assert.equal(future.reported_events_window, 0);
  assert.deepEqual(future.recurring_hold_patterns_window, []);
  await assert.rejects(localMetrics("project-name", { days: 0 }, env), /1-365 days/);
  await assert.rejects(localMetrics("project-name", { days: 366 }, env), /1-365 days/);
  await assert.rejects(localMetrics("project-name", { days: 1.5 }, env), /1-365 days/);
  await assert.rejects(localMetrics("project-name", { now: "not a date" }, env), /reference time/);
});
test("review-derived generic HOLD lessons appear in local observability but not as verified wins", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-metrics-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const env = { GODPROMPT_FEEDBACK_FILE: join(folder, "feedback.jsonl") };
  const saved = await learnFromReview({
    project: "client-internal",
    review: {
      contract_id: "sha256:" + "2".repeat(64),
      status: "HOLD",
      issues: [{ code: "MISSING_VERIFICATION", detail: "PRIVATE_KEY_SKIPPED_IN_LOGS" }],
    },
  }, env);
  assert.equal(saved.stored, 1);
  const metrics = await localMetrics("client-internal", { days: 30 }, env);
  assert.equal(metrics.reported_outcomes_window.blocked, 1);
  assert.equal(metrics.reported_verifications_window, 0);
  assert.deepEqual(metrics.recurring_hold_patterns_window,
    [{ pattern: "review_missing_verification", reported_count: 1 }]);
  assert.doesNotMatch(await readFile(env.GODPROMPT_FEEDBACK_FILE, "utf8"), /PRIVATE_KEY_SKIPPED_IN_LOGS|client-internal/);
});
test("metrics CLI is runnable from the source without creating a file", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-metrics-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "not-created.jsonl");
  const script = fileURLToPath(new URL("../bin/godprompt-proof.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [script, "metrics", "--project", "demo", "--days", "7"], {
    env: { ...process.env, GODPROMPT_FEEDBACK_FILE: filename },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).reported_events_window, 0);
  await assert.rejects(stat(filename), { code: "ENOENT" });
});
