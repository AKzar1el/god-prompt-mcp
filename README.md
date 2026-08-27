# GodPrompt MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [GodPrompt](https://github.com/AKzar1el/god-prompt) — production-grade AI software-development workflows with task routing, TDD, debugging protocols, verification gates, and progressive disclosure.

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

### Glama

GodPrompt MCP is published on [Glama](https://glama.ai/mcp/servers/AKzar1el/god-prompt-mcp). Use the server page to inspect the tools and connect it to a supported MCP client.

### Local stdio

```bash
npm install
npm run build
node dist/stdio.js
```

Example client configuration:

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "node",
      "args": ["/absolute/path/to/god-prompt-mcp/dist/stdio.js"]
    }
  }
}
```

## Development

```bash
npm install
npm run build
npm test
```

`npm test` builds the stdio server, performs the MCP initialization handshake, and verifies the expected tool list.

Repository discovery metadata is kept in `server.json` for MCP Registry-compatible consumers and `glama.json` for Glama.

## Updating Content

To update the embedded GodPrompt content:

1. Pull the latest content from the [GodPrompt repository](https://github.com/AKzar1el/god-prompt).
2. Run `npm run generate-content`.
3. Run `npm test` before publishing a new server release.

## License

[MIT](LICENSE)

## Project & related MCP servers

Project page: [GodPrompt — AI software-development system prompt](https://tomiseregi.si/projects/god-prompt) · [GodPrompt source](https://github.com/AKzar1el/god-prompt)

Related MCP servers: [Google Search Console](https://github.com/AKzar1el/mcp-gsc) · [GEO Tracker](https://github.com/AKzar1el/mcp-geo) · [Web Validator](https://github.com/AKzar1el/mcp-web-validator) · [Google News & Trends](https://github.com/AKzar1el/mcp-trendpulse)
