#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGodPromptTools, SERVER_INFO } from "./server.js";

const server = new McpServer(SERVER_INFO);
registerGodPromptTools(server);

await server.connect(new StdioServerTransport());
