#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import {
  registerGodPromptTools,
  SERVER_INFO,
  SERVER_INSTRUCTIONS,
} from "./server.js";

function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO, { instructions: SERVER_INSTRUCTIONS });
  registerGodPromptTools(server);
  return server;
}

await serveStdio(createServer);
