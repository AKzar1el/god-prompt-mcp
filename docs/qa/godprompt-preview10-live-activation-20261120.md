# GodPrompt Preview 10 — local Codexify activation and scoped observer E2E

Date: 2026-11-20 (Europe/Ljubljana). This is a **local opt-in deployment**,
not an npm/Cloudflare release, a GitHub merge, or a global Codexify policy.

## Activation: deployed and verified

- Source: isolated, clean GodPrompt branch
  `feature/godprompt-preview10-observer-hardening-20261120` at `e0c08b5`.
  Previous full QA: **199/199 Node 22** and **199/199 bounded Node 24**,
  plus a TypeScript build and a 13-file npm package dry-run.
- Installed into the **existing** private Codexify runtime at
  `%USERPROFILE%\.codexify\local-runtime\god-prompt-mcp-dogfood-preview10-20261119\node_modules\god-prompt-mcp`.
  Updated exactly three compiled modules: `dist/server.js`,
  `dist/work-contract.js`, `dist/codexify-checkpoint.js`. The original
  installed modules have SHA-verified backups and a JSON manifest in
  `%USERPROFILE%\.codexify\backups\godprompt-preview10-pre-e0c08b5-20261120050859`.
  Dependencies, other MCP sources, shared Codexify code and user data were
  not changed.
- A **fresh installed-package MCP subprocess** independently passed
  handshake, 10-tool discovery, 1,024-character bounded full-prompt read,
  new receipt documentation, and `PROHIBITED_ACTION_REPORTED` for a
  reported deploy action prohibited by a natural-language contract.
- Installed Codexify lacked merged targeted `reload_mcp` functionality.
  A guarded detached helper verified that all 18 upstreams were connected
  with **zero active/queued requests** across three consecutive samples,
  then recycled only the preexisting supervised Codexify worker. It left
  the Codexify Windows task and supervisor intact. New worker PID 18884
  brought the catalog back to **14/14 private sources connected**.
- **Real connected Codexify validation**, after the supervised recycle:
  `get_god_prompt` now advertises `start`/`maxChars`, and eight bounded
  tool calls reconstructed **64,568 characters** of the complete prompt,
  without a truncation marker (chunks 8,192 × 7 plus 7,224). The revised
  checkpoint receipt description is live. Live evidence review returned
  `HOLD` and `PROHIBITED_ACTION_REPORTED` for `Do not deploy or publish`
  versus a reported production deployment, with independent verification
  and completion authorization still both **false**. The MCP server
  identity remains `1.1.1-checkpoint-preview.10` and exposes 10 tools.
  One interoperability limitation remains: this Codexify dispatcher
  returned chunk text but not `structuredContent` continuation metadata.
  Callers can still advance `start` by the length of each returned chunk;
  standalone stdio exposes the metadata as designed.

## Scoped observer: deployed and verified

- Reused Codexify's **existing local** append-only audit stream; did not
  create a new MCP, cloud service, API key or external telemetry feed.
  It already exceeded **968 MB**. Its size/retention needs separate
  owner-approved maintenance; do not rotate or truncate it while other
  agents are writing.
- Copied the tested, non-published local observer script into the
  installed GodPrompt runtime. Its private contract, wrapper, readiness
  marker, stderr, and redacted JSONL reports reside under
  `%USERPROFILE%\.codexify\local-runtime\god-prompt-mcp-observer-20261120`.
  The wrapper pins the **current** Codexify conversation/project audit
  scope, so unrelated agents' audit events are ignored.
- Created Windows Task Scheduler entry `Codexify-GodPrompt-Observer`,
  triggered at user logon. It runs a single local Node watcher with
  existing dependencies, uses an interactive-user session and writes
  summaries only. A second copy is suppressed while it is running.
- Verified task **Running**, readiness file present, one matching
  observer process, and **zero stderr bytes**.
- Triggered a genuine Codexify `rollout_update`: the watcher emitted an
  automatic `plan` checkpoint with `MISSING_VERIFICATION` and
  `ACCEPTANCE_NOT_MET` pending, `completion_authorized=false`.
- The first synthetic verification command contained an eight-digit date
  suffix, which Codexify's existing privacy redactor deliberately masked
  in its `command_preview`. Its exact command therefore did not match
  the work contract. **Do not disable the redactor.** A benign no-digit
  canary command was independently shown to match the audited command
  exactly. Updated the low-risk contract and restarted **only the scoped
  observer task**, not Codexify itself.
- Ran that exact canary through `mcp__God_v5__exec_command`. The watcher
  emitted an automatic `verification` checkpoint, with no `RECHECK`
  codes, `ACCEPTANCE_NOT_MET` still pending, and
  `completion_authorized=false`. The observer report contains stage,
  timestamps, trigger, issue codes and counts, **not** the command text,
  contract contents, tool output, project paths, or private audit events.
- The subsequent real `apply_patch` that wrote this QA report was also
  observed as an `implementation` checkpoint, with acceptance still
  pending and completion authorization **false**. This proves three
  live trigger types, not only a synthetic `exec_command` fixture.

## Operational limits

1. This is an **advisory observer for one explicitly scoped conversation
   and contract**. It is not Codexify-wide automatic enforcement and
   does not automatically create contracts for future chats or workers.
2. A `RECHECK`/`HOLD` is evidence to inspect, **not** host-level
   interruption, independent attestation, or permission to merge/deploy.
3. The existing read-only 15-minute `Codexify-MCP-Health-Watch` task
   continues monitoring availability of upstreams separately. It does
   not kill or restart any MCP.
4. Codexify's upstream targeted-reload PR #11 is still separately under
   development. No GitHub branch was merged, no repo was pushed, and no
   public package was published during this activation.
5. The global audit JSONL size is a legitimate maintenance risk, but
   changing its lifetime or logging policy would affect other agents.
   This scoped pilot leaves those existing audit settings unchanged.

## Verification checklist

- [x] Backup and hash verification before local runtime replacement
- [x] Installed fresh stdio subprocess passes the new behavior
- [x] Guarded, single-worker recycle, without a Windows task restart
- [x] Live Codexify 10-tool schema and eight lossless prompt reads
- [x] Live forbidden-action reviewer fails closed
- [x] Live audit-backed scoped plan and verification events
- [x] Live implementation event from an actual QA-document patch
- [x] No outbound telemetry/API spending, no independent approval claims
- [ ] Codexify-wide per-task observer orchestration (not part of this pilot)
- [ ] Automatic source-specific failure recovery (awaits upstream PR #11)
- [ ] Global audit log retention (separate change, coordinated with agents)
