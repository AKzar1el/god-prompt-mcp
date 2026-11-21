# GodPrompt real-public-task intent correction (2026-11-21)

## Why this change exists

The first real public-repository coding-output A/B pilot in
`benchmarks/agent-ab/real-repos/pilot-results-20261121.md` ran **three**
matched tasks: Auvrora nested inert-template HTML auditing, Auvrora
Googlebot/Bingbot noindex detection, and MCP-GEO domain-error sanitization.
It preserved the same exact model (`gpt-6.1-sol`, high reasoning effort),
independent task checkouts, original frozen descriptions, and the
unreleased GodPrompt source `ea72ac09e20b83c86d1b568533dd08e68341ba89`.

The actual, independent, **first-pass GodPrompt MCP** classified the
unchanged requests as:

| Frozen public repository task | Observed original route | Intended action |
| --- | --- | --- |
| `auvrora-template-inert` starts with **Fix** | ANALYZE (78%) | **DEBUG** |
| `auvrora-specific-robots` starts with **Extend** | ANALYZE (72%) | **BUILD** |
| `geo-safe-domain-errors` starts with **Harden** | DEBUG (78%) | **DEBUG** |

This was not inferred from source alone: the original stdio MCP was
launched and called for all three descriptions, and the outputs were
recorded before changing classification logic.

## Root cause and bounded repair

A primary fix action was a weak single-word trigger while the incidental
noun *audit* carried a stronger subject signal. Likewise, a primary
**Extend** request had no BUILD verb trigger, allowing an internal audit
subject to win even when the user clearly asked to implement new behavior.

The correction:

- Recognizes `extend` as a BUILD action signal, promoting it **only**
  for an affirmative primary extension that is not a requested
  automation or shipping operation.
- Preserves **AUTOMATE** routing when the user extends a scheduled task,
  automation, workflow, or CI pipeline. Incidental words such as *error*
  must not turn that request into a debugging task.
- Gives primary `fix`, `debug`, `diagnose`, and `troubleshoot`
  actions priority over incidental audit/review/test nouns, **unless**
  an independent feature-building or shipping followup changes the
  intended workflow.
- Does not promote `refactor` or `improve` to DEBUG; their use as
  incidental maintenance subjects must not authorize a repair task.
- Keeps the frozen evaluation suite, the original MCP probe and the
  earlier pilot receipts **unchanged**. No live source was reloaded.

## Verification evidence

- The stdio integration test loads the **unchanged descriptions directly**
  from the frozen public-repo suite, plus 19 new contrast cases testing
  inspection-only, actual implementation, planning, mixed build/repair,
  deployment, automation extensions and negated extension instructions.
- Focused stdio MCP tests **2/2 passed**, including the previously frozen
  **246/246** classifier regression descriptions and the 22 new cases.
- Repeated actual stdio MCP transport stress across those four existing
  fixture datasets: **2,952/2,952 expected routes**, **44/44 malformed
  descriptions rejected**, no response inconsistencies, canary leaks,
  stderr output or JSON-RPC errors.
- The complete Windows/Node22 source suite on the **final corrected code**
  passed **297/297**, with zero failures. TypeScript compilation and
  the focused MCP stdio suite **2/2** also passed after the extra
  primary-automation-extension guard was added.

**Interpretation:** Existing fixtures have been used in earlier tuning;
these scores are deterministic *regression coverage*, **not unbiased
real-world intent accuracy**. The three earlier paired model sessions
showed equal hidden behavior success (24/24 per arm) but higher candidate
time and token usage in that small sample. Correcting their routing now
does **not** retroactively alter that frozen experiment or establish a
productivity improvement. The revised GodPrompt candidate requires a
fresh, independently selected real-task A/B sample before effectiveness
is assessed again.

## Release and isolation boundaries

This correction is maintained on a **separate stacked draft branch** above
GodPrompt benchmark draft PR #243 and unreleased source PR #242. Do not
merge, publish, hot-reload the live 23-tool GodPrompt service, change the
user's quant fleet, or modify any of the three public-repo patch PRs
solely to run the validation. Review and verify CI on the exact new
commit before a release decision.
