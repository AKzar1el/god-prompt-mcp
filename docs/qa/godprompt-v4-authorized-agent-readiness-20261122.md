# GodPrompt V4 - authorized coding-agent readiness (22 November 2026)

**State: three fresh public-repository tasks and nine independent arm checkouts prepared; actual live GodPrompt MCP calls made by a model; no valid new model coding productivity comparison has been completed.**

This document separates three distinct milestones: a model invoking an MCP tool, a coding agent actually editing/testing source with its own permitted tools, and a statistically supported productivity advantage. Only the first is proven in this new V4 round. Offline test harness execution must not be misrepresented as a model trial.

## Authorized execution probes

Host: Windows NT 10.0 build 19045, local Node 22.22.2, cached Codex CLI 0.171.0 authenticated through the existing ChatGPT subscription. All coding probes were run in disposable ignored repositories. No API-key environment variables were used.

| Probe | Observed result |
| --- | --- |
| Existing Ubuntu WSL2 | Nested virtualization unavailable |
| Native MXC sandbox | MXC unavailable on executor |
| One-shot legacy elevated and unelevated sandbox probes | Did not complete successfully; only owned probe sessions cancelled |
| Native Codex workspace-write | Shell read blocked by policy; patch denied as read-only/user approval settings |
| Native Codex per-session on-request approval | Same blocked-by-policy shell read |
| Authenticated Codex model plus local pinned GodPrompt stdio | Four real completed in-session MCP calls |

The Windows host configuration names the legacy elevated sandbox. We did not change the user's global Codex settings, disable approval/sandbox controls, uninstall sandbox user or firewall rules, or attempt unrestricted code execution. A completed model turn and reported token use are not proof that file tools executed. The previous draft GodPrompt PR #247 exact-head GitHub CI independently completed successfully.

Official OpenAI engineering background for the Windows sandbox and its prerequisites:
https://openai.com/index/building-codex-windows-sandbox/
https://openai.com/index/inside-the-codex-sandbox/

The next environmental action needs an authorized host/OS sandbox repair or supported execution machine, with explicit approval for any administrator setup. Before coding trials, prove that the *actual child agent* can read a harmless file, edit within its workspace, run tests, and cannot write outside the workspace. Do not evade host tool policy through an alternate tool.

## Three fresh source-pinned tasks

These repositories were not used in the previous four genuine Linux coding pairs.

| Task | Source repository / frozen HEAD | Independent hidden grading | Initial red score |
| --- | --- | --- | ---: |
| trendpulse-references | AKzar1el/mcp-trendpulse / c4ce899ab7eb75d206822c1ea5791187972ded19 | Offline Python provenance excerpt grader | 13/25 |
| pinescript-pagination | AKzar1el/ai-pinescript-auditor / db8d4d934b39ecc0b3d4a5c5f21c10b7f70fb882 | Offline mocked GitHub pagination grader | 11/19 |
| dashboard-snapshot | AKzar1el/walk-forward-crypto / 8ec32ea1ad454edd88abc5118a808c6fa764063b | Offline DOM/fetch atomicity grader | 5/12 |

The exact instructions, source SHAs, edit allowlists, reasoning level, model, time limits, randomized counterbalanced order and grader hashes are frozen in benchmarks/agent-ab/real-repos/v4-frozen-suite.json. Manifest SHA-256 is bce24d6fc0d1b73699169e5d99563f9ae889b5ac35a031fff28058cdaf7c97b1.

Each task has separate baseline, preinjected and live_mcp Git clones. All nine started on the exact frozen source SHA, zero changed source files, and the expected independent red grade. The private hidden grader source, actual raw MCP responses, model transcripts and source/arm clones are confined to ignored benchmarks/agent-ab/real-runs/replication-v4/. Only public hashes and controller/test code are committed. The three tasks cover Python, JavaScript GitHub Actions, and static HTML/JavaScript. This is a pilot, not sufficient to claim general productivity.

## Pinned GodPrompt MCP

Source SHA: f1727584f9007fbb678d167f356e7aab15c23787. Dependencies installed from the existing offline npm cache, project-local only; npm run build succeeded. The real local stdio MCP returned get_version, classify_task and execute/verify guidance for all frozen descriptions; all three classified DEBUG. Candidate runtime/source/context hashes are in benchmarks/agent-ab/real-repos/v4-context-pins.json.

Additionally, an independent authenticated GPT-6.1 Sol / High Codex model **made actual live in-session calls** to get_version, classify_task, and get_tailored_guidance twice, all completed. We observed four real mcp_tool_call events. The private transcript is retained. It had **zero successful shell calls and zero successful file changes**: the new v4-session-gate correctly rejects it as a coding trial. MCP functionality was proven, coding productivity was not.

The baseline arm receives no GodPrompt context. The preinjected arm receives only the exact previously captured hash-checked MCP guidance in its initial prompt. The live_mcp arm must invoke the pinned MCP during its coding session; pre-injected text is not a substitute. Any arm lacking genuine successful shell and file change events is ineligible for coding productivity scoring.

## Resume once the authorized sandbox works

1. Verify the original frozen project and checkouts with node benchmarks/agent-ab/real-repos/v4-control.mjs plan and status. Do not rerun prepare over the existing arms.
2. Retrieve task prompts with node benchmarks/agent-ab/real-repos/v4-control.mjs prompt TASK_ID ARM in their specified balanced order. Use independently checked GPT-6.1 Sol / High sessions with identical tool privileges and per-arm isolated checkout.
3. Preserve stdout JSONL and stderr separately. Run node benchmarks/agent-ab/real-repos/v4-session-gate.mjs TASK_ID ARM ACTUAL_JSONL ACTUAL_STDERR. The gate proves observed tool events, not accepted code or model/cost comparability.
4. Run the independent hash-pinned offline graders via node benchmarks/agent-ab/real-repos/v4-control.mjs grade and score. Review ordinary source tests, compatibility, code scope, timing, model usage, permissions, and effective model/effort without altering the frozen graders.
5. For any broader claim, expand to 10-20 unrelated preregistered tasks and compare time-to-accepted-correct-fix, regressions and resource costs. Earlier four tasks belong to a separate retrospective dataset, not new V4 observations.

## Release boundary

No product source fixes have been merged or shipped as part of V4. No live MCP reload, service restart, worker interruption, paid provider API call, global Codex policy change or destructive cleanup was performed. This record is a draft evidence handoff, **not productivity proof**.
