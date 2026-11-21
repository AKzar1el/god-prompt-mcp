# GodPrompt v1.4.2 — pre-release task-routing hardening and efficiency QA
Date: 2026-11-21
Review branch: `fix/godprompt-automation-routing-20261121`
Review PR: https://github.com/AKzar1el/god-prompt-mcp/pull/242
Release state: **HOLD — draft PR only, no publication or live activation**

## Why this work was necessary

The v1.4.2 candidate correctly classified many task types but confused requests to **create an automation** with requests to **build dashboards/APIs about automation**, or to **fix/refactor/review** existing jobs. These misroutes can waste agent guidance/tool-selection effort or trigger unnecessary handoffs. Deterministic task routing is advisory: it is neither execution permission nor a safety boundary.

## Frozen fixtures and chronological first-pass observations

All three datasets were originally labeled before their first benchmark execution. Once their misses were examined and used to improve the router, they became development/regression fixtures rather than independent holdout evidence.

| Suite | Cases | First-pass correct | After iterative fixes |
| --- | ---: | ---: | ---: |
| `benchmarks/classifier-hardening/cases.json` | 76 | 57/76 (75.0%) | 76/76 |
| `benchmarks/classifier-hardening/holdout.json` | 50 | 39/50 (78.0%) | 50/50 |
| `benchmarks/classifier-hardening/forward.json` | 50 | 42/50 (84.0%) | 50/50 |
| **Combined, tuned fixtures** | **176** | Not a simultaneous controlled baseline | **176/176** |

These are original, human-labeled local engineering examples. They are **not an estimate of accuracy on all real-world user requests**, and the post-tuning 100% is explicitly not an unbiased held-out score.

## Implementation

Changes remain limited to `src/server.ts`, `tests/stdio.test.mjs`, and the new local-only `benchmarks/classifier-hardening/` suite.

- Match the requested action and deliverable, rather than using incidental words like `cron`, `pipeline`, `PR`, `bot` or `scheduled` as the sole routing evidence.
- Distinguish new automation work from dashboard/API/UI/documentation work *about* automation.
- Handle scheduled and recurring checks, jobs, reports, reminders, workflows, and explicit follow-up actions.
- Preserve build-versus-inspect intent for writing new code tests and testing an existing system.
- Preserve existing SHIP/PLAN/CONTENT/DEBUG/REFACTOR routes and genuine mixed-intent `ambiguous` warnings.
- No added dependencies, new MCP tools, permissions, storage, network calls or background services.

## Reproducible final-source verification

Windows / Node 22.22.2, using an **isolated managed Git worktree** and local stdio subprocess.

1. `npm run build` — passed.
2. `node --test --test-concurrency=1 tests/stdio.test.mjs` — **2/2 passed**, exercising original behavior, 176 additional cases, validation, JSON-RPC compatibility and intent mixing.
3. `node --test --test-concurrency=2 tests/*.test.mjs` — **293/293 passed**, **0 failures**, approximately **137.8 s**. Includes host-observer, hosted/stdio, packaging, evidence, benchmark and negative-control checks.
4. Final-source local MCP classifier stress: three datasets x 3 repetitions x 4 deterministic text variants (original, uppercase, whitespace variation, punctuation suffix), 2 requests in parallel:
   - Development cases: **912/912** expected labels.
   - Second cases: **600/600** expected labels.
   - Cross-domain cases: **600/600** expected labels.
   - **2,112/2,112 expected labels**, **0 inconsistent semantic outputs**, **0 transport/protocol errors**, **0 MCP stderr**.
   - **33/33 deliberately malformed requests rejected**, 0 canary reflections.
   - This is a deterministic I/O/routing stress test, **not** model-solving evidence.
5. `npm pack --dry-run --ignore-scripts --json` — passed; package version `1.4.2`, **23 included files**, stdio/server bundles present, no `benchmarks/` or `tests/` shipped.
6. `git diff --check` — passed.

An earlier parallel run against the prior v1.4.2 release candidate occasionally failed one existing Codexify host-observer assertion (292/293). Subsequent targeted host-observer 5/5 and final full 293/293 passed; the intermittent behavior has **not been root-caused**, and exact-head GitHub CI remains a required independent release gate.

## Latency/size measurements and limitations

- Local focused guidance benchmark returned a **257-byte first content chunk** versus **13,628 bytes** for the entire protocols document (98.11% fewer bytes), comparing **different content scopes**.
- Final stress response payloads were on the order of **354–390 bytes at median/p95**, depending on dataset.
- Local stdio response latency varied sharply with concurrent machine activity (single-digit ms median in quiet runs; substantially higher in some loaded runs). These samples do **not** establish improved end-to-end agent latency, model-token savings or total cost savings.
- Earlier Claude Code CLI was unauthenticated and no working local Ollama model service was available. **No free approved coding-agent A/B run has taken place.** Any claim of increased coding success rate or reduced agent time/tokens remains **unmeasured**; baseline and candidate have not solved paired real tasks.

## Release controls

**Not authorized/performed in this hardening pass:** merge to main; version bump; npm, MCPB, official registry, OpenAI plugin or GHCR release; live Codexify GodPrompt hot reload/restart; paid API/model calls; changes to other Codexify workers.

Update only the existing **draft PR #242** after the local checks; require its new exact-head GitHub CI to pass before considering a merge. Preserve rollback/reference history. Any later release must separately verify source SHA, artifact digest/installed consumer path, registry compatibility and live 23-tool surface before claiming activation.

**Next meaningful productivity experiment:** when a free, authenticated runner is available, use the pinned 12-task `benchmarks/agent-ab/` plan with randomized same-model A/B ordering, independent actual test graders, equal budgets, and receipts for elapsed time/token usage/tool calls. Do not substitute classifier scores for real-world agent productivity.
