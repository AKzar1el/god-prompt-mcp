# GodPrompt Engineering

Use focused GodPrompt workflow guidance and editable engineering task briefs inside VS Code. The extension packages the same versioned protocol and quality-gate reference documents as the [GodPrompt MCP project](https://github.com/AKzar1el/god-prompt-mcp), without requiring the MCP server or an AI service.

## Use

- **GodPrompt: Open Workflow Guide**: choose one of nine engineering task types (BUILD, DEBUG, REFACTOR, CONTENT, DESIGN, SHIP, ANALYZE, AUTOMATE or PLAN), then choose plan, execute, verify or handoff. Opens the relevant guidance in an unsaved Markdown editor.
- **GodPrompt: Draft Task Brief**: enter a short task description and choose a workflow and phase. Opens an editable brief with scope, acceptance and verification placeholders plus the source-backed guidance.

The commands never inspect your workspace, run a terminal command, invoke an agent, send requests, save files automatically, or collect extension telemetry. You choose whether to save or share a draft. A checklist is not proof of completed work or an approval to perform actions.

## Development

In this directory run `npm ci`, `npm test` and `npm run package`. The build derives its guidance from the repository's checked-in references, records source hashes and version, and packages only the native adapter, data, documentation and license. Set `VSCODE_EXECUTABLE` to an installed VS Code executable and run `npm run test:host` for a disposable extension development host. The test disables optional update and AI activity only in its own profile, requires a real host receipt, and leaves normal VS Code settings unchanged.

[GodPrompt project](https://tomiseregi.si/projects/god-prompt) | [Issues](https://github.com/AKzar1el/god-prompt-mcp/issues)

MIT licensed.
