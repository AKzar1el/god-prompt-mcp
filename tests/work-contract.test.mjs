import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTRACT_SCHEMA,
  createWorkContract,
  isScopedPath,
  reviewWorkEvidence,
} from "../dist/work-contract.js";

const setup = {
  task: "Build a guarded parser for the service",
  task_type: "BUILD",
  risk_level: "medium",
  allowed_paths: ["src/", "tests/"],
  forbidden_actions: ["deploy", "merge"],
  success_criteria: ["Malformed input is rejected and valid input is accepted"],
  verification_commands: ["npm test"],
};

async function definedContract(overrides = {}) {
  const value = await createWorkContract({ ...setup, ...overrides });
  assert.equal(value.definition_status, "DEFINED");
  assert.equal(value.issues.length, 0);
  return value.contract;
}

function passingEvidence(contract) {
  return {
    contract,
    changed_files: ["src/parser.ts", "tests/parser.test.ts"],
    operations_performed: ["edited files"],
    checks: [{
      id: "VC-01",
      command: "npm test",
      exit_code: 0,
      evidence_excerpt: "tests passed (example supplied evidence, not independently verified)",
      source: "tool_output",
    }],
    acceptance: [{
      id: "AC-01",
      status: "met",
      evidence_refs: ["VC-01"],
    }],
  };
}

test("creates deterministic, bounded contracts with named evidence gates", async () => {
  const a = await definedContract();
  const b = await definedContract();
  assert.equal(a.schema, CONTRACT_SCHEMA);
  assert.deepEqual(a, b);
  assert.match(a.contract_id, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(a.success_criteria, [{
    id: "AC-01",
    text: setup.success_criteria[0],
  }]);
  assert.deepEqual(a.verification_commands, [{
    id: "VC-01",
    command: "npm test",
  }]);
});

test("does not invent missing scope, acceptance, commands or task type", async () => {
  const empty = await createWorkContract({ task: "Investigate this codebase" });
  assert.equal(empty.definition_status, "NEEDS_DEFINITION");
  assert.deepEqual(empty.issues.map((v) => v.code), [
    "TASK_TYPE_UNCLASSIFIED", "SCOPE_UNDEFINED",
    "ACCEPTANCE_UNDEFINED", "VERIFICATION_UNDEFINED",
  ]);
  assert.equal(empty.contract.verification_commands.length, 0);
});

test("reports duplicate path or verification definitions", async () => {
  const result = await createWorkContract({
    ...setup,
    allowed_paths: ["src/", "src/"],
    verification_commands: ["npm test", "npm test"],
  });
  assert.equal(result.definition_status, "NEEDS_DEFINITION");
  assert.ok(result.issues.some((v) => v.code === "DUPLICATE_SCOPE_PATH"));
  assert.ok(result.issues.some((v) => v.code === "DUPLICATE_VERIFICATION"));
});

test("rejects unsafe file scopes and does not interpret glob syntax", async () => {
  for (const candidate of [
    "/etc/passwd", "../src/", "src/../secret", "C:/work", "src\\file.ts",
    "src//x", ".", "src/*.ts",
  ]) {
    assert.equal(isScopedPath(candidate), false, candidate);
    await assert.rejects(
      createWorkContract({ ...setup, allowed_paths: [candidate] }),
      { name: "ZodError" }
    );
  }
  assert.equal(isScopedPath("src/nested/index.ts"), true);
  assert.equal(isScopedPath("src/"), true);
});

test("returns a reported-ready status but never claims independently verified completion", async () => {
  const contract = await definedContract();
  const result = await reviewWorkEvidence(passingEvidence(contract));
  assert.equal(result.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(result.issues.length, 0);
  assert.equal(result.independently_verified, false);
  assert.equal(result.completion_authorized, false);
  assert.match(result.warning, /caller-supplied/i);
});

test("detects contract drift without treating a digest as an authentication proof", async () => {
  const contract = await definedContract();
  const drifted = { ...contract, task: "Deploy the service without review" };
  const result = await reviewWorkEvidence(passingEvidence(drifted));
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((v) => v.code === "CONTRACT_DRIFT"));
});

test("blocks missing, failing, self-reported, or swapped verification commands", async () => {
  const contract = await definedContract();
  const cases = [
    { checks: [], error: "MISSING_VERIFICATION" },
    { checks: [{ id: "VC-01", command: "npm test", exit_code: 1, source: "tool_output" }], error: "VERIFICATION_FAILED" },
    { checks: [{ id: "VC-01", command: "npm test", exit_code: null, source: "tool_output" }], error: "VERIFICATION_FAILED" },
    { checks: [{ id: "VC-01", command: "npm test", exit_code: 0, source: "self_report" }], error: "SELF_REPORTED_CHECK" },
    { checks: [{ id: "VC-01", command: "echo ok", exit_code: 0, source: "tool_output" }], error: "COMMAND_MISMATCH" },
  ];
  for (const entry of cases) {
    const result = await reviewWorkEvidence({ ...passingEvidence(contract), checks: entry.checks });
    assert.equal(result.status, "HOLD");
    assert.ok(result.issues.some((v) => v.code === entry.error), entry.error);
  }
});

test("detects changed files outside scoped prefixes and never accepts traversal", async () => {
  const contract = await definedContract();
  const result = await reviewWorkEvidence({
    ...passingEvidence(contract),
    changed_files: ["src/parser.ts", "README.md", "src/../secrets.env", "C:/absolute"],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((v) => v.code === "OUT_OF_SCOPE_CHANGE"));
  assert.ok(result.issues.some((v) => v.code === "INVALID_CHANGED_PATH"));
});

test("blocks forbidden reported actions", async () => {
  const contract = await definedContract();
  const result = await reviewWorkEvidence({
    ...passingEvidence(contract),
    operations_performed: ["edited files", " DePloY "],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((v) => v.code === "PROHIBITED_ACTION_REPORTED"));
});

test("audited forbidden actions block reported variants and whole phrase mentions", async () => {
  const contract = await definedContract();
  for (const action of ["deployed to staging", "CI merged PR 17", "attempted deployment", "approved merge"]) {
    const result = await reviewWorkEvidence({
      ...passingEvidence(contract),
      operations_performed: ["edited files", action],
    });
    assert.equal(result.status, "HOLD", action);
    assert.ok(result.issues.some((issue) => issue.code === "PROHIBITED_ACTION_REPORTED"), action);
  }
  const benign = await reviewWorkEvidence({
    ...passingEvidence(contract),
    operations_performed: ["edited deployment docs", "verified merge strategy documentation"],
  });
  assert.equal(benign.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
});

test("unexpected verification and acceptance receipts cannot silently pass review", async () => {
  const contract = await definedContract();
  const base = passingEvidence(contract);
  const result = await reviewWorkEvidence({
    ...base,
    checks: [...base.checks, { id: "VC-99", command: "echo bypass", exit_code: 0, source: "tool_output", evidence_excerpt: "ok" }],
    acceptance: [...base.acceptance, { id: "AC-99", status: "met", evidence_refs: ["VC-01"] }],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((issue) => issue.code === "UNEXPECTED_CHECK_RECEIPT"));
  assert.ok(result.issues.some((issue) => issue.code === "UNEXPECTED_ACCEPTANCE_RECEIPT"));
});

test("claimed tool-output success without a meaningful excerpt remains on HOLD", async () => {
  const contract = await definedContract();
  const base = passingEvidence(contract);
  const result = await reviewWorkEvidence({
    ...base,
    checks: [{ ...base.checks[0], evidence_excerpt: "   " }],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((issue) => issue.code === "EVIDENCE_EXCERPT_MISSING"));
  assert.equal(result.independently_verified, false);
});

test("requires evidence-bound acceptance instead of a bare completion claim", async () => {
  const contract = await definedContract();
  for (const criterion of [
    { id: "AC-01", status: "unknown", evidence_refs: ["VC-01"] },
    { id: "AC-01", status: "met", evidence_refs: [] },
    { id: "AC-01", status: "met", evidence_refs: ["unknown"] },
  ]) {
    const result = await reviewWorkEvidence({
      ...passingEvidence(contract),
      acceptance: [criterion],
    });
    assert.equal(result.status, "HOLD");
  }
});

test("can cite an observation while keeping it clearly unverified", async () => {
  const contract = await definedContract();
  const result = await reviewWorkEvidence({
    ...passingEvidence(contract),
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["OBS-01"] }],
    observations: [{ id: "OBS-01", note: "Manual input/output spot check", source: "manual_report" }],
  });
  assert.equal(result.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(result.independently_verified, false);
});

test("blocks duplicate evidence ids", async () => {
  const contract = await definedContract();
  const evidence = passingEvidence(contract);
  const result = await reviewWorkEvidence({
    ...evidence,
    checks: [...evidence.checks, evidence.checks[0]],
    acceptance: [...evidence.acceptance, evidence.acceptance[0]],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((v) => v.code === "DUPLICATE_CHECK_RECEIPT"));
  assert.ok(result.issues.some((v) => v.code === "DUPLICATE_ACCEPTANCE_RECEIPT"));
});

test("holds high-risk tasks until a human review is reported", async () => {
  const contract = await definedContract({ risk_level: "high" });
  const hold = await reviewWorkEvidence(passingEvidence(contract));
  assert.equal(hold.status, "HOLD");
  assert.ok(hold.issues.some((v) => v.code === "REVIEW_REQUIRED"));
  const reviewed = await reviewWorkEvidence({
    ...passingEvidence(contract), human_review_reported: true,
  });
  assert.equal(reviewed.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(reviewed.completion_authorized, false);
});

test("reports gaps on incomplete contracts even when no receipts are supplied", async () => {
  const prepared = await createWorkContract({ task: "Investigate this codebase" });
  const result = await reviewWorkEvidence({ contract: prepared.contract });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((v) => v.code === "SCOPE_UNDEFINED"));
  assert.ok(result.issues.some((v) => v.code === "VERIFICATION_UNDEFINED"));
});
