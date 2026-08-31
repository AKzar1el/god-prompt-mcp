# Windsurf / Devin Desktop

GodPrompt MCP works with Windsurf / Devin Desktop through Cascade's native MCP support.

## Local stdio setup

Open `~/.codeium/windsurf/mcp_config.json` and merge this server into the existing `mcpServers` object:

```json
{
  "mcpServers": {
    "god-prompt-mcp": {
      "command": "npx",
      "args": ["-y", "github:AKzar1el/god-prompt-mcp"]
    }
  }
}
```

Do not replace existing MCP entries when adding this configuration.

## Verify

Reload Windsurf after changing the config, open Cascade's MCP settings, confirm `god-prompt-mcp` starts, then inspect its tool list before invoking a workflow.

- Project: https://tomiseregi.si/projects/god-prompt
- Repository: https://github.com/AKzar1el/god-prompt-mcp
- Official MCP Registry ID: `io.github.AKzar1el/god-prompt-mcp`
- Windsurf MCP docs: https://docs.devin.ai/desktop/cascade/mcp
