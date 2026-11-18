#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  registerGodPromptTools,
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
} from "./server.js";
import { registerGodPromptSkillExtension } from "./skills.js";
import { registerWorkContractTools, WORK_CONTRACT_INSTRUCTIONS } from "./work-contract.js";
import {
  registerCodexifyCheckpointTool,
  CODEXIFY_CHECKPOINT_INSTRUCTIONS,
} from "./codexify-checkpoint.js";

function checkpointOptIn(): boolean {
  // Only the local Node stdio entrypoint reads this exact opt-in. The Worker
  // entrypoint never imports the checkpoint or the Codexify evidence adapter.
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return runtime.process?.env?.GODPROMPT_CODEXIFY_CHECKPOINT === "1";
}

function createServer(): McpServer {
  const enabled = checkpointOptIn();
  const instructions = `${SERVER_INSTRUCTIONS} ${WORK_CONTRACT_INSTRUCTIONS}` +
    (enabled ? ` ${CODEXIFY_CHECKPOINT_INSTRUCTIONS}` : "");
  const identity = enabled
    ? { ...SERVER_INFO, version: SERVER_INFO.version + "-checkpoint-preview.2" }
    : SERVER_INFO;
  const server = new McpServer(identity, { instructions });
  registerGodPromptTools(server);
  registerWorkContractTools(server);
  if (enabled) registerCodexifyCheckpointTool(server);
  registerGodPromptSkillExtension(server);
  return server;
}

await serveStdio(createServer);
