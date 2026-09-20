#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { registerGodPromptTools, SERVER_INFO } from "./server.js";

const server = new McpServer(SERVER_INFO);
registerGodPromptTools(server);

await server.connect(new StdioServerTransport());
