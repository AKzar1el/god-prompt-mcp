import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { createArdManifestResponse } from "./discovery.js";
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

const mcpHandler = createMcpHandler(createServer);

export default {
  fetch(request: Request) {
    const pathname = new URL(request.url).pathname;

    if (
      request.method === "GET" &&
      (pathname === "/.well-known/ard.json" || pathname === "/.well-known/ai-catalog.json")
    ) {
      return createArdManifestResponse();
    }

    if (pathname !== "/mcp") {
      return new Response("Not Found", { status: 404 });
    }
    return mcpHandler.fetch(request);
  },
};

// Preserve the historical Durable Object class/namespace until an authenticated
// deployment audit can prove deleting it is safe. The public MCP route is now
// stateless and does not use this compatibility class.
export class GodPromptMCP {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Record<string, never>
  ) {}

  async fetch(): Promise<Response> {
    void this.state;
    void this.env;
    return new Response("GodPrompt MCP now runs statelessly at /mcp.", { status: 410 });
  }
}
