# GodPrompt OpenAI Skill + remote MCP — unpublished preview

Date: 2026-11-20. Milestone AFTER verified public GodPrompt v1.3.0, BEFORE final GHCR publishing.

## Architecture and roles

Portable OpenAI plugin at `distribution/openai/` now adds exactly one remote MCP declaration alongside its already scoped `god-prompt` Agent Skill. The Skill chooses a goal-specific tool sequence; the MCP remains bounded, read-only, stateless and advisory. The host performs any authorized code edits, test execution, repository access or approvals. No hosted memory, backend database, paid LLM calls, long-running daemon or new runtime is added.

- Portable plugin root: `plugin.json` + `mcp.json` with `type: streamable-http`, `auth.type: none`.
- Codex compatibility overlay: `.codex-plugin/plugin.json` points to `.mcp.json` with `type: http`.
- Both configurations identify `god-prompt-mcp` and the SAME endpoint: https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp
- Skill dependency: `skills/god-prompt/agents/openai.yaml` declares `type: mcp`, `transport: streamable_http`, same name and URL.
- Scoped tool choices: `skills/god-prompt/references/tool-routing.md`.
- Existing detailed authority/approval constraints in SKILL.md remain unchanged except a compact tool-routing introduction. The remote Skill extension may also discover a `god-prompt` skill; clients should avoid loading duplicate copies.

## Evidence gates

1. Existing five positive / three negative activation review cases remain and are still checked.
2. Ten new positive, four negative and four edge cases test activation, tool selection and missing-evidence behavior at fixture level. Static tests are **not** equivalent to an AI model behavioral evaluation.
3. `tests/openai-combined-preview.test.mjs` checks both formats, exact shared endpoint, auth, version agreement, tool routing, privacy/fallback language, absence of local command installers, and conflict-resistant packaging.
4. `scripts/verify-openai-remote.mjs` makes actual read-only `tools/list` and `audit_agent_trajectory` calls against the live hosted endpoint; expects 22 read-only tools and refuses to claim verification from tool output.
5. The CI preview workflow performs Node 22 build and tests, calls the actual endpoint, packages a deterministic ZIP of the existing `distribution/openai/` tree (including dotfiles) and uploads as a short-lived review artifact. No API keys required. The regular repo workflows also test Node 22/24.
6. A fresh ChatGPT/plugin runtime session and activation behavior with the actual model/installer must still be tested before marketplace publication; file checks alone cannot prove it. Do not mark published solely from a green CI run.

## Source references

- https://developers.openai.com/plugins/build/plugins — portable `mcp.json`, remote `streamable-http`, auth metadata.
- https://developers.openai.com/api/docs/guides/agents-api/tools/plugins — Codex `.codex-plugin` and `.mcp.json` compatibility format.
- https://developers.openai.com/plugins/build/skills — MCP tool dependency under `agents/openai.yaml`.

## Release boundary

This branch is an UNPUBLISHED preview. It does not mutate the already published Skill-only OpenAI plugin, submit a directory update, register a new remote server, restart Codexify, publish Docker/GHCR, or trigger release automation. The CI ZIP is for review only.

After approval and real model activation quality checks, update the OpenAI listing through its normal portal separately. Keep Docker/GHCR pinned version publication as the final milestone.
