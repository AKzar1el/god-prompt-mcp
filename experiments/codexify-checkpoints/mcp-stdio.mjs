#!/usr/bin/env node
/**
 * Compatibility MCP identity for existing pilot sessions. The evaluator,
 * request validation, result shape and privacy checks are shared with the
 * opt-in main GodPrompt MCP and are no longer duplicated here.
 */
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  registerCodexifyCheckpointTool,
  CODEXIFY_CHECKPOINT_INSTRUCTIONS,
} from "../../dist/codexify-checkpoint.js";

export function createCheckpointPilotServer() {
  const server = new McpServer({
    name: "godprompt-checkpoint-pilot", version: "0.0.0-test",
  }, {
    instructions: CODEXIFY_CHECKPOINT_INSTRUCTIONS +
      " Pilot compatibility identity; no automatic hooks, storage, or network.",
  });
  registerCodexifyCheckpointTool(server);
  return server;
}

await serveStdio(createCheckpointPilotServer);
