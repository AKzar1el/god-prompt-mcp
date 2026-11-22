# GodPrompt V4 — independent coding productivity and MCP reliability pilot

**Date:** 22 November 2026
**Status:** Nine frozen arms completed and independently graded. Six valid coding sessions. Three invalid live-MCP treatments. **No demonstrated GodPrompt productivity advantage.** No product release or merge.

## How we tested

The experiment was frozen **before any new coding arm**. Public manifest: `benchmarks/agent-ab/real-repos/v4-frozen-suite.json`, SHA-256 `bce24d6fc0d1b73699169e5d99563f9ae889b5ac35a031fff28058cdaf7c97b1`. The three source commits and private frozen grader hashes are in that manifest. All nine source clones were checked clean, pinned, and red against their independent graders before model work:

- TrendPulse (`AKzar1el/mcp-trendpulse` at `c4ce899ab7eb75d206822c1ea5791187972ded19`): **13/25** initially.
- AI PineScript Auditor (`AKzar1el/ai-pinescript-auditor` at `db8d4d934b39ecc0b3d4a5c5f21c10b7f70fb882`): **11/19** initially.
- Walk Forward Crypto dashboard (`AKzar1el/walk-forward-crypto` at `8ec32ea1ad454edd88abc5118a808c6fa764063b`): **5/12** initially.

Each agent ran authenticated **GPT-6.1 Sol / High** using its own isolated Git clone, the same frozen task statement, a common execution adapter, 15-minute cap, and the permitted native Windows `unelevated` filesystem sandbox in `workspace-write`, with no escalation and no direct shell network. No paid API-key model calls. Baseline received no GodPrompt instructions; pre-injected received identical real pinned MCP guidance for execute/verify before starting; live treatment was required to call `get_version`, `classify_task`, and `get_tailored_guidance` for **both execute and verify** during its own session.

The implementation agent never received the private grader source, but graders are first-party, not third-party-blinded or proven physically unreadable from the Windows fallback. Model and effort were requested with CLI flags; **independent attestation of the effective server-side model and actual monetary billing is unavailable**. Outcomes are benchmark evidence, not a population estimate.

## Main A/B outcome: actual correct coding runs

| Frozen task | Baseline | Real pre-injected GodPrompt | Difference | Hidden quality |
| --- | ---: | ---: | ---: | --- |
| TrendPulse reference excerpt completeness | **278.67 s** | 570.65 s | **104.78% slower** guided | 25/25 both |
| PineScript PR-file pagination | 337.74 s | **321.75 s** | **4.73% faster** guided | 19/19 both |
| Walk Forward Crypto dashboard snapshot atomicity | **337.41 s** | 501.87 s | **48.74% slower** guided | 12/12 both |
| **Total across three** | **953.82 s** | 1,394.27 s | **46.18% more elapsed time** guided | **56/56 both** |

Speed winners: baseline **2/3**, pre-injected GodPrompt **1/3**. All six were independently corroborated by original source commit, per-arm Git diff restricted to allowed files, genuine successful shell events, raw transcript digests, actual usage receipts, and unchanged private grader hashes. `benchmarks/agent-ab/real-repos/v4-evaluate-runs.mjs` performs those checks; its six dedicated deterministic tests reject missing edits, wrong server, altered SHA, tampered usage and policy denials.

**Resource usage**, as model-reported tokens rather than billed cost:

| Quantity | Baseline | Pre-injected GodPrompt | Change |
| --- | ---: | ---: | ---: |
| Input tokens | 2,634,605 | 2,823,021 | **+7.15%** guided |
| Output tokens | 10,600 | 11,672 | **+10.11%** guided |

Individual tasks varied substantially. PineScript guided code used Octokit's built-in pagination (smaller patch); baseline used an explicit page loop. Both passed all independent checks. A sample of **three** first-party tasks is much too small and selective to infer a generalizable speed, cost, or correctness difference. **Some different-task arms ran concurrently on the same Windows host**, so hardware/remote-service contention may affect elapsed times despite equal nominal permissions and a fixed within-task arm order. The observed time results are **unfavorable to pre-injected GodPrompt overall**, without proving global inferiority.

## Live in-session GodPrompt — reality vs required protocol

| Task | Elapsed | Hidden grade | Actual MCP evidence | Protocol verdict |
| --- | ---: | ---: | --- | --- |
| TrendPulse | 342.46 s | **25/25** | Pinned `godprompt` version and classify succeeded; first execute guidance request was oversized, second execute request succeeded; **no verify guidance call** | **INVALID for frozen two-phase treatment** (correct code, incomplete MCP protocol) |
| PineScript | 349.38 s | **11/19**, unchanged | Pinned version/classify succeeded; oversized execute request failed, retried successfully; no verify guidance, **no code edit** | **INVALID** |
| Dashboard | 190.49 s | **5/12**, unchanged | Seven calls to other connected `codex_apps` tools, **zero pinned `godprompt` calls**, no code edit | **INVALID / connector contamination** |

**Important:** The shorter live arm times cannot be treated as productivity wins. TrendPulse's correct code shows the model could use a **partial live-MCP interaction**, but claiming a successful full two-phase live treatment after the session would change the preregistered gate. We did **not** do that. All three live arm receipts remain inspectable and explicitly rejected.

After the dashboard agent selected unrelated app connectors, the two later live-arm prompts received an explicit **post-hoc clarification** naming the pinned `godprompt` server and prohibiting similarly named connected apps. The frozen task content and graders were not changed, but the live treatment instructions were not strictly identical between these sessions. This is another reason that the live-arm results are diagnostic rather than a clean causal comparison.

## Independent ordinary regressions

The frozen hidden graders do not replace ordinary source tests. After each model finished, we independently ran source tests without editing the agent's clone:

- TrendPulse baseline: **56 passed**, one nonfatal local `pytest` configuration warning (`asyncio_mode` plugin option).
- TrendPulse pre-injected: **56 passed**, same nonfatal warning.
- TrendPulse partial live-MCP: **59 passed**, same nonfatal warning.
- PineScript baseline: **4 passed**, Node 22's `--experimental-test-isolation=none`; JavaScript syntax check passed.
- PineScript pre-injected: **2 passed**, same no-child test mode; JavaScript syntax check passed.
- Dashboard baseline: **115 passed** (including nested parameterized subtests) and dashboard pre-injected: **8 passed** (different test granularity), both rerun independently under Node 22 with no-child test isolation. Both also passed all **12/12** identical hidden cases. Different authored test counts are **not** a cross-arm quality ranking.

No branch of these three target products was committed or deployed. Their model-written diffs and test files exist only in local private benchmark clones.

## Additional direct MCP usability research (post-hoc diagnostics, not randomized arms)

1. **Classification robustness:** 12 hand-labeled task paraphrases sent directly to pinned local `classify_task`; **5 unexpected classifications** (three explicit bug fixes that also requested tests were classified BUILD because `add` dominated; a date-validation fix became UNCLASSIFIED; and an automation workflow was classified AUTOMATE rather than the hand-label BUILD). The last case is a debatable label, and 12 selected examples do **not** represent population accuracy. Private diagnostic SHA-256: `6c50e17eb411837172936fea2d776a6516f8e1c33ce3b3c099369f34038c1af5`.
2. **Guidance argument reliability:** The real MCP JSON schema correctly advertises `get_tailored_guidance.max_chars` integer, min 200, max **4,000**, default 1,800. Direct 1,800 and 4,000 requests succeeded; 4,001 and 5,000 were correctly rejected. Both live models nevertheless attempted **5,000–6,000**, costing failed tool calls. The schema is correct; model/tool planning should comply with it. Private diagnostic SHA-256: `6dd9a6c6c57a2c909ad6155992648b033a102881471ab656c49b132c4f281a8d`.
3. **Codex connector discovery:** Disabling the general `features.apps` per session also hid the pinned local `godprompt` server from the model, verified with a genuine authenticated readiness probe. The fallback is to leave discovery enabled, insist on the exact `godprompt` server, and **invalidate** unrelated `codex_apps` calls, not pretend that an app-disabling switch isolates the pinned treatment. This is reflected in `v4-windows-profile.mjs`.
4. **Windows host:** Explicit supported `windows.sandbox="unelevated"` plus `workspace-write`, an initialized small Git checkout, no escalation and no network allowed actual shell edits and in-sandbox tests. An out-of-root write was denied. The fallback's network isolation is weaker than elevated/MXC. Use it only on trusted, isolated offline samples.

## Follow-up prioritization

**P1: live-MCP instruction reliability.** Fix the agent-facing protocol so it reliably obtains both execute and verify guidance, uses correct tool argument bounds, and does not confuse same-sounding connected apps. Validate on **new untouched tasks**; never relabel the three invalid live results.

**P2: classify_task bug-fix robustness.** Add regression cases that include both `fix/debug/repair` and `add tests`; measure routing across broader hand-labeled task sets. Do not change weights based solely on this 12-case probe.

**P3: new independent productivity replication.** Repeat on at least 10–20 unrelated fresh repo tasks with previously frozen graders, equal model/tool permissions, verified live treatment, time-to-accepted-correct-fix, source compatibility and resource measures. Correctness and cumulative cost matter as much as speed.

## Review/production boundary

Only research evidence, controller/report code and tests belong in GodPrompt **draft PR #248**. Keep raw model prompts, private grader implementations, full stdout/stderr transcripts and independent cloned code out of tracked commits. The frozen V4 manifest, grader source and original tasks are unchanged. This work **does not** authorize merging PR #248, releasing GodPrompt, modifying customer production sites, worker restarts or paid API-provider calls.
