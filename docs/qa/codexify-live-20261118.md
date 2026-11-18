# GodPrompt / Codexify live interoperability pre-release check

Date: 2026-11-18  
Status: **source integration tested; production release NOT performed**  
Work: source audit chain #217 -> #218 -> #219 -> #220 -> #221  
Execution: existing Codexify God v5 connector v2.3.29, Windows PowerShell, Node v22.22.2, isolated managed worktree of GodPrompt MCP audit source

## Live calls and observed transport semantics

1. Selected an existing authorized GodPrompt MCP checkout with the exact audit branch in a detached, isolated worktree. No new OAuth client, tunnel, credential or production-side change.
2. Real Codexify exec_command success returned a structured object with:
   - upstream_result.exit_code = 0
   - upstream_result.output = string
   - upstream_result.chunk_id = string
   - upstream_result.wall_time_seconds = number
3. An intentionally failing harmless command with exit code 13 returned as an **MCP tool error**. It did not produce a normal successful tool envelope for the caller. That behavior is handled conservatively: no success receipt is invented from freeform error text.
4. Captured a minimal actual successful Codexify receipt, with no sensitive data, and passed it through the **actual packaged local CLI** (godprompt-proof codexify) into the compiled GodPrompt reviewer:
   - success -> REPORTED_READY_FOR_INDEPENDENT_REVIEW
   - independently_verified = false
   - completion_authorized = false
5. Fed the observed error-path envelope into the same CLI and reviewer:
   - tool-error path -> HOLD
   - issues included VERIFICATION_FAILED and ACCEPTANCE_EVIDENCE_MISSING
   - completion_authorized = false
6. Added a regression test for MCP error text containing a purported exit code: the adapter does not parse or promote such text into trusted output.
7. Confirmed a real Windows test failure under an existing GITHUB_TOKEN environment value: injected/mock GitHub adapters inherited the ambient token. Fixed so only actual native fetch attaches GITHUB_TOKEN. New regression sets a harmless fake token and verifies injected adapters receive no Authorization header.

## Local source/build evidence

- npm ci completed; 42 packages installed in the isolated worktree; TypeScript compilation passed.
- The final local Windows npm test run passed **140 / 140** tests (0 failures), including the new credential-safety and tool-error cases.
- A clean npm pack --dry-run included the optional CLI, stdio MCP entry, and task-contract module; **it did not publish** a tarball.
- Original GitHub Actions audit CI had passed 16/16 checks (including 2 expected skipped release jobs) before these follow-up fixes. Re-run exact-head CI after the final audit branch commit before merge/release.

## Published versus source capabilities (queried live)

- Public Cloudflare Worker endpoint: https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp
- A real HTTP MCP tools/list POST on 2026-11-18 returned **7 tools**:
  get_god_prompt, get_core_skill, get_protocols, get_gates, get_anti_patterns, classify_task, get_version.
- The two new read-only source tools create_work_contract and review_work_evidence are **not yet deployed to the public Worker**.
- npm registry /latest reported **1.0.45** with only the god-prompt-mcp executable. The draft source still declares 1.0.45 but adds godprompt-proof; do **not** attempt to republish that immutable version. Prepare a deliberate newer semver version plus manifest/hash/Registry metadata checks in the release phase.
- No new personal cloud database exists; ChatGPT-only users cannot read local JSONL storage merely by adding the public MCP.

## Remaining release gates

1. Independently inspect and merge the stacked draft PRs in order. No automatic merge, npm publish, registry update, Cloudflare deployment or ChatGPT refresh is performed by this check.
2. Bump version correctly and verify npm package surface, lock/manifest metadata, immutable MCPB/registry release hashes, Worker version, and planned distribution tags.
3. Test the released npm package in a clean local stdio client and the deployed HTTPS Worker with MCP tools/list + actual tool calls on the **new version**.
4. Refresh/reauthorize the connected ChatGPT MCP plugin's tool inventory after the hosted release; verify the two additional tools appear. Existing skill-only Plugin Directory distribution is a separate surface.
5. Keep source trust claims precise: CLI export is caller-supplied and does not independently authenticate the actual exec_command arguments, user approval, or complete changed-file set. Reported-ready never authorizes completion.
6. Windows smoke used the authorized user's actual Codexify environment, but does not guarantee every future Codexify release behaves identically. Unknown/error envelopes must stay fail-closed.

**Verdict:** Real Codexify success/error-path integration behavior is confirmed, tested and documented. Source integration is ready for final code-review/CI gate; versioned publication and production post-deployment testing are still pending.
