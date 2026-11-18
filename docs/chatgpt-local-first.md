# GodPrompt distribution: public stateless MCP + optional private local learning

**Status: v1.1.0 distribution architecture and release checklist. Learning remains opt-in and never synchronizes automatically.**

## The actual storage boundary

| Where GodPrompt runs | Tools users get | Where learning lives |
| --- | --- | --- |
| Public hosted Cloudflare Worker endpoint /mcp | Stateless GodPrompt guidance and task-contract tools (once published) | **No GodPrompt personal learning database**, no shared user notes, no per-user JSONL |
| ChatGPT custom MCP / plugin connection | ChatGPT invokes the public **remote** endpoint | **No automatic GodPrompt storage** on OpenAI's servers and no access to the end user's files |
| Node stdio GodPrompt MCP + optional godprompt-proof CLI | Same published guidance tools plus a separate local CLI | One **opt-in** local feedback.jsonl on the user's own host, capped at 256 KiB |
| User-controlled coding agent / Codexify | Uses its already-authorized terminal and existing GitHub/Codexify tools | The **same local feedback.jsonl** when the user configures the optional CLI |

Publishing an MCP server or a ChatGPT app **does not provision per-user persistent data storage** for the developer. MCP tool invocations are not a persistent memory API. ChatGPT's own conversation history and platform data policies are separate from GodPrompt's local feedback mechanism.

Cloudflare's existing compatibility Durable Object class in this repository is **unused by the public MCP route**; keeping that class for migration safety does **not** constitute user-specific storage. The audit must verify that no future change silently wires user data into that class or adds a D1/KV database binding.

No OpenAI-specific storage API, local filesystem tunnel, user login, telemetry, or cloud synchronization is included in this proposal.

## How one person uses the local option

1. Install a verified release that contains godprompt-proof (Node.js 22+). The CLI remains optional and is not automatically run by a remote MCP client.
2. Keep GodPrompt's remote or stdio MCP available as desired. The local CLI is **optional and separate**.
3. If using a local coding agent, put a short **user-controlled** instruction into the project's agent setup: at task start, run the local workflow command for the project and task type. The project key stays on that machine and becomes a local SHA-256 hash in stored events.
4. After real work, collect **redacted** GitHub checks or Codexify execution receipts, then run GodPrompt's review_work_evidence. For actual HOLD reports, run the learn-review local command with the review JSON.
5. Read on-demand project metrics when needed. Nothing runs on a timer or in the background.
6. The latest branch rejects duplicate contract/issue feedback so replaying the same HOLD cannot inflate "recurring failure" suggestions; independent review is still necessary.

The CLI intentionally does not auto-import or copy arbitrary command logs, full prompts, repository files or user conversations into the learning file. Manual lessons should contain **only generic, sanitized correction text**. The project hash is a pseudonymous identifier, **not encryption**; a publicly guessable repository name could be brute-force matched. Do not store secrets or sensitive project identifiers as lesson content.

The JSONL 256 KiB cap is enforced for normal single-writer use; the CLI is deliberately **not a multi-process transaction database**. Use only one writer at a time. If simultaneous writers or multi-device sync becomes a genuine user requirement, that is a separate storage/consistency design and must not be quietly added to the public MCP.

## What a ChatGPT-only user gets

A ChatGPT-only user can use the published read-only public tools (guidance, classification, task contracts, evidence checks), subject to ChatGPT plan/workspace permissions. They **do not get private persistent learning across conversations** from the public MCP.

Do not imply that publishing a new CLI tool causes ChatGPT to execute code on the user's computer. ChatGPT connects to a remote custom MCP server, not arbitrary local stdio commands; a separately approved secure tunnel would be an explicit and different integration.

Current OpenAI guidance also says a previously approved custom MCP tool schema may be a frozen snapshot; administrators may need to **refresh the connected plugin's tool list** when adding create_work_contract and review_work_evidence. Do not silently assume registered tools appear in existing installations.

References:
- https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- https://help.openai.com/en/articles/12515353-building-with-the-apps-sdk
- https://developers.cloudflare.com/workers/platform/storage-options/

## No cloud sync by default

Cloud sync would require an **explicit new product scope**: end-user authentication, strong tenant isolation, durable data lifecycle and deletion, quotas, rate limits, user consent, privacy review, data export, plus an actual hosted storage binding. None is provisioned here. Avoid adding D1/KV, Durable Object per-user state, database tables, new tokens, or an app UI merely to make the public MCP stateless.

## Release safety checklist

1. Inspect and review the minimal stacked PR chain **#217 -> #218 -> #219 -> #220**, followed by the independent audit hardening PR; each PR has its own reviewable diff, tests and security checks. The offline Bench analyzer lives separately in AKzar1el/god-prompt PR **#349**.
2. Before each merge, inspect exact-head Node 22/24, stdio MCP and hosted Worker tests, npm packaging/install smoke, GHCR/MCPB distribution checks and CodeQL/security checks; never treat an older green head as evidence for a new commit.
3. Check there are no unreviewed public tool schema changes, no secrets, no unintended remote storage, and no new runtime dependencies or paid model/provider calls. Verify CLI file permissions and source/package content.
4. Decide and implement a deliberate, semantically versioned release. Existing tagged images, npm releases, MCPB hashes and approved ChatGPT tool snapshots **must not be silently replaced**.
5. Verify actual production Worker deployment with authenticated operator access and test tools/list against the real endpoint; do not claim that a GitHub PR or successful CI deployed it.
6. Verify the published npm godprompt-proof binary in a clean environment and a real authorized Codexify export envelope; fake fixture tests alone do not establish end-to-end interoperability.
7. In ChatGPT, refresh and approve changed tool schemas when appropriate, verify what tools appear in the installed plugin, and clearly communicate that users do **not** receive personal persistent memory from the public endpoint.

**Stop condition:** Do not merge, publish, deploy, create hosted storage, or install into an end user's machine automatically as part of a code audit. All such actions require a separately reviewed release and the relevant operator/user permissions.
