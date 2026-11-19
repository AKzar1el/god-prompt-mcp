/**
 * Opt-in, local-only correlation with Codexify's privacy-preserving audit log.
 *
 * Host records are stronger evidence than an agent-pasted exec_command JSON,
 * but a writable local JSONL file is NOT a signed attestation. In particular,
 * this must never authorize deployment, publication, or completion.
 */
import { lstat, open } from "node:fs/promises";
import { isAbsolute } from "node:path";

const MAX_TAIL_BYTES = 8 * 1024 * 1024;
const MAX_LINE_BYTES = 64 * 1024;
const MAX_RECORD_AGE_MS = 24 * 60 * 60 * 1000;

type RecordValue = Record<string, unknown>;
type AuditRef = {
  run_id: string;
  call_id: number;
  transport_session_id: number;
  conversation_id: string;
  project_id: string;
};

function object(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : null;
}

function validRef(raw: unknown): AuditRef | null {
  const ref = object(raw);
  if (!ref || Object.keys(ref).sort().join(",") !==
      "call_id,conversation_id,project_id,run_id,transport_session_id" ||
      typeof ref.run_id !== "string" || !/^[\w-]{8,128}$/.test(ref.run_id) ||
      typeof ref.conversation_id !== "string" ||
      !/^[a-f0-9]{24,64}$/.test(ref.conversation_id) ||
      typeof ref.project_id !== "string" ||
      !/^[a-f0-9]{24,64}$/.test(ref.project_id) ||
      !Number.isSafeInteger(ref.call_id) || Number(ref.call_id) < 0 ||
      !Number.isSafeInteger(ref.transport_session_id) ||
      Number(ref.transport_session_id) < 0) return null;
  return ref as AuditRef;
}

function recent(timestamp: unknown): boolean {
  if (typeof timestamp !== "string" || timestamp.length > 60) return false;
  const parsed = Date.parse(timestamp);
  const age = Date.now() - parsed;
  return Number.isFinite(parsed) && age >= -5 * 60_000 && age <= MAX_RECORD_AGE_MS;
}

async function auditTail(path: string, runId: string, callId: number): Promise<RecordValue[]> {
  if (!isAbsolute(path) || !path.endsWith(".jsonl")) return [];
  try {
    const info = await lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) return [];
    const handle = await open(path, "r");
    try {
      const size = Math.min(info.size, MAX_TAIL_BYTES);
      const offset = info.size - size;
      const data = Buffer.allocUnsafe(size);
      let read = 0;
      while (read < size) {
        const item = await handle.read(data, read, size - read, offset + read);
        if (item.bytesRead === 0) break;
        read += item.bytesRead;
      }
      const buffer = data.subarray(0, read);
      // A Codexify run ID is shared by *all* calls in one server process.
      // Search for the specific numeric call ID instead, then validate the
      // run ID and exact event metadata after parsing just those lines.
      const needle = Buffer.from('"call_id":' + callId, "utf8");
      const events: RecordValue[] = [];
      let found = buffer.indexOf(needle);
      while (found >= 0) {
        const precedingNewline = buffer.lastIndexOf(0x0a, found);
        const start = precedingNewline < 0 ? 0 : precedingNewline + 1;
        const end = buffer.indexOf(0x0a, found);
        if (end < 0) break; // A partial final record cannot verify anything.
        const next = end + 1;
        const nextChar = buffer[found + needle.length];
        if ((nextChar === 0x2c || nextChar === 0x7d) &&
            (precedingNewline >= 0 || offset === 0) &&
            end - start <= MAX_LINE_BYTES) {
          const line = buffer.toString("utf8", start, end).trimEnd();
          try {
            const parsed = object(JSON.parse(line));
            if (parsed?.schema_version === 2 && parsed.run_id === runId &&
                parsed.call_id === callId && recent(parsed.timestamp) &&
                ["tool_start", "tool_finish", "tool_worker_exit"].includes(String(parsed.event))) {
              events.push(parsed);
            }
          } catch { /* Ignore partial or malformed JSONL; never infer success. */ }
        }
        found = buffer.indexOf(needle, next);
      }
      return events;
    } finally {
      await handle.close();
    }
  } catch {
    return []; // Unavailable, rotated, or permission-denied log: fail closed.
  }
}

export async function correlateCodexifyAudit({
  path, ref: rawRef, expected_command, conversation_id, project_id, not_before,
}: {
  path: string;
  ref: unknown;
  expected_command: string;
  conversation_id: string;
  project_id: string;
  not_before?: string;
}): Promise<{ exit_code: number; source: "host_audit_correlated" } | null> {
  const ref = validRef(rawRef);
  const since = not_before === undefined ? null : Date.parse(not_before);
  if (!ref || !conversation_id || !project_id ||
      ref.conversation_id !== conversation_id ||
      ref.project_id !== project_id ||
      (not_before !== undefined &&
        (typeof not_before !== "string" || !Number.isFinite(since))) ||
      typeof expected_command !== "string" || expected_command.length > 400) return null;
  const events = (await auditTail(path, ref.run_id, ref.call_id)).filter((item) =>
    item.run_id === ref.run_id && item.call_id === ref.call_id);
  const starts = events.filter((item) => item.event === "tool_start");
  const finishes = events.filter((item) => item.event === "tool_finish");
  const exits = events.filter((item) => item.event === "tool_worker_exit");
  if (starts.length !== 1 || finishes.length !== 1 || exits.length !== 1) return null;
  const start = starts[0], finish = finishes[0], workerExit = exits[0];
  const sameScope = (item: RecordValue) =>
    item.transport_session_id === ref.transport_session_id &&
    item.conversation_id === ref.conversation_id &&
    item.project_id === ref.project_id;
  if (!sameScope(start) || !sameScope(finish) ||
      (since !== null && Date.parse(String(start.timestamp)) < since) ||
      start.tool !== "exec_command" || finish.tool !== "exec_command" ||
      start.resolved_tool !== "exec_command" ||
      finish.resolved_tool !== "exec_command" ||
      // The host redacts/truncates previews: only exact, intact matches count.
      start.command_preview !== expected_command ||
      finish.status !== "ok" ||
      workerExit.worker_kind !== "exec" ||
      workerExit.success !== true || workerExit.wait_error != null ||
      !Number.isInteger(workerExit.exit_code) ||
      Number(workerExit.exit_code) < 0) return null;
  return { exit_code: Number(workerExit.exit_code), source: "host_audit_correlated" };
}
