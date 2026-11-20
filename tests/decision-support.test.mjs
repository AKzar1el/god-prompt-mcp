import test from "node:test";
import assert from "node:assert/strict";
import {
  diagnoseFailure,
  assessReleaseReadiness,
  createContextHandoff,
  compareEvaluationRuns,
} from "../dist/decision-support.js";

test("failure diagnosis returns experiments without leaking the raw log", () => {
  const raw = "secret=VERY_PRIVATE_TEST_VALUE; error EACCES and 429: request failed";
  const result = diagnoseFailure("The system fails during deployment", raw);
  assert.equal(result.status, "HYPOTHESES_NOT_ROOT_CAUSES");
  assert.deepEqual(result.hypotheses.map((item) => item.signal), ["PERMISSION", "RATE_LIMIT"]);
  assert.ok(result.hypotheses.every((item) => item.confidence === "UNVERIFIED_SIGNAL"));
  assert.equal(result.independently_verified, false);
  assert.doesNotMatch(JSON.stringify(result), /VERY_PRIVATE_TEST_VALUE/);
});

test("unknown failure evidence yields an honest unclassified report", () => {
  const result = diagnoseFailure("The dashboard renders incorrectly but gives no detailed error");
  assert.equal(result.hypotheses[0].signal, "UNCLASSIFIED");
  assert.match(result.hypotheses[0].next_experiment, /minimal reproduction/);
});

test("release tool blocks missing provenance, approvals, migration and CI checks", () => {
  const result = assessReleaseReadiness({
    target: "production",
    checks: [{ name: "Node22", status: "failed" }, { name: "security", status: "not_run" }],
    source_revision: "abcdef1234",
    artifact_revision: "deadbeef123",
    migration_involved: true,
  });
  assert.equal(result.status, "BLOCKED");
  for (const code of ["FAILED_CHECK", "UNRUN_CHECK", "REVISION_MISMATCH", "MISSING_ROLLBACK_PLAN", "MISSING_APPROVAL", "MISSING_MIGRATION_PLAN"]) {
    assert.ok(result.blockers.some((item) => item.code === code), code);
  }
  assert.equal(result.deployment_authorized, false);
});

test("reported green release never becomes independently verified or authorized", () => {
  const result = assessReleaseReadiness({
    target: "production",
    checks: [{ name: "CI", status: "passed" }],
    source_revision: "abcdef1234",
    artifact_revision: "abcdef1234",
    rollback_plan: "Revert after verifying canary health",
    approval_reported: true,
  });
  assert.equal(result.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(result.independently_verified, false);
  assert.equal(result.deployment_authorized, false);
  assert.deepEqual(result.blockers, []);
});

test("context handoff preserves scope while redacting credentials and email", () => {
  // Construct a synthetic credential marker at runtime; never commit a
  // literal token-shaped fixture that could be mistaken for a real secret.
  const synthetic = "sk-" + "proj-" + "fakevalueforredactiontest12345";
  const payload = {
    goal: "Review a production change without deploying",
    decisions: ["Do not publish", `Token ${synthetic} must never be copied`],
    completed: ["CLI tested for analyst@example.com"],
    open_items: ["Verify downstream test results"],
    evidence: [{ reference: "T-01", description: "caller-supplied CI pass", independently_verified: false }],
  };
  const result = createContextHandoff(payload);
  assert.equal(result.status, "PORTABLE_UNVERIFIED_HANDOFF");
  assert.equal(result.redaction_applied, true);
  assert.match(result.handoff_text, /Do not publish/);
  assert.match(result.handoff_text, /Verify downstream test results/);
  assert.ok(!result.handoff_text.includes(synthetic));
  assert.doesNotMatch(result.handoff_text, /analyst@example.com/);
  assert.equal(result.independently_verified, false);
});

test("handoffs redact common API-key, Basic-auth and private-key material", () => {
  const api = "api_key=fake-api-key-value-123456789";
  const basic = "Authorization: Basic c3VwZXItc2VjcmV0LXZhbHVl";
  const privateKey = "-----BEGIN PRIVATE KEY-----\\nFAKE_KEY_MATERIAL_123\\n-----END PRIVATE KEY-----".replaceAll("\\n", "\n");
  const result = createContextHandoff({
    goal: "Handoff sanitized integration notes",
    decisions: [api, basic, privateKey],
    completed: [], open_items: [], evidence: [],
  });
  for (const secret of ["fake-api-key-value-123456789", "c3VwZXItc2VjcmV0LXZhbHVl", "FAKE_KEY_MATERIAL_123"]) {
    assert.ok(!result.handoff_text.includes(secret), "Sensitive material must not survive basic redaction");
  }
  assert.equal(result.redaction_applied, true);
  assert.equal(result.independently_verified, false);
});

test("evaluation comparison uses exact paired case IDs rather than unrelated runs", () => {
  const baseline = [
    { case_id: "A", passed: false, duration_ms: 120, cost_usd: 0.2 },
    { case_id: "B", passed: true, duration_ms: 80, cost_usd: 0.15 },
    { case_id: "baseline-only", passed: true },
  ];
  const candidate = [
    { case_id: "B", passed: false, duration_ms: 100, cost_usd: 0.25 },
    { case_id: "A", passed: true, duration_ms: 60, cost_usd: 0.10 },
    { case_id: "candidate-only", passed: true },
  ];
  const result = compareEvaluationRuns(baseline, candidate);
  assert.equal(result.status, "LOW_SAMPLE_DIRECTIONAL");
  assert.equal(result.matched_cases, 2);
  assert.equal(result.excluded_baseline_cases, 1);
  assert.equal(result.excluded_candidate_cases, 1);
  assert.equal(result.improved, 1);
  assert.equal(result.regressed, 1);
  assert.equal(result.unchanged, 0);
  assert.equal(result.pass_rate_delta_points, 0);
  assert.deepEqual(result.mean_duration_ms, { baseline: 100, candidate: 80 });
  assert.equal(result.measured_cost_pairs, 2);
  assert.equal(result.independently_verified, false);
});

test("duplicate and disjoint evaluation IDs are rejected as incomparable", () => {
  assert.equal(compareEvaluationRuns(
    [{ case_id: "A", passed: true }, { case_id: "A", passed: false }],
    [{ case_id: "A", passed: true }]
  ).status, "INCOMPARABLE");
  assert.equal(compareEvaluationRuns(
    [{ case_id: "A", passed: true }],
    [{ case_id: "B", passed: true }]
  ).status, "INCOMPARABLE");
});

test("missing paired cost and duration measurements are not invented", () => {
  const compared = compareEvaluationRuns(
    [{ case_id: "same", passed: true, cost_usd: 0.5 }],
    [{ case_id: "same", passed: false, duration_ms: 30 }]
  );
  assert.equal(compared.mean_duration_ms, null);
  assert.equal(compared.mean_cost_usd, null);
  assert.equal(compared.measured_duration_pairs, 0);
  assert.equal(compared.measured_cost_pairs, 0);
});
