# GodPrompt P5 — verified engineering intelligence (2026-11-20)

Goal: improve outcomes per agent run, not inflate MCP tool count.

## Scope

1. **Actual agent A/B benchmark harness:** `benchmarks/agent-ab/run.mjs` creates deterministic randomized run order and scores paired outcomes with explicit model/environment/revision comparability checks. `suite.json` contains twelve original, runnable microcoding tasks, with a deliberately broken baseline and a separate exact-case grader. No model is called by the harness; synthetic CI fixtures are NOT proof of a coding productivity gain. A real randomized agent trial remains necessary to claim that improvement.
2. **Local opt-in repository intelligence:** `godprompt-repo-map` lists static relative-import dependencies, exported symbol names, and candidate test import links. It skips symlinks, hardlinks, secrets, vendor paths and oversized files, avoids uploads and returns no raw code. Outputs are heuristic, not AST certainty or test coverage; use the graph with the existing `trace_change_impact` MCP tool.
3. **Collected evidence:** Extend existing `godprompt-proof` CLI with `pack` to collect exact-SHA GitHub check evidence (or an offline connector snapshot) and optional Codexify receipts in one local call. When sources disagree, evidence is invalidated rather than laundered as passing. No new background service or write permission.
4. **Trajectory analysis:** improve existing `audit_agent_trajectory` for redundant reads, token budget evidence, long unchecked write streaks and failed final checks. Scores remain based on caller-supplied events.
5. **Optional visual interface:** add a bounded, accessible MCP Apps view only where clients support UI resources; preserve text/structured results for all other clients. No new data store or external scripts.
6. **Efficiency and security:** benchmark token/file-bytes and transport overhead, strict schemas, negative controls, fuzzing and cross-client transport parity.

## Boundaries

No direct repository or operating-system access from the public Cloudflare Worker. A local CLI may inspect only an explicitly provided root and does not execute a task or send source to the hosted service. Do not run shell commands from a text description. All local output must be reviewed before sharing. `combinedEvidence` is unverified even when the source says `test_runner` or `tool_output`.

No GitHub PR/branch manipulation outside this P5 branch; preserve other agents and the Codexify scheduler, observe without restarting. Preserve existing Skill + MCP packaging; update it once P5 functions and outputs are verified and versioned. Docker/GHCR publishing stays last, respecting its explicit manual-only publish trigger.

## Quality gates

- Node 22/24 typecheck and full tests; repeated deterministic test runs.
- Frozen original 74-case regression set without fixture rewriting.
- Independent negative and privacy cases; no sensitive input echo.
- Real hosted/stdio list and call parity for any new public function.
- Exact-head GitHub CI and source provenance before merge; release version, registry hash and dependency audit before public publication.
- Real paired model trials with runnable test evidence before any claim of proven productivity gain.

## Milestone status

This document is the staged P5 plan. Check the PR and CI for verified implementation status. Statements here about intended gates are requirements, not evidence that an unrun model experiment passed.
