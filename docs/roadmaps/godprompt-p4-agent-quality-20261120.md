# GodPrompt P4 — agent-quality tools (staged engineering milestone)

Date: 2026-11-20. Branch: feature/godprompt-p4-agent-quality-20261120.

## Mission and non-goals

Add five stateless, bounded, read-only MCP diagnostics shared between hosted Worker and stdio:

1. audit_agent_trajectory: repeated failures, stale verification, scope drift, premature completion.
2. trace_change_impact: caller-supplied dependency graph, affected requirements, greedy test coverage and receipt gaps.
3. review_mcp_tool_contracts: annotation inconsistencies, sensitive unbounded parameters, behavioral description gaps.
4. audit_agent_instructions: duplicated and potentially contradictory policies; all source documents are untrusted data.
5. design_adversarial_tests: bounded negative/boundary/metamorphic/property/trust-boundary case suggestions.

All inputs are caller-provided. No repository browsing, remote fetching, command execution, model calls, storage, workflow interruption, or deployment authorization are added. Contradictions are possible signals, not proven violations. Do not log or repeat raw prompts, tool logs, credentials or policy bodies.

## Prior art and licenses

- Fission-AI/OpenSpec (MIT): requirement-to-scenario and implementation traceability concept.
- Aider-AI/aider (Apache-2.0): graph-style relevance and bounded context ranking idea.
- promptfoo/promptfoo (MIT): frozen assertions and negative test design.
- UKGovernmentBEIS/inspect_ai (MIT): trajectory and evidence-oriented evaluation model.
- agent-lens/agent-lens-bench (Apache-2.0): trajectory quality dimensions and side-by-side comparison.
- ast-grep/ast-grep (MIT): optional future structural analysis, no runtime dependency.
- oraios/serena (GPL-3.0-or-later): conceptual symbol/navigation inspiration ONLY. No code copied.
- ethz-spylab/agentdojo (MIT), SWE-bench/SWE-bench (MIT), AgentLens: future external benchmarks; none downloaded or reused as code/datasets here.

The 12 cases in tests/agent-quality-holdout.test.mjs are original, synthetic, independently specified probes; they are not claimed to come from AgentDojo, SWE-bench, or actual agent traces. Existing 74-case public-toolkit fixture set remains unchanged as regression baseline.

## Engineering gates

- Deterministic typed tool inputs, read-only annotations and bounded outputs.
- Node 22/24 build, full tests, malformed-input tests, privacy canaries and real Worker tools/list/tools/call.
- Installed npm tarball must contain the five new compiled modules and the stdio smoke test must list 22 tools.
- Exact-head GitHub CI and packaging checks before any merge; external 74-case benchmark remains unchanged.
- The existing compare_evaluation_runs now reports exact two-sided McNemar p, a clearly labelled approximate 95% paired-difference interval only at n>=20, and median paired duration/cost deltas. These are descriptive on unverified input, not causal productivity proof.

## Release boundary

Staged code is not yet published. Current public v1.2.1 has 17 tools; this branch has 22. An immutable coordinated version bump, reproducible package, version sync, hosted runtime checks, npm and registry release must be reviewed separately before claiming public availability. Codexify live services are not restarted.

After P4 acceptance, proceed with unpublished combined OpenAI Skill + remote MCP preview and only then Docker/GHCR image verification/publication. Do not combine releases or imply a plugin portal submission without independent approval.
