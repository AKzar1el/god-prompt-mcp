# llms-install.md — Cline and agent installation guide for GodPrompt MCP

This file is for AI agents such as Cline installing the **local stdio** GodPrompt MCP server from its public npm package.

## Requirements

- Node.js 20 or newer
- `npm` / `npx`
- Internet access for the initial npm package install

No API keys or environment variables are required.

## Recommended install path

Run the published package directly with `npx`:

```bash
npx -y god-prompt-mcp
```

The package declares a `bin` entry for the local stdio server and does not require an API key.

## Cline configuration

For the Cline IDE extension, open **MCP Servers → Configure → Configure MCP Servers** and merge this entry into the `mcpServers` object. Cline CLI uses the same server definition in its MCP settings.

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "npx",
      "args": ["-y", "god-prompt-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Keep `autoApprove` empty so the user can see when workflow guidance is requested.

## Verify

1. Confirm Cline shows `god-prompt` as connected.
2. Confirm exactly seven tools are available:
   - `get_god_prompt`
   - `get_core_skill`
   - `get_protocols`
   - `get_gates`
   - `get_anti_patterns`
   - `classify_task`
   - `get_version`
3. Run a low-impact verification call such as `get_version` or ask Cline to classify a small software-development task.

## Fallback: cloned checkout

If the npm install path is unavailable, clone and build the repository explicitly:

```bash
git clone https://github.com/AKzar1el/god-prompt-mcp.git
cd god-prompt-mcp
npm install
npm run build
node dist/stdio.js
```

Then configure Cline with `command: "node"` and the absolute path to `dist/stdio.js`.

## Safety boundary

- Do not add secrets or credentials; this server does not require them.
- Do not enable blanket tool auto-approval during installation.
- The MCP server exposes workflow guidance and embedded project content; it does not execute the GodPrompt benchmark or claim measured model-level superiority.
