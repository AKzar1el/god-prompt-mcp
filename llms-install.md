# llms-install.md — Cline and agent installation guide for GodPrompt MCP

This file is for AI agents such as Cline installing the **local stdio** GodPrompt MCP server from its public npm package.

## Requirements

- Node.js 22 or newer
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

### Windows stdio launcher fallback

If Cline reports `spawn npx ENOENT` or `spawn npx.cmd EINVAL`, its process launcher may not support the Windows npm batch shim. Keep a working `npx` configuration unchanged. For an affected Windows client that accepts a custom stdio command and arguments, try the same documented launcher workaround as in the main README:

```json
{
  "mcpServers": {
    "god-prompt": {
      "command": "C:\\Windows\\System32\\cmd.exe",
      "args": ["/d", "/s", "/c", "npx -y god-prompt-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

This is a client-specific workaround, not a change to the MCP server. It is not claimed to be tested against every Cline version; verify connection and the live tool list after changing the launcher.

## Verify

1. Confirm Cline shows `god-prompt` as connected. Call `get_version` and check the actual installed server version before comparing tool lists; `npx -y` and version-pinned clients can expose different catalogs.
2. The original **seven core tools** are: `get_god_prompt`, `get_core_skill`, `get_protocols`, `get_gates`, `get_anti_patterns`, `classify_task`, `get_version`.
3. **v1.1.1** added `create_work_contract`, `review_work_evidence`, making **nine tools** in that tagged version.
4. The repository's **v1.5.0 Node stdio implementation** registers **22 tools by default**: those nine plus `review_code_change`, `audit_requirements`, `build_test_matrix`, `get_tailored_guidance`, `diagnose_failure`, `assess_release_readiness`, `create_context_handoff`, `compare_evaluation_runs`, `audit_agent_trajectory`, `trace_change_impact`, `review_mcp_tool_contracts`, `audit_agent_instructions`, `design_adversarial_tests`. The optional local-only `review_codexify_checkpoint` is available only when `GODPROMPT_CODEXIFY_CHECKPOINT=1`; it is not part of the default 22. Resources and prompts are not counted as tools.
5. Verify your client's actual tool list (tools/list) against its installed version; do not assume other releases keep an exact count. Keep `autoApprove` empty, and test a low-impact `get_version` or `classify_task` call before using additional guidance tools.

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
