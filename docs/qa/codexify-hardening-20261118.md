# GodPrompt / Codexify: post-activation adversarial hardening

Date: 2026-11-18
Status: **tested locally; staged for next Codexify restart; NOT hot-reloaded, pushed, merged, published, or deployed**.

## Scope and invariants

- Repository: `AKzar1el/god-prompt-mcp`; isolated local branch `feature/codexify-checkpoint-main-mcp-20261118`, based on `bf25d44`.
- One canonical checkpoint evaluator and one receipt adapter shared by the main stdio MCP and compatibility pilot. No new tools, dependencies, credentials, cloud storage, or automatic host hooks.
- Default local and public/hosted MCPs remain **nine tools**. Explicit local opt-in (`GODPROMPT_CODEXIFY_CHECKPOINT=1`) exposes **ten tools**.
- Every checkpoint response remains advisory, `independently_verified: false`, `completion_authorized: false`. No implied permission to deploy, merge, publish, trade, or spend.
- All source/test changes were made only in the isolated worktree. No active Codexify agent or MCP process was restarted.

## Proven issues and scoped repairs

1. **Malformed operations silently disappeared in standalone evidence exports.** Reproduced with a list combining a forbidden operation and invalid entries. The single shared adapter now rejects malformed/oversized operation lists instead of substituting `[]`.
2. **Embedded structured failures could appear successful.** A receipt with `exit_code: 0` plus `structuredContent.isError` or a nested error object was previously treated as a passing check. The adapter now examines those immediate structured envelopes. Non-boolean/malformed `success` flags, cancelled, timed-out and still-running statuses also fail closed.
3. **Private input key disclosure in MCP validation errors.** The MCP SDK emitted a caller-controlled unexpected key name in its error text. Reproduced with a canary. The local checkpoint preserves its detailed advertised schema but routes invalid arguments to the existing generic, redacted application error. The same connection recovers for subsequent valid requests.
4. **Adversarial fixture false assurance.** A prior nested-error test accidentally replaced the successful exit-code fixture while injecting its error marker. Corrected the fixture so all negative cases really contain the misleading `exit_code: 0`.
5. **Redundant contract/schema definitions.** The local proof bridge and receipt adapter now share the same contract-envelope validator and evidence-bundle schema constant. The main MCP and compatibility pilot still delegate to the single checkpoint engine.

## Executed evidence (Windows)

| Verification | Observed result |
|---|---|
| Node 22 `npm test` (build and full suite) | **184/184 passed**, zero failures |
| Node 24 `node --test tests/*.test.mjs` | **184/184 passed**, zero failures |
| Deterministic seeded checkpoint scenarios | **2,048** scenarios, fail-closed status and privacy assertions passed |
| Original adversarial matrix | **192** scenarios passed |
| One MCP stdio connection, mixed concurrent requests | **120** valid/invalid/error requests passed and recovered |
| Existing separate concurrency test | **24** simultaneous requests passed |
| MCP invalid inputs, oversized private output, malformed/error-marked receipts | Redacted failures and successful subsequent recovery |
| SDK tool metadata after privacy fix | Stage enum and required `contract` still advertised |
| Cloudflare/public HTTP tool-catalog boundary | Still **nine** tools even with local opt-in set |
| `npm pack --dry-run --json` | **12 files**, required dist modules included, experiments excluded |
| `git diff --check` | Passed |

The packaged build was installed **offline** into a separate stable local runtime and compared against the compiled worktree by SHA-256 for five distribution modules. Fresh child stdio handshakes from that installed directory passed with nine tools and version `1.1.1` when disabled, and ten tools and version **`1.1.1-checkpoint-preview.2`** when enabled. Passing reported evidence, nested failure and private invalid-key rejection were also exercised against the installed package.

## Activation and rollback boundaries

- The currently running shared Codexify source was still `god_prompt_mcp` version `1.1.1-checkpoint-preview` with ten tools and no active separate pilot after staging. It was **not restarted or modified in memory** for this hardening work.
- The existing main MCP startup entry in `~/.codex/config.toml` now points **on its next start only** to `~/.codexify/local-runtime/god-prompt-mcp-hardening-20261118/node_modules/god-prompt-mcp/dist/stdio.js`, retaining `GODPROMPT_CODEXIFY_CHECKPOINT=1`. All other configuration sections were preserved.
- Configuration recovery copy: `~/.codex/config.toml.godprompt-pre-hardening-20261118-183927.bak`. The previously running local package remains installed independently for rollback.
- After an authorized future restart, verify the live source advertises exactly ten tools and version **`1.1.1-checkpoint-preview.2`**, and run a safe live `review_codexify_checkpoint` receipt test. A configured path or a local test is **not** proof the live inventory has switched.
- Real execution receipts remain caller-supplied and are not independently authenticated. Host-enforced automatic checkpoints, Linux CI on this unpushed commit, and guarantees about other unrelated GodPrompt tools are outside this scope.
