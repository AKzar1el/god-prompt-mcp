# GodPrompt — productivity replication follow-up (22 November 2026)

**Verdict: PRODUCTIVITY ADVANTAGE NOT PROVEN.** This is a follow-up
engineering/evidence review, not a fifth genuine coding-agent A/B pair.
We recovered a working Codexify bridge and a pinned isolated GodPrompt
review checkout, verified an authenticated model runner, attempted real
tool-using coding, and stopped at the receiving host's execution-policy
boundary. We did not bypass policy.

## Effective runner checks

- Working GodPrompt source commit f1727584f9007fbb678d167f356e7aab15c23787
  is the existing unmerged PR #246. The isolated review branch is separate;
  source checkout, production MCP and other worker worktrees were untouched.
- The original Ubuntu WSL2 runtime cannot start here: **nested
  virtualization not supported**.
- Locally cached Codex CLI 0.171.0 starts on native Windows with existing
  ChatGPT login, no API-key environment variables.
- GPT-6.1 Sol / High read-only smoke: the model ran, but its attempted shell
  read was **blocked by policy**. It could not see the file.
- GPT-6.1 Sol / High requested workspace-write in a new independent ignored
  repo with deliberately broken arithmetic. Shell and patch tool attempts
  were denied by the receiver's policy (read-only sandbox / rejected by user
  approval settings). No file changed, although Codex completed the turn
  and exited zero.
- The latter session reported 131,034 input tokens, 127,872 cached input
  tokens, 575 output tokens. These are not a monetary bill or a productive
  session. Original stdout JSONL stays only in the ignored real-runs area.
- The authenticated-browser fallback failed because its local browser
  runtime component was unavailable.
- **No valid new paired or three-arm agent coding results exist** from this
  environment. Neither exit status zero nor an agent's promise proves tool use.

## Evidence safeguards

- benchmarks/agent-ab/real-repos/session-evidence.mjs parses native Codex
  JSONL including PowerShell 5.1 UTF-16LE and UTF-8 BOM. It detects
  incomplete/failed sessions, absent successful tool events, explicit
  host-policy denials in captured stderr, and restricts reads to ordinary
  files in the ignored benchmark directory.
- tests/agent-ab-session-evidence.test.mjs covers tool-less completed turns,
  denied tools, failed commands, real shell/file events, malformed and
  incomplete receipts, usage aggregation, and Windows encoding.
- The actual saved Windows JSONL is **NO_SUCCESSFUL_TOOLS**, with the
  expected nonzero validity-gate exit status. Host policy error messages were
  printed outside that stdout JSONL; we did not fabricate error events.
- Even passing this preflight would not establish correct edits, matched
  model/effort, independent hidden grading, or causal productivity.

## Retrospective four-pair reanalysis

Data: benchmarks/agent-ab/real-repos/retrospective-four-pairs-20261121.json
is **post-experiment transcribed data, not a new holdout**. Calculation:
node benchmarks/agent-ab/real-repos/retrospective-analysis.mjs

| Measure | Baseline | GodPrompt-guided |
| --- | ---: | ---: |
| Frozen hidden checks | 59/59 | 59/59 |
| Total session time | 1,149 seconds | 1,044 seconds |
| Reported tokens | 1,809,589 | 2,374,401 |
| Tasks won on speed | 2/4 | 2/4 |
| Known post-hoc compatibility regressions | 0 identified | 1 identified |

Observed runtime reduction: **9.14%**. But only four selected tasks from
three repositories were measured, with two tasks sharing a repository.
The exploratory two-sided **exact sign-flip p = 0.75** both by task and by
repo-cluster aggregation, under exchangeability assumptions that may not
hold. Exhaustive resampling of 256 four-task draws yields a **descriptive**
2.5–97.5% runtime-change range of roughly **-20.5% to +8.4%**. This is
NOT a population confidence interval; slower outcomes remain plausible.

Reported tokens **increased 31.21%** overall and in three of four candidate
arms. The analogous descriptive resampling range is approximately
**+3.5% to +73.9%** reported tokens. Tokens are not verified bills.

The candidate received extra **pre-session guidance from the actual MCP**,
not dynamically callable in-session GodPrompt tools. The existing Searcharis
bounded-reader frozen grader missed a GodPrompt candidate newline
compatibility regression (detected in an independent post-hoc review).
No causal effectiveness claim is justified by these records.

## Next credible experiment

1. Restore an *authorized* sandbox environment, proving successful shell
   read/edit and a workspace-only write while denying parent writes.
   Never bypass host approval with unrestricted execution.
2. Freeze 10–20 previously unused tasks across unrelated repos/languages
   with pinned SHAs, independent hidden graders and compatibility checks,
   explicit permissions, bounded time and randomized order.
3. Run matched baseline, pre-injected guidance and true **live in-session
   GodPrompt MCP** arms with the same effective model/effort and tool access.
   Save actual tool events, attempted/denied actions, model/cached tokens,
   elapsed time, source diffs and independent grader outcomes.
4. Measure time-to-accepted-correct-fix, quality/regressions and token/monetary
   resources; do not adjust tasks or hidden checks after a model sees them.
5. Claim productivity only if repeated unrelated work shows a meaningful,
   stable, preregistered improvement without unacceptable quality or cost.

**Release hold remains:** no production merges, publishes, deploys, hot
reloads, worker restarts or paid provider API-key calls were performed.
The four original paired trials were not modified.
