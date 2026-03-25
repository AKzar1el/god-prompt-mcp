# GodPrompt MCP Server

A remote [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that serves [GodPrompt](https://github.com/AKzar1el/god-prompt) — the universal system prompt for AI software development.

Deployed on **Cloudflare Workers** (free tier). No authentication required.

## Tools

| Tool | Description |
|------|-------------|
| `get_god_prompt` | Full GodPrompt.md single-file payload (~40KB) |
| `get_core_skill` | `core/00-THE-SKILL.md` — always-on protocol (~10KB) |
| `get_protocols` | `core/01-PROTOCOLS.md` — deep execution guides (~13KB) |
| `get_gates` | `core/02-GATES.md` — verification checklists (~9KB) |
| `get_anti_patterns` | `core/03-ANTI-PATTERNS.md` — red flags & recovery (~9KB) |
| `classify_task` | Classify a task into one of 9 GodPrompt task types |
| `get_version` | Version info and server metadata |

## Progressive Disclosure

For minimum context usage, start with `get_core_skill`, then load `get_protocols`, `get_gates`, or `get_anti_patterns` only when the task requires deeper guidance. Use `get_god_prompt` when you want everything in one shot.

## Connect

### Claude.ai / Claude Desktop

Add as a remote MCP server:
```
https://god-prompt-mcp.<your-account>.workers.dev/mcp
```

### Claude Desktop (via mcp-remote proxy)

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://god-prompt-mcp.<your-account>.workers.dev/mcp"
      ]
    }
  }
}
```

### Cursor / Other MCP Clients

Use the `/mcp` endpoint URL with your client's MCP configuration.

## Development

```bash
npm install
npm run dev        # Local development on port 8788
npm run deploy     # Deploy to Cloudflare Workers
```

## Updating Content

To update the GodPrompt content:

1. Pull latest from the [god-prompt repo](https://github.com/AKzar1el/god-prompt)
2. Run the content generator: `npm run generate-content`
3. Deploy: `npm run deploy`

## License

[MIT](https://github.com/AKzar1el/god-prompt/blob/main/LICENSE)
