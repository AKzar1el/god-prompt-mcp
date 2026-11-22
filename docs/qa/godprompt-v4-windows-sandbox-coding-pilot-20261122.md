# GodPrompt V4 — authorized Windows sandbox recovery and first real coding pilot

Date: 2026-11-22. **Result: restricted shell read, file modification, local tests and out-of-workspace write denial are verified. No administrator intervention was required for this local pilot. A GodPrompt productivity advantage was NOT demonstrated.**

## Effective root causes and supported workaround

Codex CLI 0.171.0 on Windows 10 build 19045 was initially launched using `--ignore-user-config` without an explicit Windows sandbox implementation. Authenticated GPT-6.1 Sol sessions completed, but every shell command was rejected as `blocked by policy`. The matching upstream issue is [openai/codex #42172](https://github.com/openai/codex/issues/42172). Setting the per-session Windows selector explicitly to `windows.sandbox="elevated"`, while retaining `--ignore-user-config`, allowed a genuine read-only shell command to succeed.

The legacy elevated `workspace-write` mode then hung during sandbox setup/ACL processing in the original nested scratch directory. This behavior matches reports [#48593](https://github.com/openai/codex/issues/48593) and [#50699](https://github.com/openai/codex/issues/50699). Creating a genuinely initialized, minimal disposable Git checkout and selecting the officially documented `unelevated` Windows sandbox for **this session only** gave a working restricted workspace. The official [Windows sandbox guide](https://learn.chatgpt.com/docs/windows/windows-sandbox) notes that unelevated retains ACL-based filesystem boundaries but has weaker network isolation and does not support denied read paths. It is a fallback, not a security-equivalent replacement for MXC or elevated.

Verified via a direct Codex sandbox invocation with `--permission-profile :workspace`:
- Benign write inside the disposable Git checkout succeeded, exit code **0**.
- Benign write into a sibling, out-of-workspace file was **denied**, exit code **1**; no outside file created.
- Both probe files were removed and cleanup was verified.
- A separate genuine GPT-6.1 Sol model session read source and tests, issued a shell edit that fixed a broken arithmetic function, and the independent unchanged grader improved from **0/3 to 3/3**.
- Default `node --test` inside the sandbox initially failed with `spawn EPERM` because Node tried to spawn a test child. The supported Node 22 flag `node --test --experimental-test-isolation=none` ran the same three tests entirely **inside the restricted sandbox**, passing **3/3**.

All model sessions retained workspace-write filesystem sandboxing, used per-session configuration, did not request escalation, and supplied no paid API keys. No user-global configuration changes, admin/UAC prompts, full-access mode, WSL setup, production deployment, service restart, or source-repository merges were involved.

The verified per-session configuration for the native Codex CLI was:

~~~text
--ignore-user-config
-c windows.sandbox="unelevated"
--sandbox=workspace-write
-c approval_policy="never"
-c sandbox_workspace_write.network_access=false
~~~

This is appropriate only for known trusted offline code and tightly scoped disposable workspaces; the documented unelevated network boundary is weaker than elevated. Disable unwanted Codex connected app exposure for future comparison arms, and preserve an independently verified in-root/out-of-root write probe.

## First frozen public-repo coding comparison

Task: `dashboard-snapshot`, repository `AKzar1el/walk-forward-crypto`, frozen SHA `8ec32ea1ad454edd88abc5118a808c6fa764063b`. The same exact private hidden grader (12 checks), task text, allowed edit paths, model GPT-6.1 Sol, High effort, and per-arm separate source commit were used. A common host-only execution adapter described the safe Windows sandbox and Node test workaround. Each arm was a separate independent authenticated Codex session; no grader was exposed to the agent.

| Arm | Elapsed seconds | Hidden checks passed | Reported input tokens | Reported output tokens | Observed commands | Source changed | Interpretation |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Baseline | 337.41 | 12/12 | 730,322 | 2,927 | 9 (8 exit 0) | 2 allowed files | Accepted coding result |
| Pre-injected real GodPrompt guidance | 501.87 | 12/12 | 643,659 | 3,003 | 2 (2 exit 0) | 2 allowed files | Accepted coding result; **48.74% slower** |
| Nominal live MCP | 190.49 | 5/12 | 358,307 | 1,881 | 5 (2 exit 0) | None | **INVALID LIVE-GODPROMPT ARM** |

The pre-injected candidate used about **11.87% fewer model-reported input tokens** but took longer. Model-reported tokens are not a monetary invoice. A single task, selected by us and judged by our own grader, cannot show a causal or statistically generalizable quality advantage.

**Live arm integrity failure:** although an earlier isolated readiness probe genuinely called the pinned `godprompt` MCP four times in-session, this coding candidate made **zero** pinned `godprompt` calls. Instead it attempted seven calls to other account-connected `codex_apps` tools, including unrelated `god` and `codexify_godprompt_v2` sources. It made no file changes and stayed at the initial 5/12 grader result. Its short elapsed time **must not** be interpreted as a faster GodPrompt implementation. The live arm is invalid as a matched treatment, not a proof of inferiority or superiority.

These source and usage receipts are in ignored `benchmarks/agent-ab/real-runs/replication-v4/private/model-runs/dashboard-snapshot/` (stdout JSONL, stderr, source metadata, independent grader receipts). Raw source changes and private graders are excluded from the draft review PR. The frozen public suite and grader SHA hashes were not modified.

## Reproducibility and next gates

1. Add a **one-session app connector isolation** preflight for each Codex arm; Codex CLI currently reports the `apps` feature enabled by default. Test `-c features.apps=false` on a disposable live tool probe before the next frozen task, and ensure the pinned `godprompt` server remains callable. Do not globally disable user apps.
2. Prevent the live-arm misrouting rather than claiming calls to arbitrary `codex_apps` servers are calls to the pinned tool. Check actual `item.completed` MCP server and method names.
3. Adjust the V4 tool-evidence check: actual Codex model file edits may occur via `command_execution` shell writes and leave a valid independently graded Git diff **without** emitting a `file_change` event. The existing conservative gate rejects such sessions; preserve that fail-closed behavior until a scoped repository-diff-plus-tool-event corroboration mode is implemented and tested. Do not treat claimed edits as proof.
4. Run the remaining two *fresh* repositories' preregistered arms in the predetermined counterbalanced order and retain separate source, token, tool, timing and grader receipts. Mark invalid/failed arms explicitly. A new live-MCP retest of the already exposed dashboard task is diagnostic only; it cannot be passed off as the original blinded live arm.
5. Expand to 10–20 genuinely unused unrelated tasks with independent grading and honest uncertainty before claiming any productivity difference.

**Status:** The user's admin assistance is **not** required to run safe, restricted, disposable offline coding trials in this environment. The broader Windows sandbox remains best-effort, and one treatment arm remains invalid. The historical four pairs and the new V4 pilot remain separate; no production release is authorized.
