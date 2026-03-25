#!/usr/bin/env node

/**
 * Generates src/content.ts from the god-prompt repo files.
 *
 * Usage:
 *   node scripts/generate-content.mjs [path-to-god-prompt-repo]
 *
 * If no path is provided, defaults to ../god-prompt (sibling directory).
 */

import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const repoPath = resolve(process.argv[2] || join(import.meta.dirname, "../../god-prompt"));

const files = {
  GOD_PROMPT: "GodPrompt.md",
  CORE_SKILL: "core/00-THE-SKILL.md",
  PROTOCOLS: "core/01-PROTOCOLS.md",
  GATES: "core/02-GATES.md",
  ANTI_PATTERNS: "core/03-ANTI-PATTERNS.md",
};

console.log(`Reading from: ${repoPath}`);

let output = `// Auto-generated from https://github.com/AKzar1el/god-prompt\n`;
output += `// Do not edit manually — regenerate with: node scripts/generate-content.mjs\n\n`;
output += `export const CONTENT = {\n`;

for (const [key, filename] of Object.entries(files)) {
  const filepath = join(repoPath, filename);
  const content = readFileSync(filepath, "utf-8");
  const escaped = content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
  output += `  ${key}: \`${escaped}\`,\n\n`;
  console.log(`  ${key}: ${content.length} bytes from ${filename}`);
}

output += `} as const;\n\n`;

const version = readFileSync(join(repoPath, "VERSION"), "utf-8").trim();
output += `export const VERSION = "${version}";\n`;

const outPath = join(import.meta.dirname, "../src/content.ts");
writeFileSync(outPath, output);
console.log(`\nWrote ${outPath} (${output.length} bytes)`);
