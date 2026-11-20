# GodPrompt: OpenAI Skill + public MCP combination design

Date: 2026-11-20. Research only. The combined marketplace plugin and
Docker/GHCR were NOT published. The free 74-case benchmark came first.

## Decision

Use the existing live read-only HTTPS MCP as the single callable tool
implementation, and a concise, goal-activated Skill as the orchestration
layer. Keep downloaded stdio MCP independent. Avoid paying for another
host, API, model or user-data database.

Current OpenAI distribution already has a plugin.json, a compatibility
.codex-plugin/plugin.json, a scoped SKILL.md, and 5 positive + 3 negative
activation tests. It is still **Skill-only**. It does NOT declare the
remote MCP connection, and that must not be misrepresented.

Proposed portable package layout:

    distribution/openai/
      plugin.json
      mcp.json
      .codex-plugin/plugin.json
      skills/god-prompt/SKILL.md
      skills/god-prompt/references/tool-routing.md
      skills/god-prompt/agents/openai.yaml
      review-tests.json

The MCP URL should be the existing deployed
https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp
with streamable HTTP transport and no authentication, rather than a
local Node executable. The Codex overlay must refer to the SAME Skill
and MCP map, not register a second server. Verify transport spelling
with current OpenAI schema validators (portable plugin documentation
uses streamable-http; some historical examples use http).

## Skill / MCP responsibility split

| Engineering goal | Tool sequence | Truthfulness |
| --- | --- | --- |
| Build/plan | classify_task, audit_requirements, build_test_matrix, optional get_tailored_guidance | Draft test cases, no claims of executing tests |
| Debug | diagnose_failure, get_tailored_guidance | Hypotheses, not verified root causes |
| Code review | review_code_change, optional get_tailored_guidance | File/line risk hints, not proof of safety |
| Release prep | assess_release_readiness, optional review_work_evidence | Reported evidence, never deployment approval |
| Handoff | create_context_handoff | Best-effort redaction, not a privacy guarantee |
| Evaluate workflow | compare_evaluation_runs | Paired descriptive metrics, not causal attribution |
| Generic engineering | classify_task, a bounded phase of get_tailored_guidance | Only load references for the current task |

The Skill picks the right workflow and tells the model how to use
available host tools. The MCP validates inputs and returns deterministic
analyses. No duplicate code in Skill scripts. If the remote MCP is
unavailable, use only instruction-level safe guidance and explicitly
report missing verification rather than fabricating calls.

## Efficiency and activation

- The scoped OpenAI Skill is already long (~17.7k characters), while the
  full core tool can return ~32k characters. Avoid loading BOTH by
  default. Prefer get_tailored_guidance (default first chunk <=1,800
  characters), and reduce the Skill to a concise workflow router with
  optional references.
- Direct, indirect, follow-up, incomplete and unsupported requests must
  activate correctly. Negative examples include non-engineering
  translation, general knowledge and creative writing.
- No authorization for repository access, deployment, accounts or
  external writes is created by a read-only MCP tool.
- Keep server URL, version, tool catalog and Skill dependency metadata
  synchronized with automated tests. Refresh the client after a schema
  or tool-list change and test from a NEW conversation.
- Patch the six independent benchmark misses under a new semver release,
  such as 1.2.1, before combining with the marketplace Skill.
- Test in an unpublished local plugin before submission. Publishing a
  plugin is a separate reviewed OpenAI portal workflow.

## Public code and design reuse

| Repository | What to reuse | Licensing caution |
| --- | --- | --- |
| https://github.com/openai/plugins | Notion's Skill + remote MCP packaging structure, pointers, activated workflow examples | Plugins have different provider licenses; reuse architectural patterns, not code wholesale |
| https://github.com/agentskills/agentskills | Skill metadata format, concise descriptions, progressive references | Code Apache-2.0; docs CC-BY-4.0 |
| https://github.com/modelcontextprotocol/inspector | CLI-based discovery, schema and call smoke tests in CI | Mixed MIT/Apache-2.0 project transition; invoke the CLI, do not vendor |
| https://github.com/promptfoo/promptfoo | Later same-model prompt/agent A/B evaluation with offline assertions | MIT; no need for runtime dependency today |
| https://github.com/openai/skills | Concise workflow routing and activation-eval concepts | Check per-source licensing before copying |

No third-party code has been copied or vendored in this work.

## Official references (retrieved November 20, 2026)

- https://developers.openai.com/plugins/concepts/skills
- https://developers.openai.com/plugins/build/plugins
- https://developers.openai.com/plugins/build/skills
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/api/docs/guides/agents-api/tools/plugins

## Agreed order

1. Finish and inspect no-cost fixture benchmark: first pass 68/74,
   candidate on frozen labels 74/74. Neither proves agent productivity.
2. Prepare and independently release an immutable new version for
   benchmark-driven source fixes; verify hosted + installed consumer.
3. Test the combined Skill + remote MCP package locally without publishing.
4. Check activation/tool selection, user usefulness, privacy and fallback,
   then consider separately authorized marketplace submission.
5. Docker/GHCR LAST. No image was built or published in this task.
