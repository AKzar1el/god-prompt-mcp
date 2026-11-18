#!/usr/bin/env node
/**
 * Experimental, opt-in Codexify checkpoint preview.
 * No network, automatic hooks, storage, telemetry, or permission changes.
 * This file is not part of the published npm package or hosted Worker.
 */
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { codexifyEvidence, readSmallJson } from "../../bin/godprompt-proof.mjs";
import { reviewWorkEvidence } from "../../dist/work-contract.js";

const STAGES = new Set(["plan", "implementation", "verification", "handoff"]);
const DEFERRED_BEFORE_CHECKS = new Set([
  "MISSING_VERIFICATION", "ACCEPTANCE_NOT_MET",
  "ACCEPTANCE_EVIDENCE_MISSING", "REVIEW_REQUIRED",
]);
const DEFERRED_UNTIL_HANDOFF = new Set([
  "ACCEPTANCE_NOT_MET", "ACCEPTANCE_EVIDENCE_MISSING", "REVIEW_REQUIRED",
]);
const GUIDANCE = Object.freeze({
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

function uniqueHints(issues) {
  const seen = new Set();
  return issues.map(({ code }) => {
    if (typeof code !== "string" || !/^[A-Z_]{3,64}$/.test(code)) {
      throw new Error("Reviewer returned an unexpected issue code");
    }
    return { code, next_action: GUIDANCE[code] || "Review this unrecognized issue before continuing." };
  }).filter(({ code }) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

const SUMMARY_STATUSES = new Set([
  "CONTINUE_WITH_PENDING_ITEMS", "RECHECK", "HOLD",
  "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
]);

export function cloudSafeCheckpointSummary(result) {
  // A future authenticated storage adapter may persist only this allowlisted,
  // identity-free summary, never full contracts, raw diffs, logs or user notes.
  if (!result || !STAGES.has(result.stage) || !SUMMARY_STATUSES.has(result.status) ||
      !Array.isArray(result.recheck) || !Array.isArray(result.pending) ||
      result.recheck.length > 100 || result.pending.length > 100) {
    throw new Error("Invalid checkpoint summary");
  }
  const codes = (items) => items.map(({ code }) => {
    if (typeof code !== "string" || !Object.hasOwn(GUIDANCE, code)) {
      throw new Error("Unknown issue code cannot cross the storage boundary");
    }
    return code;
  });
  const numeric = (key) => {
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

export async function evaluateCheckpoint(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Checkpoint input must be one JSON object");
  }
  const allowed = new Set([
    "stage", "contract", "codexify_export", "acceptance", "observations", "human_review_reported",
  ]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new Error("Unexpected checkpoint field; only known review inputs are accepted");
  }
  if (!STAGES.has(input.stage)) {
    throw new Error("stage must be plan, implementation, verification or handoff");
  }
  const bundle = codexifyEvidence({
    contract: input.contract,
    exportData: input.codexify_export,
  });
  const review = await reviewWorkEvidence({
    ...bundle.review_input,
    acceptance: input.acceptance ?? [],
    observations: input.observations ?? [],
    human_review_reported: input.human_review_reported === true,
  });
  const deferCodes = input.stage === "plan" || input.stage === "implementation"
    ? DEFERRED_BEFORE_CHECKS
    : input.stage === "verification" ? DEFERRED_UNTIL_HANDOFF : new Set();
  const recheck = uniqueHints(review.issues.filter(({ code }) => !deferCodes.has(code)));
  const pending = uniqueHints(review.issues.filter(({ code }) => deferCodes.has(code)));
  // Never interpret a supplied receipt as independent evidence or authorization.
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
    warning: "All exports and acceptance reports are caller-supplied. This test runner cannot watch or interrupt Codexify automatically and never permits deployment or completion.",
  };
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== "--input") {
    throw new Error("Usage: node experiments/codexify-checkpoints/checkpoint.mjs --input checkpoint-input.json");
  }
  const preview = await evaluateCheckpoint(await readSmallJson(argv[1]));
  process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
  // Valid HOLD/RECHECK is a successful *evaluation* on purpose. Codexify
  // wraps nonzero command exit codes as MCP tool errors, hiding useful output.
}

async function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    const [entry, file] = await Promise.all([
      realpath(resolve(process.argv[1])), realpath(fileURLToPath(import.meta.url)),
    ]);
    return process.platform === "win32"
      ? entry.toLowerCase() === file.toLowerCase() : entry === file;
  } catch {
    return false;
  }
}
if (await invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write("GodPrompt checkpoint preview: " + error.message + "\n");
    process.exitCode = 1;
  });
}
