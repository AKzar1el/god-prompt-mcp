import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { codexifyEvidence } from "./codexify-evidence.js";
import { reviewWorkEvidence, type WorkContract } from "./work-contract.js";

/**
 * The single phase-aware checkpoint engine for local GodPrompt and the legacy
 * Codexify pilot. The public Worker never imports or registers this module.
 */
const STAGES = ["plan", "implementation", "verification", "handoff"] as const;
type Stage = typeof STAGES[number];
const STAGE_SET = new Set<string>(STAGES);
const SUMMARY_STATUSES = new Set([
  "CONTINUE_WITH_PENDING_ITEMS", "RECHECK", "HOLD",
  "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
]);
const DEFERRED_BEFORE_CHECKS = new Set([
  "MISSING_VERIFICATION", "ACCEPTANCE_NOT_MET",
  "ACCEPTANCE_EVIDENCE_MISSING", "REVIEW_REQUIRED",
]);
const DEFERRED_UNTIL_HANDOFF = new Set([
  "ACCEPTANCE_NOT_MET", "ACCEPTANCE_EVIDENCE_MISSING", "REVIEW_REQUIRED",
]);

const GUIDANCE: Record<string, string> = Object.freeze({
  CONTRACT_DRIFT: "Restore the original task contract and review any approved change.",
  TASK_TYPE_UNCLASSIFIED: "Classify the task before implementation.",
  SCOPE_UNDEFINED: "Define the exact allowed paths.",
  ACCEPTANCE_UNDEFINED: "Define observable acceptance criteria.",
  VERIFICATION_UNDEFINED: "Specify the real commands that must run.",
  DUPLICATE_SCOPE_PATH: "Remove duplicate allowed scope entries.",
  DUPLICATE_VERIFICATION: "Remove duplicate verification commands.",
  INVALID_CHANGED_PATH: "Recheck the changed-file list for unsafe relative paths.",
  OUT_OF_SCOPE_CHANGE: "Inspect the diff and reconcile files outside the approved scope.",
  PROHIBITED_ACTION_REPORTED: "Inspect the operation record and stop prohibited actions.",
  DUPLICATE_CHECK_RECEIPT: "Deduplicate reported check receipts.",
  DUPLICATE_ACCEPTANCE_RECEIPT: "Deduplicate reported acceptance records.",
  DUPLICATE_OBSERVATION: "Deduplicate reported observations.",
  UNEXPECTED_CHECK_RECEIPT: "Reconcile the check ID with the task contract.",
  UNEXPECTED_ACCEPTANCE_RECEIPT: "Reconcile the criterion ID with the task contract.",
  MISSING_VERIFICATION: "Run the required verification and capture its real structured receipt.",
  COMMAND_MISMATCH: "Re-run the exact contracted verification command.",
  VERIFICATION_FAILED: "Fix the failure, then re-run the contracted verification.",
  SELF_REPORTED_CHECK: "Provide actual structured tool output instead of a self-report.",
  EVIDENCE_EXCERPT_MISSING: "Capture a bounded, redacted summary of the verification output.",
  ACCEPTANCE_NOT_MET: "Check each acceptance criterion and record its result.",
  ACCEPTANCE_EVIDENCE_MISSING: "Link the acceptance claim to supplied check or observation evidence.",
  REVIEW_REQUIRED: "Obtain separately authorized human review for high-risk work.",
});

const inputSchema = z.object({
  stage: z.enum(STAGES),
  contract: z.record(z.string(), z.unknown()),
  codexify_export: z.object({
    changed_files: z.array(z.string().max(240)).max(150),
    operations_performed: z.array(z.string().max(500)).max(100).optional(),
    checks: z.array(z.unknown()).max(100),
  }).strict(),
  acceptance: z.array(z.unknown()).max(100).optional(),
  observations: z.array(z.unknown()).max(100).optional(),
  human_review_reported: z.boolean().optional(),
}).strict();
export type CheckpointInput = z.input<typeof inputSchema>;

export const CODEXIFY_CHECKPOINT_INSTRUCTIONS =
  "LOCAL OPT-IN ONLY: use create_work_contract before authorized edits, then deliberately call review_codexify_checkpoint at plan, after implementation, after verification, and before handoff. RECHECK means reconcile and repeat; HOLD means do not report ready. Missing evidence may be pending only before its due stage. The tool is advisory, not a host interrupt or an approval mechanism. Never infer permission to merge, deploy, spend, publish or claim independently verified completion.";

type Hint = { code: string; next_action: string };
type CheckpointResult = {
  schema: "godprompt.codexify_checkpoint_preview.v1";
  stage: Stage;
  status: string;
  recheck: Hint[];
  pending: Hint[];
  counts: {
    required_checks: number;
    supplied_checks: number;
    required_criteria: number;
    supplied_criteria: number;
  };
  independently_verified: false;
  completion_authorized: false;
  next_step: string;
  warning: string;
};

function uniqueHints(issues: { code: string }[]): Hint[] {
  const seen = new Set<string>();
  const hints: Hint[] = [];
  for (const issue of issues) {
    const code = issue.code;
    if (!/^[A-Z_]{3,64}$/.test(code)) {
      throw new Error("Reviewer returned an unexpected issue code");
    }
    if (seen.has(code)) continue;
    seen.add(code);
    hints.push({
      code,
      next_action: GUIDANCE[code] ?? "Review this unrecognized issue before continuing.",
    });
  }
  return hints;
}

export function cloudSafeCheckpointSummary(result: CheckpointResult) {
  if (!result || !STAGE_SET.has(result.stage) || !SUMMARY_STATUSES.has(result.status) ||
      !Array.isArray(result.recheck) || !Array.isArray(result.pending) ||
      result.recheck.length > 100 || result.pending.length > 100) {
    throw new Error("Invalid checkpoint summary");
  }
  const codes = (items: Hint[]) => items.map(({ code }) => {
    if (typeof code !== "string" || !Object.hasOwn(GUIDANCE, code)) {
      throw new Error("Unknown issue code cannot cross the storage boundary");
    }
    return code;
  });
  const numeric = (key: keyof CheckpointResult["counts"]) => {
    const value = result.counts?.[key];
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new Error("Invalid checkpoint count");
    }
    return value;
  };
  return {
    schema: "godprompt.checkpoint_summary.v1",
    stage: result.stage,
    status: result.status,
    recheck_codes: codes(result.recheck),
    pending_codes: codes(result.pending),
    counts: {
      required_checks: numeric("required_checks"),
      supplied_checks: numeric("supplied_checks"),
      required_criteria: numeric("required_criteria"),
      supplied_criteria: numeric("supplied_criteria"),
    },
    independently_verified: false,
    completion_authorized: false,
  };
}

export async function evaluateCheckpoint(raw: unknown): Promise<CheckpointResult> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Checkpoint input must be one JSON object");
  }
  const allowed = new Set([
    "stage", "contract", "codexify_export", "acceptance",
    "observations", "human_review_reported",
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) {
    throw new Error("Unexpected checkpoint field; only known review inputs are accepted");
  }
  if (!STAGE_SET.has((raw as { stage?: string }).stage ?? "")) {
    throw new Error("stage must be plan, implementation, verification or handoff");
  }
  const input = inputSchema.parse(raw);
  const bundle = await codexifyEvidence({
    contract: input.contract as WorkContract,
    exportData: input.codexify_export,
  });
  const reviewerArgs: Parameters<typeof reviewWorkEvidence>[0] = {
    ...bundle.review_input,
    acceptance: (input.acceptance ?? []) as Parameters<typeof reviewWorkEvidence>[0]["acceptance"],
    observations: (input.observations ?? []) as Parameters<typeof reviewWorkEvidence>[0]["observations"],
    human_review_reported: input.human_review_reported === true,
  };
  const review = await reviewWorkEvidence(reviewerArgs);
  const defer = input.stage === "plan" || input.stage === "implementation"
    ? DEFERRED_BEFORE_CHECKS
    : input.stage === "verification" ? DEFERRED_UNTIL_HANDOFF : new Set<string>();
  const recheck = uniqueHints(review.issues.filter(({ code }) => !defer.has(code)));
  const pending = uniqueHints(review.issues.filter(({ code }) => defer.has(code)));
  const status = recheck.length
    ? (input.stage === "handoff" ? "HOLD" : "RECHECK")
    : input.stage === "handoff"
      ? (review.status === "REPORTED_READY_FOR_INDEPENDENT_REVIEW"
          ? "REPORTED_READY_FOR_INDEPENDENT_REVIEW" : "HOLD")
      : "CONTINUE_WITH_PENDING_ITEMS";

  return {
    schema: "godprompt.codexify_checkpoint_preview.v1",
    stage: input.stage,
    status,
    recheck,
    pending,
    counts: {
      required_checks: review.required_checks,
      supplied_checks: review.supplied_check_receipts,
      required_criteria: review.required_acceptance_criteria,
      supplied_criteria: review.supplied_acceptance_receipts,
    },
    independently_verified: false,
    completion_authorized: false,
    next_step: recheck.length
      ? "Review the issues and repeat this checkpoint after the missing work is corrected."
      : input.stage === "handoff"
        ? "Inspect original source output, diff, checks and approvals independently before claiming completion."
        : "Continue only with separately authorized work; rerun at the next checkpoint.",
    warning: "All exports and acceptance reports are caller-supplied. This tool cannot interrupt Codexify automatically and never permits deployment or completion.",
  };
}

export function registerCodexifyCheckpointTool(server: McpServer): void {
  server.registerTool("review_codexify_checkpoint", {
    title: "Review Codexify task checkpoint",
    description: "Local opt-in, read-only milestone review. At plan, implementation, verification and handoff, check reported contract, scope, tool errors, verification and acceptance. RECHECK/HOLD is not an execution permission or independent proof.",
    // The SDK echoes Zod validation errors, including unexpected field names.
    // Preserve the detailed public schema, but hand invalid input to our
    // redacted error handler instead of letting the SDK echo private data.
    inputSchema: inputSchema.catch(() => ({
      stage: "plan" as const, contract: {}, codexify_export: { changed_files: [], checks: [] },
    })),
    annotations: {
      readOnlyHint: true, destructiveHint: false,
      idempotentHint: true, openWorldHint: false,
    },
  }, async (args) => {
    if (new TextEncoder().encode(JSON.stringify(args)).byteLength > 256 * 1024) {
      return {
        isError: true,
        content: [{ type: "text" as const,
          text: "Checkpoint input exceeds 256 KiB. Supply redacted, bounded receipts." }],
      };
    }
    try {
      const result = await evaluateCheckpoint(args);
      const cloud_storage_preview = cloudSafeCheckpointSummary(result);
      const safe = { ...result, cloud_storage_preview };
      return {
        structuredContent: safe,
        content: [{ type: "text" as const, text: JSON.stringify(safe) }],
      };
    } catch {
      return {
        isError: true,
        content: [{ type: "text" as const,
          text: "Invalid checkpoint input; inspect the contract schema and redacted export locally." }],
      };
    }
  });
}
