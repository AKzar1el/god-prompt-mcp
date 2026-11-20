# GodPrompt Preview 10: isolated observer hardening and cross-version QA

Date: 2026-11-20. Source: local `3f5b088bc64ecafc22c78194fde0929790acad9e`.
This pass used a separate worktree and the local branch
`feature/godprompt-preview10-observer-hardening-20261120`.

## What was verified

- The Preview 10 source built with TypeScript on Windows Node 22.22.2.
- Before modifications, all 197 existing Node 22 tests passed.
- After both fixes, the expanded suite passed **198/198** tests on
  **Node 22.22.2** and **Node 24.22.3**, with no failures or skips.
- Both new regressions failed against the affected code before their fixes,
  then passed following the surgical corrections.
- `node --check` and `git diff --check` passed.
- An offline `npm pack --dry-run --ignore-scripts --json` listed exactly
  **13 files**, including the checkpoint module. It excluded internal QA,
  tests and the opt-in observer script. No package was published.
- All nine shipped candidate `dist/*.js` modules matched this local source
  build by SHA-256; the extra build outputs `discovery.js` and `index.js`
  are not package entries. No npm package code was modified in this pass.

## Two reproduced defects and fixes

1. **Same-inode growing rewrite skipped audit records.** A watcher that
   remembers only file identity and size can wrongly resume at its old
   byte offset if the audit file is overwritten in place and its new
   content is larger than that offset. An extended real-filesystem
   regression observed 0 checkpoints instead of 1 (RED). The watcher now
   checks a bounded 128-byte continuity anchor at the old cursor and
   obtains metadata from the same open file handle it reads (GREEN).
   The previous truncate, rename/rotate and temporary missing-path
   scenarios still pass in the same regression.
2. **UTF-8 split across a bounded read corrupted command matching.**
   A multibyte code point split at the 512 KiB read boundary was decoded
   as replacement characters; a valid host execution then failed to match
   its contracted command and produced zero verification reports (RED).
   A streaming `StringDecoder` now preserves code-point continuity and is
   reset whenever the watcher resets its cursor (GREEN).

## Intended scope and limitations

Only the optional local observer and its tests changed; the existing
MCP tool catalog, checkpoint evaluator, hosted Worker, npm version,
credentials, connector, and public release were not changed. The observer
remains advisory and opt-in. Reports still withhold independent verification
and completion authorization. No parallel Codexify agents or service
processes were restarted or interrupted, and nothing was pushed or merged.

The existing Codexify configuration was **observed** pointing to the
Preview 10 installed package with the optional checkpoint flag enabled.
This is only evidence of next-start configuration: it does **not** establish
that a live shared Codexify MCP source had reloaded Preview 10. The available
catalog did not expose a definitive live version probe for that source.

An owner-writable JSONL file is not signed attestation. The continuity
anchor catches tested ordinary rewrites, not every possible rewrite:
for example, a rewrite preserving the exact anchor bytes or a truncate-
regrow cycle entirely between polls may remain undetected. No host-level
interception or automatic authority enforcement is claimed. Throughput
and end-to-end agent productivity were not measured in this pass.

## Safe continuation

Keep this commit isolated for code review; do not merge to main or
publish/deploy without a separate release decision, CI/release gate
verification and live MCP tool-catalog convergence check. A future
approved reload (if supported) or coordinated service restart can establish
whether Preview 10 is active. Do not disrupt parallel agents.

## Post-restart live-discovery check (02:31 Europe/Ljubljana)

- User reported restarting, but both running `codexify.exe` background
  processes had Windows start times of **00:12:51**. The active
  `~/.codex/config.toml` was last modified at **00:40:00** the same day.
  Thus the running background processes predate the latest MCP config.
- The config's enabled `god-prompt-mcp` entry specifies
  `C:\nvm4w\nodejs\node.exe`, the locally installed Preview 10
  `dist/stdio.js`, and `GODPROMPT_CODEXIFY_CHECKPOINT=1`.
- Running that **exact configured executable, entrypoint, and opt-in** as
  a separate read-only local stdio smoke test succeeded: MCP identity
  `1.1.1-checkpoint-preview.10`, **10 tools** including
  `review_codexify_checkpoint`, and a real `classify_task` call.
- The shared Codexify MCP source catalog still reported **13 connected**
  sources and did not include GodPrompt. This remains an unverified live
  activation; successful standalone execution is not shared integration.
- `codexify` 2.4.0 CLI exposes service restart, but no documented
  GodPrompt-only/source-scoped reload. The next activation step is an
  explicitly coordinated **Codexify background service restart** after
  parallel work is idle, then immediately inspect the refreshed source
  list and run real checkpoint calls through Codexify.

No shared service was restarted, no configuration was mutated, and no
release or remote Git operation was performed during this check.
