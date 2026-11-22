import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CONTENT } from "./content.js";

const TYPES = ["BUILD", "DEBUG", "REFACTOR", "CONTENT", "DESIGN", "SHIP", "ANALYZE", "AUTOMATE", "PLAN"] as const;
const PHASES = ["plan", "execute", "verify", "handoff"] as const;
const RECOMMENDED_GUIDANCE_CHARS = 1800;
const MAX_GUIDANCE_CHARS = 4000;

type TaskType = (typeof TYPES)[number];
type Phase = (typeof PHASES)[number];

/** Small goal-to-tool hints; never automatic tool invocation or permission. */
const TOOL_HINTS: Record<TaskType, Record<Phase, readonly string[]>> = {
  BUILD:{plan:["audit_requirements","build_test_matrix","create_work_contract"],execute:["review_code_change","trace_change_impact"],verify:["review_work_evidence","design_adversarial_tests"],handoff:["create_context_handoff"]},
  DEBUG:{plan:["diagnose_failure","create_work_contract"],execute:["review_code_change","audit_agent_trajectory"],verify:["review_work_evidence","trace_change_impact"],handoff:["create_context_handoff"]},
  REFACTOR:{plan:["create_work_contract","trace_change_impact"],execute:["review_code_change","audit_agent_trajectory"],verify:["review_work_evidence","build_test_matrix"],handoff:["create_context_handoff"]},
  CONTENT:{plan:["audit_requirements"],execute:["review_code_change"],verify:["review_work_evidence"],handoff:["create_context_handoff"]},
  DESIGN:{plan:["audit_requirements","build_test_matrix"],execute:["review_code_change"],verify:["design_adversarial_tests","review_work_evidence"],handoff:["create_context_handoff"]},
  SHIP:{plan:["assess_release_readiness","create_work_contract"],execute:["trace_change_impact"],verify:["assess_release_readiness","review_work_evidence"],handoff:["create_context_handoff"]},
  ANALYZE:{plan:["audit_requirements","diagnose_failure"],execute:["audit_agent_trajectory","review_mcp_tool_contracts"],verify:["review_work_evidence"],handoff:["create_context_handoff"]},
  AUTOMATE:{plan:["audit_requirements","review_mcp_tool_contracts"],execute:["audit_agent_trajectory"],verify:["build_test_matrix","review_work_evidence"],handoff:["create_context_handoff"]},
  PLAN:{plan:["audit_requirements"],execute:["build_test_matrix"],verify:["audit_requirements"],handoff:["create_context_handoff"]},
};

function headingSection(content: string, heading: string): string {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return "";
  let end = start + 1;
  while (end < lines.length && !/^##\s/.test(lines[end])) end++;
  return lines.slice(start, end).join("\n").trim();
}

function firstSubsection(section: string): string {
  const lines = section.split("\n");
  const next = lines.findIndex((line) => /^###\s/.test(line));
  if (next < 0) return section;
  const after = lines.findIndex((line, index) => index > next && /^###\s/.test(line));
  return lines.slice(0, after < 0 ? undefined : after).join("\n").trim();
}

export function getTailoredGuidance(taskType: TaskType, phase: Phase, start = 0, maxChars = RECOMMENDED_GUIDANCE_CHARS) {
  const protocol = headingSection(CONTENT.PROTOCOLS, `${taskType} Protocol`);
  const quality = headingSection(CONTENT.GATES, `${taskType} Quality Gate`);
  const universal = headingSection(CONTENT.GATES, "Universal Gate (EVERY task, no exceptions)");
  const defaultGate = quality || universal;
  let source = "references/01-PROTOCOLS.md";
  let text = protocol;
  if (phase === "plan") text = firstSubsection(protocol);
  if (phase === "verify") {
    text = [universal, defaultGate].filter((value, index, array) => value && array.indexOf(value) === index).join("\n\n");
    source = "references/02-GATES.md";
  }
  if (phase === "handoff") {
    text = defaultGate;
    source = "references/02-GATES.md";
  }
  const selected = text.slice(start, start + maxChars);
  return {
    task_type: taskType,
    phase,
    source,
    content: selected,
    start,
    next_start: start + selected.length < text.length ? start + selected.length : null,
    total_chars: text.length,
    truncated: start + selected.length < text.length,
    suggested_tools: start===0 ? [...TOOL_HINTS[taskType][phase]] : [],
    tool_selection_rule: start===0 ? "Only use a suggested tool when the caller supplies appropriate bounded evidence; tools are optional, not automatically invoked." : null,
    // These are navigation hints, not execution receipts or automatic calls.
    // Present the exact valid follow-up arguments where coding agents can see
    // them, rather than relying only on global instructions to remember verify.
    recommended_next_call: phase==="execute" ? {
      tool: "get_tailored_guidance",
      arguments: { task_type: taskType, phase: "verify", max_chars: RECOMMENDED_GUIDANCE_CHARS },
    } : null,
    next_step: phase==="execute"
      ? "After scoped edits and actual test commands, call get_tailored_guidance for the verify phase on this same server; independently check the returned gates before claiming completion."
      : phase==="verify"
        ? "Review actual verification command receipts and the changed-file scope; guidance is not a substitute for running tests."
        : "Use the phase guidance only within authorized task scope; retrieve execute and verify guidance separately for coding work.",
    guidance_is_verification: false,
    warning: "Guidance only: the MCP did not inspect a codebase, execute checks, or verify results. Load additional chunks when truncated.",
  };
}

export function registerTailoredGuidanceTool(server: McpServer): void {
  server.registerTool("get_tailored_guidance", {
    title: "Get phase-specific GodPrompt guidance",
    description: "Read-only phase-specific workflow instructions. Coding agents: call with phase='execute' and max_chars=1800 (valid integer 200..4000) before editing; AFTER editing and running real tests call again with the SAME task_type, phase='verify', max_chars=1800. The execute response contains recommended_next_call with exact valid verify arguments. Follow next_start if truncated. Guidance does not execute tests or independently verify work.",
    inputSchema: {
      task_type: z.enum(TYPES),
      phase: z.enum(PHASES).optional().default("execute"),
      start: z.number().int().min(0).max(60_000).optional().default(0),
      max_chars: z.number().int().min(200).max(MAX_GUIDANCE_CHARS).optional().default(RECOMMENDED_GUIDANCE_CHARS),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ task_type, phase, start, max_chars }) => {
    const result = getTailoredGuidance(task_type, phase, start, max_chars);
    return {
      structuredContent: result,
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  });
}
