#!/usr/bin/env node
/**
 * Compatibility entrypoint for the original offline checkpoint pilot.
 * Both the CLI and MCP now delegate to the one compiled GodPrompt engine.
 */
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readSmallJson } from "../../bin/godprompt-proof.mjs";

export {
  evaluateCheckpoint,
  cloudSafeCheckpointSummary,
} from "../../dist/codexify-checkpoint.js";
import { evaluateCheckpoint } from "../../dist/codexify-checkpoint.js";

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== "--input") {
    throw new Error("Usage: node experiments/codexify-checkpoints/checkpoint.mjs --input checkpoint-input.json");
  }
  const preview = await evaluateCheckpoint(await readSmallJson(argv[1]));
  process.stdout.write(JSON.stringify(preview, null, 2) + "\n");
  // HOLD and RECHECK are valid evaluations. Their exit status is deliberately 0.
}

async function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    const [entry, file] = await Promise.all([
      realpath(resolve(process.argv[1])), realpath(fileURLToPath(import.meta.url)),
    ]);
    return process.platform === "win32"
      ? entry.toLowerCase() === file.toLowerCase() : entry === file;
  } catch {
    return false;
  }
}
if (await invokedDirectly()) {
  main().catch(() => {
    // No contract fields, file paths, private outputs or user messages in errors.
    process.stderr.write("GodPrompt checkpoint preview: invalid or unavailable input.\n");
    process.exitCode = 1;
  });
}
