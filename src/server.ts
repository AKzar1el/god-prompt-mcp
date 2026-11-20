import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CONTENT, VERSION } from "./content.js";
import { CORE_SKILL } from "./skill-content.js";

export const SERVER_INFO = {
  name: "god-prompt-mcp",
  version: "1.2.1",
} as const;

export const SERVER_INSTRUCTIONS =
  "For scoped engineering tasks, use classify_task to route the work and get_tailored_guidance to load only the needed phase. Use get_core_skill if the entire core protocol is needed, not on every request. Use review_code_change, audit_requirements and build_test_matrix for bounded caller-supplied evidence and draft test planning. Use diagnose_failure, assess_release_readiness, create_context_handoff and compare_evaluation_runs only for their respective supplied-evidence workflows. None of these tools run external checks, authenticate evidence, authorize release or independently verify work. Load get_protocols, get_gates, or get_anti_patterns only when focused guidance is insufficient. Use get_god_prompt only when the full single-file payload is preferable; request bounded start/maxChars chunks if an MCP bridge truncates large responses. All GodPrompt tools are read-only.";

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
    triggers: ["fix", "debug", "debugging", "troubleshoot", "diagnose", "bug", "error", "broken", "crash", "fail", "issue", "wrong"],
    protocol: "Root cause → 4-layer defense",
    description: "Finding and fixing defects",
  },
  REFACTOR: {
    triggers: ["improve", "optimize", "clean", "refactor", "reorganize", "simplify"],
    protocol: "Characterization tests first",
    description: "Improving code without changing behavior",
  },
  CONTENT: {
    triggers: ["write", "draft", "content", "article", "documentation", "blog", "docs", "copy", "text", "release notes"],
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
    triggers: [
      "audit", "review", "check", "analyze", "inspect", "assess",
      "evaluate", "verify", "validate", "test", "investigate", "compare",
      "examine", "determine", "identify", "trace", "look into",
      "find out", "find why", "find the root cause",
      "tell me why", "why did", "why are", "why is",
    ],
    protocol: "Evidence-based investigation",
    description: "Auditing and reviewing existing systems",
  },
  AUTOMATE: {
    triggers: ["pipeline", "bot", "script", "automate", "cron", "workflow", "ci"],
    protocol: "Architecture → resilience → docs",
    description: "Building automation and pipelines",
  },
  PLAN: {
    triggers: ["brainstorm", "think", "plan", "strategy", "roadmap", "proposal", "release plan", "rollout plan", "architect", "design system"],
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
  "compare",
  "clean",
  "create",
  "deploy",
  "diagnose",
  "determine",
  "design",
  "evaluate",
  "examine",
  "fix",
  "implement",
  "improve",
  "inspect",
  "investigate",
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
  "test",
  "trace",
  "think",
  "troubleshoot",
  "validate",
  "verify",
  "write",
]);

const RELEASE_ARTIFACT = /\brelease\s+(?:plan|notes|roadmap|strategy|checklist|schedule)\b/;
const PLAN_DELIVERABLE_SIGNALS = new Set(["plan", "strategy", "roadmap", "proposal"]);

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

const TRIGGER_REGEX_CACHE = new Map<string, { boundary: RegExp; all: RegExp }>();

function triggerRegex(trigger: string): { boundary: RegExp; all: RegExp } {
  let patterns = TRIGGER_REGEX_CACHE.get(trigger);
  if (!patterns) {
    const escaped = trigger.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    patterns = {
      boundary: new RegExp('(^|[^a-z0-9])' + escaped + '($|[^a-z0-9])'),
      all: new RegExp('(^|[^a-z0-9])(' + escaped + ')(?=$|[^a-z0-9])', 'g'),
    };
    TRIGGER_REGEX_CACHE.set(trigger, patterns);
  }
  return patterns;
}

function hasTrigger(text: string, trigger: string): boolean {
  return triggerRegex(trigger).boundary.test(text);
}

function triggerIndex(text: string, trigger: string): number {
  const match = triggerRegex(trigger).boundary.exec(text);
  return match ? match.index + match[1].length : -1;
}

function hasAffirmativeActionTrigger(text: string, trigger: string): boolean {
  // matchAll clones the global regex: no shared lastIndex across requests.
  const matches = text.matchAll(triggerRegex(trigger).all);
  for (const match of matches) {
    const prefix = text.slice(0, match.index + match[1].length).split(/[.!?;,]/).at(-1) ?? "";
    // A forbidden downstream action is not a requested deployment action.
    if (!/(?:\b(?:do not|don't|never|without|avoid|must not|should not|no)\s+(?:(?!(?:but|then|however)\b)[a-z0-9-]+\s+){0,3})$/.test(prefix)) {
      return true;
    }
  }
  return false;
}

function hasPrimaryPlanningIntent(text: string): boolean {
  // Prefer the requested deliverable over incidental nouns like "feature" and
  // "release". Mentioning how to build/deploy is not a request to do so.
  const primaryPlan = /^(?:(?:please|can you|could you|would you|can we|help me(?: to)?|let's)\s+)*(?:plan\b|brainstorm\b|think through\b|(?:prepare|write|draft|create|make|outline|propose|design)\s+(?:(?!(?:and|then|but)\b)[a-z0-9-]+\s+){0,7}(?:plan|strategy|roadmap|proposal)\b)/.test(text);
  const requestedArtifact = /^(?:(?:we|i)\s+(?:need|want)\s+(?:a|an|the)|give me\s+(?:a|an|the))\s+(?:(?!(?:and|then|but)\b)[a-z0-9-]+\s+){0,7}(?:plan|strategy|roadmap|proposal)\b/.test(text);
  const separateAction = /(?:\b(?:and|then)\s+(?:then\s+)?|[;,]\s*(?:(?:and|then)\s+)?)(?:build|implement|add|deploy|publish|push|merge|ship|launch|create|make|release)\b/.test(text);
  return (primaryPlan || requestedArtifact) && !separateAction;
}

function requestedShippingVerb(text: string): string | null {
  // Only an actual shipping instruction can outrank a product noun such as
  // "feature"; references to release plans or notes are not release commands.
  const direct = /^(?:(?:please|can you|could you|would you|help me(?: to)?|let's)\s+)*(deploy|release|publish|push|merge|ship|launch)\b/.exec(text);
  const followup = /(?:\b(?:and|then)\s+(?:then\s+)?|[;,]\s*(?:(?:and|then)\s+)?)(deploy|release|publish|push|merge|ship|launch)\b/.exec(text);
  if (direct?.[1] === "release" &&
    /^\s+(?:plan|notes|roadmap|strategy|checklist|schedule)\b/.test(text.slice(direct[0].length))) {
    return null;
  }
  return direct?.[1] ?? followup?.[1] ?? null;
}

function requestedFollowupBuildVerb(text: string): string | null {
  // A requested second action outranks a preceding investigation; a mere
  // mention of a build pipeline or a feature does not.
  const match = /(?:\b(?:and|then)\s+(?:then\s+)?|[;,]\s*(?:(?:and|then)\s+)?)(build|implement|add|create|make)\b/.exec(text);
  if (!match) return null;
  // Adding regression tests or diagnostics is part of fixing a bug, not an
  // independent feature-build request. A distinct new feature still wins.
  const debugging = /^(?:(?:please|can you|could you|would you)\s+)*(?:fix|debug|diagnose|troubleshoot)\b/.test(text);
  const supportingWork = /^\s+(?:(?:a|an|new|more|extra|some|unit|integration|regression|e2e|error|robust)\s+){0,4}(?:tests?|checks?|coverage|logs?|logging|docs|documentation|error handling)\b/
    .test(text.slice(match.index + match[0].length));
  return debugging && supportingWork ? null : match[1];
}

function requestedPrimaryBuildVerb(text: string): string | null {
  // Implementing a tool often requires tests and audits of that tool;
  // incidental QA keywords do not turn the build request into ANALYZE.
  const direct = /^(?:(?:please|can you|could you|would you|help me(?: to)?|let's)\s+)*(build|implement)\b/.exec(text);
  if (!direct || /\b(?:and|then)\s+(?:fix|debug|diagnose|troubleshoot)\b/.test(text)) {
    return null;
  }
  // Preserve specialized automation routing for CI/workflow/pipeline builds.
  return TASK_TYPES.AUTOMATE.triggers.some((signal) => hasTrigger(text, signal))
    ? null : direct[1];
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
  const normalized = description.normalize("NFKC")
    .replace(/[\u2018\u2019\u02bc]/gu, "'")
    .trim().replace(/\s+/gu, " ").toLowerCase();
  const candidates: Candidate[] = [];

  const debugActions = ["fix", "debug", "debugging", "troubleshoot", "diagnose"];
  const explicitlyNegatedDebug = debugActions.some(
    (trigger) => hasTrigger(normalized, trigger) && !hasAffirmativeActionTrigger(normalized, trigger),
  );
  const affirmativeDebug = debugActions.some(
    (trigger) => hasAffirmativeActionTrigger(normalized, trigger),
  );
  const inspectionRequested = TASK_TYPES.ANALYZE.triggers
    .some((trigger) => hasTrigger(normalized, trigger));
  const affirmativeBuild = ["create", "implement", "add", "build", "make"]
    .some((trigger) => hasAffirmativeActionTrigger(normalized, trigger));
  const primaryPlanningIntent = hasPrimaryPlanningIntent(normalized);
  const shippingVerb = requestedShippingVerb(normalized);
  const followupBuildVerb = requestedFollowupBuildVerb(normalized);
  const primaryBuildVerb = shippingVerb === null
    ? requestedPrimaryBuildVerb(normalized) : null;
  const nominalRelease = RELEASE_ARTIFACT.test(normalized);
  const writingRequested = /^(?:(?:please|can you|could you|would you|help me(?: to)?)\s+)*(?:write|draft|prepare|edit|translate|create)\b/.test(normalized);

  for (const [type, info] of Object.entries(TASK_TYPES)) {
    // An inspection request is not authorization to build/debug just because it names a feature or bug.
    if (inspectionRequested && ((type === "BUILD" && !affirmativeBuild) ||
      (type === "DEBUG" && !affirmativeDebug))) continue;
    // A plan may be the *subject* of review or implementation rather than
    // the requested deliverable. Keep explicit multi-action requests visible.
    if (type === "PLAN" && !primaryPlanningIntent &&
      (inspectionRequested || affirmativeBuild || affirmativeDebug || shippingVerb !== null) &&
      !/\b(?:and|then)\s+(?:plan|outline|brainstorm)\b/.test(normalized)) continue;
    // Release notes are content only when drafting/editing them is the task.
    // An inspection or an actual publish command must not become copywriting.
    if (type === "CONTENT" && (shippingVerb !== null ||
      (inspectionRequested && !writingRequested))) continue;
    // CI, cron and workflow names are audit subjects, not requests to automate them.
    if (type === "AUTOMATE" && inspectionRequested && !affirmativeBuild &&
      !hasAffirmativeActionTrigger(normalized, "automate")) continue;
    // Mentions of bugs or errors must not override an explicit no-debug instruction.
    if (type === "DEBUG" && explicitlyNegatedDebug && !affirmativeDebug) continue;
    const matches = info.triggers
      .filter((trigger) =>
        !(type === "SHIP" &&
          ((trigger === "release" && nominalRelease && shippingVerb !== "release") ||
           (inspectionRequested && shippingVerb === null))) &&
        (type === "SHIP" || type === "BUILD"
          ? hasAffirmativeActionTrigger(normalized, trigger)
          : hasTrigger(normalized, trigger)))
      .map((trigger) => ({
        signal: trigger,
        strength: (type === "PLAN" && primaryPlanningIntent &&
          PLAN_DELIVERABLE_SIGNALS.has(trigger)) ||
          (type === "SHIP" && trigger === shippingVerb) ||
          (type === "BUILD" && (trigger === followupBuildVerb ||
            trigger === primaryBuildVerb))
          ? 3 : signalStrength(trigger),
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
      description: `Returns the complete GodPrompt.md — a single-file universal system prompt for AI software development (${Math.round(CONTENT.GOD_PROMPT.length / 1024)}KB, ~1145 lines). With no arguments, returns the original full text for backward compatibility. Bridges may truncate the middle of such a large response: pass start (initially 0) and maxChars (at most 8192) to retrieve bounded, lossless chunks; structuredContent.nextStart gives the next offset, or null at EOF. For progressive disclosure, use get_core_skill and references instead.`,
      inputSchema: {
        start: z.number().int().min(0).max(CONTENT.GOD_PROMPT.length).optional(),
        maxChars: z.number().int().min(1).max(8_192).optional(),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ start, maxChars }) => {
      if (start === undefined && maxChars === undefined) {
        return { content: [{ type: "text" as const, text: CONTENT.GOD_PROMPT }] };
      }
      const first = start ?? 0;
      const end = Math.min(first + (maxChars ?? 8_192), CONTENT.GOD_PROMPT.length);
      return {
        content: [{ type: "text" as const, text: CONTENT.GOD_PROMPT.slice(first, end) }],
        structuredContent: {
          start: first,
          end,
          totalChars: CONTENT.GOD_PROMPT.length,
          nextStart: end < CONTENT.GOD_PROMPT.length ? end : null,
        },
      };
    }
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
