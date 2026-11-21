import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createWorkContract, reviewWorkEvidence } from "../dist/work-contract.js";
import {
  BUNDLE_SCHEMA, codexifyEvidence, githubEvidence, githubSnapshotEvidence, localLessons, saveFeedback, learnFromReview,
} from "../bin/godprompt-proof.mjs";

const SHA = "a".repeat(40);
test("offline proof CLI help is discoverable and exits successfully", () => {
  const script = fileURLToPath(new URL("../bin/godprompt-proof.mjs", import.meta.url));
  for (const args of [["--help"], ["github", "--help"], ["pack", "--help"], ["-h"]]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /github-snapshot/);
    assert.match(result.stdout, /codexify/);
    assert.match(result.stdout, /pack/);
    assert.match(result.stdout, /local feedback/i);
    assert.equal(result.stderr, "");
  }
  const invalid = spawnSync(process.execPath, [script, "unsupported-command"], {
    encoding: "utf8", timeout: 10000,
  });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage:/);
});
async function contract() {
  return (await createWorkContract({
    task: "Implement and test scoped parser validation",
    task_type: "BUILD",
    risk_level: "medium",
    allowed_paths: ["src/", "tests/"],
    forbidden_actions: ["deploy", "merge"],
    success_criteria: ["Invalid input is rejected and valid input continues to work"],
    verification_commands: ["npm test"],
  })).contract;
}
function fakeGithub({ status = "completed", conclusion = "success", runSha = SHA, links = null, badCommitSha = false } = {}) {
  const seen = [];
  const fetchImpl = async (url, opts) => {
    seen.push({ url, opts });
    if (url.includes("/check-runs")) {
      return new Response(JSON.stringify({
        total_count: 1,
        check_runs: [{
          id: 1234, name: "verify (22)", head_sha: runSha,
          status, conclusion,
        }],
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      sha: badCommitSha ? "b".repeat(40) : SHA,
      files: [
        { filename: "src/parser.ts", status: "modified" },
        { filename: "tests/new-parser.test.ts", previous_filename: "tests/old-parser.test.ts", status: "renamed" },
      ],
    }), { status: 200, headers: links ? { link: links } : {} });
  };
  return { fetchImpl, seen };
}
test("GitHub adapter fetches the exact SHA and creates only explicitly mapped receipts", async () => {
  const prepared = await contract();
  const { fetchImpl, seen } = fakeGithub();
  const bundle = await githubEvidence({
    repo: "owner/sample-repo", sha: SHA, contract: prepared,
    mapping: { "VC-01": "verify (22)" }, fetchImpl,
  });
  assert.equal(bundle.schema, BUNDLE_SCHEMA);
  assert.equal(bundle.adapter, "github_checks");
  assert.equal(bundle.independently_verified, false);
  assert.equal(bundle.completion_authorized, false);
  assert.equal(bundle.provenance.commit_sha, SHA);
  assert.deepEqual(bundle.review_input.changed_files, [
    "src/parser.ts", "tests/new-parser.test.ts", "tests/old-parser.test.ts",
  ]);
  assert.equal(bundle.review_input.checks[0].exit_code, 0);
  assert.equal(bundle.review_input.checks[0].source, "tool_output");
  assert.match(bundle.review_input.checks[0].evidence_excerpt, /NOT established/);
  assert.equal(bundle.review_input.acceptance.length, 0);
  assert.ok(bundle.gaps.includes("ACCEPTANCE_REQUIRES_INDEPENDENT_EVIDENCE"));
  assert.equal(seen.length, 2);
  assert.ok(seen.every((x) => x.url.startsWith("https://api.github.com/repos/owner/sample-repo/")));
  assert.ok(seen.every((x) => !Object.hasOwn(x.opts.headers, "Authorization")));
  const hold = await reviewWorkEvidence(bundle.review_input);
  assert.equal(hold.status, "HOLD");
  assert.ok(hold.issues.some((x) => x.code === "ACCEPTANCE_MISSING" || x.code === "ACCEPTANCE_NOT_MET"));
});
test("injected GitHub adapters never receive ambient GitHub credentials", async () => {
  const prior = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "TEST_FAKE_TOKEN_DO_NOT_FORWARD";
  try {
    const { fetchImpl, seen } = fakeGithub();
    await githubEvidence({
      repo: "owner/sample-repo", sha: SHA, contract: await contract(),
      mapping: { "VC-01": "verify (22)" }, fetchImpl,
    });
    assert.equal(seen.length, 2);
    assert.ok(seen.every((entry) => !Object.hasOwn(entry.opts.headers, "Authorization")));
  } finally {
    if (prior === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prior;
  }
});
test("GitHub checks are not invented for missing maps or incomplete runs", async () => {
  const prepared = await contract();
  const { fetchImpl } = fakeGithub({ status: "in_progress", conclusion: null });
  const missing = await githubEvidence({
    repo: "owner/sample-repo", sha: SHA, contract: prepared, fetchImpl,
  });
  assert.equal(missing.review_input.checks.length, 0);
  assert.ok(missing.gaps.includes("CHECK_NOT_MAPPED:VC-01"));
  const pending = await githubEvidence({
    repo: "owner/sample-repo", sha: SHA, contract: prepared,
    mapping: { "VC-01": "verify (22)" }, fetchImpl,
  });
  assert.equal(pending.review_input.checks[0].exit_code, null);
  assert.ok(pending.gaps.includes("CHECK_NOT_SUCCESSFUL:VC-01"));
  const reviewed = await reviewWorkEvidence({
    ...pending.review_input,
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
  });
  assert.equal(reviewed.status, "HOLD");
});
test("GitHub adapter rejects malicious repo names, mismatched SHA and unsafe external API origins", async () => {
  const prepared = await contract();
  await assert.rejects(githubEvidence({
    repo: "../evil", sha: SHA, contract: prepared, fetchImpl: fakeGithub().fetchImpl,
  }), /owner\/name/);
  await assert.rejects(githubEvidence({
    repo: "owner/repo", sha: SHA, contract: prepared,
    fetchImpl: fakeGithub({ badCommitSha: true }).fetchImpl,
  }), /SHA/);
  await assert.rejects(githubEvidence({
    repo: "owner/repo", sha: SHA, contract: prepared,
    mapping: { "VC-01": "verify (22)" },
    fetchImpl: fakeGithub({ runSha: "b".repeat(40) }).fetchImpl,
  }), /head SHA/);
});
test("GitHub full-PR adapter pins the branch head and includes every PR file", async () => {
  const prepared = await contract();
  let metadataRequests = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/pulls/12")) {
      metadataRequests++;
      return new Response(JSON.stringify({ number: 12, head: { sha: SHA } }), { status: 200 });
    }
    if (url.includes("/pulls/12/files?")) {
      return new Response(JSON.stringify([
        { filename: "src/from-first-commit.ts", status: "modified" },
        { filename: "tests/from-last-commit.test.ts", status: "added" },
      ]), { status: 200 });
    }
    if (url.includes("/check-runs?")) {
      return new Response(JSON.stringify({
        total_count: 1,
        check_runs: [{ id: 42, name: "verify (22)", head_sha: SHA, status: "completed", conclusion: "success" }],
      }), { status: 200 });
    }
    throw new Error("Unexpected API route: " + url);
  };
  const bundle = await githubEvidence({
    repo: "owner/repo", sha: SHA, pr: 12, contract: prepared,
    mapping: { "VC-01": "verify (22)" }, fetchImpl,
  });
  assert.equal(metadataRequests, 2);
  assert.equal(bundle.provenance.diff_scope, "pull_request");
  assert.equal(bundle.provenance.pull_request_number, 12);
  assert.deepEqual(bundle.review_input.changed_files, [
    "src/from-first-commit.ts", "tests/from-last-commit.test.ts",
  ]);
  assert.ok(!bundle.gaps.includes("SINGLE_COMMIT_DIFF_ONLY_NOT_FULL_PR"));
  await assert.rejects(githubEvidence({
    repo: "owner/repo", sha: SHA, pr: -5, contract: prepared, fetchImpl,
  }), /positive integer/);
});
test("GitHub PR adapter fails closed if head moves during collection", async () => {
  const prepared = await contract();
  let count = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/pulls/12")) {
      count++;
      return new Response(JSON.stringify({
        number: 12, head: { sha: count === 1 ? SHA : "b".repeat(40) },
      }), { status: 200 });
    }
    if (url.includes("/pulls/12/files?")) {
      return new Response(JSON.stringify([{ filename: "src/p.ts", status: "modified" }]), { status: 200 });
    }
    throw new Error("Unexpected API route");
  };
  await assert.rejects(githubEvidence({
    repo: "owner/repo", sha: SHA, pr: 12, contract: prepared, fetchImpl,
  }), /head moved/);
});
test("GitHub connector snapshot works fully offline and never claims source authentication", async () => {
  const prepared = await contract();
  const snapshot = {
    complete: true,
    commit: { sha: SHA, files: [{ filename: "src/parser.ts", status: "modified" }] },
    check_runs: { total_count: 1, check_runs: [{
      id: 42, name: "verify (22)", head_sha: SHA, status: "completed", conclusion: "success",
    }] },
  };
  const bundle = await githubSnapshotEvidence({
    repo: "owner/private-repo", sha: SHA, contract: prepared,
    mapping: { "VC-01": "verify (22)" }, snapshot,
  });
  assert.equal(bundle.adapter, "github_connector_snapshot");
  const prSnapshot = {
    complete: true,
    pull_request: { number: 12, head: { sha: SHA } },
    pr_files: [{ filename: "src/parser.ts", status: "modified" }],
    check_runs: snapshot.check_runs,
  };
  const offlinePr = await githubSnapshotEvidence({
    repo: "owner/private-repo", sha: SHA, pr: 12, contract: prepared,
    mapping: { "VC-01": "verify (22)" }, snapshot: prSnapshot,
  });
  assert.equal(offlinePr.provenance.diff_scope, "pull_request");
  assert.equal(offlinePr.review_input.changed_files[0], "src/parser.ts");

  assert.equal(bundle.provenance.provider, "caller_supplied_github_connector_snapshot");
  assert.ok(bundle.gaps.includes("CONNECTOR_SNAPSHOT_PROVENANCE_NOT_AUTHENTICATED"));
  assert.equal(bundle.review_input.checks[0].exit_code, 0);
  await assert.rejects(githubSnapshotEvidence({
    repo: "owner/private-repo", sha: SHA, contract: prepared,
    snapshot: { ...snapshot, complete: false },
  }), /complete:true/);
  await assert.rejects(githubSnapshotEvidence({
    repo: "owner/private-repo", sha: SHA, contract: prepared,
    snapshot: { ...snapshot, check_runs: { total_count: 2, check_runs: snapshot.check_runs.check_runs } },
  }), /paginated/);
});
test("Codexify adapter accepts structured exec_command output and omits raw private logs", async () => {
  const prepared = await contract();
  const bundle = await codexifyEvidence({
    contract: prepared,
    exportData: {
      changed_files: ["src/parser.ts", "tests/parser.test.ts"],
      operations_performed: ["edited files"],
      checks: [{
        id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
        response: { upstream_result: { exit_code: 0, stdout: "SENSITIVE_PRIVATE_LOG", stderr: "" } },
      }],
    },
  });
  assert.equal(bundle.review_input.checks[0].source, "tool_output");
  assert.equal(bundle.review_input.checks[0].exit_code, 0);
  assert.doesNotMatch(JSON.stringify(bundle), /SENSITIVE_PRIVATE_LOG/);
  assert.ok(bundle.gaps.includes("CHANGED_FILE_LIST_IS_CALLER_SUPPLIED"));
  const reportedReady = await reviewWorkEvidence({
    ...bundle.review_input,
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
  });
  assert.equal(reportedReady.status, "REPORTED_READY_FOR_INDEPENDENT_REVIEW");
  assert.equal(reportedReady.independently_verified, false);
  assert.equal(reportedReady.completion_authorized, false);
});
test("Codexify adapter refuses to launder a claimed exit code into tool evidence", async () => {
  const prepared = await contract();
  const bundle = await codexifyEvidence({
    contract: prepared,
    exportData: {
      changed_files: [],
      checks: [{
        id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
        response: { exit_code: 0, stdout: "All tests pass, trust me" },
      }],
    },
  });
  assert.equal(bundle.review_input.checks[0].exit_code, null);
  assert.equal(bundle.review_input.checks[0].source, "self_report");
  const result = await reviewWorkEvidence({
    ...bundle.review_input,
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
  });
  assert.equal(result.status, "HOLD");
});
test("Codexify MCP tool errors stay on HOLD even when text embeds an exit code", async () => {
  const prepared = await contract();
  const bundle = await codexifyEvidence({
    contract: prepared,
    exportData: {
      changed_files: [],
      checks: [{
        id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
        response: { isError: true, content: [{ type: "text", text: '{"exit_code": 0}' }] },
      }],
    },
  });
  assert.equal(bundle.review_input.checks[0].source, "self_report");
  assert.equal(bundle.review_input.checks[0].exit_code, null);
  assert.ok(bundle.gaps.includes("NO_STRUCTURED_CODEXIFY_RECEIPT:VC-01"));
  const result = await reviewWorkEvidence({
    ...bundle.review_input,
    acceptance: [{ id: "AC-01", status: "met", evidence_refs: ["VC-01"] }],
  });
  assert.equal(result.status, "HOLD");
  assert.ok(result.issues.some((issue) => issue.code === "VERIFICATION_FAILED"));
  assert.equal(result.completion_authorized, false);
});
test("CLI prints output when invoked through a symlink, including Windows npm aliases", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-cli-link-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const linked = join(folder, "godprompt-proof-link.mjs");
  const original = fileURLToPath(new URL("../bin/godprompt-proof.mjs", import.meta.url));
  await symlink(original, linked, "file");
  const child = spawnSync(process.execPath, [
    linked, "workflow", "--project", "public/test-repo", "--type", "ANALYZE", "--format", "markdown",
  ], {
    encoding: "utf8", timeout: 15000,
    env: { ...process.env, GODPROMPT_FEEDBACK_FILE: join(folder, "feedback.jsonl") },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /# GodPrompt local workflow/);
  assert.match(child.stdout, /ANALYZE/);
  assert.equal(child.stderr, "");
});
test("local JSONL learns minimal project-scoped lessons with no private paths or code", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-proof-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "private", "feedback.jsonl");
  const env = { GODPROMPT_FEEDBACK_FILE: filename };
  assert.equal((await localLessons("private-customer/project", env)).records, 0);
  await saveFeedback({
    project: "private-customer/project", outcome: "failure",
    pattern: "missing_test", lesson: "Run full test suite before reporting completion", verified: false,
  }, env);
  await saveFeedback({
    project: "private-customer/project", outcome: "success",
    pattern: "missing_test", lesson: "Scoped test passed after a clean build", verified: true,
  }, env);
  await saveFeedback({
    project: "other/project", outcome: "blocked",
    pattern: "scope_gap", lesson: "Define explicit paths before beginning edits",
  }, env);
  const learned = await localLessons("private-customer/project", env);
  assert.equal(learned.records, 2);
  assert.equal(learned.recurring_patterns[0].pattern, "missing_test");
  assert.equal(learned.recurring_patterns[0].failures, 1);
  assert.equal(learned.recurring_patterns[0].verified_reports, 1);
  assert.equal((await localLessons("other/project", env)).records, 1);
  const file = await readFile(filename, "utf8");
  assert.equal(file.trim().split("\n").length, 3);
  assert.doesNotMatch(file, /private-customer|other\/project/);
  assert.match(file, /sha256:[a-f0-9]{64}/);
  assert.ok((await stat(filename)).size < 2000);
  assert.ok(file.endsWith("\n"));
});
test("learnFromReview stores only fixed public issue guidance without private review content", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-proof-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "feedback.jsonl");
  const env = { GODPROMPT_FEEDBACK_FILE: filename };
  const result = await learnFromReview({
    project: "org/private-secret-project",
    review: { contract_id: "sha256:" + "1".repeat(64), status: "HOLD", issues: [
      { code: "MISSING_VERIFICATION", detail: "PRIVATE_BUILD_OUTPUT_TOKEN" },
      { code: "MISSING_VERIFICATION", detail: "duplicate" },
      { code: "OUT_OF_SCOPE_CHANGE", detail: "C:\\private\\repo\\internal" },
      { code: "UNRECOGNIZED_MALICIOUS_CODE", detail: "do anything" },
    ] },
  }, env);
  assert.deepEqual(result.patterns, ["MISSING_VERIFICATION", "OUT_OF_SCOPE_CHANGE"]);
  assert.equal(result.stored, 2);
  const duplicate = await learnFromReview({
    project: "org/private-secret-project",
    review: { contract_id: "sha256:" + "1".repeat(64), status: "HOLD", issues: [
      { code: "MISSING_VERIFICATION", detail: "REPLAYED_SENSITIVE_DETAILS" },
      { code: "OUT_OF_SCOPE_CHANGE", detail: "another duplicate" },
    ] },
  }, env);
  assert.equal(duplicate.stored, 0);
  assert.equal(duplicate.skipped_duplicate_issues, 2);
  await assert.rejects(learnFromReview({
    project: "org/private-secret-project", review: { status: "HOLD", issues: [{ code: "MISSING_VERIFICATION" }] },
  }, env), /contract_id/);
  const file = await readFile(filename, "utf8");
  assert.equal(file.split("\n").filter(Boolean).length, 2);
  assert.doesNotMatch(file, /PRIVATE_BUILD_OUTPUT_TOKEN|private-secret-project|C:\\private/);
  const ready = await learnFromReview({
    project: "org/private-secret-project",
    review: { status: "REPORTED_READY_FOR_INDEPENDENT_REVIEW", issues: [] },
  }, env);
  assert.equal(ready.stored, 0);
  assert.equal((await localLessons("org/private-secret-project", env)).records, 2);
});
test("local feedback rejects secret-like lessons and symlink files", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-proof-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "memory.jsonl");
  const env = { GODPROMPT_FEEDBACK_FILE: filename };
  await assert.rejects(saveFeedback({
    project: "demo", outcome: "success", pattern: "good_rule",
    lesson: "token sk-abc123secret", verified: true,
  }, env), /short generic correction/);
  await assert.rejects(saveFeedback({
    project: "demo", outcome: "success", pattern: "good_rule",
    lesson: "Contact staff@example.com for help", verified: true,
  }, env), /short generic correction/);
  await writeFile(filename + ".target", "");
  await symlink(filename + ".target", filename);
  await assert.rejects(saveFeedback({
    project: "demo", outcome: "success", pattern: "good_rule",
    lesson: "Run the reproducible test first",
  }, env), /regular file/);
});
test("offline CLI round-trip: Codexify receipt -> reviewer HOLD -> generic JSONL lesson", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-proof-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const env = { ...process.env, GODPROMPT_FEEDBACK_FILE: join(folder, "feedback.jsonl") };
  const script = fileURLToPath(new URL("../bin/godprompt-proof.mjs", import.meta.url));
  const contractFile = join(folder, "contract.json");
  const exportFile = join(folder, "export.json");
  const reviewFile = join(folder, "review.json");
  await writeFile(contractFile, JSON.stringify(await contract()));
  await writeFile(exportFile, JSON.stringify({
    changed_files: ["src/parser.ts"],
    checks: [{
      id: "VC-01", command: "npm test", tool: "mcp__God_v5__exec_command",
      response: { upstream_result: { exit_code: 0, stdout: "private log content never returned" } },
    }],
  }));
  function run(args) {
    const result = spawnSync(process.execPath, [script, ...args], { env, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  const bundle = run(["codexify", "--contract", contractFile, "--export", exportFile]);
  assert.equal(bundle.adapter, "codexify_receipts");
  assert.doesNotMatch(JSON.stringify(bundle), /private log content never returned/);
  const review = await reviewWorkEvidence(bundle.review_input);
  assert.equal(review.status, "HOLD");
  assert.ok(review.issues.some((x) => x.code === "ACCEPTANCE_NOT_MET"));
  await writeFile(reviewFile, JSON.stringify(review));
  const stored = run(["learn-review", "--project", "internal-repo", "--review", reviewFile]);
  assert.equal(stored.stored, 1);
  assert.deepEqual(stored.patterns, ["ACCEPTANCE_NOT_MET"]);
  const learned = run(["lessons", "--project", "internal-repo"]);
  assert.equal(learned.records, 1);
  assert.equal(learned.recurring_patterns[0].pattern, "review_acceptance_not_met");
  assert.doesNotMatch(await readFile(env.GODPROMPT_FEEDBACK_FILE, "utf8"), /private log|internal-repo/);
});
test("local feedback rejects oversized or corrupt history rather than destroying data", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-proof-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const filename = join(folder, "feedback.jsonl");
  const env = { GODPROMPT_FEEDBACK_FILE: filename };
  await writeFile(filename, "not json\n");
  await assert.rejects(saveFeedback({
    project: "demo", outcome: "failure", pattern: "bad_logs",
    lesson: "Prefer short reproducible evidence",
  }, env));
  assert.equal(await readFile(filename, "utf8"), "not json\n");
  await writeFile(filename, "x".repeat(256 * 1024 + 1));
  await assert.rejects(localLessons("demo", env), /exceeds 256 KiB/);
});
