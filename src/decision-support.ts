/** Portable read-only decision support; caller evidence is always unverified. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const ANNOTATIONS = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

function result(payload: unknown) {
  return { structuredContent: payload, content: [{ type: "text" as const, text: JSON.stringify(payload) }] };
}

const FAILURE_RULES: ReadonlyArray<{
  code: string;
  pattern: RegExp;
  hypothesis: string;
  next_experiment: string;
}> = [
  { code: "PERMISSION", pattern: /\b(?:EACCES|EPERM|permission denied|access is denied|forbidden)\b/i,
    hypothesis: "The operation may be blocked by identity, permissions or a file lock.", next_experiment: "Check the exact denied resource and active identity; distinguish ACL denial from a concurrent lock." },
  { code: "RATE_LIMIT", pattern: /\b(?:429|rate.?limit|too many requests|quota exceeded)\b/i,
    hypothesis: "The upstream may be throttling requests or enforcing quota.", next_experiment: "Inspect authoritative rate-limit headers and compare a single safe request after the stated retry window." },
  { code: "AUTH", pattern: /\b(?:401|unauthorized|invalid token|expired token|invalid credentials)\b/i,
    hypothesis: "Authentication, token expiry or authorization scope may be failing.", next_experiment: "Verify the responding service, principal and token expiry/scope without exposing token bytes." },
  { code: "NETWORK_DNS", pattern: /\b(?:ENOTFOUND|EAI_AGAIN|DNS|name resolution|unknown host)\b/i,
    hypothesis: "Name resolution or networking may prevent connection.", next_experiment: "Compare DNS resolution and endpoint reachability from the actual execution environment." },
  { code: "NETWORK_TIMEOUT", pattern: /\b(?:ETIMEDOUT|ECONNRESET|timed out|timeout|deadline exceeded)\b/i,
    hypothesis: "A downstream operation may be timing out or losing connectivity.", next_experiment: "Trace one request ID across client/server timings and upstream availability; do not blindly replay writes." },
  { code: "MEMORY_PRESSURE", pattern: /\b(?:out of memory|heap out of memory|OOM|allocation failed|ENOMEM)\b/i,
    hypothesis: "Memory/resource exhaustion may interrupt execution.", next_experiment: "Compare peak resource usage to limits and check whether input-size growth correlates with failure." },
  { code: "VERSION_CONTRACT", pattern: /\b(?:unsupported engine|version mismatch|schema mismatch|incompatible version|module not found|ERR_MODULE_NOT_FOUND)\b/i,
    hypothesis: "Runtime, package, or schema version mismatch may explain the failure.", next_experiment: "Compare resolved versions, lockfile and API contract in the failing and last-known-good environment." },
  { code: "INPUT_PARSING", pattern: /\b(?:SyntaxError|unexpected token|invalid JSON|parse error|malformed input)\b/i,
    hypothesis: "The received data format may violate the parser or schema assumptions.", next_experiment: "Inspect a sanitized minimal failing payload and validate it against the expected schema." },
];

export function diagnoseFailure(symptoms: string, logs = "") {
  const combined = `${symptoms}\n${logs}`;
  const hypotheses = FAILURE_RULES.filter((rule) => rule.pattern.test(combined)).map((rule, rank) => ({
    rank: rank + 1,
    signal: rule.code,
    hypothesis: rule.hypothesis,
    next_experiment: rule.next_experiment,
    confidence: "UNVERIFIED_SIGNAL",
  }));
  if (!hypotheses.length) hypotheses.push({
    rank: 1,
    signal: "UNCLASSIFIED",
    hypothesis: "Insufficient deterministic evidence to identify a specific failure class.",
    next_experiment: "Capture the minimal reproduction, failing step, exact error category, environment and last-known-good result.",
    confidence: "UNVERIFIED_SIGNAL",
  });
  return {
    status: "HYPOTHESES_NOT_ROOT_CAUSES",
    hypotheses: hypotheses.slice(0, 8),
    evidence_source: "CALLER_SUPPLIED_UNVERIFIED",
    independently_verified: false,
    warning: "Matches are keyword-based triage, not a diagnosis. Raw logs were not echoed or stored; consult authoritative evidence before acting.",
  };
}

type ReleaseInput = {
  target: "staging" | "production";
  checks: Array<{ name: string; status: "passed" | "failed" | "not_run" }>;
  source_revision?: string;
  artifact_revision?: string;
  rollback_plan?: string;
  migration_involved?: boolean;
  migration_plan?: string;
  approval_reported?: boolean;
};

export function assessReleaseReadiness(input: ReleaseInput) {
  const blockers: Array<{ code: string; message: string }> = [];
  for (const check of input.checks) {
    if (check.status !== "passed") blockers.push({
      code: check.status === "failed" ? "FAILED_CHECK" : "UNRUN_CHECK",
      message: `Required check ${check.name} is ${check.status}.`,
    });
  }
  if (!input.source_revision || !input.artifact_revision) blockers.push({
    code: "MISSING_ARTIFACT_PROVENANCE",
    message: "Source and built artifact revision evidence are both required.",
  });
  else if (input.source_revision !== input.artifact_revision) blockers.push({
    code: "REVISION_MISMATCH",
    message: "Reported built artifact revision does not match the intended source revision.",
  });
  if (input.target === "production" && !input.rollback_plan?.trim()) blockers.push({
    code: "MISSING_ROLLBACK_PLAN", message: "A production rollback or safe recovery plan is required.",
  });
  if (input.target === "production" && input.approval_reported !== true) blockers.push({
    code: "MISSING_APPROVAL", message: "No explicit production approval was reported.",
  });
  if (input.migration_involved && !input.migration_plan?.trim()) blockers.push({
    code: "MISSING_MIGRATION_PLAN", message: "Migration was declared but no migration/rollback handling was supplied.",
  });
  return {
    status: blockers.length ? "BLOCKED" : "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
    target: input.target,
    reported_checks: input.checks.length,
    blockers,
    independently_verified: false,
    deployment_authorized: false,
    warning: "All checks, hashes and approval flags are user-reported. This tool did not verify CI, inspect artifacts, authenticate approvals or authorize release.",
  };
}

function redact(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]{0,4000}?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]")
    .replace(/\b(?:sk-proj-|ghp_|github_pat_)[A-Za-z0-9_-]{10,}\b/gi, "[REDACTED_CREDENTIAL]")
    .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/gi, "[REDACTED_CREDENTIAL]")
    .replace(/\bAuthorization\s*:\s*(?:Basic|Bearer|Token)\s+[A-Za-z0-9+\/=._-]{8,}/gi, "Authorization: [REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._-]{10,}/gi, "Bearer [REDACTED]")
    .replace(/\b([\w.+%-]+)@([\w.-]+\.[a-z]{2,})\b/gi, "[REDACTED_EMAIL]")
    .replace(/\b(password|secret|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
}

type Handoff = {
  goal: string;
  decisions: string[];
  completed: string[];
  open_items: string[];
  evidence: Array<{ reference: string; description: string; independently_verified: boolean }>;
};

export function createContextHandoff(input: Handoff) {
  const body: string[] = [
    `Goal: ${input.goal}`,
    "Decisions:", ...input.decisions.map((value) => `- ${value}`),
    "Completed (reported):", ...input.completed.map((value) => `- ${value}`),
    "Open items:", ...input.open_items.map((value) => `- ${value}`),
    "Evidence references:", ...input.evidence.map((entry) =>
      `- ${entry.reference}: ${entry.description} (${entry.independently_verified ? "caller-marked verified" : "unverified"})`),
  ];
  const raw = body.join("\n");
  const safe = redact(raw);
  return {
    status: "PORTABLE_UNVERIFIED_HANDOFF",
    handoff_text: safe,
    chars: safe.length,
    redaction_applied: safe !== raw,
    independently_verified: false,
    warning: "All handoff fields and verification markers are caller-supplied. Pattern-based redaction cannot guarantee secret removal; inspect before sharing.",
  };
}

type EvalCase = { case_id: string; passed: boolean; duration_ms?: number; cost_usd?: number };

function duplicateIDs(cases: EvalCase[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of cases) {
    if (seen.has(item.case_id)) duplicates.add(item.case_id);
    seen.add(item.case_id);
  }
  return [...duplicates].sort();
}

export function compareEvaluationRuns(baseline: EvalCase[], candidate: EvalCase[]) {
  const duplicates = [...new Set([...duplicateIDs(baseline), ...duplicateIDs(candidate)])];
  const previous = new Map(baseline.map((item) => [item.case_id, item]));
  const current = new Map(candidate.map((item) => [item.case_id, item]));
  const matching = [...previous.keys()].filter((id) => current.has(id)).sort();
  const dropped = [...previous.keys()].filter((id) => !current.has(id)).sort();
  const added = [...current.keys()].filter((id) => !previous.has(id)).sort();
  if (duplicates.length || !matching.length) {
    return {
      status: "INCOMPARABLE",
      reason: duplicates.length ? "Duplicate case IDs prevent reliable pairing." : "No common test case IDs between runs.",
      duplicates,
      matched_cases: 0,
      excluded_baseline_cases: dropped.length,
      excluded_candidate_cases: added.length,
      independently_verified: false,
    };
  }
  let baselinePass = 0;
  let candidatePass = 0;
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  let durationPairs = 0;
  let baselineMs = 0;
  let candidateMs = 0;
  let costPairs = 0;
  let baselineCost = 0;
  let candidateCost = 0;
  for (const id of matching) {
    const old = previous.get(id)!;
    const now = current.get(id)!;
    if (old.passed) baselinePass++;
    if (now.passed) candidatePass++;
    if (!old.passed && now.passed) improved++;
    else if (old.passed && !now.passed) regressed++;
    else unchanged++;
    if (old.duration_ms !== undefined && now.duration_ms !== undefined) {
      durationPairs++;
      baselineMs += old.duration_ms;
      candidateMs += now.duration_ms;
    }
    if (old.cost_usd !== undefined && now.cost_usd !== undefined) {
      costPairs++;
      baselineCost += old.cost_usd;
      candidateCost += now.cost_usd;
    }
  }
  const ratio = (count: number) => Math.round((count / matching.length) * 10_000) / 100;
  return {
    status: matching.length < 20 ? "LOW_SAMPLE_DIRECTIONAL" : "PAIRED_COMPARISON_UNVERIFIED",
    matched_cases: matching.length,
    excluded_baseline_cases: dropped.length,
    excluded_candidate_cases: added.length,
    baseline_pass_percent: ratio(baselinePass),
    candidate_pass_percent: ratio(candidatePass),
    pass_rate_delta_points: ratio(candidatePass) - ratio(baselinePass),
    improved,
    regressed,
    unchanged,
    measured_duration_pairs: durationPairs,
    mean_duration_ms: durationPairs ? { baseline: Math.round(baselineMs / durationPairs), candidate: Math.round(candidateMs / durationPairs) } : null,
    measured_cost_pairs: costPairs,
    mean_cost_usd: costPairs ? { baseline: baselineCost / costPairs, candidate: candidateCost / costPairs } : null,
    independently_verified: false,
    warning: "Paired outcomes are caller-supplied and not independently verified. Small or selectively chosen samples do not establish statistically significant productivity gains.",
  };
}

const EvalCaseSchema = z.object({
  case_id: z.string().trim().min(1).max(80),
  passed: z.boolean(),
  duration_ms: z.number().finite().nonnegative().max(7 * 24 * 60 * 60 * 1000).optional(),
  cost_usd: z.number().finite().nonnegative().max(1_000_000).optional(),
});

export function registerDecisionSupportTools(server: McpServer): void {
  server.registerTool("diagnose_failure", {
    title: "Diagnose supplied failure symptoms",
    description: "Return bounded evidence-class hypotheses and differentiating experiments for supplied symptoms/logs. Does not expose raw logs or claim a root cause.",
    inputSchema: { symptoms: z.string().trim().min(10).max(3_000), logs: z.string().max(8_000).optional() },
    annotations: ANNOTATIONS,
  }, async ({ symptoms, logs }) => result(diagnoseFailure(symptoms, logs)));

  server.registerTool("assess_release_readiness", {
    title: "Assess reported release readiness",
    description: "Check caller-reported CI checks, source/artifact revision, rollback, migration and approvals for missing blockers; never authorize deployment or authenticate receipts.",
    inputSchema: {
      target: z.enum(["staging", "production"]),
      checks: z.array(z.object({ name: z.string().trim().min(1).max(80), status: z.enum(["passed", "failed", "not_run"]) })).min(1).max(30),
      source_revision: z.string().trim().min(7).max(80).optional(),
      artifact_revision: z.string().trim().min(7).max(80).optional(),
      rollback_plan: z.string().max(1_000).optional(),
      migration_involved: z.boolean().optional(),
      migration_plan: z.string().max(1_000).optional(),
      approval_reported: z.boolean().optional(),
    },
    annotations: ANNOTATIONS,
  }, async (input) => result(assessReleaseReadiness(input)));

  server.registerTool("create_context_handoff", {
    title: "Prepare a safe cross-chat task handoff",
    description: "Compose a bounded, explicitly unverified state transfer from caller-reported decisions, open items and evidence references, with best-effort token/email redaction.",
    inputSchema: {
      goal: z.string().trim().min(5).max(600),
      decisions: z.array(z.string().max(250)).max(12).optional().default([]),
      completed: z.array(z.string().max(250)).max(12).optional().default([]),
      open_items: z.array(z.string().max(250)).max(12).optional().default([]),
      evidence: z.array(z.object({ reference: z.string().max(80), description: z.string().max(200), independently_verified: z.boolean().optional().default(false) })).max(20).optional().default([]),
    },
    annotations: ANNOTATIONS,
  }, async (input) => result(createContextHandoff(input)));

  server.registerTool("compare_evaluation_runs", {
    title: "Compare paired agent evaluation runs",
    description: "Compare bounded caller-reported outcomes on exact matching case IDs, with coverage exclusions and low-sample warnings. No API calls, statistical significance claims or stored results.",
    inputSchema: { baseline: z.array(EvalCaseSchema).min(1).max(200), candidate: z.array(EvalCaseSchema).min(1).max(200) },
    annotations: ANNOTATIONS,
  }, async ({ baseline, candidate }) => result(compareEvaluationRuns(baseline, candidate)));
}
