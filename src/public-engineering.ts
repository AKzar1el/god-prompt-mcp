/**
 * Portable, deterministic engineering-quality helpers.
 * These tools only inspect bounded caller-supplied text. They never read files,
 * execute programs, contact third parties or independently verify evidence.
 */
import { McpServer } from "@modelcontextprotocol/server";
import parseDiff from "parse-diff";
import * as z from "zod/v4";

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function result(value: unknown) {
  return {
    structuredContent: value,
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

type Finding = {
  code: string;
  severity: "high" | "medium" | "low";
  message: string;
  file?: string;
  line?: number;
  requirement_id?: string;
};

const MAX_FINDINGS = 40;

/** Signals indicate what a human or capable agent should inspect, not bugs. */
const PATCH_SIGNALS: ReadonlyArray<{
  code: string;
  severity: Finding["severity"];
  matcher: RegExp;
  message: string;
}> = [
  {
    code: "DYNAMIC_CODE_EXECUTION",
    severity: "high",
    matcher: /\b(?:eval\s*\(|new\s+Function\s*\()/i,
    message: "New dynamic code execution requires input-trust and abuse review.",
  },
  {
    code: "DISABLED_TLS_VERIFICATION",
    severity: "high",
    matcher: /\b(?:rejectUnauthorized\s*:\s*false|verify\s*=\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0)/i,
    message: "Added TLS-verification bypass: review exact runtime effect.",
  },
  {
    code: "DANGEROUS_HTML_SINK",
    severity: "medium",
    matcher: /\b(?:innerHTML\s*=|dangerouslySetInnerHTML\b)/,
    message: "Added raw HTML sink: review content provenance and escaping.",
  },
  {
    code: "SENSITIVE_BEHAVIOR_CHANGE",
    severity: "medium",
    matcher: /\b(?:auth(?:orization|entication)?|password|token|secret|session|permission|csrf|cors|payment|migration)\b/i,
    message: "Sensitive behavior changed: inspect authorization, compatibility and test evidence.",
  },
  {
    code: "UNFINISHED_MARKER",
    severity: "low",
    matcher: /\b(?:TODO|FIXME|HACK)\b/i,
    message: "New unfinished-work marker: verify release expectations.",
  },
];

function patchPath(value?: string): string {
  return (value ?? "unknown").replace(/^[ab]\//, "").slice(0, 250);
}

export function reviewCodeChange(diff: string) {
  // Require a real unified hunk instead of silently treating arbitrary text as code.
  if (!/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(diff)) {
    return {
      status: "UNPARSEABLE_PATCH",
      files: [],
      findings: [{ code: "NO_UNIFIED_HUNKS", severity: "medium", message: "Provide a unified diff containing @@ hunks; binary-only changes need separate review." }],
      independently_verified: false,
      warning: "No code execution or semantic correctness review occurred.",
    };
  }

  const parsed = parseDiff(diff);
  if (!parsed.length || parsed.length > 50) {
    return {
      status: "UNSUPPORTED_PATCH_SIZE",
      files: [],
      findings: [{ code: "PATCH_FILE_LIMIT", severity: "medium", message: "Use a diff with 1–50 files per review." }],
      independently_verified: false,
      warning: "No code execution or semantic correctness review occurred.",
    };
  }

  const findings: Finding[] = [];
  const files: Array<{ path: string; additions: number; deletions: number; hunks: number }> = [];
  let changedLines = 0;
  let changeOverflow = false;
  let reviewedLines = 0;
  let testPatch = false;
  let productionPatch = false;

  for (const file of parsed) {
    const path = patchPath(file.to && file.to !== "/dev/null" ? file.to : file.from);
    files.push({ path, additions: file.additions, deletions: file.deletions, hunks: file.chunks.length });
    const isTest = /(?:^|\/)(?:tests?|__tests__|specs?)(?:\/|\.)|\.(?:test|spec)\.[a-z]+$/i.test(path);
    testPatch ||= isTest;
    productionPatch ||= !isTest && /\.(?:ts|tsx|js|jsx|py|go|rs|java|cs|rb|php)$/i.test(path);
    if (!file.chunks.length && findings.length < MAX_FINDINGS) {
      findings.push({ code: "UNREVIEWABLE_FILE", severity: "medium", message: "No text hunk is available; inspect binary or metadata changes separately.", file: path });
    }
    for (const chunk of file.chunks) {
      for (const change of chunk.changes) {
        if (change.type === "normal") continue;
        changedLines++;
        if (changedLines > 5_000) {
          changeOverflow = true;
          break;
        }
        if (change.type === "del") {
          if (isTest && /\b(?:expect|assert(?:\.\w+)?|test|it)\s*\(/i.test(change.content) && findings.length < MAX_FINDINGS) {
            findings.push({ code: "REMOVED_TEST_ASSERTION", severity: "medium", message: "Removed test/assertion text: check that coverage was preserved.", file: path, line: change.ln });
          }
          if (!isTest && /\b(?:if\s*\(|throw\s+|assert(?:\.\w+)?\s*\()/i.test(change.content)
            && /\b(?:isAdmin|isAuthenticated|hasPermission|canAccess|authoriz\w*|auth\w*|permissions?|roles?|csrf|access|credentials?|session)\b/i.test(change.content)
            && findings.length < MAX_FINDINGS) {
            findings.push({
              code: "REMOVED_SECURITY_GUARD",
              severity: "medium",
              message: "Removed a possible authorization or access-control guard. Verify replacement protection and regression coverage; removal alone is not proof of a vulnerability.",
              file: path,
              line: change.ln,
            });
          }
          continue;
        }
        reviewedLines++;
        if (findings.length >= MAX_FINDINGS) continue;
        const added = change.content.slice(1).trimStart();
        const commentOnly = /^(?:\/\/|\/\*|\*|#|<!--)/.test(added);
        if (/^\.github\/workflows\/(?:publish|release|deploy)[^/]*\.ya?ml$/i.test(path)
          && /github\.event_name\s*!=\s*[\x27\x22]pull_request[\x27\x22]/i.test(added)) {
          findings.push({ code: "WEAKENED_RELEASE_GATE", severity: "high",
            message: "A release workflow gate appears broadened beyond manual dispatch; inspect publication permissions and intended triggers.",
            file: path, line: change.ln });
          continue;
        }
        for (const signal of PATCH_SIGNALS) {
          if (commentOnly && signal.code !== "UNFINISHED_MARKER") continue;
          if (signal.matcher.test(added)) {
            findings.push({ code: signal.code, severity: signal.severity, message: signal.message, file: path, line: change.ln });
            break;
          }
        }
      }
      if (changeOverflow) break;
    }
    if (changeOverflow) break;
  }

  if (productionPatch && !testPatch && changedLines > 1 && findings.length < MAX_FINDINGS) {
    findings.push({
      code: "NO_TEST_CHANGES_IN_PATCH",
      severity: "low",
      message: "The supplied patch includes production code but no test-file changes; ask for existing test receipts before concluding coverage is missing.",
    });
  }
  const truncated = changeOverflow || findings.length >= MAX_FINDINGS;
  return {
    status: truncated ? "PARTIAL_REVIEW" : "REVIEW_HINTS_ONLY",
    files,
    change_lines_seen: changedLines,
    additions_reviewed: reviewedLines,
    findings,
    truncated,
    independently_verified: false,
    warning: "Heuristic signals are not a semantic code review. No repository was opened, tests run, vulnerabilities confirmed, or completion authorized.",
  };
}

type Requirement = {
  id: string;
  text: string;
  source_line: number;
  acceptance: string[];
  scenarios: string[];
};

/** Shared normalization prevents audit/test-matrix disagreement. */
export function normalizeRequirements(specification: string): { requirements: Requirement[]; truncated: boolean } {
  const lines = specification.split(/\r?\n/);
  const requirements: Requirement[] = [];
  let current: Requirement | undefined;
  let overflow = false;
  let formalRequirement = false;
  let capturedBody = false;
  let inCodeFence = false;
  let skipSection = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (/^```/.test(raw)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (!raw || inCodeFence) continue;
    const bare = raw.replace(/^#{1,6}\s*/, "");
    const requirementHeading = /^#{1,6}\s+Requirement\s*:\s*(.+)$/i.exec(raw);
    const acceptance = /^(?:[-*]\s*)?(?:AC(?:CEPTANCE)?(?:\s+CRITERI(?:ON|A))?|THEN|EXPECTED)\s*[:\-]/i.test(bare);
    const scenario = /^(?:[-*]\s*)?(?:GIVEN|WHEN|THEN|SCENARIO|EXAMPLE)\b/i.test(bare);
    if (current && (acceptance || scenario)) {
      const dest = scenario ? current.scenarios : current.acceptance;
      if (dest.length < 8) dest.push(bare.slice(0, 400));
      continue;
    }
    if (/^#{1,6}\s/.test(raw) && !requirementHeading) {
      current = undefined;
      formalRequirement = false;
      skipSection = /^(?:purpose|background|design|implementation|notes)\b/i.test(bare);
      continue;
    }
    if (skipSection && !requirementHeading) continue;
    if (formalRequirement && current && !capturedBody && !/^(?:[-*]\s+|\d+[.)]\s+)/.test(raw)) {
      current.text = `${current.text}: ${raw}`.slice(0, 700);
      capturedBody = true;
      continue;
    }
    const cleaned = bare
      .replace(/^Requirement\s*:\s*/i, "")
      .replace(/^#{1,6}\s*(?:requirement\s*:\s*)?/i, "")
      .replace(/^(?:[-*]\s+|\d+[.)]\s+|REQ[-_ ]?\d+\s*[:\-]\s*)/i, "")
      .trim();
    if (cleaned.length < 7 || /^(?:purpose|scope|notes|assumptions|constraints):?$/i.test(cleaned)) continue;
    if (requirements.length >= 35) {
      overflow = true;
      break;
    }
    current = {
      id: `R-${String(requirements.length + 1).padStart(2, "0")}`,
      text: cleaned.slice(0, 700),
      source_line: i + 1,
      acceptance: [],
      scenarios: [],
    };
    formalRequirement = Boolean(requirementHeading);
    capturedBody = false;
    skipSection = false;
    requirements.push(current);
  }
  return { requirements, truncated: overflow };
}

const VAGUE = /\b(?:fast|quick|easy|simple|seamless|robust|secure|reliable|performant|efficient|user[- ]friendly|appropriate|scalable|soon|regularly)\b/i;
const MEASURABLE = /\b(?:\d+(?:\.\d+)?\s*(?:ms|s|seconds|minutes|hours|days|%|requests|users|MB|GB)|at\s+(?:least|most)|within\s+\d+|exactly\s+\d+)\b/i;

export function auditRequirements(specification: string) {
  const { requirements, truncated } = normalizeRequirements(specification);
  const findings: Finding[] = [];
  const exact = new Map<string, string>();
  const quantified = new Map<string, { polarity: number; id: string }>();
  for (const req of requirements) {
    const key = req.text.replace(/\s+/g, " ").toLowerCase();
    const prior = exact.get(key);
    if (prior) findings.push({ code: "DUPLICATE_REQUIREMENT", severity: "medium", message: `Same text also appears in ${prior}.`, requirement_id: req.id });
    else exact.set(key, req.id);
    const quantifiedClause = /^(every|all|no)\s+(.+)$/i.exec(key.replace(/[.!?]+$/, ""));
    if (quantifiedClause) {
      const polarity = quantifiedClause[1] === "no" ? -1 : 1;
      const previous = quantified.get(quantifiedClause[2]);
      if (previous && previous.polarity !== polarity) findings.push({
        code: "CONTRADICTORY_REQUIREMENTS", severity: "medium",
        message: "Obvious universal-versus-none obligations conflict with " + previous.id + "; clarify which behavior applies.",
        requirement_id: req.id,
      });
      else if (!previous) quantified.set(quantifiedClause[2], {polarity, id: req.id});
    }
    if (!req.acceptance.length && !req.scenarios.length) findings.push({
      code: "MISSING_ACCEPTANCE_EVIDENCE",
      severity: "medium",
      message: "No explicit acceptance criterion or scenario is attached to this requirement.",
      requirement_id: req.id,
    });
    if (VAGUE.test(req.text) && !MEASURABLE.test(req.text)) findings.push({
      code: "UNMEASURABLE_LANGUAGE",
      severity: "medium",
      message: "Qualitative language needs a concrete, observable acceptance threshold.",
      requirement_id: req.id,
    });
    if (/\b(?:shall|must|should)\b/i.test(req.text) && /\b(?:may|maybe|optional|optionally|if possible)\b/i.test(req.text)) findings.push({
      code: "MIXED_OBLIGATION",
      severity: "low",
      message: "Check whether mandatory and optional behavior were intentionally mixed.",
      requirement_id: req.id,
    });
  }
  return {
    status: !requirements.length ? "NO_REQUIREMENTS_FOUND" : findings.length ? "NEEDS_CLARIFICATION" : "STRUCTURALLY_REVIEWED",
    requirements,
    findings: findings.slice(0, MAX_FINDINGS),
    truncated: truncated || findings.length > MAX_FINDINGS,
    independently_verified: false,
    warning: "This deterministic structural audit cannot determine if requirements are correct, feasible, complete or consistent with a codebase.",
  };
}

export function buildTestMatrix(specification: string, maxCases: number) {
  const normalized = normalizeRequirements(specification);
  const cases: Array<{
    id: string;
    requirement_id: string;
    category: "positive" | "negative" | "boundary" | "regression";
    objective: string;
    expected: string;
    status: "PROPOSED_NOT_RUN";
  }> = [];
  // Inspect all requirements, even when the test budget is exhausted.
  const gaps = normalized.requirements
    .filter((requirement) => !requirement.acceptance.length && !requirement.scenarios.length)
    .map((requirement) => ({ requirement_id: requirement.id, reason: "No expected outcome or acceptance scenario supplied." }));
  const categories = ["positive", "negative", "boundary", "regression"] as const;
  // Round-robin by category: cover each requirement at least once before
  // spending a limited budget on more cases for the first requirement.
  for (const category of categories) {
    for (const requirement of normalized.requirements) {
      if (cases.length >= maxCases) break;
      const objective = category === "positive"
        ? `Verify the stated behavior of ${requirement.id}.`
        : category === "negative"
          ? `Check invalid, missing or rejected inputs relevant to ${requirement.id}.`
          : category === "boundary"
            ? `Exercise limits, empties and state transitions relevant to ${requirement.id}.`
            : `Verify existing adjacent behavior is preserved when implementing ${requirement.id}.`;
      const expected = category === "positive"
        ? ([...requirement.acceptance, ...requirement.scenarios][0] ?? "UNSPECIFIED: define an observable pass condition")
        : category === "negative"
          ? "UNSPECIFIED: define rejection/error contract"
          : category === "boundary"
            ? "UNSPECIFIED: define applicable limits"
            : "UNSPECIFIED: establish baseline evidence";
      cases.push({
        id: `TC-${String(cases.length + 1).padStart(3, "0")}`,
        requirement_id: requirement.id,
        category,
        objective,
        expected,
        status: "PROPOSED_NOT_RUN",
      });
    }
    if (cases.length >= maxCases) break;
  }
  const truncated = normalized.truncated || cases.length < normalized.requirements.length * categories.length;
  const uncovered_requirement_ids = normalized.requirements
    .filter((requirement) => !cases.some((entry) => entry.requirement_id === requirement.id))
    .map((requirement) => requirement.id);
  return {
    status: !normalized.requirements.length ? "NO_REQUIREMENTS_FOUND" : truncated ? "PARTIAL_TEST_PLAN" : "DRAFT_TEST_PLAN",
    cases,
    requirements_seen: normalized.requirements.length,
    traceability: normalized.requirements.map((requirement) => ({
      requirement_id: requirement.id,
      test_case_ids: cases.filter((entry) => entry.requirement_id === requirement.id).map((entry) => entry.id),
    })),
    gaps,
    uncovered_requirement_ids,
    truncated,
    tests_executed: 0,
    warning: "Draft cases are suggestions only. The MCP has not generated executable tests, inspected code, run checks, or verified expected behavior.",
  };
}

export function registerPublicEngineeringTools(server: McpServer): void {
  server.registerTool("review_code_change", {
    title: "Review supplied code changes",
    description: "Analyze a bounded unified diff for line-anchored risk signals, changed-file coverage, and review follow-ups. Heuristics only: not a semantic review, vulnerability scanner or verified test result. Stateless, no repository access.",
    inputSchema: { diff: z.string().min(10).max(120_000) },
    annotations: ANNOTATIONS,
  }, async ({ diff }) => result(reviewCodeChange(diff)));

  server.registerTool("audit_requirements", {
    title: "Audit software requirements",
    description: "Inspect bounded requirement text for missing acceptance scenarios, qualitative obligations and duplicates. Returns source-line-linked clarification prompts; cannot validate business correctness.",
    inputSchema: { specification: z.string().trim().min(10).max(16_000) },
    annotations: ANNOTATIONS,
  }, async ({ specification }) => result(auditRequirements(specification)));

  server.registerTool("build_test_matrix", {
    title: "Plan requirement-traceable tests",
    description: "Draft bounded positive, negative, boundary and regression test cases for supplied requirements. Reuses the requirements parser, reports unspecified expectations and never claims tests ran.",
    inputSchema: {
      specification: z.string().trim().min(10).max(16_000),
      max_cases: z.number().int().min(4).max(80).optional().default(24),
    },
    annotations: ANNOTATIONS,
  }, async ({ specification, max_cases }) => result(buildTestMatrix(specification, max_cases)));
}
