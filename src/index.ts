import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { registerGodPromptTools, SERVER_INFO } from "./server.js";

function createServer(): McpServer {
  const server = new McpServer(SERVER_INFO);
  registerGodPromptTools(server);
  return server;
}

const mcpHandler = createMcpHandler(createServer);

export default {
  fetch(request: Request) {
    if (new URL(request.url).pathname !== "/mcp") {
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
