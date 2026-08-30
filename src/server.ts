import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CONTENT, VERSION } from "./content.js";

export const SERVER_INFO = {
  name: "god-prompt-mcp",
  version: "1.0.1",
} as const;

// Version 1.0.0 was generated before the source layout moved from core/* to
// SKILL.md + references/*. Normalize only those legacy links at the serving
// boundary; regenerated content from the repaired generator makes this a no-op.
const CORE_SKILL = CONTENT.CORE_SKILL
  .replaceAll("core/01-PROTOCOLS.md", "references/01-PROTOCOLS.md")
  .replaceAll("core/02-GATES.md", "references/02-GATES.md")
  .replaceAll("core/03-ANTI-PATTERNS.md", "references/03-ANTI-PATTERNS.md");

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

const TASK_TYPES = {
  BUILD: {
    triggers: ["create", "implement", "add", "feature", "build", "make", "new"],
    protocol: "TDD Red-Green-Refactor",
    description: "Creating new functionality",
  },
  DEBUG: {
    triggers: ["fix", "bug", "error", "broken", "crash", "fail", "issue", "wrong"],
    protocol: "Root cause → 4-layer defense",
    description: "Finding and fixing defects",
  },
  REFACTOR: {
    triggers: ["improve", "optimize", "clean", "refactor", "reorganize", "simplify"],
    protocol: "Characterization tests first",
    description: "Improving code without changing behavior",
  },
  CONTENT: {
    triggers: ["write", "article", "documentation", "blog", "docs", "copy", "text"],
    protocol: "Research → verify → SEO",
    description: "Writing or editing content",
  },
  DESIGN: {
    triggers: ["ui", "ux", "layout", "mockup", "design", "style", "theme", "visual"],
    protocol: "Bold aesthetics, no AI slop",
    description: "UI/UX and visual design",
  },
  SHIP: {
    triggers: ["deploy", "release", "push", "pr", "merge", "ship", "publish", "launch"],
    protocol: "Safety-first checklist",
    description: "Deploying to production",
  },
  ANALYZE: {
    triggers: ["audit", "review", "check", "analyze", "inspect", "assess", "evaluate"],
    protocol: "Evidence-based investigation",
    description: "Auditing and reviewing existing systems",
  },
  AUTOMATE: {
    triggers: ["pipeline", "bot", "script", "automate", "cron", "workflow", "ci"],
    protocol: "Architecture → resilience → docs",
    description: "Building automation and pipelines",
  },
  PLAN: {
    triggers: ["brainstorm", "think", "plan", "strategy", "architect", "design system"],
    protocol: "Explore → document → handoff",
    description: "Planning and brainstorming",
  },
} as const;

type TaskType = keyof typeof TASK_TYPES;

function classifyTask(description: string): {
  type: TaskType;
  confidence: number;
  protocol: string;
  taskDescription: string;
} {
  const lower = description.toLowerCase();
  const scores: Partial<Record<TaskType, number>> = {};

  for (const [type, info] of Object.entries(TASK_TYPES)) {
    const matches = info.triggers.filter((t) => lower.includes(t));
    if (matches.length > 0) {
      scores[type as TaskType] = matches.length;
    }
  }

  const entries = Object.entries(scores) as [TaskType, number][];
  if (entries.length === 0) {
    return {
      type: "BUILD",
      confidence: 0.3,
      protocol: TASK_TYPES.BUILD.protocol,
      taskDescription: TASK_TYPES.BUILD.description,
    };
  }

  entries.sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = entries[0];
  const totalTriggers = TASK_TYPES[bestType].triggers.length;

  return {
    type: bestType,
    confidence: Math.min(bestScore / Math.max(totalTriggers * 0.4, 1), 1),
    protocol: TASK_TYPES[bestType].protocol,
    taskDescription: TASK_TYPES[bestType].description,
  };
}

export function registerGodPromptTools(server: McpServer): void {
  server.registerTool(
    "get_god_prompt",
    {
      title: "Get full GodPrompt",
      description: `Returns the complete GodPrompt.md — a single-file universal system prompt for AI software development (${Math.round(CONTENT.GOD_PROMPT.length / 1024)}KB, ~1145 lines). Use this when you want the full payload in one shot. For progressive disclosure (smaller context), use get_core_skill and the reference tools instead.`,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: CONTENT.GOD_PROMPT,
        },
      ],
    })
  );

  server.registerTool(
    "get_core_skill",
    {
      title: "Get core GodPrompt skill",
      description: `Returns SKILL.md — the core protocol that should be loaded on every message. This is the lean base context (~${Math.round(CORE_SKILL.length / 1024)}KB) covering the universal 6-phase protocol, Three Iron Laws, and task auto-classification. Start here for progressive disclosure.`,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: CORE_SKILL,
        },
      ],
    })
  );

  server.registerTool(
    "get_protocols",
    {
      title: "Get GodPrompt protocols",
      description: `Returns references/01-PROTOCOLS.md — deep execution guides for each task type (BUILD, DEBUG, REFACTOR, CONTENT, DESIGN, SHIP, ANALYZE, AUTOMATE, PLAN). Load this when the task requires detailed protocol steps beyond the core skill. ~${Math.round(CONTENT.PROTOCOLS.length / 1024)}KB.`,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: CONTENT.PROTOCOLS,
        },
      ],
    })
  );

  server.registerTool(
    "get_gates",
    {
      title: "Get GodPrompt verification gates",
      description: `Returns references/02-GATES.md — verification checklists, THE GATE (pre-completion verification), and structured report templates for every deliverable type. Load when you need to verify work before claiming completion. ~${Math.round(CONTENT.GATES.length / 1024)}KB.`,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: CONTENT.GATES,
        },
      ],
    })
  );

  server.registerTool(
    "get_anti_patterns",
    {
      title: "Get GodPrompt anti-patterns",
      description: `Returns references/03-ANTI-PATTERNS.md — red flags, rationalizations, and recovery patterns. Covers the 10 most dangerous anti-patterns that lead to broken code, scope creep, and false confidence. Load when you catch yourself rationalizing. ~${Math.round(CONTENT.ANTI_PATTERNS.length / 1024)}KB.`,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: CONTENT.ANTI_PATTERNS,
        },
      ],
    })
  );

  server.registerTool(
    "classify_task",
    {
      title: "Classify software-development task",
      description: "Classify a task description into one of GodPrompt's 9 task types (BUILD, DEBUG, REFACTOR, CONTENT, DESIGN, SHIP, ANALYZE, AUTOMATE, PLAN) and return the matching protocol name. Useful for routing tasks through the right workflow.",
      inputSchema: {
      description: z
        .string()
        .min(3, "Task description must be at least 3 characters")
        .max(1000, "Task description must be under 1000 characters")
        .describe(
          "The task description to classify, e.g. 'fix the login bug' or 'build a REST API for user auth'"
        ),
    },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ description }) => {
      const result = classifyTask(description);
      const output = {
        task_type: result.type,
        confidence: Math.round(result.confidence * 100) + "%",
        protocol: result.protocol,
        description: result.taskDescription,
        recommendation:
          result.confidence < 0.5
            ? "Low confidence — consider providing more context or specifying the task type directly."
            : `Classified as ${result.type}. Use get_protocols to load the detailed execution guide.`,
      };
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_version",
    {
      title: "Get GodPrompt version",
      description: "Returns the current GodPrompt version and a summary of what's included.",
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              version: VERSION,
              name: "GodPrompt",
              description:
                "Provides GodPrompt's task-routing, test-driven execution guidance, and verification gates.",
              repo: "https://github.com/AKzar1el/god-prompt",
              files: {
                "GodPrompt.md": `${Math.round(CONTENT.GOD_PROMPT.length / 1024)}KB — full single-file payload`,
                "SKILL.md": `${Math.round(CORE_SKILL.length / 1024)}KB — core protocol (always-on)`,
                "references/01-PROTOCOLS.md": `${Math.round(CONTENT.PROTOCOLS.length / 1024)}KB — deep execution guides`,
                "references/02-GATES.md": `${Math.round(CONTENT.GATES.length / 1024)}KB — verification checklists`,
                "references/03-ANTI-PATTERNS.md": `${Math.round(CONTENT.ANTI_PATTERNS.length / 1024)}KB — red flags & recovery`,
              },
              task_types: Object.entries(TASK_TYPES).map(([type, info]) => ({
                type,
                protocol: info.protocol,
                description: info.description,
              })),
            },
            null,
            2
          ),
        },
      ],
    })
  );
}
