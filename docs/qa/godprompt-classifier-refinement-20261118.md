# GodPrompt task classifier: PLAN / BUILD / SHIP intent hardening

Date: 2026-11-18. Scope: isolated Codexify GodPrompt source branch only.

## Reproduced defects

- A direct request to **plan a feature release** was routed to BUILD because
  the incidental word `feature` outranked the action verb `plan`.
- Direct instructions to **deploy, release, or publish a new feature** could
  likewise be routed to BUILD, bypassing SHIP-specific *guidance* (not a
  permissions or deployment safeguard).
- A review or implementation request mentioning a `release plan` could
  incorrectly compete with PLAN or SHIP merely because the plan was named.

All failures were reproduced with test-first `tests/stdio.test.mjs` cases.

## Scoped changes

- Recognize direct planning commands and requests for a plan, strategy or
  roadmap as primary intent; treat incidental product/feature nouns as context.
- Differentiate **planning how to deploy** from requesting an actual deploy.
  Subsequent explicit build/deploy actions still take priority.
- Give direct or clearly requested follow-on SHIP verbs priority over the
  subject `feature`, while recognizing nominal `release plan`, `release
  notes`, etc. as subject matter, not permission to release.
- Preserve explicit inspection/implementation requests about existing plans.
- Reuse a compiled nominal-release expression and a shared set of planning
  deliverable signals instead of repeated ad-hoc keyword lists at call sites.
- Keep `get_version` content metadata, default nine-tool MCP catalog,
  evidence gates, and the ten-tool local checkpoint behavior unchanged.

## Verification

The expanded end-to-end stdio classifier test includes more than 50 curated
planning, shipping, inspection, negative, and multi-action cases; a further
7-subject x 7-template (49-case) matrix checks that changing the subject
does not change the requested task type. Existing ambiguity, negative-action,
input-boundary, and deterministic-result assertions remain in the same suite.

Both full test suites include checkpoint receipt/error/privacy/fuzz/concurrency
regressions. They must pass on Node 22 and Node 24 before local packaging.

### Verified results

| Check | Result |
|---|---|
| Node 22 `npm test` | **184/184 passed**, zero failures |
| Node 24 `node --test tests/*.test.mjs` | **184/184 passed**, zero failures |
| Targeted stdio test, including 49-case subject matrix | Passed |
| Offline npm package dry-run | **12 files**, no experiments/tests/private docs |
| Installed candidate SHA-256 equality | **5/5 dist modules** matched |
| Fresh installed default stdio handshake | `1.1.1`, **9 tools**, 9/9 classifier smoke cases |
| Fresh installed local opt-in handshake | `1.1.1-checkpoint-preview.4`, **10 tools**, 9/9 classifier smoke cases |
| Installed opt-in checkpoint HOLD / privacy | Passed; no independent authorization or secret reflection |
| Installed candidate repeated classifier stress | **1,176/1,176 passed**: 7 subjects x 7 intents x 4 text variants x 6 repeats; post-stress MCP recovery passed |

Local candidate directory: `~/.codexify/local-runtime/god-prompt-mcp-classifier-20261118`.
These results prove the **independent installed candidate** behaves as tested;
they do **not** prove it is already serving the live Codexify connector.
The 1,176-call run took approximately 3.3 seconds (about 356 requests/second)
on this machine, not a production latency guarantee.

## Limitations and rollout boundary

- Classification is a **heuristic advisory**, not execution authorization, a
  guarantee of perfect intent recognition, or an independent approval.
- Local opt-in checkpoint reminders are **agent-cooperative**, not host
  enforced; all returned completion authorization flags remain false.
- This branch is isolated from parallel agents. Do not restart Codexify
  during QA, change other MCP services, publish to npm/OpenAI, deploy to
  Cloudflare, or push/merge without a separate decision.
- To activate a newly installed local preview, configure only the existing
  GodPrompt stdio entry with a timestamped rollback copy, then verify the
  **live** source version after a later controlled restart.

The existing `~/.codex/config.toml` GodPrompt startup `args` was staged for
the **next** restart to use the separately installed classifier candidate.
The single-section change was verified against the previous configuration;
its rollback copy is
`~/.codex/config.toml.godprompt-pre-classifier-20261118-220430.bak`.
The currently running Codexify/GodPrompt process was **not** restarted.
