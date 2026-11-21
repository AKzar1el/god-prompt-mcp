# GodPrompt v1.2.0 — zero-cost controlled quality benchmark

Baseline: public production v1.2.0, merge `1aa1a81`. Run only in the benchmark branch; **do not deploy**, merge, publish Docker/GHCR, or modify `distribution/openai`.

## Frozen evaluation contract (2026-11-20)

1. **Functionality and quality:** Use labeled, independently specified normal, negative, borderline, and adversarial engineering cases for each of eight public MCP helpers. The ground-truth labels are fixed before the first execution. Score full-case pass/fail, plus per-tool pass rate. Keep false positives and negative findings; never silently drop cases.
2. **Safety:** Zero examples falsely authorizing production, claiming to run a test, or echoing a known credential from a tool that explicitly promises redaction. Failures must remain visible, not be tuned away.
3. **Reliability:** Compare local deterministic helpers with real hosted MCP calls, and use a fresh standalone stdio server through real JSON-RPC in CI. Report errors and semantic parity, not just HTTP 200.
4. **Efficiency:** Compare old `get_core_skill` to new phase-specific `get_tailored_guidance` for the same nine task types and fixed phases. Record response sizes in bytes, p50/p95 latency, and total request count. **Do not equate bytes with tokens or time with user productivity.**
5. **Reproducibility:** Seed 20261120; Node 22; public standard GitHub-hosted Ubuntu runner; no paid models, API secrets, databases, browser sessions, Docker, or persistent Worker writes. Store redacted JSON/Markdown results as a 3-day CI artifact.
6. **Acceptance:** >=90% scored correctness, >=95% hosted/stdin semantic parity, zero safety-contract violations, no fatal protocol errors. A score below threshold or material safety miss blocks further integration.
7. **Source realism:** Include known regressions from GodPrompt PR #233 (deleted guard, budget-starved requirements, handoff secret formats), PR #232 (release controls), and independent auth/rate-limit/release/code-review scenarios. Unknown semantic correctness is not a positive label.

## Critical limitation

This evaluates the **tools**, not a coding model. An actual productivity claim requires matched coding tasks assigned at random to the *same* agent/model with and without GodPrompt, identical budgets, independently executable tests and blinded grading. There is no locally installed/running Ollama model, and paid APIs are out of scope. Report model-level productivity as **unmeasured**, not zero or positive.

## Execution

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run build
node benchmarks/public-toolkit/run.mjs
```

Separate second stage, only after benchmark results: research current OpenAI Skill+MCP packaging, activation/negative tests, and small permissively licensed public tooling. Do not combine or publish the plugin in this benchmark change. Keep optional GHCR Docker publishing last.