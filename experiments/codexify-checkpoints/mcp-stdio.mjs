#!/usr/bin/env node
/**
 * Opt-in, unpublished local MCP adapter for supervised Codexify checkpoint trials.
 * Separate from the production Worker and npm package; no storage or network.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { evaluateCheckpoint, cloudSafeCheckpointSummary } from "./checkpoint.mjs";

const PHASES = ["plan", "implementation", "verification", "handoff"];
const pilotInput = z.object({
  stage: z.enum(PHASES),
  contract: z.record(z.string(), z.unknown()),
  codexify_export: z.object({
    changed_files: z.array(z.string().max(240)).max(150),
    operations_performed: z.array(z.string().max(500)).max(100).optional(),
    checks: z.array(z.unknown()).max(100),
  }).strict(),
  acceptance: z.array(z.unknown()).max(100).optional(),
  observations: z.array(z.unknown()).max(100).optional(),
  human_review_reported: z.boolean().optional(),
}).strict();

const safeAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export function createCheckpointPilotServer() {
  const server = new McpServer({
    name: "godprompt-checkpoint-pilot", version: "0.0.0-test",
  }, {
    instructions: "Pilot only. Agents must call review_codexify_checkpoint deliberately at plan, implementation, verification, and handoff. It returns advisory RECHECK/HOLD, never independently verifies tests or authorizes work. No automatic hooks, storage, provider access, or public deployment.",
  });
  server.registerTool("review_codexify_checkpoint", {
    description: "Read-only, phase-aware GodPrompt checklist evaluation of caller-supplied Codexify receipts. Call mid-run; RECHECK/HOLD requires agent reconciliation. Not proof or permission.",
    inputSchema: pilotInput,
    annotations: safeAnnotations,
  }, async (args) => {
    // The MCP wire may carry copied tool results: do not allow unbounded logs.
    if (Buffer.byteLength(JSON.stringify(args), "utf8") > 256 * 1024) {
      return { isError: true, content: [{ type: "text", text: "Checkpoint input exceeds 256 KiB. Supply redacted, bounded receipts." }] };
    }
    try {
      const result = await evaluateCheckpoint(args);
      const storagePreview = cloudSafeCheckpointSummary(result);
      return {
        structuredContent: { ...result, cloud_storage_preview: storagePreview },
        content: [{ type: "text", text: JSON.stringify({ ...result, cloud_storage_preview: storagePreview }) }],
      };
    } catch (error) {
      // Never echo the submitted payload, command output, paths, or arbitrary parser messages.
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid checkpoint input; inspect the contract schema and redacted export locally." }],
      };
    }
  });
  return server;
}

await serveStdio(createCheckpointPilotServer);
