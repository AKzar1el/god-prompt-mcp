# GodPrompt V18: matched failing-checkpoint recovery experiment

**Date:** 2026-11-23
**Status:** Completed six original, genuine model runs; **NO-GO for production promotion**
**Research branch:** `research/godprompt-v18-matched-checkpoint-20261123`
**Stacked parent:** [draft PR #260](https://github.com/AKzar1el/god-prompt-mcp/pull/260), commit `c6030dcc15066a32abfe9ce18ce07dbbf3db07e1`

## Decision

**There is a promising small directional signal, not a proven repeatable productivity gain.** On three new independently reported Python defects, both conditions completed all three fixes correctly. The guided condition took **539.340 seconds** total versus **582.702 seconds** for the ordinary baseline, a **7.44% improvement in original elapsed wall time**. The predeclared threshold for meaningful improvement was **at least 15%** without correctness regressions, and the study has only one attempt per condition per task. Input-token use went the other way: **1,084,441** guided vs **851,004** baseline (**27.43% more**). These model-reported totals include cached input and are not verified billable usage.

No production change, npm release, service restart, GitHub merge, or upstream issue response is authorized.

## All original matched checkpoint results

| New public upstream issue | Untreated baseline | GodPrompt-guided intervention | Correctness |
|---|---:|---:|---|
| [pytest #15335](https://github.com/pytest-dev/pytest/issues/15335) — `Decimal('NaN')` raises instead of comparing unequal with `approx()` | 217.305 s | **179.255 s** | Both **13/13 hidden**, 3/3 native |
| [AnyIO #1486](https://github.com/agronholm/anyio/issues/1486) — helper task spawned into already-cancelled group isn't cancelled | **230.244 s** | 234.131 s | Both **6/6 hidden**, 3/3 native |
| [Rich #4264](https://github.com/Textualize/rich/issues/4264) — cell splitting detaches Unicode combining marks and emoji clusters | 135.153 s | **125.954 s** | Both **19/19 hidden**, 3/3 native |
| **Total elapsed time, all attempts** | **582.702 s** | **539.340 s** | **3/3 accepted per condition** |
| **Seconds per accepted fix** | **194.234** | **179.780** | No difference in accepted count |
| **Model-reported input tokens (including cached)** | **851,004** | **1,084,441** | Not billable-cost attestation |
| **Actual GodPrompt MCP calls** | **0** | **3** | Exact calls verified from raw JSONL |

The individual elapsed differences are **-38.050 seconds** for pytest, **+3.887 seconds** for AnyIO, and **-9.199 seconds** for Rich (negative means guided faster). The same source and tests, a single randomized treatment assignment per task, and a genuine tool call make this a more meaningful intervention pilot than V17; they do **not** imply the effect will replicate on unseen defects.

## Frozen experimental design and validation

- Three externally reported, independently reproduced real defects were selected before observing any arm's outcome. All source files and preexisting native regression tests were byte-identical between matched clones and pinned by upstream revision and SHA-256. No agent could edit or delete the frozen tests. One first-run model attempt per arm, with no retry or postflight promotion.
- The ordinary baseline ran with **no enabled MCP servers**. The guided condition was required to invoke exactly one local `godprompt.get_tailored_guidance` call with **`task_type=DEBUG`, `phase=execute`, `compact=true`, `max_chars=600`**, **before the first source edit**. All **three completed calls and exact arguments** were independently reconstructed from original Codex native JSONL; no extra tools were called.
- Both conditions requested Codex CLI **0.171.0**, `gpt-6.1-sol`, high thinking effort, offline workspace-write sandbox, identical native test commands and allowed source-file scope. Requested identity/effort and model token accounting are not independent attestation.
- The run order was blocked-randomized before model execution using seed `52992aa4028d4b1fbea1fed40f26414e`: pytest baseline then guided; AnyIO baseline then guided; Rich guided then baseline.
- Fixed task caps: **300 s** pytest, **420 s** AnyIO and **300 s** Rich. No first-run timeouts, policy denials, unexpected file writes, missing MCP calls, grader errors, or invalid outcomes occurred.
- Before freezing, untouched checkpoint hidden behavior scored **pytest 5/13**, **AnyIO 2/6**, **Rich 9/19**. For each issue, **two structurally different researcher-authored reference solutions** passed all hidden checks (**13/13**, **6/6**, **19/19**) and the three frozen native regression tests; an intentionally flawed mutant failed both. The entire hidden checker calibration was repeated **three times per variant**, identically.
- One candidate was **rejected before study freeze**: a preserved V17 AnyIO partially repaired snapshot unexpectedly passed the new native regression, making it an invalid failing checkpoint. It was archived privately, then replaced with the reproduced open AnyIO #1486 source. This choice was made **before** any V18 model trial, not after observing relative arm results.
- A prefreeze Rich hidden-grader error regarding *control segments* was identified and corrected before study freeze. The final frozen grader treats control segments as atomic, while ordinary grapheme splitting must preserve combining marks. No grader adjustments followed model execution.

## Evidence provenance, independent postflight and release safety

- Original model stdout JSONL, stderr and exact first-run receipts were written once under ignored `benchmarks/agent-ab/real-runs/replication-v18/receipts/`. The frozen runner will refuse to overwrite any original receipt. The raw transcripts, reference calibration patches and hidden grader were **not committed**.
- Study manifest SHA-256: `7583270dfca93665581a308d3bc3b180ad27767dec361868809c2d0ecd2ec4f3`. Frozen runner SHA-256: `cc96023860094be631e962029b760ade66c18ab9b747aa643b46e7d37739eea4`. Private grader SHA-256: `1b8bdf3ccf4e0a43e990b94223d80d39058ac6ef46d1914ffe25d2a125642b86`. Live GodPrompt stdio artifact SHA-256: `1024943fc2ece7743c5cde9a3b1485396ec37e43fd694d25ae6c6b6ee91fe51b`, unchanged.
- A separately implemented **read-only `v18-secondary-audit.mjs`** reconstructed the original model event chronology, tool-call arguments, original SHA-256 receipts, raw stdout and stderr hashes, pinned source revisions, Git changed-file scopes and full-denominator arithmetic. No unexpected modifications or missing original-file inventories were detected.
- Public `v18-public-results-20261123.json` contains six sanitized original results and SHA-256 receipt identities. Portable `v18-verify-public.mjs` independently verifies all six hard-coded original status/time/receipt identities and recomputes aggregate metrics; integrity/tamper tests reject omissions, invented MCP calls, altered timings, forged hashes, quality upgrades and misleading production claims.
- The live stdio binary and npm publish payload are not modified by this study. Release, merge, deploy, restart and default-guidance updates remain **NO-GO** pending real independent replication.
- Final QA: full npm test **461 passed, 2 skipped, 0 failed** (463 total); npm package dry run **24 publish files and zero private research artifacts**, live stdio hash unchanged.

## What this experiment does **not** prove

1. **Three paired bugs, one trial per condition** is far too small for reliable statistical inference. Faster performance on two tasks with a narrow loss on one is not a repeatable population benefit.
2. No **independent blinded human reviewer** adjudicated the benchmark's private grader, references, mutants or accepted repairs. Correctness evidence is native executable behavior under same-author-designed checks, not independent peer approval.
3. The intervention is **generic compact process guidance** invoked through a real MCP tool, not source-aware automated root-cause diagnosis. The elapsed-time effect combines tool overhead, prompt differences and stochastic agent choices; it cannot be attributed entirely to the text itself.
4. Model-reported input usage includes cache and is not the same as paid/billable token cost. The guided approach used substantially more reported input, a significant negative efficiency guardrail.
5. Both arms were eligible because source was genuinely RED. These are genuine externally reported defects but not blinded, independently sampled failed-agent work states.

## Next decision

Preserve this **research-only draft**. Do not merge or deploy guidance changes. A credible *V19* would preregister **12–20 new failure checkpoints across at least 3–5 repositories**, use truly independent graders or blinded human adjudication, compare one real context-specific diagnostic versus baseline and/or compact generic guidance, randomize order, and then replicate any positive result on a second unseen cohort. Require a meaningful **at least 15% improvement in wall time per accepted fix**, no quality regression, and acceptable measured token/cost overhead before considering production.

**Outcome:** V18 completed end-to-end and demonstrated **three authentic GodPrompt MCP interventions**, all paired fixes correct, a small speed-direction signal, and clear additional cost/context overhead; no statistically supported repeatable gain or production readiness.
