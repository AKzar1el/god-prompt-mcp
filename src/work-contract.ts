import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// A stateless, deterministic contract. This server never reads repositories,
// runs commands, contacts providers, stores user work, or grants permissions.
export const CONTRACT_SCHEMA = "godprompt.work_contract.v1";

export const WORK_CONTRACT_INSTRUCTIONS =
  "For coding tasks with scoped changes or required proof of completion, use classify_task then create_work_contract to define explicit acceptance, scope and actual verification commands before implementation. After authorized work, provide redacted command receipts and changed paths to review_work_evidence. All evidence is caller-supplied; a review is not independent verification, approval, or completion authorization.";

const TASK_TYPES = [
  "BUILD", "DEBUG", "REFACTOR", "CONTENT", "DESIGN",
  "SHIP", "ANALYZE", "AUTOMATE", "PLAN", "UNCLASSIFIED",
] as const;

const taskType = z.enum(TASK_TYPES);
const riskLevel = z.enum(["low", "medium", "high", "critical"]);

export function isScopedPath(value: string): boolean {
  if (
    !value || value.startsWith("/") || value.includes("\\") ||
    value.includes("\0") || /^[a-zA-Z]:/.test(value) ||
    value.includes("?") || value.includes("*")
  ) return false;
  const path = value.endsWith("/") ? value.slice(0, -1) : value;
  return path.length > 0 && path.split("/").every(
    (segment) => segment.length > 0 && segment !== "." && segment !== ".."
  );
}

const path = z.string().trim().min(1).max(240)
  .refine(isScopedPath, "Use a relative POSIX path, or a directory ending with /. No globs, traversal or drive paths.");

const phrase = z.string().trim().min(3).max(500);
const command = z.string().trim().min(1).max(400);

const CreateInput = z.object({
  task: z.string().trim().min(5).max(3000),
  task_type: taskType.default("UNCLASSIFIED"),
  risk_level: riskLevel.default("medium"),
  allowed_paths: z.array(path).max(50).default([]),
  forbidden_actions: z.array(phrase).max(30).default([]),
  success_criteria: z.array(phrase).max(30).default([]),
  verification_commands: z.array(command).max(30).default([]),
});

const ContractPayload = z.object({
  schema: z.literal(CONTRACT_SCHEMA),
  task: z.string().min(5).max(3000),
  task_type: taskType,
  risk_level: riskLevel,
  allowed_paths: z.array(path).max(50),
  forbidden_actions: z.array(phrase).max(30),
  success_criteria: z.array(z.object({
    id: z.string().regex(/^AC-[0-9]{2}$/),
    text: phrase,
  })).max(30),
  verification_commands: z.array(z.object({
    id: z.string().regex(/^VC-[0-9]{2}$/),
    command,
  })).max(30),
});

const Contract = ContractPayload.extend({
  contract_id: z.string().regex(/^sha256:[a-f0-9]{64}$/),
});

type Payload = z.infer<typeof ContractPayload>;
export type WorkContract = z.infer<typeof Contract>;

export type ContractIssue = {
  code: string;
  detail: string;
};

function canonicalPayload(contract: WorkContract): Payload {
  return {
    schema: contract.schema,
    task: contract.task,
    task_type: contract.task_type,
    risk_level: contract.risk_level,
    allowed_paths: contract.allowed_paths,
    forbidden_actions: contract.forbidden_actions,
    success_criteria: contract.success_criteria,
    verification_commands: contract.verification_commands,
  };
}

async function fingerprint(value: Payload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256:" + Array.from(new Uint8Array(digest))
    .map((n) => n.toString(16).padStart(2, "0")).join("");
}

function missingDefinitions(contract: Payload): ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (contract.task_type === "UNCLASSIFIED") issues.push({
    code: "TASK_TYPE_UNCLASSIFIED",
    detail: "Choose a task type. Use classify_task first, then resolve ambiguity explicitly.",
  });
  if (contract.allowed_paths.length === 0) issues.push({
    code: "SCOPE_UNDEFINED",
    detail: "Supply exact allowable files or relative directory prefixes ending in /.",
  });
  if (contract.success_criteria.length === 0) issues.push({
    code: "ACCEPTANCE_UNDEFINED",
    detail: "Supply user-approved, observable outcome-level success criteria.",
  });
  if (contract.verification_commands.length === 0) issues.push({
    code: "VERIFICATION_UNDEFINED",
    detail: "Supply actual repository-appropriate verification commands. None are invented.",
  });
  return issues;
}

function duplicateValues(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

export async function createWorkContract(raw: z.input<typeof CreateInput>) {
  const input = CreateInput.parse(raw);
  const payload: Payload = {
    schema: CONTRACT_SCHEMA,
    task: input.task,
    task_type: input.task_type,
    risk_level: input.risk_level,
    allowed_paths: input.allowed_paths,
    forbidden_actions: input.forbidden_actions,
    success_criteria: input.success_criteria.map((text, i) => ({
      id: "AC-" + String(i + 1).padStart(2, "0"),
      text,
    })),
    verification_commands: input.verification_commands.map((commandText, i) => ({
      id: "VC-" + String(i + 1).padStart(2, "0"),
      command: commandText,
    })),
  };
  const issues = missingDefinitions(payload);
  if (duplicateValues(payload.allowed_paths)) issues.push({
    code: "DUPLICATE_SCOPE_PATH",
    detail: "Remove duplicate allowed paths before work begins.",
  });
  if (duplicateValues(payload.verification_commands.map((v) => v.command))) issues.push({
    code: "DUPLICATE_VERIFICATION",
    detail: "Each required verification command should be unique.",
  });
  return {
    contract: { ...payload, contract_id: await fingerprint(payload) },
    definition_status: issues.length ? "NEEDS_DEFINITION" : "DEFINED",
    issues,
    workflow: [
      "Understand authoritative requirements and current repository state.",
      "Plan within the specified paths, forbidden actions and success criteria.",
      "Execute only actions separately authorized by the user and the host.",
      "Run required checks in the actual target environment and retain redacted receipts.",
      "Submit evidence to review_work_evidence, then independently verify before completion claims.",
      "Report complete, partial, blocked, or stopped truthfully; hand off this contract unchanged.",
    ],
    instructions:
      "Contract creation neither executes commands nor authorizes changes, deployment, merges, spending or completion claims. The SHA-256 ID detects accidental drift, not malicious forgery.",
  };
}

const VerificationReceipt = z.object({
  id: z.string().regex(/^VC-[0-9]{2}$/),
  command,
  exit_code: z.number().int().nullable(),
  evidence_excerpt: z.string().max(1000).default(""),
  source: z.enum(["tool_output", "self_report"]).default("self_report"),
});

const AcceptanceReceipt = z.object({
  id: z.string().regex(/^AC-[0-9]{2}$/),
  status: z.enum(["met", "unmet", "unknown"]),
  evidence_refs: z.array(z.string().min(1).max(80)).max(20).default([]),
});

const Observation = z.object({
  id: z.string().regex(/^OBS-[0-9]{2}$/),
  note: z.string().trim().min(3).max(1000),
  source: z.enum(["tool_output", "manual_report"]),
});

const ReviewInput = z.object({
  contract: Contract,
  changed_files: z.array(z.string().trim().min(1).max(240)).max(150).default([]),
  operations_performed: z.array(phrase).max(100).default([]),
  checks: z.array(VerificationReceipt).max(100).default([]),
  acceptance: z.array(AcceptanceReceipt).max(100).default([]),
  observations: z.array(Observation).max(100).default([]),
  human_review_reported: z.boolean().default(false),
});

function isAllowed(file: string, allowed: string[]): boolean {
  if (!isScopedPath(file) || file.endsWith("/")) return false;
  return allowed.some((entry) =>
    entry.endsWith("/") ? file.startsWith(entry) : file === entry
  );
}

function normalizeAction(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

export async function reviewWorkEvidence(raw: z.input<typeof ReviewInput>) {
  const input = ReviewInput.parse(raw);
  const contract = input.contract;
  const issues: ContractIssue[] = missingDefinitions(contract);
  if (await fingerprint(canonicalPayload(contract)) !== contract.contract_id) issues.push({
    code: "CONTRACT_DRIFT",
    detail: "Contract fields no longer match its SHA-256 fingerprint. Recreate and review the contract.",
  });
  if (duplicateValues(contract.allowed_paths)) issues.push({
    code: "DUPLICATE_SCOPE_PATH",
    detail: "Contract contains duplicate scope paths.",
  });
  if (duplicateValues(contract.verification_commands.map((v) => v.command))) issues.push({
    code: "DUPLICATE_VERIFICATION",
    detail: "Contract contains duplicate verification commands.",
  });
  if (duplicateValues(input.checks.map((c) => c.id))) issues.push({
    code: "DUPLICATE_CHECK_RECEIPT",
    detail: "More than one check receipt uses the same verification ID.",
  });
  if (duplicateValues(input.acceptance.map((c) => c.id))) issues.push({
    code: "DUPLICATE_ACCEPTANCE_RECEIPT",
    detail: "More than one acceptance receipt uses the same criterion ID.",
  });
  if (duplicateValues(input.observations.map((o) => o.id))) issues.push({
    code: "DUPLICATE_OBSERVATION",
    detail: "More than one observation uses the same ID.",
  });

  for (const file of input.changed_files) {
    if (!isScopedPath(file) || file.endsWith("/")) issues.push({
      code: "INVALID_CHANGED_PATH",
      detail: "Changed file path is not a safe relative file path: " + file,
    });
    else if (!isAllowed(file, contract.allowed_paths)) issues.push({
      code: "OUT_OF_SCOPE_CHANGE",
      detail: "Changed file is outside the defined paths: " + file,
    });
  }
  const forbidden = new Set(contract.forbidden_actions.map(normalizeAction));
  for (const action of input.operations_performed) {
    if (forbidden.has(normalizeAction(action))) issues.push({
      code: "PROHIBITED_ACTION_REPORTED",
      detail: "A forbidden action is reported as performed: " + action,
    });
  }

  const checks = new Map(input.checks.map((receipt) => [receipt.id, receipt]));
  const evidenceIDs = new Set<string>();
  for (const expected of contract.verification_commands) {
    const receipt = checks.get(expected.id);
    if (!receipt) {
      issues.push({
        code: "MISSING_VERIFICATION",
        detail: "No execution receipt for " + expected.id + " (" + expected.command + ").",
      });
      continue;
    }
    if (receipt.command !== expected.command) issues.push({
      code: "COMMAND_MISMATCH",
      detail: "Command recorded for " + expected.id + " does not match the contract.",
    });
    else if (receipt.exit_code !== 0) issues.push({
      code: "VERIFICATION_FAILED",
      detail: "Command " + expected.id + " has nonzero or missing exit code.",
    });
    else if (receipt.source !== "tool_output") issues.push({
      code: "SELF_REPORTED_CHECK",
      detail: "Command " + expected.id + " has no attributed tool-output receipt.",
    });
    else evidenceIDs.add(receipt.id);
  }

  for (const observation of input.observations) evidenceIDs.add(observation.id);
  const acceptance = new Map(input.acceptance.map((receipt) => [receipt.id, receipt]));
  for (const criterion of contract.success_criteria) {
    const receipt = acceptance.get(criterion.id);
    if (!receipt || receipt.status !== "met") {
      issues.push({
        code: "ACCEPTANCE_NOT_MET",
        detail: "Criterion " + criterion.id + " lacks a reported met result.",
      });
      continue;
    }
    if (receipt.evidence_refs.length === 0 ||
        receipt.evidence_refs.some((ref) => !evidenceIDs.has(ref))) {
      issues.push({
        code: "ACCEPTANCE_EVIDENCE_MISSING",
        detail: "Criterion " + criterion.id + " needs references to supplied successful checks or observations.",
      });
    }
  }
  if ((contract.risk_level === "high" || contract.risk_level === "critical") &&
      !input.human_review_reported) {
    issues.push({
      code: "REVIEW_REQUIRED",
      detail: "High/critical-risk work requires a separately authorized human review.",
    });
  }

  return {
    contract_id: contract.contract_id,
    status: issues.length ? "HOLD" : "REPORTED_READY_FOR_INDEPENDENT_REVIEW",
    issues,
    reported_files: input.changed_files.length,
    required_checks: contract.verification_commands.length,
    supplied_check_receipts: input.checks.length,
    required_acceptance_criteria: contract.success_criteria.length,
    supplied_acceptance_receipts: input.acceptance.length,
    independently_verified: false,
    completion_authorized: false,
    warning:
      "Every receipt and approval is caller-supplied and untrusted. This server did not execute or independently authenticate any command, diff, manual check or approval. A clean report is not proof of successful work or authorization to ship.",
    next_step: issues.length
      ? "Resolve the reported gaps and rerun evidence review. Do not claim task completion."
      : "Independently inspect authoritative source tool outputs, actual diff, CI status and necessary approvals before a completion claim.",
  };
}

const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toolResult(value: unknown) {
  return {
    structuredContent: value,
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

export function registerWorkContractTools(server: McpServer): void {
  server.registerTool(
    "create_work_contract",
    {
      title: "Create a bounded GodPrompt task contract",
      description:
        "Create a portable, SHA-256-fingerprinted task contract with explicitly provided scope, acceptance criteria, verification commands and prohibitions. Deterministic, read-only and stateless. Use classify_task first; missing details produce NEEDS_DEFINITION, never inferred commands or permission to execute.",
      inputSchema: CreateInput.shape,
      annotations: ANNOTATIONS,
    },
    async (input) => toolResult(await createWorkContract(input))
  );
  server.registerTool(
    "review_work_evidence",
    {
      title: "Review task completion evidence",
      description:
        "Fail-closed audit of a create_work_contract result against supplied changed paths, command receipts, criteria, prohibited actions and risk review. Returns HOLD or REPORTED_READY_FOR_INDEPENDENT_REVIEW; never independently verifies caller-supplied evidence or authorizes completion, merge or deployment.",
      inputSchema: ReviewInput.shape,
      annotations: ANNOTATIONS,
    },
    async (input) => toolResult(await reviewWorkEvidence(input))
  );
}
