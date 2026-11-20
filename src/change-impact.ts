/** Read-only dependency impact and evidence coverage from caller-supplied relationships. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const file = z.string().trim().min(1).max(240).regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_.\/-]+$/);
const id = z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/);
const files = z.array(file).max(25);
export const ImpactSchema = z.object({
  changed_files: z.array(file).min(1).max(50),
  dependencies: z.array(z.object({ consumer: file, dependency: file }).strict()).max(250).default([]),
  requirements: z.array(z.object({ id, files }).strict()).max(50).default([]),
  tests: z.array(z.object({
    id,
    covers_files: files.default([]),
    covers_requirements: z.array(id).max(30).default([]),
    duration_ms: z.number().int().min(1).max(3_600_000).optional(),
  }).strict()).max(70).default([]),
  receipts: z.array(z.object({
    test_id: id,
    status: z.enum(["passed", "failed", "not_run"]),
  }).strict()).max(70).default([]),
}).strict();
export type ImpactInput = z.input<typeof ImpactSchema>;
type Normalized = z.output<typeof ImpactSchema>;

export function traceChangeImpact(input: Normalized) {
  const issues: Array<{ code: string; severity: "high" | "medium" | "low"; reference: string }> = [];
  const affected = new Map<string, { depth: number; via: string | null }>();
  const dependents = new Map<string, string[]>();
  for (const link of input.dependencies) {
    const list = dependents.get(link.dependency) ?? [];
    if (!list.includes(link.consumer)) list.push(link.consumer);
    dependents.set(link.dependency, list);
  }
  const queue: string[] = [];
  for (const path of input.changed_files) if (!affected.has(path)) {
    affected.set(path, {depth: 0, via: null});
    queue.push(path);
  }
  for (let i = 0; i < queue.length; i++) {
    const path = queue[i];
    const info = affected.get(path)!;
    if (info.depth >= 6) continue;
    for (const child of (dependents.get(path) ?? []).sort()) {
      if (affected.size >= 150 || affected.has(child)) continue;
      affected.set(child, {depth: info.depth + 1, via: path});
      queue.push(child);
    }
  }
  if (affected.size >= 150) issues.push({code:"IMPACT_GRAPH_TRUNCATED",severity:"medium",reference:"graph"});
  const impacted = input.requirements.filter(r => r.files.some(path => affected.has(path)));
  const targets = new Set([
    ...impacted.map(r => "requirement:" + r.id),
    ...[...affected.keys()].map(path => "file:" + path),
  ]);
  const selected: Array<{id:string;covers:string[];reported_status:string}> = [];
  const used = new Set<string>();
  const receiptByID = new Map(input.receipts.map(r => [r.test_id, r.status]));
  const seenTestIDs = new Set<string>();
  for (const test of input.tests) {
    if (seenTestIDs.has(test.id)) issues.push({code:"DUPLICATE_TEST_ID",severity:"medium",reference:test.id});
    seenTestIDs.add(test.id);
  }
  const remaining = new Set(targets);
  for (let step = 0; step < 12 && remaining.size > 0; step++) {
    let best: Normalized["tests"][number] | null = null;
    let coverage: string[] = [];
    let bestScore = -1;
    for (const test of input.tests) {
      if (used.has(test.id)) continue;
      const matching = [
        ...test.covers_files.map(path => "file:" + path),
        ...test.covers_requirements.map(r => "requirement:" + r),
      ].filter(key => remaining.has(key));
      const score = matching.length / (1 + Math.log2(1 + (test.duration_ms ?? 1000) / 1000));
      if (matching.length > 0 && (score > bestScore || (score === bestScore && test.id < (best?.id ?? "")))) {
        best = test; coverage = [...new Set(matching)]; bestScore = score;
      }
    }
    if (!best) break;
    used.add(best.id);
    for (const target of coverage) remaining.delete(target);
    selected.push({id:best.id,covers:coverage,reported_status:receiptByID.get(best.id) ?? "missing"});
    if (receiptByID.get(best.id) !== "passed") issues.push({
      code:"SELECTED_TEST_NOT_VERIFIED", severity:"medium", reference: best.id,
    });
  }
  for (const target of [...remaining].sort().slice(0, 40)) issues.push({
    code:"UNCOVERED_IMPACT_TARGET",severity:"high",reference:target,
  });
  return {
    status: issues.length ? "RECHECK_IMPACT_EVIDENCE" : "REPORTED_COVERAGE_ONLY",
    affected_files: [...affected].slice(0, 150).map(([path, trace]) => ({path, ...trace})),
    impacted_requirement_ids: [...new Set(impacted.map(r => r.id))],
    recommended_tests: selected,
    uncovered_targets: [...remaining].sort().slice(0, 40),
    issues: issues.slice(0, 70),
    truncated: affected.size >= 150 || remaining.size > 40 || issues.length > 70,
    independently_verified: false,
    tests_executed: 0,
    warning: "Dependencies, test mappings and receipts are caller-supplied. Graph traversal and test selection do not inspect code, execute tests or prove correctness.",
  };
}

export const ImpactOutputSchema=z.object({
  status:z.enum(["RECHECK_IMPACT_EVIDENCE","REPORTED_COVERAGE_ONLY"]),
  affected_files:z.array(z.object({path:z.string(),depth:z.number().int(),via:z.string().nullable()}).strict()),
  impacted_requirement_ids:z.array(z.string()),
  recommended_tests:z.array(z.object({id:z.string(),covers:z.array(z.string()),reported_status:z.enum(["passed","failed","not_run","missing"])}).strict()),
  uncovered_targets:z.array(z.string()),
  issues:z.array(z.object({code:z.string(),severity:z.enum(["high","medium","low"]),reference:z.string()}).strict()),
  truncated:z.boolean(),independently_verified:z.literal(false),tests_executed:z.literal(0),warning:z.string(),
}).strict();

export function registerImpactTool(server: McpServer): void {
  server.registerTool("trace_change_impact", {
    title: "Trace changed-code impact and test coverage",
    description: "Rank affected files and select test cases with explicit dependency and requirement-to-test mappings. All graph and receipt evidence must be supplied by caller; no repository or command execution.",
    inputSchema: ImpactSchema.shape,
    outputSchema:ImpactOutputSchema.shape,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async (args) => {
    const output = traceChangeImpact(ImpactSchema.parse(args));
    return {structuredContent:output,content:[{type:"text",text:JSON.stringify(output)}]};
  });
}
