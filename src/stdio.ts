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

function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: `${SERVER_INSTRUCTIONS} ${WORK_CONTRACT_INSTRUCTIONS}` });
  registerGodPromptTools(server);
  registerWorkContractTools(server);
  registerGodPromptSkillExtension(server);
  return server;
}

await serveStdio(createServer);
