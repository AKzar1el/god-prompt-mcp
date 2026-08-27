import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGodPromptTools, SERVER_INFO } from "./server.js";

type Env = {
  GOD_PROMPT_MCP: DurableObjectNamespace;
};

export class GodPromptMCP extends McpAgent<Env, Record<string, never>> {
  server = new McpServer(SERVER_INFO);

  async init() {
    registerGodPromptTools(this.server);
  }
}

export default GodPromptMCP.serve("/mcp");
