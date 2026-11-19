#!/usr/bin/env node
/**
 * Optional, local-only GodPrompt evidence bridge. Node 22+, zero dependencies.
 * The public Cloudflare MCP never imports or executes this file.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readFile, lstat, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BUNDLE_SCHEMA = "godprompt.evidence_bundle.v1";
const MAX_JSON_BYTES = 256 * 1024;
const MAX_FEEDBACK_BYTES = 256 * 1024;
const MAX_PAGES = 3;

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
function fail(message) {
  throw new Error(message);
}
function checkContract(contract) {
  if (!contract || contract.schema !== "godprompt.work_contract.v1" ||
      !/^sha256:[a-f0-9]{64}$/.test(contract.contract_id || "") ||
      !Array.isArray(contract.verification_commands) ||
      !Array.isArray(contract.allowed_paths) ||
      !Array.isArray(contract.success_criteria)) fail("Expected a complete v1 GodPrompt contract");
  return contract;
}
export async function readSmallJson(filename) {
  const bytes = await readFile(filename);
  if (bytes.length > MAX_JSON_BYTES) fail("Input JSON exceeds the 256 KiB limit");
  return JSON.parse(bytes.toString("utf8"));
}
function makeBundle(adapter, contract, changedFiles, checks, gaps, provenance) {
  return {
    schema: BUNDLE_SCHEMA,
    adapter,
    provenance,
    review_input: {
      contract,
      changed_files: changedFiles,
      operations_performed: [],
      checks,
      acceptance: [],
      observations: [],
      human_review_reported: false,
    },
    gaps: [...new Set(gaps)],
    independently_verified: false,
    completion_authorized: false,
    warning: "Caller-supplied exports and GitHub check names are not proof that contracted commands ran. Acceptance, complete diff, approvals and original outputs require independent review. Never send private evidence to the public MCP.",
  };
}
function validateRepo(repo, sha) {
  const segments = typeof repo === "string" ? repo.split("/") : [];
  if (segments.length !== 2 || segments.some((s) => !/^[A-Za-z0-9_.-]{1,100}$/.test(s) || s === "." || s === "..")) {
    fail("Repository must be owner/name");
  }
  if (typeof sha !== "string" || !/^[a-f0-9]{40}$/.test(sha)) fail("Use an exact 40-character lowercase commit SHA");
}
async function githubJson(url, fetchImpl) {
  if (new URL(url).origin !== "https://api.github.com") fail("GitHub API origin mismatch");
  // Only the actual network adapter needs credentials. Never pass a token to
  // caller-injected fetch handlers (including the offline connector snapshot).
  const token = fetchImpl === fetch ? process.env.GITHUB_TOKEN : null;
  const response = await fetchImpl(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "godprompt-proof-bridge",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) fail("GitHub API HTTP " + response.status + " (credentials and response body withheld)");
  const body = await response.text();
  if (Buffer.byteLength(body) > 8 * 1024 * 1024) fail("GitHub response exceeds the safety limit");
  return {
    data: JSON.parse(body),
    hasNext: /rel="next"/.test(response.headers.get("link") || ""),
  };
}
export async function githubEvidence({ repo, sha, contract, mapping = {}, pr = null, fetchImpl = fetch }) {
  validateRepo(repo, sha);
  checkContract(contract);
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) fail("Expected a VC-ID-to-check-name JSON map");
  const base = "https://api.github.com/repos/" + repo;
  const gaps = [];
  if (pr !== null && (!Number.isInteger(pr) || pr < 1 || pr > 1000000)) fail("PR must be a positive integer");
  const files = [];
  let completeFiles = true;
  const recordFile = (entry) => {
    if (!entry || typeof entry.filename !== "string") fail("GitHub file list contains an invalid path");
    files.push(entry.filename);
    if (entry.status === "renamed" && typeof entry.previous_filename === "string") files.push(entry.previous_filename);
  };
  if (pr === null) {
    gaps.push("SINGLE_COMMIT_DIFF_ONLY_NOT_FULL_PR");
    for (let page = 1; page <= MAX_PAGES; page++) {
      const item = await githubJson(base + "/commits/" + sha + "?per_page=100&page=" + page, fetchImpl);
      if (item.data.sha !== sha || !Array.isArray(item.data.files)) fail("GitHub commit SHA or file list mismatch");
      for (const entry of item.data.files) recordFile(entry);
      if (!item.hasNext) break;
      if (page === MAX_PAGES) {
        completeFiles = false;
        gaps.push("COMMIT_FILE_LIST_TRUNCATED");
      }
    }
  } else {
    const pullUrl = base + "/pulls/" + pr;
    const before = await githubJson(pullUrl, fetchImpl);
    if (before.data.number !== pr || before.data.head?.sha !== sha) fail("GitHub PR head SHA mismatch");
    for (let page = 1; page <= MAX_PAGES; page++) {
      const item = await githubJson(pullUrl + "/files?per_page=100&page=" + page, fetchImpl);
      if (!Array.isArray(item.data)) fail("GitHub PR files response malformed");
      for (const entry of item.data) recordFile(entry);
      if (!item.hasNext) break;
      if (page === MAX_PAGES) {
        completeFiles = false;
        gaps.push("PR_FILE_LIST_TRUNCATED");
      }
    }
    const after = await githubJson(pullUrl, fetchImpl);
    if (after.data.number !== pr || after.data.head?.sha !== sha) fail("GitHub PR head moved while collecting evidence");
  }
  const runs = [];
  let completeRuns = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const item = await githubJson(base + "/commits/" + sha + "/check-runs?per_page=100&page=" + page, fetchImpl);
    if (!Array.isArray(item.data.check_runs)) fail("GitHub check-runs response malformed");
    for (const run of item.data.check_runs) {
      if (run.head_sha !== sha) fail("GitHub check-run head SHA mismatch");
      runs.push(run);
    }
    if (!item.hasNext) {
      if (Number.isInteger(item.data.total_count) && item.data.total_count > runs.length) {
        completeRuns = false;
        gaps.push("CHECK_RUNS_INCOMPLETE");
      }
      break;
    }
    if (page === MAX_PAGES) {
      completeRuns = false;
      gaps.push("CHECK_RUNS_TRUNCATED");
    }
  }
  const checks = [];
  const ids = {};
  for (const expected of contract.verification_commands) {
    const name = mapping[expected.id];
    if (typeof name !== "string" || !name.trim()) {
      gaps.push("CHECK_NOT_MAPPED:" + expected.id);
      continue;
    }
    const matches = runs.filter((run) => run.name === name);
    if (matches.length !== 1) {
      gaps.push((matches.length ? "AMBIGUOUS_CHECK:" : "CHECK_NOT_FOUND:") + expected.id);
      continue;
    }
    const run = matches[0];
    const passed = completeFiles && completeRuns && run.status === "completed" && run.conclusion === "success";
    const receipt = {
      id: expected.id,
      command: expected.command,
      exit_code: passed ? 0 : (!completeFiles || !completeRuns || run.status !== "completed" ? null : 1),
      source: "tool_output",
      evidence_excerpt: "GitHub check '" + name.slice(0, 100) + "' status=" + run.status + ", conclusion=" + run.conclusion + ", commit=" + sha.slice(0, 12) + ". Exact command execution NOT established.",
    };
    if (!passed) gaps.push("CHECK_NOT_SUCCESSFUL:" + expected.id);
    checks.push(receipt);
    ids[expected.id] = Number.isInteger(run.id) ? run.id : null;
  }
  gaps.push("ACCEPTANCE_REQUIRES_INDEPENDENT_EVIDENCE");
  if (!completeFiles) files.length = 0;
  return makeBundle("github_checks", contract, [...new Set(files)], checks, gaps, {
    provider: "github_rest_readonly",
    commit_sha: sha,
    diff_scope: pr === null ? "single_commit" : "pull_request",
    pull_request_number: pr,
    check_run_ids: ids,
    file_list_complete: completeFiles,
    check_run_list_complete: completeRuns,
  });
}
/**
 * Use a previously authorized GitHub connector export when no local GitHub
 * credential is available. Entirely offline; never claims authenticated proof.
 */
export async function githubSnapshotEvidence({ repo, sha, contract, mapping = {}, pr = null, snapshot }) {
  const sourceFiles = pr === null ? snapshot?.commit?.files : snapshot?.pr_files;
  if (!snapshot || typeof snapshot !== "object" || snapshot.complete !== true ||
      !snapshot.check_runs || !Array.isArray(snapshot.check_runs.check_runs) ||
      !Array.isArray(sourceFiles) ||
      (pr === null && !snapshot.commit) ||
      (pr !== null && (!snapshot.pull_request || snapshot.pull_request.number !== pr ||
                      snapshot.pull_request.head?.sha !== sha))) {
    fail("Snapshot must contain complete:true, matching commit or pull_request, files and check_runs");
  }
  if (sourceFiles.length > 100 ||
      (Number.isInteger(snapshot.check_runs.total_count) &&
       snapshot.check_runs.total_count !== snapshot.check_runs.check_runs.length) ||
      snapshot.check_runs.check_runs.length > 100) {
    fail("Snapshot might be paginated; collect complete results or use direct GitHub reads");
  }
  const fetchImpl = async (url) => {
    const data = url.includes("/check-runs?") ? snapshot.check_runs :
      pr !== null && url.includes("/pulls/" + pr + "/files?") ? snapshot.pr_files :
      pr !== null && url.endsWith("/pulls/" + pr) ? snapshot.pull_request :
      snapshot.commit;
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const bundle = await githubEvidence({ repo, sha, contract, mapping, pr, fetchImpl });
  bundle.adapter = "github_connector_snapshot";
  bundle.provenance.provider = "caller_supplied_github_connector_snapshot";
  bundle.gaps.push("CONNECTOR_SNAPSHOT_PROVENANCE_NOT_AUTHENTICATED");
  return bundle;
}
export function codexifyEvidence({ contract, exportData }) {
  checkContract(contract);
  if (!exportData || typeof exportData !== "object" || Array.isArray(exportData)) fail("Codexify export must be an object");
  const rawFiles = exportData.changed_files;
  if (!Array.isArray(rawFiles) || rawFiles.length > 150 || rawFiles.some((v) => typeof v !== "string")) {
    fail("Codexify export needs a bounded changed_files array");
  }
  const rawChecks = exportData.checks;
  if (!Array.isArray(rawChecks) || rawChecks.length > 100) fail("Codexify export needs a bounded checks array");
  const gaps = [];
  const checks = rawChecks.map((receipt) => {
    if (!receipt || typeof receipt !== "object" || typeof receipt.id !== "string" || typeof receipt.command !== "string") {
      fail("Malformed Codexify receipt");
    }
    // Only a pasted structured exec_command envelope is attributed to tool output.
    // An ordinary claimed numeric exit_code is never promoted to tool provenance.
    // A contradictory error envelope is not a successful execution receipt,
    // even when its caller-supplied nested result contains exit_code: 0.
    const response = receipt.response;
    const result = receipt.tool === "mcp__God_v5__exec_command" &&
      response && typeof response === "object" && response.isError !== true &&
      response.upstream_result?.isError !== true ? response.upstream_result : null;
    const code = Number.isInteger(result?.exit_code) && result.exit_code >= 0 ? result.exit_code : null;
    const attributed = code !== null;
    if (!attributed) gaps.push("NO_STRUCTURED_CODEXIFY_RECEIPT:" + receipt.id);
    return {
      id: receipt.id,
      command: receipt.command,
      exit_code: code,
      source: attributed ? "tool_output" : "self_report",
      evidence_excerpt: attributed
        ? "Codexify exec_command exported envelope: exit_code=" + code + "; result_sha256=" + sha256(JSON.stringify(result)).slice(0, 16) + "; raw output withheld."
        : "No structured Codexify exec_command tool result; self-report only.",
    };
  });
  for (const required of contract.verification_commands) {
    if (!checks.some((c) => c.id === required.id)) gaps.push("VERIFICATION_MISSING:" + required.id);
  }
  gaps.push("CHANGED_FILE_LIST_IS_CALLER_SUPPLIED");
  gaps.push("ACCEPTANCE_REQUIRES_INDEPENDENT_EVIDENCE");
  const bundle = makeBundle("codexify_receipts", contract, rawFiles, checks, gaps, {
    provider: "codexify_export",
    claimed_receipts: checks.length,
  });
  if (Array.isArray(exportData.operations_performed) &&
      exportData.operations_performed.length <= 100 &&
      exportData.operations_performed.every((v) => typeof v === "string" && v.length <= 500)) {
    bundle.review_input.operations_performed = exportData.operations_performed;
  }
  return bundle;
}
function filePath(env = process.env) {
  if (env.GODPROMPT_FEEDBACK_FILE) {
    if (!isAbsolute(env.GODPROMPT_FEEDBACK_FILE)) fail("GODPROMPT_FEEDBACK_FILE must be an absolute path");
    return env.GODPROMPT_FEEDBACK_FILE;
  }
  const base = env.LOCALAPPDATA || env.XDG_STATE_HOME || join(homedir(), ".local", "state");
  return join(base, "godprompt", "feedback.jsonl");
}
function projectDigest(project) {
  if (typeof project !== "string" || project.trim().length < 2 || project.length > 160) fail("Project identifier must be 2-160 characters");
  return "sha256:" + sha256(project.trim());
}
async function readEvents(filename) {
  let info;
  try { info = await lstat(filename); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink()) fail("Feedback path must be a regular file, not a symlink");
  if (info.size > MAX_FEEDBACK_BYTES) fail("Local feedback file exceeds 256 KiB; archive it before adding more");
  const text = await readFile(filename, "utf8");
  const lines = text.split("\n").filter(Boolean);
  return lines.map((line) => {
    const event = JSON.parse(line);
    if (!event || event.v !== 1 ||
        typeof event.project !== "string" || !/^sha256:[a-f0-9]{64}$/.test(event.project) ||
        typeof event.pattern !== "string" || typeof event.lesson !== "string" ||
        (event.review_ref !== undefined && !/^[a-f0-9]{24}$/.test(event.review_ref))) {
      fail("Malformed feedback file; no automatic repair or overwrite");
    }
    return event;
  });
}
export async function saveFeedback({ project, outcome, pattern, lesson, verified = false, reviewRef = null }, env = process.env) {
  const hash = projectDigest(project);
  if (!["success", "failure", "blocked"].includes(outcome)) fail("Outcome must be success, failure or blocked");
  if (typeof pattern !== "string" || !/^[a-z][a-z0-9_-]{2,47}$/.test(pattern)) {
    fail("Pattern must be a 3-48 character lowercase issue code");
  }
  if (typeof lesson !== "string" || lesson.length < 5 || lesson.length > 160 ||
      /[\r\n\t<>@]/.test(lesson) || /(?:https?:\/\/|[a-z]:\\|\/users\/|\/home\/|bearer |password|secret|api[_ -]?key|ghp_|github_pat_|sk-)/i.test(lesson)) {
    fail("Lesson must be a short generic correction with no URLs, paths, credentials, or personal data");
  }
  if (typeof verified !== "boolean") fail("verified must be a boolean");
  if (reviewRef !== null && (typeof reviewRef !== "string" || !/^[a-f0-9]{24}$/.test(reviewRef))) {
    fail("Invalid bounded review fingerprint");
  }
  const filename = filePath(env);
  const current = await readEvents(filename);
  if (reviewRef && current.some((event) => event.project === hash && event.review_ref === reviewRef)) {
    return { stored: false, reason: "duplicate_review_issue", scope: "local_only", project_hash: hash };
  }
  const event = {
    v: 1, project: hash, at: new Date().toISOString(),
    outcome, pattern, lesson: lesson.trim(), verified_reported: verified,
    ...(reviewRef ? { review_ref: reviewRef } : {}),
  };
  const row = JSON.stringify(event) + "\n";
  let used = 0;
  try { used = (await lstat(filename)).size; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (used + Buffer.byteLength(row) > MAX_FEEDBACK_BYTES) fail("Feedback file is full (256 KiB); archive or rotate it manually");
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
  const fd = await open(filename, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | (constants.O_NOFOLLOW || 0), 0o600);
  try { await fd.writeFile(row, "utf8"); }
  finally { await fd.close(); }
  return { stored: true, scope: "local_only", project_hash: hash, records_for_project: current.filter((e) => e.project === hash).length + 1, verified_reported: verified };
}
export async function localLessons(project, env = process.env) {
  const hash = projectDigest(project);
  const records = (await readEvents(filePath(env))).filter((e) => e.project === hash);
  const byPattern = new Map();
  for (const item of records) {
    const value = byPattern.get(item.pattern) || { pattern: item.pattern, total: 0, failures: 0, verified_reports: 0 };
    value.total++;
    if (item.outcome !== "success") value.failures++;
    if (item.verified_reported) value.verified_reports++;
    byPattern.set(item.pattern, value);
  }
  return {
    scope: "local_only",
    project_hash: hash,
    records: records.length,
    recurring_patterns: [...byPattern.values()].sort((a, b) => b.failures - a.failures || b.total - a.total).slice(0, 10),
    recent_lessons: records.slice(-5).reverse().map((x) => ({
      pattern: x.pattern, outcome: x.outcome, lesson: x.lesson, verified_reported: x.verified_reported,
    })),
    warning: "These are local user-reported observations, not trained weights, global rules or independently verified facts.",
  };
}
/**
 * On-demand, read-only local observability. No telemetry or additional files.
 * Outcomes are reported observations, never a measured agent success rate.
 */
export async function localMetrics(project, { days = 30, now = Date.now() } = {}, env = process.env) {
  const hash = projectDigest(project);
  if (!Number.isInteger(days) || days < 1 || days > 365) fail("Metric window must be 1-365 days");
  const timestamp = typeof now === "number" ? now : Date.parse(now);
  if (!Number.isFinite(timestamp)) fail("Invalid metrics reference time");
  const filename = filePath(env);
  const records = (await readEvents(filename)).filter((row) => row.project === hash);
  const cutoff = timestamp - days * 86400000;
  const inWindow = records.filter((row) => {
    const time = Date.parse(row.at);
    return Number.isFinite(time) && time <= timestamp && time >= cutoff;
  });
  const counts = (items) => {
    const result = { success: 0, failure: 0, blocked: 0 };
    for (const item of items) if (Object.hasOwn(result, item.outcome)) result[item.outcome]++;
    return result;
  };
  const patterns = new Map();
  for (const item of inWindow) {
    if (item.outcome === "success") continue;
    const count = patterns.get(item.pattern) || 0;
    patterns.set(item.pattern, count + 1);
  }
  const topHolds = [...patterns].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10).map(([pattern, reported_count]) => ({ pattern, reported_count }));
  let fileBytes = 0;
  try { fileBytes = (await lstat(filename)).size; }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return {
    scope: "local_only",
    project_hash: hash,
    file_bytes: fileBytes,
    file_cap_bytes: MAX_FEEDBACK_BYTES,
    window_days: days,
    reported_events_all_time: records.length,
    reported_events_window: inWindow.length,
    reported_outcomes_all_time: counts(records),
    reported_outcomes_window: counts(inWindow),
    reported_verifications_window: inWindow.filter((row) => row.verified_reported === true).length,
    recurring_hold_patterns_window: topHolds,
    latest_event_at: records.length ? records[records.length - 1].at : null,
    warning: "Only user-reported events are counted. Sampling is incomplete and biased; do not interpret these counts as task success rates, measured quality uplift or independently verified telemetry.",
  };
}
// Only fixed, public generic corrections are stored from a review. The
// submitted task, issue details, command output and paths are never persisted.
const REVIEW_LESSONS = Object.freeze({
  MISSING_VERIFICATION: "Run each required verification command before completion",
  VERIFICATION_FAILED: "Fix failed checks and rerun them before completion",
  COMMAND_MISMATCH: "Preserve exact contracted commands in verification receipts",
  SELF_REPORTED_CHECK: "Use real structured tool receipts rather than claimed success",
  OUT_OF_SCOPE_CHANGE: "Review and revert changes outside the approved paths",
  INVALID_CHANGED_PATH: "Use safe repository relative paths for changed files",
  PROHIBITED_ACTION_REPORTED: "Stop prohibited actions and request explicit authorization",
  ACCEPTANCE_NOT_MET: "Validate each acceptance criterion with observable evidence",
  ACCEPTANCE_EVIDENCE_MISSING: "Reference successful checks or observations for acceptance",
  CONTRACT_DRIFT: "Recreate the contract after any approved scope change",
  REVIEW_REQUIRED: "Obtain separately authorized human review for high risk",
  DUPLICATE_CHECK_RECEIPT: "Deduplicate verification receipt identifiers before review",
});
export async function learnFromReview({ project, review }, env = process.env) {
  if (!review || typeof review !== "object" ||
      review.status !== "HOLD" || !Array.isArray(review.issues)) {
    return { stored: 0, reason: "Only HOLD issue codes are stored; a ready report is not verified success" };
  }
  if (typeof review.contract_id !== "string" || !/^sha256:[a-f0-9]{64}$/.test(review.contract_id)) {
    fail("A HOLD review must contain its original v1 contract_id to avoid double-counting");
  }
  const codes = [...new Set(review.issues.map((item) => item?.code))].filter(
    (code) => typeof code === "string" && Object.hasOwn(REVIEW_LESSONS, code)
  ).slice(0, 8);
  const storedCodes = [];
  for (const code of codes) {
    const result = await saveFeedback({
      project,
      outcome: "blocked",
      pattern: "review_" + code.toLowerCase(),
      lesson: REVIEW_LESSONS[code],
      verified: false,
      reviewRef: sha256(review.contract_id + ":" + code).slice(0, 24),
    }, env);
    if (result.stored) storedCodes.push(code);
  }
  return {
    stored: storedCodes.length,
    skipped_duplicate_issues: codes.length - storedCodes.length,
    patterns: storedCodes,
    source_is_caller_supplied: true,
    note: "Stored only previously unseen contract-and-HOLD-code pairs as generic local lessons; no raw details or global policy changes.",
  };
}
// Versioned, bounded workflow previews. This stays entirely local and is
// read-only. Repeated HOLDs suggest human-reviewed changes, never trust grants.
export const WORKFLOW_SCHEMA = "godprompt.local_workflow.v1";
const WORKFLOW_FOCUS = Object.freeze({
  BUILD: "Define observable acceptance; add focused regression tests before implementation.",
  DEBUG: "Reproduce the failure; isolate its root cause; test the fix and neighboring paths.",
  REFACTOR: "Characterize existing behavior; change structure; verify behavior preservation.",
  CONTENT: "Verify sources and factual claims; make focused edits; review accuracy and clarity.",
  DESIGN: "Define design constraints; inspect responsive and accessible states; verify screenshots.",
  SHIP: "Inspect release impact and rollback path; require explicit publish or deployment approval.",
  ANALYZE: "Inspect authoritative evidence; separate observations from interpretation and unknowns.",
  AUTOMATE: "Test idempotence, retries, failure handling and dry-run behavior before activation.",
  PLAN: "Record constraints, assumptions, alternatives, uncertainties and explicit next actions.",
});
const BASE_WORKFLOW_GATES = Object.freeze([
  "Use only paths and actions that the user and host authorize.",
  "Create or review a task contract with explicit success criteria and verification commands.",
  "Run checks in the actual environment and retain redacted tool or CI receipts.",
  "Treat reported-ready evidence as unverified until independent source review.",
  "Do not merge, publish, deploy, spend or widen risk limits without separate authorization.",
]);
const REVIEW_PATTERN_PREFIX = "review_";
export async function localWorkflow(project, {
  taskType = "BUILD", riskLevel = "medium", minReports = 3,
} = {}, env = process.env) {
  const hash = projectDigest(project);
  if (!Object.hasOwn(WORKFLOW_FOCUS, taskType)) fail("Workflow task type must be a classified GodPrompt task type");
  if (!["low", "medium", "high", "critical"].includes(riskLevel)) fail("Invalid workflow risk level");
  if (!Number.isInteger(minReports) || minReports < 2 || minReports > 20) fail("minReports must be an integer from 2 through 20");
  const events = (await readEvents(filePath(env))).filter((row) => row.project === hash);
  const issueCodes = new Map();
  for (const row of events) {
    if (row.outcome !== "blocked" || typeof row.pattern !== "string" ||
        typeof row.review_ref !== "string" ||
        !row.pattern.startsWith(REVIEW_PATTERN_PREFIX)) continue;
    const issue = row.pattern.slice(REVIEW_PATTERN_PREFIX.length).toUpperCase();
    if (!Object.hasOwn(REVIEW_LESSONS, issue)) continue;
    issueCodes.set(issue, (issueCodes.get(issue) || 0) + 1);
  }
  const candidates = [...issueCodes].filter(([, count]) => count >= minReports)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8).map(([code, count]) => ({
      issue_code: code,
      reported_holds: count,
      proposed_safeguard: REVIEW_LESSONS[code],
      status: "NEEDS_HUMAN_REVIEW",
    }));
  const payload = {
    schema: WORKFLOW_SCHEMA,
    project_hash: hash,
    task_type: taskType,
    risk_level: riskLevel,
    focus: WORKFLOW_FOCUS[taskType],
    standard_gates: [...BASE_WORKFLOW_GATES],
    human_review_required: riskLevel === "high" || riskLevel === "critical",
    suggestion_threshold: minReports,
    review_candidates: candidates,
    auto_promoted: false,
    independently_verified: false,
  };
  const version = "sha256:" + sha256(JSON.stringify(payload));
  const markdown = [
    "# GodPrompt local workflow — " + taskType,
    "",
    "Version: " + version,
    "Scope: per-project local preview; no policy changes applied",
    "",
    "## Task focus",
    payload.focus,
    "",
    "## Standard verification gates",
    ...payload.standard_gates.map((gate) => "- " + gate),
    ...(payload.human_review_required
      ? ["", "## High-risk requirement", "- Obtain separately authorized human review before completion."] : []),
    "",
    "## Repeated local HOLD patterns — review candidates, NOT trusted rules",
    ...(candidates.length ? candidates.map((entry) =>
      "- " + entry.issue_code + " (" + entry.reported_holds + " reported HOLDs): " + entry.proposed_safeguard
    ) : ["- None met the review threshold."]),
    "",
    "These are caller-supplied observations, not authenticated results. Do not copy candidates into project policy or global GodPrompt rules without an authorized human review and independent evidence.",
    "The CLI never edits AGENTS.md, source files, the public MCP or local feedback during preview.",
  ].join("\n");
  return {
    ...payload,
    version,
    markdown,
    read_only: true,
    source_reports_examined: events.length,
    warning: "Version tracks a deterministic preview, not an approved rule set. Repeated self-reports are not independent evidence, and no policy is automatically applied.",
  };
}
function parseOptions(argv) {
  const command = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || i + 1 >= argv.length) fail("Expected --name value option pairs");
    const key = argv[i].slice(2);
    if (!/^[a-z-]+$/.test(key) || Object.hasOwn(opts, key)) fail("Invalid or duplicate flag");
    opts[key] = argv[i + 1];
  }
  const allowed = {
    github: ["repo", "sha", "contract", "map", "pr"],
    "github-snapshot": ["repo", "sha", "contract", "map", "snapshot", "pr"],
    codexify: ["contract", "export"],
    learn: ["project", "outcome", "pattern", "lesson", "verified"],
    lessons: ["project"],
    "learn-review": ["project", "review"],
    metrics: ["project", "days"],
    workflow: ["project", "type", "risk", "min-reports", "format"],
  };
  if (!allowed[command]) fail("Usage: godprompt-proof github|github-snapshot|codexify|learn|learn-review|lessons|metrics|workflow [--name value ...]");
  for (const key of Object.keys(opts)) if (!allowed[command].includes(key)) fail("Unknown option --" + key);
  return { command, opts };
}
export async function cli(argv = process.argv.slice(2)) {
  const { command, opts } = parseOptions(argv);
  if (command === "github") {
    if (!opts.repo || !opts.sha || !opts.contract) fail("github requires --repo --sha --contract");
    return githubEvidence({
      repo: opts.repo,
      sha: opts.sha,
      contract: checkContract(await readSmallJson(opts.contract)),
      mapping: opts.map ? await readSmallJson(opts.map) : {},
      pr: opts.pr ? Number(opts.pr) : null,
    });
  }
  if (command === "github-snapshot") {
    if (!opts.repo || !opts.sha || !opts.contract || !opts.snapshot) fail("github-snapshot requires --repo --sha --contract --snapshot");
    return githubSnapshotEvidence({
      repo: opts.repo,
      sha: opts.sha,
      contract: checkContract(await readSmallJson(opts.contract)),
      mapping: opts.map ? await readSmallJson(opts.map) : {},
      pr: opts.pr ? Number(opts.pr) : null,
      snapshot: await readSmallJson(opts.snapshot),
    });
  }
  if (command === "codexify") {
    if (!opts.contract || !opts.export) fail("codexify requires --contract --export");
    return codexifyEvidence({
      contract: checkContract(await readSmallJson(opts.contract)),
      exportData: await readSmallJson(opts.export),
    });
  }
  if (command === "learn-review") {
    if (!opts.project || !opts.review) fail("learn-review requires --project --review");
    return learnFromReview({ project: opts.project, review: await readSmallJson(opts.review) });
  }
  if (command === "learn") {
    for (const key of ["project", "outcome", "pattern", "lesson"]) if (!opts[key]) fail("learn requires --" + key);
    if (opts.verified && !["true", "false"].includes(opts.verified)) fail("--verified accepts true or false");
    return saveFeedback({ ...opts, verified: opts.verified === "true" });
  }
  if (command === "metrics") {
    if (!opts.project) fail("metrics requires --project");
    return localMetrics(opts.project, { days: opts.days ? Number(opts.days) : 30 });
  }
  if (command === "workflow") {
    if (!opts.project || !opts.type) fail("workflow requires --project and --type");
    if (opts.format && !["json", "markdown"].includes(opts.format)) fail("workflow --format must be json or markdown");
    const result = await localWorkflow(opts.project, {
      taskType: opts.type,
      riskLevel: opts.risk || "medium",
      minReports: opts["min-reports"] ? Number(opts["min-reports"]) : 3,
    });
    return opts.format === "markdown" ? result.markdown : result;
  }
  if (!opts.project) fail("lessons requires --project");
  return localLessons(opts.project);
}
// npm's Windows launcher can invoke through an nvm/NTFS symlink while Node
// canonicalizes import.meta.url. Compare physical paths so the CLI actually
// runs instead of silently exiting 0 from its module-import guard.
async function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    const [entry, modulePath] = await Promise.all([
      realpath(resolve(process.argv[1])),
      realpath(fileURLToPath(import.meta.url)),
    ]);
    return process.platform === "win32"
      ? entry.toLowerCase() === modulePath.toLowerCase()
      : entry === modulePath;
  } catch {
    return false;
  }
}
const invokedAsScript = await isDirectInvocation();
if (invokedAsScript) {
  cli().then((result) => {
    process.stdout.write((typeof result === "string" ? result : JSON.stringify(result, null, 2)) + "\n");
  }).catch((error) => {
    process.stderr.write("GodPrompt proof bridge: " + error.message + "\n");
    process.exitCode = 1;
  });
}
