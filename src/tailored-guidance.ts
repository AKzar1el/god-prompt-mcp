import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CONTENT } from "./content.js";

const TYPES = ["BUILD", "DEBUG", "REFACTOR", "CONTENT", "DESIGN", "SHIP", "ANALYZE", "AUTOMATE", "PLAN"] as const;
const PHASES = ["plan", "execute", "verify", "handoff"] as const;

type TaskType = (typeof TYPES)[number];
type Phase = (typeof PHASES)[number];

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

export function getTailoredGuidance(taskType: TaskType, phase: Phase, start = 0, maxChars = 1800) {
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
    warning: "Guidance only: the MCP did not inspect a codebase, execute checks, or verify results. Load additional chunks when truncated.",
  };
}

export function registerTailoredGuidanceTool(server: McpServer): void {
  server.registerTool("get_tailored_guidance", {
    title: "Get phase-specific GodPrompt guidance",
    description: "Return only the relevant task-type protocol or quality gate for one phase, paged into small bounded chunks. More efficient than loading the entire reference; no tool execution or verification.",
    inputSchema: {
      task_type: z.enum(TYPES),
      phase: z.enum(PHASES).optional().default("execute"),
      start: z.number().int().min(0).max(60_000).optional().default(0),
      max_chars: z.number().int().min(200).max(4_000).optional().default(1800),
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
