import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CONTENT, VERSION } from "./content.js";
import { CORE_SKILL } from "./skill-content.js";

export const SERVER_INFO = {
  name: "god-prompt-mcp",
  version: "1.0.26",
} as const;

export const SERVER_INSTRUCTIONS =
  "Start with get_core_skill for the lean GodPrompt protocol. Use classify_task to route a concrete task, then load get_protocols, get_gates, or get_anti_patterns only when that focused reference is needed. Use get_god_prompt only when the full single-file payload is preferable. All GodPrompt tools are read-only.";

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

type RouteType = TaskType | "UNCLASSIFIED";

const ACTION_SIGNALS = new Set([
  "add",
  "analyze",
  "architect",
  "assess",
  "automate",
  "brainstorm",
  "build",
  "check",
  "clean",
  "create",
  "deploy",
  "design",
  "evaluate",
  "fix",
  "implement",
  "improve",
  "inspect",
  "launch",
  "make",
  "merge",
  "new",
  "optimize",
  "plan",
  "publish",
  "push",
  "refactor",
  "release",
  "reorganize",
  "review",
  "ship",
  "simplify",
  "think",
  "write",
]);

type MatchedSignal = {
  signal: string;
  strength: number;
  index: number;
};

type Candidate = {
  type: TaskType;
  matches: MatchedSignal[];
  strongestSignal: number;
  evidenceScore: number;
  firstMatchIndex: number;
};

function hasTrigger(text: string, trigger: string): boolean {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(text);
}

function triggerIndex(text: string, trigger: string): number {
  const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).exec(text);
  return match ? match.index + match[1].length : -1;
}

function signalStrength(trigger: string): number {
  if (trigger.includes(" ")) return 3;
  if (ACTION_SIGNALS.has(trigger)) return 1;
  return 2;
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    b.strongestSignal - a.strongestSignal ||
    b.evidenceScore - a.evidenceScore ||
    b.matches.length - a.matches.length ||
    a.firstMatchIndex - b.firstMatchIndex ||
    a.type.localeCompare(b.type)
  );
}

function hasSameRoutingRank(a: Candidate, b: Candidate): boolean {
  return (
    a.strongestSignal === b.strongestSignal &&
    a.evidenceScore === b.evidenceScore &&
    a.matches.length === b.matches.length
  );
}

function routingConfidence(best: Candidate, runnerUp?: Candidate): number {
  const baseByStrength: Record<number, number> = {
    1: 0.78,
    2: 0.86,
    3: 0.93,
  };
  let confidence =
    baseByStrength[best.strongestSignal] + Math.min((best.matches.length - 1) * 0.02, 0.04);

  if (!runnerUp) return Math.min(confidence, 0.97);
  if (hasSameRoutingRank(best, runnerUp)) return 0.42;

  if (best.strongestSignal === runnerUp.strongestSignal) {
    const competition = runnerUp.evidenceScore / best.evidenceScore;
    confidence -= 0.24 * competition;
  } else {
    confidence -= best.strongestSignal - runnerUp.strongestSignal === 1 ? 0.08 : 0.04;
  }

  return Math.max(0.5, Math.min(confidence, 0.97));
}

function classifyTask(description: string): {
  type: RouteType;
  confidence: number;
  protocol: string | null;
  taskDescription: string;
  matchedSignals: string[];
  alternativeTaskTypes: TaskType[];
  ambiguous: boolean;
} {
  const normalized = description.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
  const candidates: Candidate[] = [];

  for (const [type, info] of Object.entries(TASK_TYPES)) {
    const matches = info.triggers
      .filter((trigger) => hasTrigger(normalized, trigger))
      .map((trigger) => ({
        signal: trigger,
        strength: signalStrength(trigger),
        index: triggerIndex(normalized, trigger),
      }));
    if (matches.length === 0) continue;

    candidates.push({
      type: type as TaskType,
      matches,
      strongestSignal: Math.max(...matches.map((match) => match.strength)),
      evidenceScore: matches.reduce((sum, match) => sum + match.strength, 0),
      firstMatchIndex: Math.min(...matches.map((match) => match.index)),
    });
  }

  if (candidates.length === 0) {
    return {
      type: "UNCLASSIFIED",
      confidence: 0,
      protocol: null,
      taskDescription: "No reliable task route identified",
      matchedSignals: [],
      alternativeTaskTypes: [],
      ambiguous: false,
    };
  }

  candidates.sort(compareCandidates);
  const best = candidates[0];
  const runnerUp = candidates[1];
  const ambiguous = Boolean(runnerUp && hasSameRoutingRank(best, runnerUp));

  return {
    type: best.type,
    confidence: routingConfidence(best, runnerUp),
    protocol: TASK_TYPES[best.type].protocol,
    taskDescription: TASK_TYPES[best.type].description,
    matchedSignals: best.matches.map((match) => match.signal),
    alternativeTaskTypes: candidates.slice(1).map((candidate) => candidate.type),
    ambiguous,
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
      description: `Returns SKILL.md — the lean core protocol (~${Math.round(CORE_SKILL.length / 1024)}KB) covering the universal 6-phase protocol, Three Iron Laws, and task auto-classification. Load it at the start of a task or after a context reset, then reuse that context instead of reloading it on every message. Start here for progressive disclosure.`,
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
      description: "Classify one concrete software-development task into one of GodPrompt's 9 task types (BUILD, DEBUG, REFACTOR, CONTENT, DESIGN, SHIP, ANALYZE, AUTOMATE, PLAN), or UNCLASSIFIED when no reliable route is detected. Returns JSON with task_type, deterministic confidence, protocol, matched_signals, alternative_task_types, ambiguous, and recommendation; use it for routing before loading detailed workflow text.",
      inputSchema: {
      description: z
        .string()
        .max(1000, "Task description must be at most 1000 characters")
        .trim()
        .min(3, "Task description must contain at least 3 characters of meaningful text")
        .regex(/[\p{L}\p{N}]/u, "Task description must include a letter or number")
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
        matched_signals: result.matchedSignals,
        alternative_task_types: result.alternativeTaskTypes,
        ambiguous: result.ambiguous,
        recommendation:
          result.type === "UNCLASSIFIED"
            ? "No reliable route detected — provide an English task description with a clearer software-development action or specify the task type directly."
            : result.ambiguous
              ? "Ambiguous mixed intent — consider splitting the task or specifying the primary task type directly."
              : result.confidence < 0.5
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
      title: "Get GodPrompt versions",
      description: "Returns JSON with the GodPrompt content version, MCP server version, repository, bundled file sizes and purposes, and task-type/protocol catalog. Use it to verify which GodPrompt content/server version a client is connected to; use the content retrieval tools when you need the actual workflow text.",
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              version: VERSION,
              server_version: SERVER_INFO.version,
              name: "GodPrompt",
              description:
                "Provides GodPrompt's task-routing, test-driven execution guidance, and verification gates.",
              repo: "https://github.com/AKzar1el/god-prompt",
              files: {
                "GodPrompt.md": `${Math.round(CONTENT.GOD_PROMPT.length / 1024)}KB — full single-file payload`,
                "SKILL.md": `${Math.round(CORE_SKILL.length / 1024)}KB — core protocol (load when relevant)`,
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
