import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewCodeChange,
  normalizeRequirements,
  auditRequirements,
  buildTestMatrix,
} from "../dist/public-engineering.js";

const DIFF = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index aaaa..bbbb 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -1,2 +1,4 @@",
  " export function login(value: string) {",
  "+  eval(value);",
  "+  const password = 'PRIVATE_TEST_SECRET_VALUE';",
  "+  // TODO: add validation",
  "   return value;",
  " }",
].join("\n");

test("patch review uses real parser line numbers, caps findings and never copies secret lines", () => {
  const review = reviewCodeChange(DIFF);
  assert.equal(review.status, "REVIEW_HINTS_ONLY");
  assert.equal(review.files[0].path, "src/auth.ts");
  assert.equal(review.files[0].additions, 3);
  assert.equal(review.files[0].deletions, 0);
  assert.ok(review.findings.some((item) => item.code === "DYNAMIC_CODE_EXECUTION" && item.line === 2));
  assert.ok(review.findings.some((item) => item.code === "SENSITIVE_BEHAVIOR_CHANGE"));
  assert.ok(review.findings.some((item) => item.code === "NO_TEST_CHANGES_IN_PATCH"));
  assert.equal(review.independently_verified, false);
  assert.doesNotMatch(JSON.stringify(review), /PRIVATE_TEST_SECRET_VALUE/);
});

test("patch review rejects arbitrary prose and binary-only fragments without claiming success", () => {
  for (const input of ["This code is safe and fully tested", "Binary files a/a and b/a differ"]) {
    const review = reviewCodeChange(input);
    assert.equal(review.status, "UNPARSEABLE_PATCH");
    assert.equal(review.independently_verified, false);
  }
});

test("patch review isolates a test deletion from a negative source line", () => {
  const patch = [
    "diff --git a/tests/feature.test.ts b/tests/feature.test.ts",
    "--- a/tests/feature.test.ts",
    "+++ b/tests/feature.test.ts",
    "@@ -4,2 +4,1 @@",
    "-assert.equal(result, 1);",
    "  export default 1;",
  ].join("\n");
  const review = reviewCodeChange(patch);
  assert.ok(review.findings.some((item) => item.code === "REMOVED_TEST_ASSERTION" && item.line === 4));
  assert.ok(!review.findings.some((item) => item.code === "NO_TEST_CHANGES_IN_PATCH"));
});

test("patch review flags deletion of an authorization guard without claiming a proven vulnerability", () => {
  const patch = [
    "diff --git a/src/auth.ts b/src/auth.ts",
    "--- a/src/auth.ts",
    "+++ b/src/auth.ts",
    "@@ -1,2 +1 @@",
    '-if (!context.isAdmin) throw new Error("Forbidden");',
    " return true;",
  ].join("\n");
  const result = reviewCodeChange(patch);
  assert.ok(result.findings.some((item) => item.code === "REMOVED_SECURITY_GUARD" && item.line === 1));
  assert.equal(result.independently_verified, false);
});

test("requirement audit identifies ambiguous outcomes and traceable missing acceptance", () => {
  const input = "## Login\n- The user login must be fast and secure.\n- The user login must be fast and secure.\n- A locked user must be rejected.\n  Acceptance: locked account returns 403.\n  Scenario: Given a locked account, When login is attempted, Then the request fails.";
  const result = auditRequirements(input);
  assert.equal(result.requirements.length, 3);
  assert.equal(result.requirements[0].source_line, 2);
  assert.equal(result.requirements[2].acceptance.length, 1);
  assert.equal(result.requirements[2].scenarios.length, 1);
  assert.ok(result.findings.some((item) => item.code === "DUPLICATE_REQUIREMENT" && item.requirement_id === "R-02"));
  assert.ok(result.findings.some((item) => item.code === "UNMEASURABLE_LANGUAGE" && item.requirement_id === "R-01"));
  assert.ok(result.findings.some((item) => item.code === "MISSING_ACCEPTANCE_EVIDENCE" && item.requirement_id === "R-01"));
  assert.equal(result.independently_verified, false);
});

test("requirement normalization is deterministic, bounded and shared with test matrix", () => {
  const input = Array.from({ length: 40 }, (_, index) => `- R${index}: The service must return status ${index}.`).join("\n");
  const a = normalizeRequirements(input);
  const b = normalizeRequirements(input);
  assert.deepEqual(a, b);
  assert.equal(a.requirements.length, 35);
  assert.equal(a.truncated, true);
  const plan = buildTestMatrix(input, 6);
  assert.equal(plan.cases.length, 6);
  assert.equal(plan.truncated, true);
  assert.equal(plan.tests_executed, 0);
  assert.equal(plan.cases[0].status, "PROPOSED_NOT_RUN");
  assert.deepEqual(plan.traceability[0].test_case_ids, ["TC-001"]);
  assert.deepEqual(plan.traceability[5].test_case_ids, ["TC-006"]);
  assert.deepEqual(plan.traceability[6].test_case_ids, []);
  assert.equal(plan.uncovered_requirement_ids.length, 29);
  assert.equal(plan.status, "PARTIAL_TEST_PLAN");
});

test("a small test budget covers distinct requirements before adding optional scenarios", () => {
  const specification = [
    "- The service must authenticate users.",
    "- The service must limit upload size.",
    "- The service must reject repeated requests.",
  ].join("\n");
  const matrix = buildTestMatrix(specification, 4);
  assert.deepEqual(matrix.cases.map((entry) => entry.requirement_id), ["R-01", "R-02", "R-03", "R-01"]);
  assert.equal(matrix.traceability.length, 3);
  assert.equal(matrix.gaps.length, 3, "truncated cases must not hide missing acceptance evidence for later requirements");
  assert.equal(matrix.truncated, true);
});

test("test matrix preserves acceptance text without manufacturing success evidence", () => {
  const text = "- The service must return HTTP 429 after ten requests.\n  Acceptance: request eleven returns HTTP 429.";
  const result = buildTestMatrix(text, 8);
  assert.equal(result.cases.length, 4);
  assert.match(result.cases[0].expected, /request eleven returns HTTP 429/);
  assert.match(result.cases[1].expected, /UNSPECIFIED/);
  assert.equal(result.gaps.length, 0);
  assert.equal(result.tests_executed, 0);
  assert.match(result.warning, /not generated executable tests/i);
});

test("empty or heading-only specs fail structurally without inventing requirements", () => {
  const result = auditRequirements("## Something\n## Else");
  assert.equal(result.status, "NO_REQUIREMENTS_FOUND");
  assert.equal(result.requirements.length, 0);
  const matrix = buildTestMatrix("## Something\n## Else", 8);
  assert.equal(matrix.status, "NO_REQUIREMENTS_FOUND");
  assert.equal(matrix.cases.length, 0);
});

test("OpenSpec-style requirement bodies and GIVEN/WHEN/THEN scenarios stay together", () => {
  const spec = [
    "## Purpose",
    "This explains the business context, not a requirement.",
    "## Requirements",
    "### Requirement: Session Timeout",
    "The system SHALL expire a session after 30 minutes of inactivity.",
    "#### Scenario: Idle session expiration",
    "- GIVEN an authenticated session",
    "- WHEN 30 minutes pass without activity",
    "- THEN the session is invalidated",
    "```txt",
    "MUST be a fake requirement inside a code block",
    "```",
  ].join("\n");
  const result = auditRequirements(spec);
  assert.equal(result.requirements.length, 1);
  assert.equal(result.requirements[0].source_line, 4);
  assert.match(result.requirements[0].text, /Session Timeout: The system SHALL expire/);
  assert.equal(result.requirements[0].scenarios.length, 4);
  assert.ok(!result.findings.some((issue) => issue.code === "MISSING_ACCEPTANCE_EVIDENCE"));
  const matrix = buildTestMatrix(spec, 8);
  assert.equal(matrix.cases.length, 4);
  assert.match(matrix.cases[0].expected, /Scenario: Idle session expiration/);
});


test("benchmark review suppresses code execution mentioned only in comments", () => {
  const patch = [
    "diff --git a/src/docs.ts b/src/docs.ts",
    "--- a/src/docs.ts",
    "+++ b/src/docs.ts",
    "@@ -1,1 +1,2 @@",
    " // Explanation:",
    "+// Example string mentions eval(input), but does not execute it.",
  ].join("\n");
  const result = reviewCodeChange(patch);
  assert.ok(!result.findings.some((x) => x.code === "DYNAMIC_CODE_EXECUTION"));
});

test("benchmark review still reports TODO markers in added comments", () => {
  const patch = [
    "diff --git a/src/job.ts b/src/job.ts",
    "--- a/src/job.ts",
    "+++ b/src/job.ts",
    "@@ -1,1 +1,2 @@",
    " const active = true;",
    "+// TODO: validate before production release",
  ].join("\n");
  const result = reviewCodeChange(patch);
  assert.ok(result.findings.some((x) => x.code === "UNFINISHED_MARKER"));
});

test("benchmark review does not demand a test-file edit for a trivial safe one-liner", () => {
  const patch = [
    "diff --git a/src/math.ts b/src/math.ts",
    "--- a/src/math.ts",
    "+++ b/src/math.ts",
    "@@ -1,1 +1,2 @@",
    " const size = 1;",
    "+const sum = 1 + 2;",
  ].join("\n");
  const result = reviewCodeChange(patch);
  assert.ok(!result.findings.some((x) => x.code === "NO_TEST_CHANGES_IN_PATCH"));
});

test("benchmark review flags a broader release workflow gate without claiming a verified exploit", () => {
  const patch = [
    "diff --git a/.github/workflows/publish-container.yml b/.github/workflows/publish-container.yml",
    "--- a/.github/workflows/publish-container.yml",
    "+++ b/.github/workflows/publish-container.yml",
    "@@ -1,1 +1,1 @@",
    "-if: github.event_name == 'workflow_dispatch'",
    "+if: github.event_name != 'pull_request'",
  ].join("\n");
  const result = reviewCodeChange(patch);
  assert.ok(result.findings.some((x) => x.code === "WEAKENED_RELEASE_GATE"));
  assert.equal(result.independently_verified, false);
});

test("benchmark requirements detect explicit opposing obligations and optional mandatory wording", () => {
  const audit = auditRequirements([
    "- Every user must have access to the report.",
    "- No user must have access to the report.",
    "- The feature must optionally offer exports.",
  ].join("\n"));
  assert.ok(audit.findings.some((x) => x.code === "CONTRADICTORY_REQUIREMENTS"));
  assert.ok(audit.findings.some((x) => x.code === "MIXED_OBLIGATION"));
});
