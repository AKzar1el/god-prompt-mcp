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

## Continued pre-release hardening: round 3 (2026-11-21)

This new evidence comes **after** the previous PR candidate at `3e070c5`.
The earlier 176-case results above remain historical measurements.

- Added `benchmarks/classifier-hardening/adversarial.json`: **70 newly
  labeled** cross-workflow, shipping-safety, negation, UI/API, plan and
  test-writing cases. First run against the prior candidate:
  **54/70 (77.14%)**. Some shipping-readiness questions such as
  "Should we deploy this release?" were incorrectly categorized as
  `SHIP` rather than `ANALYZE`. This is a tool-routing/decision-support
  error, not evidence that GodPrompt actually executes shipping actions.
- Added action-intent guards and a bounded shipping-assessment detector.
  The additional **70/70** cases and previous **176/176** cases now
  agree with their labels: **246/246 tuned regression cases**.
  Because the new cases informed refinements, this is not an unbiased
  estimate of accuracy on all real user requests.
- Reduced redundant signal matching by doing the trigger-presence and
  first-index check together, and avoiding affirmative scans for absent
  triggers. The reproducible, same-process A/B runner
  `benchmarks/classifier-hardening/compare.mjs` loads commit `3e070c5`
  and the working candidate, alternates call order and uses identical
  inputs without invoking MCP, models, network or writing files:

| Trial | Previous correct | Candidate correct | Previous p50 CPU | Candidate p50 CPU | Previous p95 CPU | Candidate p95 CPU |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 230/246 | 246/246 | 338 us | 312 us | 618 us | 605 us |
| 2 | 230/246 | 246/246 | 264 us | 242 us | 463 us | 419 us |
| 3 | 230/246 | 246/246 | 348 us | 318 us | 617 us | 581 us |

  That is a **7.7-8.6% improvement in local median classifier CPU time**
  in these three paired samples. Results are load-sensitive and are
  **not** evidence of faster coding agents or reduced model tokens.
- Real stdio transport stress at four concurrent requests, four
  deterministic text variants: adversarial **1,400/1,400**, previous
  cases **912/912**, holdout **600/600**, forward **600/600**.
  Together **3,512/3,512 labeled calls**, zero inconsistent semantic
  decisions/protocol errors/stderr. **44/44 malformed requests rejected**,
  zero privacy-canary echoes.
- The previously intermittent Codexify host observer test file passed
  **three complete independent rounds (15/15 tests)**. The earlier race
  has **not** been root-caused; repeated passes do not prove it fixed.
- Complete Windows/Node 22 source suite at test-file concurrency four:
  **293/293 passed, zero failures, 117.2 s**. After adding explicit
  1,000-character routing-input tests, targeted MCP stdio tests also
  passed **2/2**.
- A free authenticated coding-agent runner remains unavailable for
  a legitimate paired A/B trial. **Real agent success, wall time,
  tool-count and token/cost uplift are still unmeasured.**

## Observer high-load investigation and bounded recovery

The next full-suite run with file concurrency 2 reproduced a **292/293**
failure: "observer preserves UTF-8 JSONL split across its bounded read
window" received **zero** observed checkpoints instead of one.
The source showed a concrete failure mode: at its watch deadline the
observer could stop after a single 512 KiB read, even when a complete
record was already visible beyond that read window. A multibyte UTF-8
character at the boundary leaves the JSONL record incomplete until the
following read. This is a plausible explanation for the observed race,
not proof that no other timing failures exist.

The isolated observer now immediately consumes up to **eight additional
bounded 512 KiB chunks** of already-visible backlog when its deadline
expires. It does **not** extend the watcher indefinitely; it emits
`audit_backlog_incomplete: true` and exits with status 1 if that limit
is exhausted instead of presenting an incomplete audit as complete.
Only local, privacy-preserving summary metadata is emitted.

Two new regression scenarios simulate the deadline condition:
1. A UTF-8 verification record crossing the fourth read window must
   still be observed when the deadline expires.
2. A record beyond twenty windows must fail closed with an explicit
   incomplete-backlog flag and nonzero exit status.

Targeted tests following this change passed **7/7 observer tests**
and **2/2 stdio tests**. Two subsequent complete Windows/Node22 test
runs passed **295/295 each**: test-file concurrency four in **88.3 s**,
and test-file concurrency two in **247.2 s** under higher machine load.
The earlier failing UTF-8 case passed in both runs. The difference in
elapsed time reinforces that host-load measurements are noisy.

`npm pack --dry-run --ignore-scripts --json` passed for version
`1.4.2`: **23 distributable files**, including the stdio entrypoint,
with no benchmark/test fixtures. The Codexify audit observer script
is a local opt-in script, **not part of the npm package contents**.
This source-only candidate remains on release hold pending exact-head
GitHub CI and review.

## Release controls

**Not authorized/performed in this hardening pass:** merge to main; version bump; npm, MCPB, official registry, OpenAI plugin or GHCR release; live Codexify GodPrompt hot reload/restart; paid API/model calls; changes to other Codexify workers.

Update only the existing **draft PR #242** after the local checks; require its new exact-head GitHub CI to pass before considering a merge. Preserve rollback/reference history. Any later release must separately verify source SHA, artifact digest/installed consumer path, registry compatibility and live 23-tool surface before claiming activation.

**Next meaningful productivity experiment:** when a free, authenticated runner is available, use the pinned 12-task `benchmarks/agent-ab/` plan with randomized same-model A/B ordering, independent actual test graders, equal budgets, and receipts for elapsed time/token usage/tool calls. Do not substitute classifier scores for real-world agent productivity.
