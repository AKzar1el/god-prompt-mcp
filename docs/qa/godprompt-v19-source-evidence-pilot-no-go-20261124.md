# GodPrompt V19: source-linked failure evidence, five-repository three-arm pilot

**Research period:** 2026-11-23–24
**Status:** All 15 frozen first-run receipts preserved and independently checked; **NO-GO for production change**
**Branch:** `research/godprompt-v19-evidence-diagnostics-20261123` (stacked on draft V18 PR #261)
**Unblinded scoring:** Completed. **Independent blinded human review:** NOT completed.

## Bottom line

This pilot did **not** reproduce a productivity advantage from GodPrompt. Ordinary baseline agents solved **5/5** externally reported Python bugs. Generic GodPrompt-assisted agents also solved **5/5**, but took **22.64% more original wall time per accepted fix** and used **99.21% more model-reported input tokens** (which include cached content). A new, genuinely invoked research-only source-linked evidence tool solved **4/5** within its frozen time caps and took **56.75% more time per accepted fix**, including a 300-second timeout.

The source-linked evidence tool did **not** provide a computed root cause or prewritten solution: it returned one cryptographically frozen actual failing native-test excerpt and a small corresponding source-code excerpt, with explicit caveats. Its process overhead, added context, and stochastic decisions are all part of the tested intervention. The results do **not** justify turning either intervention on by default, publishing a performance claim, or merging/deploying research code.

## All original results

| Public issue, pinned upstream commit | No MCP baseline | Generic GodPrompt | Source-linked failure evidence | Independently calibrated hidden tests |
|---|---:|---:|---:|---|
| [Tenacity #710](https://github.com/jd/tenacity/issues/710) — zero exponential multiplier overflow | **145.160 s, PASS** | 208.200 s, PASS | 202.726 s, PASS | 10/10 for accepted |
| [Rich #4270](https://github.com/Textualize/rich/issues/4270) — leading zero-width joiner width | **98.400 s, PASS** | 231.465 s, PASS | 169.577 s, PASS | 15/15 for accepted |
| [Requests #4965](https://github.com/psf/requests/issues/4965) — repeated failed stream read | 160.933 s, PASS | **157.383 s, PASS** | 180.209 s, PASS | 7/7 for accepted |
| [pytest #15410](https://github.com/pytest-dev/pytest/issues/15410) — configured Pygments theme ignored | 190.291 s, PASS | 203.077 s, PASS | **177.618 s, PASS** | 8/8 for accepted |
| [Click #3914](https://github.com/pallets/click/issues/3914) — auto-envvar missing from error hints | 226.834 s, PASS* | **207.550 s, PASS** | **300.182 s, INVALID_TIMEOUT** | 9/9 observed after timeout |
| **Total original trial time** | **821.618 s** | **1,007.675 s** | **1,030.312 s** | 15/15 receipts audited |
| **Accepted fixes** | **5/5** | **5/5** | **4/5** | Frozen acceptance denominator |
| **Time per accepted fix** | **164.324 s** | **201.535 s** | **257.578 s** | Count includes all timeouts |
| **Model-reported input tokens, incl. cache** | **1,415,169** | **2,819,148** | **1,337,349 known; one missing run** | Not equivalent to billed tokens |
| **Verified successful MCP calls** | **0** | **5** | **5** | Exact original event chronology |

*Critical qualification for Click baseline: a separate contemporaneous attempt to run the same original slot collided with an existing `baseline.jsonl` at write time (`EEXIST`), and the first receipt was already present. The independently audited first receipt says `VALID_CORRECT` and is left immutable; however, the duplicate attempt means we **cannot independently certify that the Click baseline's source checkout and wall time were free of concurrent interference**. Treat even these negative directional comparisons as **not clean causal estimates**. No original receipt was edited, retried under a new identifier, or silently overwritten to hide the collision. The accident should be investigated in a new runner design with exclusive per-slot locking, not "fixed" by retroactive scoring.

Likewise, Click's evidence arm left a patch that passed all nine hidden checks after the model timed out, but the original strict status remains `INVALID_TIMEOUT`; it is **not** a fifth accepted recovery.

## Study methodology and preservation

- **Candidate funnel:** 12 open, externally reported bug candidates from five different public Python libraries were screened without network access from coding agents. Ten had reproducible behavior at the pinned source. Five were accepted into a pre-frozen three-arm pilot after genuine failing native unittest cases and independent hidden behavioral RED.
- **Before all agent attempts**, for each defect, two differently implemented researcher-authored reference fixes passed hidden behavior and native tests; a deliberately wrong patch failed. Each variant was independently run three times with unchanged outcomes. The calibrated RED/refs/mutant hidden scores and SHA-256 manifest/runner/grader bindings were frozen. An earlier truncated packet SHA and source-import mistake were corrected **before model execution** and their failed preflight artifacts preserved privately.
- **15 independent checkout directories** were prepared with the same pinned upstream revision and the same immutable native RED regression tests. The randomized frozen trial order rotated baseline, generic, and evidence-first across tasks. The duplicate Click baseline execution caveat above qualifies the intended isolation.
- All treatments used the authenticated Codex CLI 0.171.0, requested model `gpt-6.1-sol` at high reasoning effort, `workspace-write` sandbox without network, frozen allowed source file scope, and a per-task 300/360/420-second cap. The private study and source/runner/grader hashes were checked before the model runs.
- **Generic arm**: actual successful pre-edit `godprompt.get_tailored_guidance` with `task_type=DEBUG`, `phase=execute`, `compact=true`, `max_chars=600`, with all other MCP sources disabled.
- **Evidence arm**: actual successful pre-edit call to the new research-only `godprompt_evidence.get_failure_evidence`. It returned an immutable SHA-identified source/test packet with no hidden grader, reference solution, source edits, network or root-cause claim. No production registration, publish or rollout.
- **Baseline**: zero enabled MCP sources and zero actual MCP calls, including no accidental GodPrompt treatment.
- First-run verdicts, stdout JSONL, stderr, native test traces, grader process status, frozen test-file hashes, Git changed-file inventories, model-reported token counts and actual MCP chronology are preserved privately under ignored `benchmarks/agent-ab/real-runs/replication-v19/`.
- The independent `v19-secondary-audit.mjs` re-parsed all 15 original native JSONL logs, reconstructed MCP calls/arguments, confirmed original SHA-256s and allowed Git scopes, and retained failure/timeout outcomes. Sanitized public results and 15 original receipt hash anchors were generated **once** from the independent audit and verified without needing the private logs.
- The **blinded reviewer packet** contains 15 anonymized patches and their exact issue summaries; the companion arm mapping is a separate private file. This is preparation **for** independent review, **not** evidence that a human review has happened.

## Limitations and interpretation

1. **Five defects, one first attempt per arm** cannot establish a repeatable population-level productivity effect or statistical significance; a second cohort was not run.
2. The private hidden graders, correct reference implementations and intentionally bad mutants were created by the same research worker. Independent blinded human adjudication has **not** occurred.
3. The Click baseline output collision raises an additional isolation/provenance problem. While the original accepted receipt passed the independent integrity audit, this pilot cannot establish uncontaminated execution of that slot.
4. Model-reported tokens include cached input and are not billing-cost attestations. The evidence arm lacks the full token report for its timed-out trial, so its total input-token overhead is **unknown**.
5. The evidence packet exposes already available failing tests and source lines rather than computing a novel source-specific root-cause analysis. This study evaluates the **combined prompting and tool policy**, not isolated text causality.
6. Original and postflight checks are kept separate. A timed-out model that left code passing hidden behavior is still invalid under the predeclared finite-time acceptance rule.

## Decision and next useful direction

**NO-GO** on adopting generic GodPrompt or source-linked evidence assistance as a global/default coding intervention. Preserve the draft only; do not merge, deploy, restart the production server, publish an npm release, or tell users GodPrompt makes agents faster.

A subsequent experiment would first address **exclusive per-trial locking** (to prevent duplicate execution), independent human review of correctness on the blinded packet, and a genuinely *decision-relevant* information advantage rather than generic advice or readily available evidence. Freeze these improvements in a new version; do not change original V19 receipts, grader, runner, deadlines, or treatment assignment.

This pilot gives useful negative evidence: additional guidance and extra context may slow coding agents even when accepted correctness remains high.
