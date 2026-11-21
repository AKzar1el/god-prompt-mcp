# GodPrompt Preview 10 + Memory: hybrid health and functional audit

Date: 2026-11-20, Europe/Ljubljana. Scope: **local source and existing
Codexify instance only**. No remote release, merge or publication.

## What Memory does and does not do

The connected `memory` MCP provides explicit knowledge-graph create,
retrieve, search, observation and relation operations. Records may grow
over time **when an authorized client writes them**, but the MCP does not
autonomously learn, resolve conflicting facts, curate stale records, or
self-repair a failed Codexify startup. A 90-second startup timeout reduces
one failure mode but is not a recovery loop.

## Best-of-both operational model

- **Automated, local and free:** `scripts/codexify-mcp-health-monitor.ps1`
  performs a read-only HTTP GET to the existing
  `http://127.0.0.1:3000/health` endpoint. It checks the **18 upstreams**
  connected in this verified deployment, detects missing/disconnected
  sources, and persists only timestamps, source names, status, and a
  bounded 64-entry transition history.
- **Delivery:** the only installed copy lives at
  `%USERPROFILE%\.codexify\health-monitor\monitor.ps1` and the Windows
  scheduled task is `Codexify-MCP-Health-Watch` every **15 minutes**.
  Status is `%USERPROFILE%\.codexify\health-monitor\latest.json`.
  No keys, user memory content, transcripts, or agent prompts are read.
  No API calls to paid model services are made.
- **Alert hygiene:** a single transient failure records a warning state.
  After **two consecutive failures**, the monitor requests a desktop
  balloon notification; recovery requests one more. Notifications are
  best-effort and require a user session; the JSON status file and
  Task Scheduler result are authoritative. History and alerts are
  deduplicated. The task is interactive-user-only; it does not run when
  that Windows user is fully logged out.
- **Explicit fail-closed boundary:** the monitor **never** kills or
  restarts Codexify or any agent. Until upstream Codexify PR #11 enables
  reviewed targeted `reload_mcp` recovery, unconditional service-wide
  restart would risk interrupting parallel workers. A separate manual
  semantic audit is still needed after source changes or real incidents.

### Monitor red/green and deployment checks

- PowerShell `-Mode SelfTest` passed: healthy, missing, disconnected,
  two-check alert threshold, no alert spam, recovery, malformed/null
  health input and capped history.
- Live run against `/health` passed all **18** expected upstreams.
- Initial Windows task launch failed with `0x80070002` because its action
  used a nonabsolute `powershell.exe` lookup. Repaired only this task's
  action to the absolute Windows PowerShell path.
- A **later scheduled run failed** with exit code `1` because the first
  version of the monitor passed a null rollback path into Windows
  `.NET File.Replace`. The first write succeeded but replacement of an
  existing `latest.json` failed. Reproduced this in a direct second run
  (RED). Changed the writer to use a fixed, same-directory
  `previous.json` rollback snapshot (GREEN), added a self-test that
  exercises real atomic replacement, and deployed the repaired script
  with a local backup of the earlier copy.
- After this repair, repeated direct checks and a fresh **actual Task
  Scheduler run** returned exit/result **0**, the task returned `Ready`,
  and `latest.json` contained `healthy=true`, `monitoredSources=18`,
  `consecutiveFailures=0`. `previous.json` exists as a rollback snapshot.
- The preexisting disabled legacy `Codexify-GodPrompt` task was **not**
  enabled or altered.

## Live functional audit (actual connected Codexify)

- Private MCP catalog: **14/14 connected**, GodPrompt
  `1.1.1-checkpoint-preview.10` (**10 tools**), memory `0.6.3`
  (**9 tools**). The `/health` surface reports **18 connected** including
  directly exposed upstreams.
- GodPrompt: `get_version` and five large/reference retrieval calls
  worked. Twelve classification examples covered all nine task types,
  negated shipping, ambiguous input and non-ASCII text; **12/12** routed
  as expected.
- Checkpoint: six real stage/adversarial cases (plan,
  implementation, verification, handoff, scope violation, unsupported
  success receipt) returned appropriate pending, `RECHECK` or `HOLD`
  outcomes; **zero** incorrectly claimed independent verification or
  completion authorization.
- Memory: created two uniquely named temporary nodes, added an
  observation, created and deleted a relation, searched/read them,
  deleted the observation and both nodes, then verified no test nodes
  remained. All operations passed; existing personal knowledge was
  not exported, changed, or summarized.

## One newly reproduced output limit and staged source fix

When asked through the **live Codexify** connection for the entire
`get_god_prompt` payload, the approximately **64,568-character** text
was returned with a deliberate middle truncation marker around the
10,000-token downstream cap. This is a delivery limitation, not a
corrupted installed asset. The existing `get_core_skill`, protocols,
gates and anti-pattern tools remain below this limit and work normally.

In the **isolated local feature branch**, `get_god_prompt` now accepts
optional `start` and `maxChars` (maximum 8192). A chunked response
includes `structuredContent.start/end/totalChars/nextStart`, and callers
can reconstruct the exact original without losing its middle. Calling
it with no arguments retains the original complete response for
backward compatibility. Added an actual stdio roundtrip regression:
the old code failed the new test (RED) and the rebuilt code passed (GREEN),
including concatenation of every 8192-character chunk. No additional
MCP tool was added. **The new schema is staged, not live yet**; activating
it requires a reviewed source-specific reload or safe deployment gate.

## Verification and environment pressure

- TypeScript build completed with exit 0, and `git diff --check` passed.
- Source with the chunk regression: **Node 22.22.2: 198/198 passed**.
- An earlier baseline before adding chunks passed **Node 24.22.3:
  198/198**. During the updated source's unrestricted concurrent Node 24
  suite, Windows child processes hit memory-commit exhaustion
  (`0xC000012D`, V8 heap/zone allocation failure); this run **failed**.
  Physical RAM was approximately 16 GB with just 0.6-1.4 GB free during
  inspection. No deterministic source regression is established by it.
- Rerunning with `NODE_OPTIONS=--max-old-space-size=256` and
  `node --test --test-concurrency=1 tests/*.test.mjs` passed **Node
  24.22.3: 198/198**, with zero skips or failures. The targeted Node 24
  stdio test also passed **2/2**. Concurrency must remain bounded while
  other work is consuming the Windows system memory-commit budget.
- `npm pack --dry-run --ignore-scripts --json` yielded exactly **13**
  intended files; it excludes the local health monitor, internal QA
  docs and all tests. Nothing was published.

## Remaining risks and next action

1. The live `get_god_prompt` large-output path still truncates in
   Codexify; use progressive disclosure meanwhile. Activate the staged
   chunk schema only through an approved, safe reload/release.
2. The 15-minute task detects failures and can notify an interactive
   Windows desktop, but is not autonomous service repair. Review and
   integrate Codexify's targeted hot-reload PR #11 separately after
   its own independent QA, retaining all parallel-agent state.
3. High system memory-commit usage is a real operational risk. Keep
   stress/regression test concurrency bounded; do not terminate unrelated
   processes or silently increase resource consumption.
4. Memory content still needs intentional writes, provenance, deduping
   and periodic human review. Nothing here writes the user's personal
   knowledge automatically.

No GitHub PR was merged, no public GodPrompt MCP or Worker was deployed,
no browser profiles were modified and no parallel agent was intentionally
interrupted by the health-watch installation or source tests.
