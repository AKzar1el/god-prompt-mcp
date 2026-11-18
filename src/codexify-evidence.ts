/**
 * Shared, local-only adapter for caller-supplied Codexify receipts.
 * Portable WebCrypto permits both the CLI and MCP to use one implementation.
 * A receipt is not authenticated simply because it resembles a tool result.
 */
import type { WorkContract } from "./work-contract.js";

export const CODEXIFY_BUNDLE_SCHEMA = "godprompt.evidence_bundle.v1";

type RecordValue = Record<string, unknown>;
type Check = {
  id: string;
  command: string;
  exit_code: number | null;
  source: "tool_output" | "self_report";
  evidence_excerpt: string;
};

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}

export function validateWorkContractEnvelope(contract: unknown): WorkContract {
  const data = record(contract);
  if (data?.schema !== "godprompt.work_contract.v1" ||
      typeof data.contract_id !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(data.contract_id) ||
      !Array.isArray(data.verification_commands) ||
      !Array.isArray(data.allowed_paths) ||
      !Array.isArray(data.success_criteria)) {
    throw new Error("Expected a complete v1 GodPrompt contract");
  }
  return contract as WorkContract;
}

async function digestShort(data: RecordValue): Promise<string> {
  const payload = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest)).map((byte) =>
    byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function hasToolError(receipt: RecordValue, response: RecordValue | null,
                      result: RecordValue | null): boolean {
  // MCP errors must override misleading nested exit_code:0 values.
  // Treat malformed error flags and explicit failure statuses conservatively.
  // A present JSON-RPC error object is a failure even without isError.
  const nested = record(result?.upstream_result);
  return [receipt, response, result, nested,
    record(response?.structuredContent), record(result?.structuredContent)].some((data) =>
    data !== null && (
      (Object.hasOwn(data, "isError") && data.isError !== false) ||
      (Object.hasOwn(data, "success") && data.success !== true) ||
      (typeof data.status === "string" &&
        /^(error|failed|failure|cancelled|canceled|timeout|timed_out|aborted|interrupted|rejected|pending|running)$/i.test(data.status.trim())) ||
      (data.error !== undefined && data.error !== null)
    ));
}

export async function codexifyEvidence({
  contract, exportData,
}: { contract: WorkContract; exportData: unknown }) {
  validateWorkContractEnvelope(contract);
  const source = record(exportData);
  if (!source) throw new Error("Codexify export must be an object");
  const changedFiles = source.changed_files;
  if (!Array.isArray(changedFiles) || changedFiles.length > 150 ||
      changedFiles.some((value) => typeof value !== "string")) {
    throw new Error("Codexify export needs a bounded changed_files array");
  }
  const rawChecks = source.checks;
  if (!Array.isArray(rawChecks) || rawChecks.length > 100) {
    throw new Error("Codexify export needs a bounded checks array");
  }

  const gaps: string[] = [];
  const checks: Check[] = await Promise.all(rawChecks.map(async (raw): Promise<Check> => {
    const receipt = record(raw);
    if (!receipt || typeof receipt.id !== "string" ||
        typeof receipt.command !== "string") {
      throw new Error("Malformed Codexify receipt");
    }
    const response = record(receipt.response);
    const result = record(response?.upstream_result);
    const code = receipt.tool === "mcp__God_v5__exec_command" &&
      !hasToolError(receipt, response, result) &&
      Number.isInteger(result?.exit_code) && Number(result?.exit_code) >= 0
      ? Number(result?.exit_code) : null;
    if (code === null) gaps.push("NO_STRUCTURED_CODEXIFY_RECEIPT:" + receipt.id);
    return {
      id: receipt.id,
      command: receipt.command,
      exit_code: code,
      source: code === null ? "self_report" : "tool_output",
      evidence_excerpt: code === null
        ? "No successful structured Codexify exec_command envelope; self-report only."
        : "Codexify exec_command exported envelope: exit_code=" + code +
          "; result_sha256=" + await digestShort(result!) + "; raw output withheld.",
    };
  }));

  for (const required of contract.verification_commands) {
    if (!checks.some((entry) => entry.id === required.id)) {
      gaps.push("VERIFICATION_MISSING:" + required.id);
    }
  }
  gaps.push("CHANGED_FILE_LIST_IS_CALLER_SUPPLIED");
  gaps.push("ACCEPTANCE_REQUIRES_INDEPENDENT_EVIDENCE");

  const rawOperations = source.operations_performed;
  if (rawOperations !== undefined &&
      (!Array.isArray(rawOperations) || rawOperations.length > 100 ||
       rawOperations.some((value) => typeof value !== "string" ||
         value.trim().length < 3 || value.length > 500))) {
    throw new Error("Codexify export needs a bounded operations_performed array");
  }
  const operations = rawOperations === undefined ? [] : rawOperations as string[];
  return {
    schema: CODEXIFY_BUNDLE_SCHEMA,
    adapter: "codexify_receipts",
    provenance: { provider: "codexify_export", claimed_receipts: checks.length },
    review_input: {
      contract,
      changed_files: changedFiles as string[],
      operations_performed: operations,
      checks,
      acceptance: [],
      observations: [],
      human_review_reported: false,
    },
    gaps: [...new Set(gaps)],
    independently_verified: false,
    completion_authorized: false,
    warning: "Caller-supplied receipts are not authenticated execution proof. Diff, output, acceptance, and approvals require independent review. Do not send private evidence to the public MCP.",
  };
}
