#!/usr/bin/env node
/**
 * Read-only diagnostic of V12's preserved first-run README variants.
 * Does not rewrite original frozen grades or execute an example command.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gradePinnedUvxHelp } from "./v13-semantic-doc-grade.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "real-runs", "replication-v12");
const SOURCE = join(ROOT, "source", "trendpulse", "README.md");
const BEGIN = 'uv run --no-sync mcp-trendpulse-cli keyword "OpenAI" --headlines-only --format csv --output-file rss-headlines.csv';
const END = "**Source checkout (not yet in the published PyPI version):** Extracted-article CLI";
const sha = text => createHash("sha256").update(text).digest("hex");

function scopedText(readme) {
  const begin = readme.indexOf(BEGIN);
  const end = readme.indexOf(END, begin + BEGIN.length);
  if (begin < 0 || end < 0) throw new Error("Unexpected RSS document anchors");
  return readme.slice(begin + BEGIN.length, end);
}

function checkOne(arm) {
  const source = join(ROOT, "arms", "published-rss-docs-415-v12", arm, "README.md");
  if (!existsSync(source)) return { arm, status: "UNAVAILABLE" };
  const readme = readFileSync(source, "utf8");
  const result = gradePinnedUvxHelp(scopedText(readme));
  return {
    arm,
    command_semantics: result.status,
    accepted_commands: result.accepted,
    unknown_syntax_count: result.review_candidates.length,
    readme_sha256: sha(readme),
  };
}

if (!existsSync(SOURCE)) throw new Error("Original pinned source unavailable");
const report = {
  schema: "godprompt.v13.read-only-semantic-diagnostic.v1",
  scope: "Only pinned PyPI uvx help command examples; not a full issue acceptance or trial regrade",
  original_v12_grades_unchanged: true,
  original_study: "V12-real-issues-20261123",
  source_readme_sha256: sha(readFileSync(SOURCE)),
  variants: ["baseline", "full_mcp"].map(checkOne),
};
console.log(JSON.stringify(report, null, 2));
