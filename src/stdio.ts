#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { registerGodPromptTools, SERVER_INFO } from "./server.js";

function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerGodPromptTools(server);
  return server;
}

await serveStdio(createServer);
