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
  GodPrompt-only/source-scoped reload. Live source recovery needs a
  supported targeted reload or an explicitly coordinated service change;
  do not repeatedly ask the owner to restart without diagnosing failures.

No shared service was restarted, no configuration was mutated, and no
release or remote Git operation was performed during this check.

## Startup failure: root-cause evidence (02:36 Europe/Ljubljana)

- Existing service log `~/.codexify/logs/codexify.log.1` records service
  launch at **2026-11-19 23:12:51 UTC** (00:12:51 Ljubljana time).
  Codexify discovered the GodPrompt config key at startup, but at
  **23:15:40 UTC** reported:
  `skipping MCP server 'god-prompt-mcp': timed out after 30s waiting for
  'god-prompt-mcp' to initialise`. The startup source table lists it as
  **FAILED**; later private source listings omit it. This is a concrete
  startup failure, not evidence that the tool was never configured.
- The **90-second** timeout currently shown in `~/.codex/config.toml` was
  saved at **00:40 Ljubljana time**, after the failed service startup.
  Do **not** claim Codexify ignored 90 seconds in that earlier startup;
  only the earlier 30-second effective setting is evidenced by the log.
- In three fresh stand-alone launches of the exact Preview 10 MCP
  executable, the entire `initialize` plus `tools/list` took **2.202s**,
  **1.634s**, and **1.207s** respectively. This rules out a consistent
  >30-second startup defect in the installed package, but not occasional
  contention, blocking or delayed protocol initialization in Codexify.
- Separate Codexify PR **#11**, `feat(mcp): targeted transactional
  upstream hot reload without global restart`, contains code and tests
  for failed-source recovery. A factual reproduction and regression
  request was posted to the PR conversation; that branch was **not**
  modified, merged or deployed during this investigation.

Current conclusion: the shared process retains an MCP catalog from a
startup where GodPrompt failed initialization, while the installed
Preview 10 candidate itself passes direct protocol tests. Recovery
should reinitialize **only this source**, honor configured timeouts, and
preserve unrelated live MCP sessions. Until supported source recovery
is active, do not claim shared Codexify Preview 10 is verified.
