import { SERVER_INFO } from "./server.js";

export const PUBLIC_ORIGIN = "https://god-prompt-mcp.tomi-seregi99.workers.dev";

const TRUST_MANIFEST = {
  identity: PUBLIC_ORIGIN,
  identityType: "https",
} as const;

export function buildArdManifest() {
  return {
    entries: [
      {
        identifier: "urn:air:god-prompt-mcp.tomi-seregi99.workers.dev:mcp:god-prompt",
        displayName: "GodPrompt MCP Server",
        type: "application/mcp-server-card+json",
        url: `${PUBLIC_ORIGIN}/mcp`,
        description:
          "Read-only MCP guidance for classifying software-engineering tasks and loading GodPrompt protocols, verification gates, and anti-pattern references on demand.",
        tags: ["software-engineering", "coding-agents", "mcp", "verification", "workflow"],
        capabilities: [
          "get_god_prompt",
          "get_core_skill",
          "get_protocols",
          "get_gates",
          "get_anti_patterns",
          "classify_task",
          "get_version",
        ],
        representativeQueries: [
          "classify this software task and choose the right implementation protocol",
          "show me the verification gates I should run before shipping this code change",
          "load the GodPrompt guidance for debugging a failing implementation",
          "review this coding task for scope, verification, and common execution mistakes",
        ],
        version: SERVER_INFO.version,
        trustManifest: TRUST_MANIFEST,
      },
      {
        identifier: "urn:air:god-prompt-mcp.tomi-seregi99.workers.dev:skill:god-prompt",
        displayName: "GodPrompt Agent Skill",
        type: "application/ai-skill",
        url: "https://raw.githubusercontent.com/AKzar1el/god-prompt-mcp/main/skills/god-prompt/SKILL.md",
        description:
          "Portable relevance-scoped Agent Skill for evidence-led software-engineering planning, implementation, debugging, verification, and release work.",
        tags: ["agent-skill", "software-engineering", "coding-agents", "tdd", "verification"],
        capabilities: [
          "task-classification",
          "implementation-planning",
          "debugging",
          "verification",
          "release-safety",
        ],
        representativeQueries: [
          "plan and implement this code change with explicit scope and verification",
          "debug this failure from root cause and verify the fix",
          "review this implementation before I merge or release it",
          "help me execute a software task with evidence instead of assumptions",
        ],
        version: SERVER_INFO.version,
        trustManifest: TRUST_MANIFEST,
      },
    ],
  } as const;
}

export function createArdManifestResponse(): Response {
  return new Response(JSON.stringify(buildArdManifest()), {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "application/json; charset=utf-8",
      Link: '</.well-known/ard.json>; rel="ard"; type="application/json"',
    },
  });
}
