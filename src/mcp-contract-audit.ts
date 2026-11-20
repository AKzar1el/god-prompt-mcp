/** Structural and behavioral hint audit of caller-supplied MCP tool contracts. */
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

const annotationSchema = z.object({
  readOnlyHint: z.boolean().optional(),
  destructiveHint: z.boolean().optional(),
  idempotentHint: z.boolean().optional(),
  openWorldHint: z.boolean().optional(),
}).strict();
const toolSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1200).optional(),
  input_schema: z.record(z.string(), z.unknown()).optional(),
  output_schema: z.record(z.string(), z.unknown()).optional(),
  annotations: annotationSchema.optional(),
}).strict();
export const McpContractAuditSchema = z.object({ tools: z.array(toolSchema).min(1).max(40) }).strict();
type ContractTool = z.infer<typeof toolSchema>;
type ContractIssue = { tool_index: number; code: string; severity: "high" | "medium" | "low"; advice: string };
const flag = (tool_index: number, code: string, severity: ContractIssue["severity"], advice: string): ContractIssue =>
  ({tool_index, code, severity, advice});

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ?
    value as Record<string, unknown> : null;
}
function text(value: unknown): string { return typeof value === "string" ? value : ""; }
function unsafeArgLimit(prop: Record<string, unknown>): boolean {
  return !Number.isFinite(prop.maxLength) && !Array.isArray(prop.enum) && !Object.hasOwn(prop, "const");
}

export function reviewMcpToolContracts(tools: ContractTool[]) {
  const issues: ContractIssue[] = [];
  for (let i = 0; i < tools.length; i++) {
    const item = tools[i]; const ix = i + 1;
    const name = item.name.toLowerCase();
    const description = item.description ?? "";
    const hasWrites = /(?:^|[_-])(delete|remove|write|edit|execute|run|send|deploy|publish|merge|push|update|create)(?:$|[_-])/.test(name);
    const destructive = /(?:^|[_-])(delete|remove|purge|drop)(?:$|[_-])/.test(name);
    if (description.trim().length < 25) issues.push(flag(ix,"UNDERSPECIFIED_TOOL_DESCRIPTION","medium",
      "Describe observable behavior, side effects and trust boundary in the tool contract."));
    if (!item.annotations) issues.push(flag(ix,"MISSING_BEHAVIOR_ANNOTATIONS","low",
      "Declare accurate read-only and destructive hints for client decision-making."));
    if (hasWrites && item.annotations?.readOnlyHint === true) issues.push(flag(ix,"READONLY_BEHAVIOR_CONTRADICTION","high",
      "Reconcile mutation-like tool name with its readOnlyHint before advertising the tool."));
    if (destructive && item.annotations?.destructiveHint === false) issues.push(flag(ix,"DESTRUCTIVE_BEHAVIOR_CONTRADICTION","high",
      "Review whether the tool may delete resources and correct descriptive safety hints."));
    if (!item.output_schema) issues.push(flag(ix,"OUTPUT_SCHEMA_ABSENT","low",
      "Consider a bounded structured result contract for reliable agent consumption."));
    if (item.input_schema) {
      const schema = object(item.input_schema);
      if (schema?.type !== "object") issues.push(flag(ix,"UNUSUAL_INPUT_SCHEMA","medium",
        "Check whether the declared input schema is a well-scoped object."));
      const properties = object(schema?.properties) ?? {};
      for (const [key,value] of Object.entries(properties).slice(0, 35)) {
        const p = object(value);
        if (/(?:^|_)(?:command|script|code|url|shell|path)(?:$|_)/i.test(key) &&
            p?.type === "string" && unsafeArgLimit(p)) {
          issues.push(flag(ix,"UNBOUNDED_SENSITIVE_ARGUMENT","medium",
            "Constrain sensitive text arguments and validate access scope before execution."));
          break;
        }
      }
    }
    if (/\b(read[- ]only|does not mutate)\b/i.test(description) && hasWrites) issues.push(flag(ix,
      "DESCRIPTION_NAME_MISMATCH","low","Confirm actual side effects; natural-language descriptions are not enforcement."));
    if (issues.length > 200) break;
  }
  return {
    status: issues.length ? "CONTRACT_REVIEW_HINTS" : "NO_DETERMINISTIC_SIGNALS",
    issues: issues.slice(0, 80),
    truncated: issues.length > 80,
    reviewed_tools: tools.length,
    independently_verified: false,
    warning: "Caller-supplied schemas were inspected without executing tools, validating server behavior or verifying annotations. These are heuristics, not vulnerabilities.",
  };
}

export const McpContractOutputSchema=z.object({
  status:z.enum(["CONTRACT_REVIEW_HINTS","NO_DETERMINISTIC_SIGNALS"]),
  issues:z.array(z.object({tool_index:z.number().int(),code:z.string(),severity:z.enum(["high","medium","low"]),advice:z.string()}).strict()),
  truncated:z.boolean(),reviewed_tools:z.number().int(),independently_verified:z.literal(false),warning:z.string(),
}).strict();

export function registerMcpContractAuditTool(server: McpServer): void {
  server.registerTool("review_mcp_tool_contracts",{
    title:"Review supplied MCP contracts",
    description:"Read-only bounded design audit of MCP tool descriptions, input/output schemas and annotations. Not a protocol validator, vulnerability scanner or permission grant.",
    inputSchema:McpContractAuditSchema.shape,
    outputSchema:McpContractOutputSchema.shape,
    annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  },async ({tools})=>{
    const output=reviewMcpToolContracts(tools);
    return {structuredContent:output,content:[{type:"text",text:JSON.stringify(output)}]};
  });
}
