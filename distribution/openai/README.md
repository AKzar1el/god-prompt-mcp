# OpenAI Plugin Directory — GodPrompt Skill + MCP preview

This folder is a review package for the scoped software-engineering GodPrompt Skill and **one existing public read-only remote MCP**. The Skill is activated for engineering tasks, selects a bounded advisory tool, and never infers authority from MCP output.

- `plugin.json`, `mcp.json`: portable ChatGPT plugin and the existing hosted GodPrompt MCP URL.
- `.codex-plugin/plugin.json`, `.mcp.json`: the same MCP endpoint in a Codex-compatible manifest; clients must not register both formats simultaneously.
- `skills/god-prompt/SKILL.md`, `agents/openai.yaml`, `references/tool-routing.md`: scoped Skill, single MCP dependency and efficient tool choice.
- `review-tests.json` and `review-tool-tests.json`: positive, negative and adversarial activation fixtures; static fixtures do not prove live model behavior.

P5 adds optional **local-only** `godprompt-repo-map` and `godprompt-proof pack` CLIs to the separately distributed npm package. Neither is present as a new public remote tool. The existing `trace_change_impact` and `audit_agent_trajectory` MCP tools consume sanitized caller-supplied summaries. Compatible clients may render an optional read-only evidence view; text and `structuredContent` remain authoritative fallback formats.

The GitHub workflow `verify-openai-plugin.yml` performs CI checks, hosted `tools/list`/`tools/call`, packages a preview plugin ZIP and a standalone Skill ZIP. It does not publish or update the public OpenAI Plugin Directory. Live installed-client activation, plugin portal review, and explicit publication remain separate quality gates.
