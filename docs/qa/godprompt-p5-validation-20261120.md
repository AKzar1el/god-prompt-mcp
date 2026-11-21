# GodPrompt P5 — quality and release acceptance record

Date: 2026-11-20. Branch `feature/godprompt-p5-intelligence-evidence-20261120`. Draft PR #238.

## Implemented components

- Real-task **benchmark protocol** with deterministic paired order and scoring; twelve original runnable microtasks. Each *broken* reference fails its selected verification case. The harness DOES NOT call an agent and DOES NOT establish that GodPrompt improves coding accuracy, throughput, speed, or costs.
- `godprompt-repo-map` opt-in local Node CLI: bounded static JS/TS imports/exports, skipped private data, symlink/hardlink and path checks. No execution or network.
- Existing `godprompt-proof` extended with `pack`: exact-SHA GitHub evidence + optional Codexify receipt adapter; contradictory receipts remain unverified.
- Existing `audit_agent_trajectory`: reported token budget, redundant reads, unchecked changes and failing final check.
- `ui://godprompt/evidence-review.html` optional MCP Apps static read-only UI resource for existing trajectory and impact tools; no new public tool and no network from the UI. Structured and text outputs remain available.
- Task/phase-specific tool suggestions, independently tested 74 frozen scenario regressions, synthetic negative/security tests and local microbenchmark instrumentation.

## Regression, privacy and transport gates

Mandatory checks: Node 22 + Node 24 `npm test`, TypeScript typecheck, P5 security fuzz and output canaries, 74/74 frozen primary cases, deterministic local benchmark scaffolding, installed npm tarball allowlist, real hosted `tools/list`/MCP preview parity (22 tools), package/MCPB checks and Docker stdio smoke as nonroot UID 10001.

Only GitHub CI with the exact candidate commit can establish these checks. The current v1.4.0 candidate's built normalized MCPB SHA-256 was measured as `9ec4ad32f0c3d890334fe59c82f04fb7716a3cb58ecbeaa60b0f5c7f11b0772c`; `server.json` must match this hash. New QA docs and tests do not belong inside the MCPB.

## Boundaries of reported value

- 12 failing reference microtasks prove the grader catches their current bugs; this is not a controlled A/B coding-agent productivity result.
- Static import edges do not establish semantic call graphs or test coverage.
- Host-provided event metadata and GitHub/Codexify receipt exports are unverified until independently correlated to authenticated execution.
- All tools remain advisory. The hosted Cloudflare Worker does not scan source, access local files, execute tests, store agent logs, or grant completion/deployment permission.
- Optional Skill + MCP package source can be shipped and checked in CI. The OpenAI directory listing is still a separate human-reviewed submission; an install-and-activate model trial must occur before claiming live plugin behavior.
- Docker/GHCR new-image publication is manual-only and **last**, not a side effect of main push; a green Docker smoke does not imply a pushed registry tag.

## Validation references

- [P5 PR #238](https://github.com/AKzar1el/god-prompt-mcp/pull/238)
- [P5 roadmap](../roadmaps/godprompt-p5-quality-intelligence-20261120.md)
- [Agent A/B benchmark](../../benchmarks/agent-ab/README.md)
- [Combined OpenAI preview validation](godprompt-openai-combined-preview-20261120.md)

This document does **not** claim every gate passed or any publication happened. Add exact HEAD SHA and workflow run references when the final release checks finish.

## P5 release-candidate CI evidence

Exact pre-hash-fix candidate commit `35cc5c2021027e7c9aced79c04a68b88efab005a` passed Node 22/24 MCP tests (including 74/74 frozen scenarios), installed npm package, combined OpenAI Skill+MCP preview with live 22-tool call, Registry metadata and non-root Docker stdio smoke. The normalized MCPB build was deterministic, but intentionally failed the previous stale metadata hash; new artifact hash above was read from that build's log. The next exact-head CI must pass **all gates including hash** before release.
