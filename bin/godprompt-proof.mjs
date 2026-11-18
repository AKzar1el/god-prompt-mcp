#!/usr/bin/env node
/**
 * Optional, local-only GodPrompt evidence bridge. Node 22+, zero dependencies.
 * The public Cloudflare MCP never imports or executes this file.
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, readFile, lstat } from "node:fs/promises";
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
  const token = process.env.GITHUB_TOKEN;
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
export async function githubEvidence({ repo, sha, contract, mapping = {}, fetchImpl = fetch }) {
  validateRepo(repo, sha);
  checkContract(contract);
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) fail("Expected a VC-ID-to-check-name JSON map");
  const base = "https://api.github.com/repos/" + repo;
  const gaps = [];
  const files = [];
  let completeFiles = true;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const item = await githubJson(base + "/commits/" + sha + "?per_page=100&page=" + page, fetchImpl);
    if (item.data.sha !== sha || !Array.isArray(item.data.files)) fail("GitHub commit SHA or file list mismatch");
    for (const entry of item.data.files) {
      if (typeof entry.filename !== "string") fail("GitHub commit file lacks a path");
      files.push(entry.filename);
      if (entry.status === "renamed" && typeof entry.previous_filename === "string") {
        files.push(entry.previous_filename);
      }
    }
    if (!item.hasNext) break;
    if (page === MAX_PAGES) {
      completeFiles = false;
      gaps.push("COMMIT_FILE_LIST_TRUNCATED");
    }
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
      exit_code: passed ? 0 : (run.status === "completed" && !completeFiles && !completeRuns ? null : run.status === "completed" ? 1 : null),
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
    check_run_ids: ids,
    file_list_complete: completeFiles,
    check_run_list_complete: completeRuns,
  });
}
/**
 * Use a previously authorized GitHub connector export when no local GitHub
 * credential is available. Entirely offline; never claims authenticated proof.
 */
export async function githubSnapshotEvidence({ repo, sha, contract, mapping = {}, snapshot }) {
  if (!snapshot || typeof snapshot !== "object" || snapshot.complete !== true ||
      !snapshot.commit || !snapshot.check_runs ||
      !Array.isArray(snapshot.commit.files) || !Array.isArray(snapshot.check_runs.check_runs)) {
    fail("Snapshot must contain complete:true, commit.files and check_runs.check_runs");
  }
  if (snapshot.commit.files.length > 100 ||
      (Number.isInteger(snapshot.check_runs.total_count) &&
       snapshot.check_runs.total_count !== snapshot.check_runs.check_runs.length) ||
      snapshot.check_runs.check_runs.length > 100) {
    fail("Snapshot might be paginated; collect complete results or use direct GitHub reads");
  }
  const fetchImpl = async (url) => new Response(
    JSON.stringify(url.includes("/check-runs?") ? snapshot.check_runs : snapshot.commit),
    { status: 200 }
  );
  const bundle = await githubEvidence({ repo, sha, contract, mapping, fetchImpl });
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
    const result = receipt.tool === "mcp__God_v5__exec_command" &&
      receipt.response && typeof receipt.response === "object" ? receipt.response.upstream_result : null;
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
    if (event.v !== 1 || typeof event.project !== "string" ||
        typeof event.pattern !== "string" || typeof event.lesson !== "string") {
      fail("Malformed feedback file; no automatic repair or overwrite");
    }
    return event;
  });
}
export async function saveFeedback({ project, outcome, pattern, lesson, verified = false }, env = process.env) {
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
  const filename = filePath(env);
  const current = await readEvents(filename);
  const event = {
    v: 1, project: hash, at: new Date().toISOString(),
    outcome, pattern, lesson: lesson.trim(), verified_reported: verified,
  };
  const row = JSON.stringify(event) + "\n";
  const used = Buffer.byteLength(current.map((e) => JSON.stringify(e) + "\n").join(""));
  if (used + Buffer.byteLength(row) > MAX_FEEDBACK_BYTES) fail("Feedback file is full (256 KiB); archive or rotate it manually");
  await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
  const fd = await open(filename, constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | (constants.O_NOFOLLOW || 0), 0o600);
  try { await fd.writeFile(row, "utf8"); }
  finally { await fd.close(); }
  return { stored: true, scope: "local_only", project_hash: hash, records_for_project: current.filter((e) => e.project === hash).length + 1, verified_is_reported: true };
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
    github: ["repo", "sha", "contract", "map"],
    "github-snapshot": ["repo", "sha", "contract", "map", "snapshot"],
    codexify: ["contract", "export"],
    learn: ["project", "outcome", "pattern", "lesson", "verified"],
    lessons: ["project"],
  };
  if (!allowed[command]) fail("Usage: godprompt-proof github|github-snapshot|codexify|learn|lessons [--name value ...]");
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
    });
  }
  if (command === "github-snapshot") {
    if (!opts.repo || !opts.sha || !opts.contract || !opts.snapshot) fail("github-snapshot requires --repo --sha --contract --snapshot");
    return githubSnapshotEvidence({
      repo: opts.repo,
      sha: opts.sha,
      contract: checkContract(await readSmallJson(opts.contract)),
      mapping: opts.map ? await readSmallJson(opts.map) : {},
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
  if (command === "learn") {
    for (const key of ["project", "outcome", "pattern", "lesson"]) if (!opts[key]) fail("learn requires --" + key);
    if (opts.verified && !["true", "false"].includes(opts.verified)) fail("--verified accepts true or false");
    return saveFeedback({ ...opts, verified: opts.verified === "true" });
  }
  if (!opts.project) fail("lessons requires --project");
  return localLessons(opts.project);
}
const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  cli().then((result) => {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  }).catch((error) => {
    process.stderr.write("GodPrompt proof bridge: " + error.message + "\n");
    process.exitCode = 1;
  });
}
