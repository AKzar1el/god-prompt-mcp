# Real public-repository GodPrompt A/B pilot (Codexify)

This is a **real coding-agent pilot environment**, not a classifier benchmark. The three tasks target real, user-owned, public GitHub repositories. Each task has two separately cloned, pinned Git checkouts and an independent, read-only Node grader. The grader does **not** call AI models, external provider APIs, network services, npm install scripts, or deployment endpoints.

**Completed pilot evidence:** [pilot-results-20261121.md](./pilot-results-20261121.md).
All three paired read-only coding-output comparisons were executed using
ChatGPT-authenticated Codex CLI through Codexify, with actual pinned GodPrompt
MCP guidance for candidate arms. Both variants passed all 24 behavioral
checks; the candidate used 28.1% more reported tokens and 14.1% more model
session time across these three tasks. **Do not equate this with autonomous
tool-using agent productivity:** Windows sandbox execution failed, so the
models returned code patches without executing tools. Three useful public
repo changes were opened as draft PRs and have green GitHub CI. No merges,
deployments, paid provider-key calls or Codexify restarts occurred.

## Pinned tasks

| Task | Repository | Type | Baseline (before agent edits) |
| --- | --- | --- | --- |
| `auvrora-template-inert` | `AKzar1el/auvrora-webmcp` | Bug: inert nested template markup must not affect SEO findings | 2/8 hidden checks pass |
| `auvrora-specific-robots` | `AKzar1el/auvrora-webmcp` | Feature: detect Googlebot/Bingbot noindex directives | 3/6 pass |
| `geo-safe-domain-errors` | `AKzar1el/mcp-geo` | Bug: bound/sanitize invalid-domain error previews | 4/10 pass |

The precise Git SHAs, task descriptions, edit allowlists and time budgets are frozen in `suite.json`. This pilot has **three tasks**, so no statistical significance or overall productivity claim is justified.

## What is prepared

The controller source is under `benchmarks/agent-ab/real-repos/`. On the user's Windows computer, Codexify has already created six **independent local Git clones** in the ignored `benchmarks/agent-ab/real-runs/trials/` directory. Each clone is on a distinct `gp-ab/<task>-<arm>` branch; baseline and candidate have the exact same starting commit. The `sources/` subdirectory contains separate read-only reference clones. No shared Git worktrees, linked object alternates, edits to main, network model calls or GitHub pushes were used to seed them.

`real-runs/` is **gitignored**, deliberately. It is not published in npm, does not survive deletion of this managed Codexify worktree, and can be recreated from the pinned public commits.

From the GodPrompt project workspace:

```powershell
node benchmarks/agent-ab/real-repos/trial.mjs plan
node benchmarks/agent-ab/real-repos/trial.mjs status
node benchmarks/agent-ab/real-repos/trial.mjs grade
node benchmarks/agent-ab/real-repos/trial.mjs score
```

The first two calls are read-only. `grade` and `score` import the target's source and validate it read-only. Only `prepare` writes: it creates **new** local clone directories, refuses to overwrite existing checkouts, and does not modify other workers. It must not be rerun on an already-prepared task without inspecting it first.

## Running the actual matched AI-agent pilot

1. Fix a single exact model and reasoning effort (e.g., GPT-6 High), fixed task time, equal Codexify tool privileges, and one independent ChatGPT/Codexify session **per arm**. No extra API purchases; do not run unapproved Claude, OpenAI API, Gemini, or other paid providers.
2. Get the next task's randomized order with `trial.mjs plan`. Example: `auvrora-template-inert` starts with baseline, while `geo-safe-domain-errors` starts with candidate. Keep the order; do **not** cherry-pick after seeing which result works.
3. Generate the exact arm prompt: `node benchmarks/agent-ab/real-repos/trial.mjs prompt auvrora-template-inert baseline` (or `candidate`). Give this prompt to a **fresh independent** coding-agent session using Codexify. Verify that session has tool access, the assigned local checkout, branch, and task SHA before allowing source edits. Do not paste the private grader source into either arm; do not load a sibling arm or earlier solution. If the receiving session cannot access the assigned checkout using its explicitly authorized Codexify workspace, stop that arm and reconcile its workspace—do not bypass a project safety boundary.
4. **Baseline:** use Codexify for ordinary coding work without GodPrompt's MCP/Skill/guidance. **Candidate:** use Codexify to call `godprompt-probe.mjs <task-id>`, which invokes the **unreleased local GodPrompt stdio MCP** (`get_version`, `classify_task`, and scoped execute/verify guidance). Log returned source SHA and guidance receipt. This is actual MCP use, not merely code inspection. It does **not** test native automatic MCP-tool discovery or a globally reloaded Codexify source. Do not call the live old GodPrompt source as a substitute. If routing looks wrong, record it as a product defect rather than tuning away the failure.
5. Both arms may edit **only** their own approved source/test paths. Do not give the agent the hidden grader. The agent may run the repository's ordinary local tests if permitted; do not deploy, publish, push public changes, or touch unrelated agents.
6. After each arm finishes, independently run `trial.mjs grade`. The grader checks commit identity, allowed file changes and hidden behavioral assertions. Preserve the agent's actual session id, effective model/effort, start/end times, observed tool-call count, known token usage (nullable), version of GodPrompt used (candidate), Codexify session transcript/audit reference and result. Never invent costs or token counts.
7. Run `trial.mjs score`. This deliberately produces only an **objective code-grade comparison**, not a causally verified productivity number, until independent session/effective-model/cost/time receipts have been joined and reviewed. One task or three tasks cannot establish a general improvement; expand to 10–20 distinct real tasks with multiple orders before interpreting an uplift.
8. Once both arms are graded, compare the independently passing patches. Preserve the superior minimal implementation on a **reviewable local public-repo branch**; after review, optionally open a draft GitHub PR to the user's own public repository. Do **not** automatically merge or publish a release.

## Current runner/cost readiness

- **Codexify** is connected, but its `agents` CLI discovers the existing host connection; it is **not itself a separate LLM agent runner**.
- `claude.exe` is installed but was unauthenticated in the previous check; do not attempt paid API calls.
- Ollama is installed but its model service is not running; Codex CLI was not present in the PATH.
- At the time of this **original three-task read-only pilot**, no independent tool-using agent trials had been performed on these six checkouts. Subsequent, genuinely tool-using sessions on **four different frozen tasks** are recorded separately in docs/qa/godprompt-real-tool-using-agentic-ab-20261121.md and docs/qa/godprompt-cross-repo-agentic-v3-20261121.md. Neither the old read-only pilot nor the later four pairs establishes a general productivity saving.

### Evidence gate and retrospective analysis (22 November 2026)

Before counting **any new** coding-agent session, verify it used real tools:

~~~powershell
node benchmarks/agent-ab/real-repos/session-evidence.mjs benchmarks/agent-ab/real-runs/my-session.jsonl --stderr benchmarks/agent-ab/real-runs/my-session.stderr.txt
node benchmarks/agent-ab/real-repos/retrospective-analysis.mjs
~~~

The receipt parser reads regular files in the ignored real-runs/ tree only, including Windows PowerShell 5.1 UTF-16LE captures. It rejects incomplete turns, missing successful tool calls, and explicit policy-denial messages in captured stderr. Exit code 1 means **not a valid tool-using trial**, even if the Codex process itself exited successfully. Exit code 0 verifies **observed tool use only**: still verify actual source changes, frozen grader outcome, execution policy, effective model and effort, and timing. Preserve **stdout and stderr separately**, without secrets. Do not use this gate alone as an effectiveness score.

The four-pair analysis is deliberately retrospective, based on fixed published records rather than new holdouts. Its exact sign-flip calculations and exhaustive task resampling are **exploratory**; do not interpret a descriptive resampling range as population confidence or a metered-cost estimate. See docs/qa/godprompt-productivity-followup-20261122.md for this environment's actual Windows tool-policy failure and the follow-up gate.

### First genuine GodPrompt MCP functional calls (before agent trials)

The controller actually started the **unreleased** GodPrompt stdio server at
source commit `ea72ac09e20b83c86d1b568533dd08e68341ba89` and called its
`get_version`, `classify_task` and tailored execute/verify guidance for all
three real public-repository task descriptions. The server reported version
`1.4.2` and responded without paid model calls.
On its separate benchmark branch, the probe refuses changes to the candidate
implementation relative to the pinned code commit and records SHA-256 digests
of the compiled stdio/server modules for later runtime identity checks.

| Task | Intended workflow | Actual GodPrompt route | Finding |
| --- | --- | --- | --- |
| Auvrora inert-template bug | DEBUG | ANALYZE (78%) | Misrouting; useful independent regression candidate |
| Auvrora bot-specific robots feature | BUILD | ANALYZE (72%) | Misrouting; feature work needs building |
| MCP-GEO bounded validation errors | DEBUG | DEBUG (78%) | Correct routing |

These are **actual MCP behavior observations** from practical tasks, not
source-code inference or an A/B model productivity experiment. In particular,
do not tune the task prompts to hide misroutes while scoring the original
candidate. The proposed next step is a separate classifier refinement
using these observed task descriptions, *after* preserving this first-pass
functional evidence. The old Codexify live 23-tool source has not been
reloaded; the separate stdio probe accesses the exact unreleased candidate.

## Scope and integrity limitations

These tasks and grading criteria are authored by us, not blinded by a third-party evaluator; fixing the same tests used to choose the tasks can overestimate generalization. The two conversations must not share solution content. The local filesystem is not a security sandbox: discipline/authorization and Codexify's effective workspace guard matter. The suite is pinned by a hash over its **entire** JSON contents so changes to wording, reference commits or budgets invalidate prior trial IDs. Grader hashes are integrity receipts, not cryptographic signatures or proof of which model did the work. No automated expiry or destructive cleanup is installed.
