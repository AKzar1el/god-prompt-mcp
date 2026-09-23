# GodPrompt MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [GodPrompt](https://github.com/AKzar1el/god-prompt) — AI software-development workflow guidance with task routing, TDD, debugging protocols, verification gates, and progressive disclosure.

[![MCPVault: verified](https://mcpvault.io/badge/god-prompt-mcp.svg)](https://mcpvault.io/servers/god-prompt-mcp/health?utm_source=external_badge&utm_medium=referral&utm_campaign=mcp_health_report)

## Agent Harness Review — US$49

Under the active `GP-RS1` standing mission, GodPrompt offers one bounded paid service for developers and small teams whose coding agents lose context, overstep scope, skip verification, or repeat mistakes. The mission has no automatic terminal date; it continues until Tomi explicitly pauses or stops it, or replaces it with a project-specific goal or kill criterion.

**GodPrompt Agent Harness Review — US$49 one-time.** For one repository, send up to three agent-control artifacts (`AGENTS.md`, `CLAUDE.md`, project rules, or equivalent) plus one short failure example. The review returns five priority risks, one proposed revised instruction block or patch, and a next-task verification checklist, with a target of 24 hours after payment and usable inputs.

GitHub Sponsors is the frozen payment rail, and the current `AKzar1el` Sponsors profile is active for signed-in buyers. To buy the review, open the [GP-RS1 US$49 one-time tier](https://github.com/sponsors/AKzar1el/sponsorships?tier_id=657478&metadata_campaign=godprompt_rs1&metadata_offer=agent_harness_review&metadata_source=mcp) and complete the one-time sponsorship. GitHub sign-in is required. After sponsoring, email `info@tomiseregi.si` with subject `[GP-RS1] Agent Harness Review` and include the GitHub username used for the sponsorship plus the review inputs. Delivery begins only after the US$49 sponsorship is independently verified and attributed to GP-RS1. The free MIT GodPrompt MCP remains unchanged and free. [See a transparent sample deliverable](https://github.com/AKzar1el/god-prompt/blob/main/AGENT_HARNESS_REVIEW_SAMPLE.md) before deciding; it is illustrative, not a client result or benchmark. [Full frozen experiment terms](https://github.com/AKzar1el/god-prompt/blob/main/MONETIZATION_EXPERIMENT.md).

## Tools

| Tool | Description |
|------|-------------|
| `get_god_prompt` | Full GodPrompt.md single-file payload (~40KB) |
| `get_core_skill` | `SKILL.md` — core protocol (load when relevant, ~10KB) |
| `get_protocols` | `references/01-PROTOCOLS.md` — deep execution guides (~13KB) |
| `get_gates` | `references/02-GATES.md` — verification checklists (~9KB) |
| `get_anti_patterns` | `references/03-ANTI-PATTERNS.md` — red flags & recovery (~9KB) |
| `classify_task` | Deterministically route a task to one of 9 GodPrompt task types, or `UNCLASSIFIED` when no reliable signal exists |
| `get_version` | Version info and server metadata |

## Progressive Disclosure

For minimum context usage, start with `get_core_skill`, then load `get_protocols`, `get_gates`, or `get_anti_patterns` only when the task requires deeper guidance. Use `get_god_prompt` when you want everything in one shot.

## Example queries

- "Classify this refactor and tell me which GodPrompt workflow applies."
- "Show me the verification gates I should satisfy before I claim this bug fix is complete."
- "Load the debugging protocol for a failing integration test without loading the full GodPrompt."

## Evaluation

GodPrompt's benchmark methodology, deterministic task corpus, evaluator logic, and reproducible run/export tooling live in the source project: [GodPrompt Bench](https://github.com/AKzar1el/god-prompt/tree/main/bench). No frozen reference-model run or raw benchmark artifacts have been published yet.

The MCP server does not run the benchmark or claim model-level superiority itself; it distributes the GodPrompt content evaluated by that suite.

## Connect

### Hosted remote (no Node.js required)

Use the public Streamable HTTP endpoint directly in MCP clients that support remote servers:

```text
https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp
```

The hosted endpoint exposes the same seven read-only GodPrompt tools as the local server and requires no API key or local Node.js runtime. It accepts both the deployed `initialize` flow and the current MCP 2026-07-28 `server/discover` flow so clients can connect while the ecosystem transitions between protocol eras. It is also published as a remote option in the Official MCP Registry alongside the installable stdio packages.

### Agent Skills over MCP (SEP-2640)

On MCP 2026-07-28, both the hosted and stdio servers advertise the Final `io.modelcontextprotocol/skills` extension from SEP-2640. Supporting clients can discover the same relevance-scoped `god-prompt` Agent Skill with `skills/list` / `skills/get`, then fetch `SKILL.md` and its three reference files through `resources/read`. The skill manifest includes SHA-256 digests and exact byte sizes so clients can verify what they import. Clients that do not implement this extension continue to use the seven existing GodPrompt tools normally.

This transports GodPrompt's existing skill package; it does not force the skill into every request or change the host's own approval, verification, or activation policy. See the [MCP Skills extension specification](https://modelcontextprotocol.io/extensions/skills/overview).

### ChatGPT Plugin Directory (skill-only)

For the lowest-friction ChatGPT path, install [GodPrompt from the first-party Plugin Directory](https://chatgpt.com/plugins/plugins_6ab2f1cc5d0081919d729fd1c2884f86). That published plugin carries the scoped `god-prompt` Agent Skill; use the custom MCP app setup below when you specifically want the seven callable GodPrompt tools.

### ChatGPT (hosted remote MCP)

On ChatGPT web, supported Business and Enterprise/Edu workspaces can connect the hosted endpoint as a custom MCP app in Developer Mode:

1. Enable Developer Mode, then open **Settings > Apps > Create** (workspace controls may require an admin or authorized developer).
2. Use `https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp` as the MCP endpoint and select no authentication.
3. Choose **Scan Tools**, confirm the seven read-only GodPrompt tools, then create and enable the app for the intended workspace users.

ChatGPT connects to remote MCP servers rather than local stdio servers. See OpenAI's [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt) documentation for current availability and workspace controls.

### npm / npx (recommended)

```bash
npx -y god-prompt-mcp
```

The public npm package runs the local stdio server directly. It requires Node.js 22+ and no API key or account.

### Glama

GodPrompt MCP is published on [Glama](https://glama.ai/mcp/servers/AKzar1el/god-prompt-mcp). Use the server page to inspect the tools and connect it to a supported MCP client.

### Kiro

Install this repository as a native **Kiro Power** to get the portable GodPrompt Agent Skill and MCP server together. In Kiro, open **Powers → Add Custom Power → Import power from GitHub**, enter:

```text
https://github.com/AKzar1el/god-prompt-mcp
```

Kiro reads the repository's Agent Plugins 1.0 `plugin.json`, `skills/`, and `mcp.json`; the bundled MCP server activates with the Power instead of requiring a separate user-level MCP entry.

If you only want the MCP server, use the direct install button:

[![Add to Kiro](https://kiro.dev/images/add-to-kiro.svg)](https://kiro.dev/launch/mcp/add?name=god-prompt-mcp&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22god-prompt-mcp%22%5D%2C%22disabled%22%3Afalse%2C%22autoApprove%22%3A%5B%5D%7D)

Both paths ultimately launch the published npm package through `npx`. Node.js 22+ is required for the MCP server.

### Visual Studio Code

VS Code can use GodPrompt as both a portable Agent Skill and a local MCP server. Install the skill at user scope so VS Code discovers it from `~/.copilot/skills`:

```bash
gh skill install AKzar1el/god-prompt-mcp skills/god-prompt --agent github-copilot --scope user
```

Then add the MCP server for the callable tools:

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_GodPrompt_MCP-0098FF?style=flat-square&logo=visualstudiocode&logoColor=white)](https://vscode.dev/redirect?url=vscode:mcp/install?%7B%22name%22%3A%22god-prompt-mcp%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22god-prompt-mcp%22%5D%7D)

VS Code installs the local stdio server through the published npm package. Node.js 22+ is required; no API key is needed.

### OpenAI Codex

GodPrompt can be used in Codex as either a portable Agent Skill or a native local MCP server.

Install the standards-compatible Agent Skill directly from this repository with Codex's built-in `$skill-installer`:

```text
$skill-installer install https://github.com/AKzar1el/god-prompt-mcp/tree/main/skills/god-prompt
```

Or register the published stdio server with Codex's native MCP CLI:

```bash
codex mcp add god-prompt -- npx -y god-prompt-mcp
```

Run `codex mcp list` to verify the registration. The Agent Skill gives Codex the reusable workflow directly; MCP adds GodPrompt's progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Gemini CLI

Install the repository as a native Gemini CLI extension to get both the portable GodPrompt Agent Skill and the MCP server in one step:

```bash
gemini extensions install https://github.com/AKzar1el/god-prompt-mcp
```

Or register only the published local stdio server with Gemini CLI's native MCP command:

```bash
gemini mcp add god-prompt npx -- -y god-prompt-mcp
```

Run `gemini extensions list` to verify the extension or `gemini mcp list` to verify the direct MCP registration. Node.js 22+ is required for the MCP server; GodPrompt itself needs no API key.

### Google Antigravity CLI

Antigravity CLI supports Agent Plugins that bundle Agent Skills and MCP servers. Install the existing GodPrompt plugin directly from GitHub:

```bash
agy plugin install https://github.com/AKzar1el/god-prompt-mcp
```

Run `agy plugin list` to verify the installation. The repository's Agent Plugins 1.0 package supplies both `skills/god-prompt` and the pinned local stdio MCP server, so no separate skill or MCP registration is needed. Node.js 22+ is required for the MCP server.

### GitHub CLI Agent Skills (preview)

GitHub CLI 2.100+ can install the same portable Agent Skill directly into supported coding agents without cloning the repository:

```bash
gh skill install AKzar1el/god-prompt-mcp skills/god-prompt --agent codex --scope user
```

Replace `codex` with another supported host such as `github-copilot`, `claude-code`, or `cursor`. The explicit `skills/god-prompt` path intentionally selects the portable skill rather than another distribution-specific package in this repository.

### Vercel Skills CLI

The open `skills` CLI can install the same portable Agent Skill into Codex, Claude Code, Cursor, and many other supported coding agents:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent codex --copy -y
```

Replace `codex` with another supported agent when needed. The current CLI discovers the repository's portable `god-prompt` skill directly and installs `SKILL.md` plus its referenced protocol files; the MCP server remains separately available through `npx -y god-prompt-mcp`.

### Cline

Cline SDK / Hub 0.0.83+ can load GodPrompt's existing Agent Plugins 1.0 package directly. Cline discovers user-installed plugin packages under `~/.agents/plugins/*`, validates the root `plugin.json`, exposes valid `skills/` entries, and starts valid servers from the root `mcp.json` without writing them into `cline_mcp_settings.json`.

Install the repository into Cline's user plugin directory:

```bash
mkdir -p ~/.agents/plugins
git clone --depth 1 https://github.com/AKzar1el/god-prompt-mcp ~/.agents/plugins/god-prompt-mcp
```

On the next settings refresh or session build, Cline can expose the `god-prompt` Agent Skill and launch the bundled local stdio server, whose root `mcp.json` pins the published GodPrompt MCP package version. Cline intentionally does **not** auto-scan workspace `.agents/plugins` directories, so merely opening a repository cannot activate repository-controlled MCP servers; SDK hosts that deliberately trust another package root can opt in through `agentPluginPaths`.

### Amp

Amp can load GodPrompt as an Agent Skill and expose the MCP tools only when that skill is relevant. Install the portable skill with:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent amp --copy -y
```

The skill includes Amp's sibling `mcp.json` configuration, pinned to the current GodPrompt MCP package. Amp keeps those seven MCP tool definitions hidden until the skill loads, avoiding a permanently expanded tool context while preserving the full progressive-disclosure surface. Node.js 22+ is required for the MCP server.

### Factory Droid

Factory Droid can use GodPrompt as both an Agent Skill and a local MCP server. Install the complete portable skill with the current Skills CLI target for Droid:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent droid --copy -y
```

Droid discovers compatible project skills under `.agents/skills/`. To add the callable GodPrompt tools as a local stdio MCP server, use Droid's native MCP command with the published version pinned:

```bash
droid mcp add god-prompt "npx -y god-prompt-mcp@1.0.26"
```

Open `/mcp` in Droid to verify the server and available tools. The Agent Skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Warp

Warp can use GodPrompt as both an Agent Skill and a local MCP server. Install the complete portable skill into Warp with:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent warp --copy -y
```

Warp discovers project skills from `.agents/skills/` and `.warp/skills/`. For MCP tools, add a CLI-based MCP server in Warp with command `npx` and arguments `-y`, `god-prompt-mcp`; Warp's Oz CLI can also receive MCP configuration through `oz agent run --mcp`. The skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Goose

Goose can use GodPrompt as both an Agent Skill and a local MCP extension. Install the complete portable skill into Goose with:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent goose --copy -y
```

Goose discovers the copied skill under `.goose/skills/god-prompt/`. To expose GodPrompt's callable tools for a session, start Goose with the published MCP package as an external stdio extension:

```bash
goose session --with-extension "npx -y god-prompt-mcp@1.0.26"
```

Goose currently treats Agent Skills and MCP extensions as separate native surfaces, so this path does not depend on Agent Plugins support. The skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Zed

Zed can use GodPrompt as both a native Agent Skill and a local MCP context server. Install the complete portable skill, including its referenced protocol files, with:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent zed --copy -y
```

For MCP tools, open **Settings → AI → MCP Servers → Add Server → Add Local Server**, set the command to `npx`, and pass `-y` and `god-prompt-mcp` as arguments. Zed loads project skills from `.agents/skills/` and can forward configured MCP servers to supported external agents. Node.js 22+ is required for the MCP server.

### OpenCode

OpenCode v2 natively discovers Agent Skills from `.agents/skills/` and supports local MCP servers. Install the same portable GodPrompt skill with:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent opencode --copy -y
```

To expose GodPrompt's MCP tools as well, add a local server to `opencode.json` or `opencode.jsonc`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "god-prompt": {
        "type": "local",
        "command": ["npx", "-y", "god-prompt-mcp"]
      }
    }
  }
}
```

OpenCode 1.x used the same server entry directly under `mcp`; the v2 schema shown above nests named servers under `mcp.servers`.

The Agent Skill provides the reusable workflow; MCP adds the seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### TraeCode

TraeCode can use GodPrompt as both a native project skill and a project-level local MCP server. Install the complete portable skill with the current Skills CLI target for Trae:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent trae --copy -y
```

The Trae target installs the skill under `.trae/skills/god-prompt/`, where TraeCode can load it when the task matches its description. To expose GodPrompt's callable tools for the project as well, add `.trae/mcp.json`:

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "npx",
      "args": ["-y", "god-prompt-mcp@1.0.26"]
    }
  }
}
```

TraeCode also supports the portable `.agents/skills/` convention when **Enable .agents Skills Directory** is turned on in its import settings. Treat project MCP configuration as executable workspace configuration and enable it only in repositories you trust. The Agent Skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### OpenClaw

OpenClaw can use GodPrompt as both a project Agent Skill and a locally registered MCP server. Install the complete portable skill with the current Skills CLI target for OpenClaw:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent openclaw --copy -y
```

The copied skill lands under `.agents/skills/god-prompt/`, one of OpenClaw's documented project skill roots. To expose GodPrompt's callable tools to OpenClaw-managed agent runtimes as well, register the published stdio server:

```bash
openclaw mcp add god-prompt --command npx --arg -y --arg god-prompt-mcp@1.0.26
openclaw mcp probe god-prompt
```

`mcp probe` opens a live MCP connection and reports the discovered capabilities, making it a direct verification step after registration. The Agent Skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Qoder

Qoder can use GodPrompt as both a native project Skill and a project-level local MCP server. Install the portable skill with Qoder's supported Skills CLI target:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent qoder --copy -y
```

The Qoder target installs the skill under `.qoder/skills/god-prompt/`, where Qoder can load it automatically when the task matches the skill description. To expose GodPrompt's callable tools to the project as well, add `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "npx",
      "args": ["-y", "god-prompt-mcp@1.0.26"]
    }
  }
}
```

Qoder requires approval before using project-level MCP servers by default. After adding or changing the server, start a new session or run `/mcp reload`, then use `/mcp` to verify the connection. The Agent Skill supplies the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Qwen Code

Qwen Code can use GodPrompt through both of its native extension surfaces: Agent Skills and local MCP servers. Install the complete portable skill with the current Skills CLI target for Qwen Code:

```bash
npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent qwen-code --copy -y
```

This installs GodPrompt under `.qwen/skills/god-prompt/`, where Qwen Code can discover and load the skill when the task matches its description. To add the callable GodPrompt tools as a project-local stdio MCP server, add this to `.qwen/settings.json`:

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "npx",
      "args": ["-y", "god-prompt-mcp"]
    }
  }
}
```

Restart Qwen Code after changing MCP configuration, then open `/mcp` to verify the server. The Agent Skill provides the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Kimi Code

Kimi Code CLI can install GodPrompt as one native custom plugin containing the existing Agent Skill and local MCP server. Install the current repository branch explicitly:

```text
/plugins install https://github.com/AKzar1el/god-prompt-mcp/tree/main
/reload
```

The Kimi manifest points at `skills/`, so the `god-prompt` skill remains available through Kimi's normal relevance-based skill loading instead of being forced into every session. The same manifest exposes `god-prompt-mcp@1.0.26` as a local stdio MCP server, preserving the seven progressive-disclosure tools. The explicit `tree/main` URL matters because Kimi's bare GitHub-repository install form prefers the latest GitHub release; using `main` makes the current plugin manifest available without forcing a documentation-only npm/MCP Registry release. Node.js 22+ is required for the MCP server.

### JetBrains AI Assistant

JetBrains AI Assistant 2026.2 can use GodPrompt through both supported agent surfaces:

- **Agent Skill:** in **Settings → Tools → AI Assistant → Skills**, open **Manage External Registries** and add `https://github.com/AKzar1el/god-prompt-mcp`. The existing `skills/god-prompt` package can then be installed for supported skill-aware agents such as Codex or Claude Agent.
- **MCP tools:** in **Settings → Tools → AI Assistant → Model Context Protocol (MCP)**, add a stdio server with command `npx` and arguments `-y`, `god-prompt-mcp`. Enable **Pass custom MCP servers** for the coding agent that should receive GodPrompt's progressive-disclosure tools.

The Agent Skill supplies the reusable workflow; the MCP server supplies GodPrompt's callable tools. Node.js 22+ is required for the MCP server.

### JetBrains Junie CLI

Junie CLI can install GodPrompt as one extension by reusing this repository's existing Claude-compatible marketplace manifest. In Junie, register the repository and install the listed extension:

```text
/extensions marketplace add AKzar1el/god-prompt-mcp
/extensions install god-prompt-mcp
```

Junie supports `.claude-plugin/marketplace.json` as a marketplace format, so no Junie-specific duplicate manifest is required. The installed extension reuses GodPrompt's existing portable Agent Skill and MCP configuration; Junie can also discover the same skill from `.agents/skills/` and supports local `npx` MCP servers. Node.js 22+ is required for the MCP server. Junie CLI is not installed in this repository's qualification environment, so these commands are documented from JetBrains' current extension contract rather than claimed as a local end-to-end runtime smoke.

### Devin Desktop / Windsurf

Devin Desktop (formerly Windsurf) and Devin CLI can load GodPrompt's existing Agent Plugins 1.0 package directly from GitHub. After signing in to Devin, install the plugin with:

```bash
devin plugins install AKzar1el/god-prompt-mcp
```

The plugin supplies both `skills/god-prompt` and the published local stdio MCP server. Run `devin plugins list` to verify the installation.

If you only want the portable skill, place the complete skill directory at `.agents/skills/god-prompt/`; Devin also discovers project skills under `.devin/skills/` and `.windsurf/skills/`. If you only want the MCP server, register it directly:

```bash
devin mcp add god-prompt -- npx -y god-prompt-mcp
```

Run `devin mcp list` to verify the direct server registration. The Agent Skill provides the reusable workflow while MCP exposes GodPrompt's seven progressive-disclosure tools. Node.js 22+ is required for the MCP server.

### Cursor

The repository includes a native Cursor plugin manifest plus a portable Agent Plugins 1.0 manifest. Cursor Marketplace can use `.cursor-plugin/plugin.json` with `cursor-mcp.json`; Agent Plugins-compatible clients can use root `plugin.json` with `mcp.json`. Both launch the same local stdio server through `npx -y god-prompt-mcp`.

### GitHub Copilot

GitHub Copilot CLI supports the portable Agent Plugins 1.0 package at the repository root. Install it through the repository marketplace:

```bash
copilot plugin marketplace add AKzar1el/god-prompt-mcp
copilot plugin install god-prompt-mcp@god-prompt
```

The plugin includes both the GodPrompt MCP server and a standards-compatible `god-prompt` Agent Skill under `skills/god-prompt/`. Copilot can load the skill automatically when relevant or invoke it explicitly as `/god-prompt`, while MCP remains available for progressive-disclosure tool access.

This keeps the marketplace entry, portable plugin, skill, and MCP server in one versioned repository and works for individual, team, and cloud-agent distribution. Direct repository installs (`copilot plugin install AKzar1el/god-prompt-mcp`) still work in current Copilot CLI releases, but the CLI marks them deprecated in favor of `plugin@marketplace` installs.

### GitLab Duo CLI

GitLab Duo CLI 9.15+ supports Agent Plugins and Git-backed plugin marketplaces. Register this repository once, then install the same portable plugin:

```bash
duo plugin marketplace add https://github.com/AKzar1el/god-prompt-mcp.git
duo plugin install god-prompt-mcp@god-prompt
```

The installed plugin bundles the existing `god-prompt` Agent Skill and pinned local MCP server, so GitLab Duo users get both workflow guidance and callable tools from the same versioned repository.

### Claude Code

The repository includes a Claude Code marketplace catalog alongside the existing plugin and MCP manifests, so users can install the same versioned plugin directly from this GitHub repository without waiting for community-directory review. In Claude Code, run:

```text
/plugin marketplace add AKzar1el/god-prompt-mcp
/plugin install god-prompt-mcp@god-prompt
```

The plugin bundles the portable `god-prompt` Agent Skill and the pinned local MCP server. The same package remains structurally ready for Anthropic's reviewed community directory without maintaining a separate implementation.

### Claude Desktop extension

GitHub releases include a `.mcpb` bundle for one-click local installation in MCPB-compatible clients such as Claude Desktop. The bundle runs the same local stdio server and does not require an API key or account.

Current GitHub releases are immutable and include a release attestation. With GitHub CLI installed, verify the release and your downloaded MCPB before installing it:

```bash
gh release verify <release-tag> --repo AKzar1el/god-prompt-mcp
gh release verify-asset <release-tag> <downloaded-mcpb> --repo AKzar1el/god-prompt-mcp
```

The asset check verifies that the local MCPB exactly matches the file recorded in the published release attestation.

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

GodPrompt MCP can run either as a local stdio server or through the public Streamable HTTP Worker. Its content tools return static GodPrompt material bundled with the server, and `classify_task` is deterministic; neither mode calls a model or third-party content API.

- **Data collection and use:** GodPrompt application code has no telemetry or analytics and does not request account data. Local stdio tool input stays in the local Node.js process. Hosted remote tool input is sent over HTTPS to the Cloudflare-hosted Worker so it can produce the MCP response.
- **Storage and retention:** the MCP request handlers are stateless and have no application database or request-retention path; they do not intentionally persist tool inputs after a request completes. Hosting/provider infrastructure may process connection or request metadata under its own policies.
- **Third-party sharing:** local stdio does not transmit tool inputs or bundled GodPrompt content to an external API. The hosted remote necessarily passes the request through Cloudflare infrastructure, but GodPrompt application code does not forward tool inputs to another API or service. The MCP host or AI client may process conversation and tool data under its own policies independently of this server.
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
