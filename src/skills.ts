import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CONTENT } from "./content.js";
import { CORE_SKILL } from "./skill-content.js";

const EXTENSION_ID = "io.modelcontextprotocol/skills";
const SKILL_URI = "skill://god-prompt/SKILL.md";
const CACHE_TTL_MS = 300_000;

const SKILL_FILES = [
  { uri: SKILL_URI, text: CORE_SKILL },
  {
    uri: "skill://god-prompt/references/01-PROTOCOLS.md",
    text: CONTENT.PROTOCOLS,
  },
  {
    uri: "skill://god-prompt/references/02-GATES.md",
    text: CONTENT.GATES,
  },
  {
    uri: "skill://god-prompt/references/03-ANTI-PATTERNS.md",
    text: CONTENT.ANTI_PATTERNS,
  },
] as const;

type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
};

function parseFrontmatter(skill: string): SkillFrontmatter {
  const normalized = skill.replaceAll("\r\n", "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match) throw new Error("GodPrompt SKILL.md is missing YAML frontmatter");

  const lines = match[1].split("\n");
  const frontmatter: Partial<SkillFrontmatter> = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const scalar = /^(name|license):\s*(.+)$/.exec(line);
    if (scalar) {
      frontmatter[scalar[1] as "name" | "license"] = scalar[2].trim();
      continue;
    }

    if (line === "description: |") {
      const description: string[] = [];
      while (index + 1 < lines.length && lines[index + 1].startsWith("  ")) {
        index += 1;
        description.push(lines[index].slice(2));
      }
      frontmatter.description = `${description.join("\n")}\n`;
      continue;
    }

    throw new Error(`Unsupported GodPrompt SKILL.md frontmatter line: ${line}`);
  }

  if (!frontmatter.name || !frontmatter.description) {
    throw new Error("GodPrompt SKILL.md frontmatter must include name and description");
  }
  return frontmatter as SkillFrontmatter;
}

const SKILL_FRONTMATTER = parseFrontmatter(CORE_SKILL);

async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `sha256:${hex}`;
}

async function buildSkillEntry() {
  return {
    uri: SKILL_URI,
    frontmatter: SKILL_FRONTMATTER,
    resources: await Promise.all(
      SKILL_FILES.map(async ({ uri, text }) => ({
        uri,
        digest: await sha256(text),
        size: new TextEncoder().encode(text).byteLength,
      }))
    ),
  };
}

const listSkillsParams = z.object({
  cursor: z.string().optional(),
});

const getSkillParams = z.object({
  uri: z.string(),
});

export function registerGodPromptSkillExtension(server: McpServer): void {
  for (const { uri, text } of SKILL_FILES) {
    const isRootSkill = uri === SKILL_URI;
    server.registerResource(
      isRootSkill ? "god-prompt" : uri.slice("skill://god-prompt/".length),
      uri,
      {
        mimeType: "text/markdown",
        ...(isRootSkill
          ? {
              description: SKILL_FRONTMATTER.description.trim(),
            }
          : {}),
      },
      async (resourceUri) => ({
        contents: [
          {
            uri: resourceUri.href,
            mimeType: "text/markdown",
            text,
          },
        ],
      })
    );
  }

  server.server.registerCapabilities({
    extensions: {
      [EXTENSION_ID]: {},
    },
  });

  server.server.setRequestHandler(
    "skills/list",
    { params: listSkillsParams },
    async ({ cursor }) => {
      if (cursor !== undefined) {
        throw new Error("GodPrompt serves one skills/list page and does not issue cursors");
      }
      return {
        resultType: "complete",
        skills: [await buildSkillEntry()],
        ttlMs: CACHE_TTL_MS,
        cacheScope: "public",
      };
    }
  );

  server.server.setRequestHandler(
    "skills/get",
    { params: getSkillParams },
    async ({ uri }) => {
      if (uri !== SKILL_URI) {
        throw new ProtocolError(
          ProtocolErrorCode.InvalidParams,
          `Unknown GodPrompt skill URI: ${uri}`
        );
      }
      return {
        resultType: "complete",
        skill: await buildSkillEntry(),
        ttlMs: CACHE_TTL_MS,
        cacheScope: "public",
      };
    }
  );
}
