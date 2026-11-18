# GodPrompt / Codexify checkpoint consolidation: local-only verification

Date: 2026-11-18
Status: draft; NOT merged, pushed, published, deployed or activated in shared Codexify configuration.

## Source and isolation

- Repository: AKzar1el/god-prompt-mcp.
- Source baseline: PR #226 at `d842181e9720ec1248a1a26fb4e8d621fc328c90` (still an open draft and unmerged).
- Implementation branch: `feature/codexify-checkpoint-main-mcp-20261118` in a *separate Codexify-managed Git worktree*.
- Active Codexify MCPs were NOT restarted, terminated, reconfigured or hot-reloaded. Running agents' files and processes were not altered.
- New branch exists locally until a separately authorized review/release decision. Do not infer that a GitHub push is harmless: automated Cloudflare/build integrations may react.

## Architecture

1. `src/work-contract.ts`: original authoritative contract creation and final evidence audit, unchanged.
2. `src/codexify-evidence.ts`: one portable, shared adapter for copied Codexify tool receipts. Error-marked, malformed or JSON-RPC-error receipts cannot be promoted to success even with `exit_code: 0`. It returns redacted evidence metadata; never emits raw logs.
3. `src/codexify-checkpoint.ts`: one phase-aware implementation (plan/implementation/verification/handoff), cloud-safe identity-free summary generator and MCP tool registration.
4. `src/stdio.ts`: exposes the additional read-only `review_codexify_checkpoint` only when `GODPROMPT_CODEXIFY_CHECKPOINT=1` in the **local Node stdio process**. Opt-in identity is `god-prompt-mcp@1.1.1-checkpoint-preview`; the default remains `god-prompt-mcp@1.1.1` with nine tools.
5. `experiments/codexify-checkpoints/checkpoint.mjs` and `mcp-stdio.mjs`: lightweight compatibility entrypoints using the same module, preserving the pilot's prior one-tool identity for existing connections.
6. `bin/godprompt-proof.mjs`: re-exports the shared adapter; the Codexify adapter is now asynchronous because the portable, dependency-free WebCrypto digest is asynchronous.
7. `src/index.ts`, `src/discovery.ts`, OpenAI distribution, hosted Cloudflare Worker code: unchanged. The hosted Worker still advertises exactly nine tools, including with the local opt-in flag in its environment.
8. No remote storage, authentication expansion, telemetry, new credentials, new dependencies, scheduled jobs, hooks, spending or deployment actions.

## Executed verification

All checks ran through the existing authorized Codexify God v5 execution gateway, against the isolated Windows checkout, without touching other Codexify agent sessions.

| Check | Result |
|---|---|
| Clean baseline Node 22, before edits | 171/171 passed |
| Final `npm run build` / TypeScript | Passed |
| Final `npm test` (Windows Node 22.22.2) | 179/179 passed, zero failures |
| Final `npx --yes node@24 --test tests/*.test.mjs` (Windows Node 24.22.3) | 179/179 passed, zero failures |
| Local main MCP, default stdio catalog | Nine tools, no checkpoint |
| Local main MCP, explicit opt-in catalog | Ten tools, one checkpoint |
| Legacy pilot compatibility MCP | One checkpoint tool; same exported evaluator |
| Local/public boundary with opt-in environment set | Hosted HTTP MCP still nine tools |
| Error receipts, malformed failure flags, JSON-RPC errors with exit_code zero | Rejected; HOLD/RECHECK as appropriate |
| 24 parallel requests through main MCP | Isolated results, no private canary output |
| Oversized secret-bearing request then safe request on same MCP | Rejected without echo; server recovered |
| Scope violation and prohibited action | RECHECK |
| High-risk review absent, missing verification, tampered contract | Fail-closed; legacy regression suite preserved |
| `npm pack --dry-run --json` | Local npm pack preview includes two new dist modules; excludes experiments folder. No package published. |
| `npm ci` dependency audit during bootstrap | Zero reported vulnerabilities |

## Deployment state and non-claims

At the time of the inspection the actual shared Codexify sources are still:
- `god_prompt_mcp`, connected, v1.1.1, nine tools.
- `godprompt_checkpoint_pilot`, connected, v0.0.0-test, one tool.

Their live catalogs were **not** changed. New implementation tests use a freshly launched child stdio process controlled by the isolated test, not an unobserved change to shared MCP routing. No fresh Linux GitHub CI result exists for this consolidation yet. Prior PR #226 test results refer to the *baseline* code, not this later refactor.

The Codexify God v5 catalog does not expose a generic lifecycle tool-call hook that could independently interrupt another agent after every step. Main-MCP instructions now request checkpoints at four milestones in a cooperating agent run. That is **agent-invoked**, not host-enforced automatic interception. A separate, explicitly scoped host integration would be required to guarantee automatic scheduling; do not advertise such enforcement before evidence.

Even `REPORTED_READY_FOR_INDEPENDENT_REVIEW` is caller-supplied status only. All results retain `independently_verified: false`, `completion_authorized: false`. Never infer merge, deploy, publish, spend or ship authorization.

## Rollback / next controlled rollout

- Before rollout: keep shared Codexify config and all running agents unchanged.
- To disable the new main tool in a **future** dedicated session: omit `GODPROMPT_CODEXIFY_CHECKPOINT` or set it to a value other than `1`; the main MCP returns to nine tools.
- Preserve the existing pilot for compatibility until no running session depends on it, then remove only that future-session source after a catalog convergence check.
- Before any remote PR, npm release, Cloudflare deployment or OpenAI plugin update: separately review CI/deployment triggers, source-to-artifact identity, privacy and host policy effects. This task expressly did not authorize those downstream actions.
