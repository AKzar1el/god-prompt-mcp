# Priority 1: local evidence bridge + tiny learning file

> **Optional local CLI from v1.1.0.** Installing the package does not enable local learning or wire it to Codexify automatically. Users must explicitly run it; hosted ChatGPT clients do not gain local storage.

## Resource and privacy model

- **Zero new npm dependencies, services, databases, embeddings, AI calls, GPU work, or background jobs.**
- GitHub reads are HTTPS **GET** requests to the official GitHub REST API, executed only when the user runs the github command. Public repositories do not require a token. A private repository needs an already-authorized GITHUB_TOKEN in the local process; this bridge does not create credentials or an OAuth client.
- Codexify evidence is an **explicit caller-supplied JSON export** of existing exec_command results, not a direct connection from the public Worker. The command only parses and summarizes exported evidence.
- Local learning is a single append-only **feedback.jsonl** text file, maximum **256 KiB**, keyed by a SHA-256 hash of the supplied project identifier. It stores short generic patterns/lessons, outcomes and user-reported verification flags. **Only generic lessons should be entered: the tool does not intentionally ingest raw logs, code, credentials, private project names, or file paths, but its filter is not a substitute for user redaction.**
- The file lives under **%LOCALAPPDATA%/godprompt/feedback.jsonl** on Windows, **$XDG_STATE_HOME/godprompt/feedback.jsonl** when set on Linux/macOS, otherwise **~/.local/state/godprompt/feedback.jsonl**. An optional GODPROMPT_FEEDBACK_FILE can override this with an **absolute local path**. It is created only by learn, with restrictive permissions where supported.
- Hosted GodPrompt MCP is still **stateless** and never sees the local text file. For hosted reviews, share **only carefully sanitized** review_input fields; prefer a local stdio MCP for sensitive tasks. Each user has a separate local file and no cross-user synchronization.

The learning file is deliberately **not** a trained model or rule-promotion engine. An agent can consult recurring lessons and use them as provisional guidance, then explicitly verify changes. Feedback is never silently promoted into public GodPrompt policies. It stops accepting new events when it reaches 256 KiB; archive/rotate it manually, rather than silently deleting history.

## Installation (v1.1.0 and later)

The source package includes **bin/godprompt-proof.mjs**, which can be run from a checked-out repository with:

~~~shell
node bin/godprompt-proof.mjs ...
~~~

The v1.1.0 npm package declares the **godprompt-proof** binary.

No second tunnel, MCP endpoint or Codexify installation is created. The local coding agent may run it using its **existing authorized terminal tool**. The CLI is intended for **single-writer** use: simultaneous processes are not guaranteed a transactional 256 KiB cap. Project name hashes are **pseudonyms**, not encryption or a way to safely store secrets.

## A. GitHub CI -> GodPrompt review

1. Create a real task contract with **create_work_contract**. Save the returned **contract object** (not the entire tool response) as **contract.json** on the local machine.
2. Pin a **full 40-character commit SHA**.
3. Write a tiny **check-map.json** such as:

~~~json
{"VC-01": "verify (22)", "VC-02": "verify (24)"}
~~~

4. Run:

~~~powershell
node bin/godprompt-proof.mjs github --repo owner/repository --sha FULL_40_CHARACTER_SHA --contract contract.json --map check-map.json
~~~

By default the bridge reads the exact **single commit** file list (including both rename paths) and checks tied to that SHA. **A single commit is not a full pull request diff.** To review the complete PR scope, add the exact PR number:

~~~powershell
node bin/godprompt-proof.mjs github --repo owner/repository --sha FULL_40_CHARACTER_PR_HEAD_SHA --pr 218 --contract contract.json --map check-map.json
~~~

In PR mode, it checks the head SHA before and after reading the paginated **entire PR changed-file list**, and fails if the branch moves. The CI check runs still have to match that exact SHA. It refuses mismatched SHAs and malformed responses; unsafe and out-of-scope changed paths are flagged by the subsequent GodPrompt reviewer. Missing, ambiguous, incomplete or failed CI produces gaps. Pagination is bounded at three pages. No GitHub writes are ever made.

**Critical:** GitHub check names do not establish that the exact contract command ran. The map association is user/agent supplied, so inspect the pinned workflow and original CI run, including permissions and dependency changes, before claiming verification. The bridge emits review_input for review_work_evidence; it never auto-fills acceptance criteria or grants completion authorization.

When a private repository is already accessible through a GitHub connector but the local terminal has no authorized GITHUB_TOKEN, use the connector to inspect the same checks and supply only redacted output to review_work_evidence. Do **not** generate a new credential just for this bridge. The optional direct GitHub adapter is not mandatory.

### Offline GitHub connector export (no token or network)

If the agent already has the GitHub connector, it can save a sanitized JSON snapshot of the **exact pinned commit** and its check-runs into **github-snapshot.json**, then use:

~~~powershell
node bin/godprompt-proof.mjs github-snapshot --repo owner/repository --sha FULL_40_CHARACTER_SHA --contract contract.json --map check-map.json --snapshot github-snapshot.json
~~~

The expected snapshot object has **complete: true**, **commit** (with sha and files array) and **check_runs** (with total_count and check_runs array). Example shape:

~~~json
{
  "complete": true,
  "commit": {
    "sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "files": [{"filename": "src/parser.ts", "status": "modified"}]
  },
  "check_runs": {
    "total_count": 1,
    "check_runs": [{
      "id": 1234,
      "name": "verify (22)",
      "head_sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "status": "completed",
      "conclusion": "success"
    }]
  }
}
~~~

For an offline **full PR** review, add **--pr 218** and replace the snapshot's commit object with **pull_request** (number plus head.sha) and **pr_files** (the complete changed-file array). Keep **check_runs** and **complete: true**. The snapshot must be a single complete page with at most 100 files and checks; for larger PRs use direct GitHub reads or a separate exhaustive review.

This path is offline. It refuses an explicitly incomplete, mismatched or oversized snapshot, limits it to one unpaginated page, and marks its provenance **caller-supplied**. It does **not** authenticate that the export came from the GitHub connector. Do not assert complete:true unless the exact source results were actually inspected for pagination and completeness. The best evidence remains a verified, pinned GitHub check inspected independently.

## B. Codexify exec_command -> GodPrompt review

There is no public Codexify API dependency. Codexify can produce a small **sanitized** JSON export referencing the existing tool receipts. Example **codexify-export.json**:

~~~json
{
  "changed_files": ["src/parser.ts", "tests/parser.test.ts"],
  "operations_performed": ["edited files"],
  "checks": [
    {
      "id": "VC-01",
      "command": "npm test",
      "tool": "mcp__God_v5__exec_command",
      "response": {
        "upstream_result": {
          "chunk_id": "chunk-example",
          "exit_code": 0,
          "output": "[redacted]",
          "wall_time_seconds": 0.1
        }
      }
    }
  ]
}
~~~

Use the **real tool response**, never fabricate a success exit code. If the connector wraps its response differently or returns only narrative text, the bridge reports a missing structured receipt and the GodPrompt reviewer should **HOLD**. The exported shape is an interoperability format, not an assertion that every Codexify version emits that exact JSON envelope.

**Live connector behavior checked on 2026-11-18:** Codexify God v5 (connector 2.3.29) returned successful commands as an object containing `upstream_result.exit_code`, `upstream_result.output`, `chunk_id`, and execution duration. **Nonzero command exits were delivered as MCP tool errors**, not ordinary successful tool responses. If that happens, do not parse error text or fabricate a normal upstream_result: leave the missing structured receipt unverified so the reviewer returns **HOLD**. Tool responses also do not independently bind the submitted `command` field to actual invocation arguments; the exporter is caller-supplied and the original command/call receipt must be checked separately.

~~~powershell
node bin/godprompt-proof.mjs codexify --contract contract.json --export codexify-export.json
~~~

The returned review_input contains bounded receipt summaries and a digest of the submitted structured result. It intentionally does **not** repeat raw stdout/stderr. It does not interpret free-text assertions like "tests passed" as verified command execution.

For either provider, send the returned `review_input` to GodPrompt's existing `review_work_evidence` and supply **actual independently checked acceptance evidence** separately. For Codexify exports, the local CLI can run both stages in one offline invocation:

~~~powershell
node bin/godprompt-proof.mjs review --contract contract.json --export codexify-export.json
~~~

Alternatively, use `node bin/godprompt-proof.mjs review --bundle proof-bundle.json` with a saved unverified v1 evidence bundle. This performs a structural review without network requests, feedback persistence, authentication of evidence or authority to complete a task. Both HOLD and REPORTED_READY_FOR_INDEPENDENT_REVIEW require independent review of the original receipts and diff before consequential actions.

## C. Tiny per-project learning

After independently assessing an outcome, add a generic pattern and correction:

~~~powershell
node bin/godprompt-proof.mjs learn --project sample-repo --outcome failure --pattern missing_tests --lesson "Run the complete test suite before completion"
node bin/godprompt-proof.mjs learn --project sample-repo --outcome success --pattern missing_tests --lesson "The full suite passed after rebuilding" --verified true
~~~

Before the next task, retrieve only the **same project's** bounded summary:

~~~powershell
node bin/godprompt-proof.mjs lessons --project sample-repo
~~~

To record recurring failures from a **completed GodPrompt evidence review** without retyping or persisting private details, save the full reviewer response as **review.json**, then run:

~~~powershell
node bin/godprompt-proof.mjs learn-review --project sample-repo --review review.json
~~~

Only recognized, generic **HOLD issue codes** from a complete reviewer response containing a SHA-256 **contract_id** become local lessons. Repeating the same contract-and-issue pair is ignored, so a replay cannot inflate the recurrence threshold. The command does not copy issue descriptions, task text, logs or code. A reported-ready response is **not** treated as proof of success and stores nothing. Since the review is caller-supplied, these records remain unverified learning hints until independently checked.

A project key is hashed before storage; the filename does not contain the key. The verified flag means **someone reported** independent verification, not that the CLI authenticated it. The CLI blocks obvious secrets, URLs, e-mail addresses and file paths in lessons, but these filters cannot guarantee perfect redaction; use generic lessons only.

This design needs **no periodic job**. The coding agent can use lessons at the beginning of a task and learn after checking the outcome, if explicitly instructed by the user's workflow. Global rule promotion and measured workflow uplift are separate review-gated priorities.

## D. Local observability (Priority 2, opt-in read)

The same file supports **on-demand metrics** without a telemetry backend:

~~~powershell
node bin/godprompt-proof.mjs metrics --project sample-repo --days 30
~~~

The command reads only the existing local feedback.jsonl. It returns file size relative to the 256 KiB cap, number of reported events, separately labeled **reported** success/failure/blocked outcomes, count of user-reported verifications, and frequent HOLD patterns in the selected 1-365 day window. Project labels are hashed; no raw history or other projects' rows are returned. It does not write anything, run in the background, send telemetry or start a service.

**Do not treat these results as an agent-success rate or proof of quality improvement.** Only tasks where feedback was explicitly recorded appear. Verified flags are themselves reports, not cryptographic attestations. The metrics identify recurring workflow gaps for later investigation, not a benchmark.

## E. Versioned per-project workflow preview (Priority 4)

A future agent should not need a model retrain, a large database or a repeated explanation. The local bridge can **compose a deterministic workflow preview on demand** from the standard GodPrompt gates plus repeated generic review issues from the **same existing** feedback.jsonl file:

~~~powershell
node bin/godprompt-proof.mjs workflow --project sample-repo --type BUILD --risk medium --format markdown
~~~

Output is plain Markdown with a SHA-256 version digest. Use **--format json** (or omit --format) to get structured fields. The command is **read-only**; it neither writes another file nor edits AGENTS.md, Codexify, the hosted MCP or public rules.

### One-time optional agent setup

In your **own** Codexify / coding-agent project instructions (not a public shared prompt), add a short local procedure:

1. At task start, classify the task type, then read the local workflow preview for this project's key. Apply standard verification gates; treat any recurring issue suggestions as untrusted **review candidates**.
2. For scoped implementation, create a GodPrompt task contract and work only within the user's actual permissions.
3. After running real verification, collect sanitized evidence and call GodPrompt's review_work_evidence.
4. If the review returns HOLD, save generic issue-code feedback locally with **learn-review** and resolve the missing proof. A clean review still requires checking original evidence and authorization.
5. Do **not** auto-insert candidate suggestions into AGENTS.md, the global GodPrompt repository or the public MCP. Any durable policy change requires an explicit review and its own tests.

This is a one-time **user-controlled instruction**, not an automatic Codexify integration or proof that an existing Codexify session is already configured. The public hosted MCP has **no path to your computer**. A local agent must explicitly run the CLI using its already-authorized terminal.

### Candidate safeguards and versions

- Only **known, hardcoded review issue codes** are eligible, not free-form lesson text or untrusted instructions. Unknown patterns and successful-event strings are never copied into the workflow preview.
- By default an issue needs **at least three distinct contract-and-issue records** before being proposed. You can set **--min-reports 2** through **--min-reports 20**, but the count is not proof of independent recurrence: different fabricated contract IDs could still inflate it.
- Every candidate is labeled **NEEDS_HUMAN_REVIEW**. A preview is not an approved rule set.
- The workflow SHA changes when its selected focus, risk level, review threshold or included candidate counts change. Identical inputs produce identical output; no time-dependent or background updates.
- Every project has its own hashed key; no personal project names or private paths are echoed.
- High- and critical-risk previews explicitly require independent, separately authorized human review.

Because only the single tiny local feedback file is used, there is **no database migration, daemon, GPU, model fine-tuning, remote sync, or telemetry**. The fixed core GodPrompt and public releases remain identical for users who never enable local feedback. No performance claim is made from these local event counts.
