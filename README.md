# GodPrompt MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [GodPrompt](https://github.com/AKzar1el/god-prompt) — AI software-development workflow guidance with task routing, TDD, debugging protocols, verification gates, and progressive disclosure.

## Tools

| Tool | Description |
|------|-------------|
| `get_god_prompt` | Full GodPrompt.md single-file payload (~40KB) |
| `get_core_skill` | `SKILL.md` — always-on protocol (~10KB) |
| `get_protocols` | `references/01-PROTOCOLS.md` — deep execution guides (~13KB) |
| `get_gates` | `references/02-GATES.md` — verification checklists (~9KB) |
| `get_anti_patterns` | `references/03-ANTI-PATTERNS.md` — red flags & recovery (~9KB) |
| `classify_task` | Classify a task into one of 9 GodPrompt task types |
| `get_version` | Version info and server metadata |

## Progressive Disclosure

For minimum context usage, start with `get_core_skill`, then load `get_protocols`, `get_gates`, or `get_anti_patterns` only when the task requires deeper guidance. Use `get_god_prompt` when you want everything in one shot.

## Example queries

- "Classify this refactor and tell me which GodPrompt workflow applies."
- "Show me the verification gates I should satisfy before I claim this bug fix is complete."
- "Load the debugging protocol for a failing integration test without loading the full GodPrompt."

## Evaluation

GodPrompt's benchmark methodology, deterministic task corpus, evaluator logic, and published run artifacts live in the source project: [GodPrompt Bench](https://github.com/AKzar1el/god-prompt/tree/main/bench).

The MCP server does not run the benchmark or claim model-level superiority itself; it distributes the GodPrompt content evaluated by that suite.

## Connect

### Glama

GodPrompt MCP is published on [Glama](https://glama.ai/mcp/servers/AKzar1el/god-prompt-mcp). Use the server page to inspect the tools and connect it to a supported MCP client.

### Kiro

[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=god-prompt-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22github%3AAKzar1el%2Fgod-prompt-mcp%22%5D%2C%22disabled%22%3Afalse%2C%22autoApprove%22%3A%5B%5D%7D)

Kiro installs and builds the stdio server directly from this GitHub repository. The package remains unpublished on npm; Node.js 20+ and Git are required.

### Claude Desktop extension

GitHub releases include a `.mcpb` bundle for one-click local installation in MCPB-compatible clients such as Claude Desktop. The bundle runs the same local stdio server and does not require an API key or account.

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

## Privacy and data handling

GodPrompt MCP is a local stdio server. Its content tools return static GodPrompt material bundled with the installed extension. `classify_task` evaluates the supplied task description in the local Node.js process and does not send it to an external API.

The server itself has no telemetry, analytics, external service integration, or server-side persistence. It does not retain tool inputs after the local process handles a request. The MCP host or AI client can process conversation and tool data under its own policies independently of this server.

General privacy information: [tomiseregi.si/privacy](https://tomiseregi.si/privacy). For support or bug reports, use [GitHub Issues](https://github.com/AKzar1el/god-prompt-mcp/issues).

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

The generator reads the current source layout: `GodPrompt.md`, `SKILL.md`, and the three files under `references/`.

## License

[MIT](LICENSE)

## Project & related MCP servers

Project page: [GodPrompt — AI software-development system prompt](https://tomiseregi.si/projects/god-prompt) · [GodPrompt source](https://github.com/AKzar1el/god-prompt)

Related MCP servers: [Google Search Console](https://github.com/AKzar1el/mcp-gsc) · [GEO Tracker](https://github.com/AKzar1el/mcp-geo) · [Web Validator](https://github.com/AKzar1el/mcp-web-validator) · [Google News & Trends](https://github.com/AKzar1el/mcp-trendpulse)
