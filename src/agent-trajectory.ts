/** Read-only, deterministic review of caller-supplied agent events. No host log access. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

export const TrajectoryEventSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/),
  kind: z.enum(["tool_call", "tool_result", "verification", "completion", "decision"]),
  operation: z.enum(["read", "write", "verify", "other"]).optional(),
  tool: z.string().max(100).optional(),
  status: z.enum(["ok", "failed", "skipped", "unknown"]).optional(),
  scope: z.enum(["allowed", "outside", "unknown"]).optional(),
  fingerprint: z.string().regex(/^[A-Za-z0-9_.:-]{1,80}$/).optional(),
  tokens: z.number().int().min(0).max(200_000).optional(),
}).strict();

export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;
export const TrajectoryInputSchema = z.object({
  events: z.array(TrajectoryEventSchema).min(1).max(150),
  budget_tokens: z.number().int().min(1).max(2_000_000).optional(),
}).strict();

type Finding = { code: string; severity: "high" | "medium" | "low"; event_index: number; recommendation: string };
const hint = (code: string, severity: Finding["severity"], event_index: number, recommendation: string): Finding =>
  ({ code, severity, event_index, recommendation });

export function auditAgentTrajectory(events: TrajectoryEvent[], budget_tokens?: number) {
  const findings: Finding[] = [];
  const IDs = new Set<string>();
  const failing = new Map<string, number>();
  const redundantReads = new Map<string, number>();
  let uncheckedWrites = 0;
  let reportedTokens = 0;
  let eventsWithTokens = 0;
  let budgetReported = false;
  let latestCheckOutcome: "ok" | "failed" | "skipped" | "unknown" | null = null;
  let writes = 0;
  let verification = 0;
  let lastWrite = -1;
  let lastCheck = -1;
  let completed = 0;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const position = i + 1;
    if (IDs.has(event.id)) findings.push(hint("DUPLICATE_EVENT_ID", "medium", position,
      "Provide unique event identifiers before trusting the trajectory."));
    IDs.add(event.id);
    if(event.tokens!==undefined) {
      reportedTokens+=event.tokens;
      eventsWithTokens++;
      if(!budgetReported && budget_tokens!==undefined && reportedTokens>budget_tokens){
        budgetReported=true;
        findings.push(hint("TOKEN_BUDGET_EXCEEDED_REPORTED","medium",position,
          "Review reported token spend and scope; stop avoidable exploration without skipping necessary verification."));
      }
    }
    if(event.kind==="decision" || (event.operation==="write"&&event.status==="ok"))redundantReads.clear();
    if(event.kind==="tool_result" && event.operation==="read" && event.status==="ok" && event.fingerprint){
      const key=(event.tool??"unnamed")+":"+event.fingerprint;
      const count=(redundantReads.get(key)??0)+1;
      redundantReads.set(key,count);
      if(count===4)findings.push(hint("REPEATED_UNCHANGED_READ","low",position,
        "Consider caching or reusing this reported identical read; polling may be legitimate."));
    }
    if(event.kind==="verification" || event.operation==="verify")latestCheckOutcome=event.status??"unknown";
    if (event.operation === "write" && event.scope === "outside" &&
        event.kind === "tool_result" && event.status === "ok") {
      findings.push(hint("OUT_OF_SCOPE_WRITE_REPORTED", "high", position,
        "Reconcile the successful reported write with the approved task scope."));
    }
    if (event.kind === "tool_result" && event.status === "failed") {
      const key = (event.tool ?? "unnamed") + ":" + (event.fingerprint ?? "unspecified");
      const count = (failing.get(key) ?? 0) + 1;
      failing.set(key, count);
      if (count === 3) findings.push(hint("REPEATED_FAILURE", "medium", position,
        "Stop repeating this failing call unchanged; inspect the cause or adjust the plan."));
    }
    if (event.kind === "tool_result" && event.operation === "write" && event.status === "ok") {
      writes++;
      lastWrite = i;
      uncheckedWrites++;
      if(uncheckedWrites===12)findings.push(hint("LONG_UNCHECKED_WRITE_STREAK","low",position,
        "Consider a focused checkpoint to catch regressions before more changes."));
    }
    if ((event.kind === "verification" || event.operation === "verify") && event.status === "ok") {
      verification++;
      lastCheck = i;
      uncheckedWrites=0;
    }
    if (event.kind === "completion") {
      completed++;
      if (lastCheck < lastWrite || lastCheck < 0 || latestCheckOutcome!=="ok") findings.push(hint("PREMATURE_COMPLETION", "high", position,
        "Obtain current verification evidence before claiming completion."));
    }
  }
  if(completed>0 && latestCheckOutcome==="failed")findings.push(hint("FAILED_FINAL_VERIFICATION","high",events.length,
    "The latest reported verification failed; do not claim completion."));
  if (writes > 0 && lastCheck < 0) findings.push(hint("MISSING_VERIFICATION", "high", events.length,
    "Capture a real post-change check; event reports are not independently authenticated."));
  else if (writes > 0 && lastCheck < lastWrite) findings.push(hint("STALE_VERIFICATION", "high", events.length,
    "Rerun verification after the most recent write."));
  return {
    status: findings.length ? "RECHECK" : "NO_DETERMINISTIC_SIGNALS",
    findings: findings.slice(0, 40),
    truncated: findings.length > 40,
    events_reviewed: events.length,
    reported_writes: writes,
    reported_successful_verifications: verification,
    reported_completions: completed,
    reported_tokens: eventsWithTokens ? reportedTokens : null,
    token_budget: budget_tokens ?? null,
    independently_verified: false,
    completion_authorized: false,
    warning: "Caller-supplied event metadata is unverified. No logs, commands or file contents were accessed or replayed.",
  };
}

export const TrajectoryOutputSchema=z.object({
  status:z.enum(["RECHECK","NO_DETERMINISTIC_SIGNALS"]),
  findings:z.array(z.object({code:z.string(),severity:z.enum(["high","medium","low"]),event_index:z.number().int(),recommendation:z.string()}).strict()),
  truncated:z.boolean(),events_reviewed:z.number().int(),reported_writes:z.number().int(),
  reported_successful_verifications:z.number().int(),reported_completions:z.number().int(),
  reported_tokens:z.number().int().nullable(),token_budget:z.number().int().nullable(),
  independently_verified:z.literal(false),completion_authorized:z.literal(false),warning:z.string(),
}).strict();

export function registerTrajectoryTool(server: McpServer): void {
  server.registerTool("audit_agent_trajectory", {
    title: "Audit reported agent trajectory",
    description: "Read-only review of bounded, sanitized event metadata for repeated failures, scope drift, stale verification and premature completion. No raw logs or independent execution evidence; cannot authorize an agent.",
    inputSchema: TrajectoryInputSchema.shape,
    outputSchema:TrajectoryOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ events, budget_tokens }) => {
    const output = auditAgentTrajectory(events, budget_tokens);
    return { structuredContent: output, content: [{ type: "text", text: JSON.stringify(output) }] };
  });
}
