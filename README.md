# GodPrompt MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [GodPrompt](https://github.com/AKzar1el/god-prompt) — AI software-development workflow guidance with task routing, TDD, debugging protocols, verification gates, and progressive disclosure.

## Agent Harness Review — US$49

For the seven-day `GP-RS1` experiment, GodPrompt offers one bounded paid service for developers and small teams whose coding agents lose context, overstep scope, skip verification, or repeat mistakes.

**GodPrompt Agent Harness Review — US$49 one-time.** For one repository, send up to three agent-control artifacts (`AGENTS.md`, `CLAUDE.md`, project rules, or equivalent) plus one short failure example. The review returns five priority risks, one proposed revised instruction block or patch, and a next-task verification checklist, with a target of 24 hours after payment and usable inputs.

GitHub Sponsors is the frozen payment rail. If checkout is live, [sponsor US$49](https://github.com/sponsors/AKzar1el?metadata_campaign=godprompt_rs1&metadata_offer=agent_harness_review&metadata_source=god_prompt_mcp_readme), then email `info@tomiseregi.si` with subject `[GP-RS1] Agent Harness Review`. If GitHub still shows checkout as unavailable or pending, email only `[GP-RS1] Agent Harness Review Interest`; do not send repository artifacts yet. I will confirm when the same checkout is publicly payable. Delivery begins only after an independently verified US$49 sponsorship. The free MIT GodPrompt MCP remains unchanged and free. [Full frozen experiment terms](https://github.com/AKzar1el/god-prompt/blob/main/MONETIZATION_EXPERIMENT.md).

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

### npm / npx (recommended)

```bash
npx -y god-prompt-mcp
```

The public npm package runs the local stdio server directly. It requires Node.js 20+ and no API key or account.

### Glama

GodPrompt MCP is published on [Glama](https://glama.ai/mcp/servers/AKzar1el/god-prompt-mcp). Use the server page to inspect the tools and connect it to a supported MCP client.

### Kiro

[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=god-prompt-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22god-prompt-mcp%22%5D%2C%22disabled%22%3Afalse%2C%22autoApprove%22%3A%5B%5D%7D)

Kiro launches the published npm package through `npx`. Node.js 20+ is required.

### Cursor

The repository includes a Cursor plugin manifest and `mcp.json` for Marketplace or local plugin installation. Cursor runs the same local stdio server through `npx -y god-prompt-mcp`.

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

## Privacy Policy

GodPrompt MCP is a local stdio server. Its content tools return static GodPrompt material bundled with the installed extension, and `classify_task` evaluates the supplied task description in the local Node.js process.

- **Data collection and use:** the server has no telemetry or analytics and does not collect account data. Tool input is used only to produce the requested local response.
- **Storage and retention:** the server has no server-side persistence and does not retain tool inputs after a request completes.
- **Third-party sharing:** the server does not transmit tool inputs or bundled GodPrompt content to an external API or third party. The MCP host or AI client may process conversation and tool data under its own policies independently of this server.
- **Contact and policy:** see [tomiseregi.si/privacy](https://tomiseregi.si/privacy) for the current privacy policy and contact information. For support or bug reports, use [GitHub Issues](https://github.com/AKzar1el/god-prompt-mcp/issues).

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
