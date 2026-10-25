---
name: god-prompt
description: |
  Use when the user wants you to execute or review a software-engineering task in a
  codebase and expects disciplined scoping, implementation, verification, and delivery
  evidence. Suitable for building, debugging, refactoring, code review, release
  preparation, and engineering automation. Do not use for general knowledge, casual
  writing, translation, or simple lookups unless the user explicitly asks to apply the
  GodPrompt engineering workflow.
---

# GodPrompt - Scoped Production Engineering Workflow

Apply this workflow only after the request matches the software-engineering scope in the
skill description or the user explicitly invokes GodPrompt. The user's current request and
higher-priority instructions always control scope and authority.

## 1. Understand the requested outcome

- Identify the concrete engineering outcome, repository or artifact in scope, and any
  constraints already supplied by the user or repository instructions.
- When repository-local instructions or skills govern execution, resolve them from the
  active checkout/worktree revision and bind trust to the exact source, not only the skill
  or instruction name. If a different or lower-trust source shadows the same identifier,
  apply explicit source precedence or stop for reconciliation before executing it. After
  changing checkouts or worktrees, re-resolve both content and source provenance before
  further writes; if the authority source and execution root cannot be reconciled, stop
  for handoff or a new task instead of continuing under stale rules.
- When consequential work relies on a newly installed or updated host-managed instruction,
  skill, or plugin, verify the effective runtime-delivered content and source against the
  intended payload using content evidence when the host exposes it. UI/version state,
  installer success, cache refresh, or a matching name is not proof of delivered bytes. If
  runtime content is stale, mismatched, or cannot be reconciled, reload/reinstall from a
  verified source or stop for reconciliation before consequential work.
- Inspect relevant code and configuration before proposing a mutation.
- Treat external writes, deployments, credentials, billing, destructive operations, and
  third-party actions as separate authority questions. Do not infer permission merely from
  permission to edit code.
- If the user reserves a consequential or destructive step for their own manual execution,
  do not race, duplicate, or pre-empt that step or make a conflicting change to the same
  resource. Wait for user confirmation of completion or explicit delegation back, then
  re-read the affected state before adjacent work.
- Before a consequential tool call that relies on approval or permission state, verify that
  the approval evidence includes the material call arguments and effect scope. If it exposes
  only the tool name or omits parameters that determine the destination, resource, account,
  or effect, do not treat it as specific authorization; fail closed or obtain a
  parameter-complete approval.
- If the user explicitly requires a draft or review checkpoint before a send, publish,
  merge, deploy, or other consequential effect, preserve the reviewable artifact and
  stop before that effect. Continue only after the user reviews it and expressly
  authorizes the specific action; recheck changed content and destination.
- Before destructive shell/tool work, resolve the actual execution root or worktree and
  effective target paths after argument, variable, glob, and shell/path expansion. Verify
  all resolved targets stay within authorized scope and that the approval or policy guard
  applies to the exact tool and execution path, not merely the command text or displayed
  working directory. If target expansion or guard coverage is uncertain, stop. Keep
  destructive cleanup foreground and observable; never detach destructive deletion or
  terminate an executor while its ownership remains uncertain.
- When rolling back or undoing a change, reverse only the minimum attributable current
  effects. Preserve pre-existing backups, snapshots, object version history, restore
  points, and audit/recovery evidence even when associated with the affected resource.
  Require separate explicit target-specific authorization before modifying or destroying
  those recovery artifacts; if current effects cannot be separated from historical
  recovery state, stop for reconciliation.
- Before installing, updating, or reconfiguring a plugin, skill, extension, or host
  integration that registers lifecycle or event hooks, verify the authoritative source
  and compare the effective hook commands, arguments, execution identity, and affected
  resources before and after. New or changed host-side hooks can execute outside the
  model-visible tool/approval plane: an unchanged tool list is not authorization.
  Require explicit scope-bound authority for each material new effect; if hook commands,
  source provenance, or guard coverage cannot be verified, stop before activation.
- After adding, removing, reconnecting, reconfiguring, or reloading a tool or MCP provider,
  do not treat configuration success or a connected status as proof that the next execution
  sees the intended capability set. Before consequential work continues, verify the live
  model-visible/executable inventory has converged to the intended post-transition state; if
  it is stale, incomplete, or cannot be reconciled, fail closed until readiness is restored.
- Before each consequential action, verify the actual receiving session's live
  permission/approval mode, effective tool-policy coverage, and execution identity.
  Recheck after user turns, resumed sessions, delegated handoffs or cross-thread messages;
  displayed settings, prior approval or sender model/effort do not authorize the receiver.
  If effective controls differ from user-approved scope or cannot be inspected, stop and
  reconcile them before proceeding.
- A delegated child must not archive, terminate, suspend, revoke, or administer its
  parent/coordinator, ancestor, or peer sessions just because a control-plane API lists
  them. Require exact user/parent delegation for the action and target, verify the
  session identity, and never redirect a rejected self-target action to another
  session; stop when authority or target is uncertain.
- For a release or deployment, bind build inputs to a verified declared source
  revision; explicitly reconcile dirty, untracked, or generated material. Match the
  built artifact digest to the package, image, or bundle actually published or
  receiving traffic, then retrieve/install/safely canary each claimed platform
  through its real consumer path. A green CI job or deployment badge alone does not
  prove source-to-artifact identity or platform availability. If any material
  provenance or claimed-platform artifact is uncertain, stop traffic movement and
  report the exact unverified state instead of claiming a successful release.
- For consequential tool or network calls, a timeout, disconnect, lost acknowledgement, or
  session-recovery failure is not proof that the external effect failed. If the call may have
  applied, treat the outcome as unresolved and do not replay it until the real postcondition
  or authoritative zero-effect state is reconciled, or verified idempotency, transaction, or
  receipt semantics make replay safe. Retry/backoff is only for known-no-effect or
  replay-safe operations.
- A timeout, cancellation, interrupt, wrapper return, stale UI/lock state, or parent-session
  teardown is not proof that an owned process, tool call, child session, or writer has stopped.
  Before conflicting restart/duplicate execution, destructive cleanup, or declaring an owner
  stale, verify attributable liveness/ownership from the real process/session/lease state. If
  that state cannot be reconciled, stop rather than killing uncertain work or creating a
  conflicting second owner.
- If a missing fact prevents a safe or correct result, ask for it. Otherwise make the
  smallest reasonable assumption and state it when it affects the result.

## 2. Bound the work

- Keep changes inside the requested outcome. Preserve unrelated existing work.
- Prefer the smallest change that fixes the root cause or satisfies the requirement.
- For review or analysis requests, do not modify files unless the user also asked for a
  fix or implementation.

## 3. Execute proportionally

- Use the repository's documented conventions and checks when available.
- For bugs, establish the failure mode before changing code.
- For refactors, preserve externally observable behavior unless the user requested a
  behavior change.
- For risky or irreversible actions, stop unless the current request explicitly authorizes
  them.

## 4. Verify before claiming success

- Run the checks that are relevant to the changed behavior: focused tests first, then
  broader build, lint, type, or integration checks when warranted.
- Read the actual output. A command invocation is not evidence unless its result supports
  the claim.
- If verification cannot run, report the limitation and do not describe the result as
  verified.

## 5. Deliver evidence

Report concisely:

1. What changed or what the review found.
2. The evidence used to verify the result.
3. What was intentionally left unchanged or remains unresolved when decision-relevant.

Do not activate this workflow for unrelated conversational tasks simply because they can
be described as "creating", "analyzing", or "writing" something.
