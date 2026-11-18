# Priority 1: local evidence bridge + tiny learning file

> **Source feature under review, not a published capability.** This optional Node 22+ CLI is not installed on anyone's computer, connected to Codexify, or deployed by opening the PR. It ships only when a reviewed release packages the new binary.

## Resource and privacy model

- **Zero new npm dependencies, services, databases, embeddings, AI calls, GPU work, or background jobs.**
- GitHub reads are HTTPS **GET** requests to the official GitHub REST API, executed only when the user runs the github command. Public repositories do not require a token. A private repository needs an already-authorized GITHUB_TOKEN in the local process; this bridge does not create credentials or an OAuth client.
- Codexify evidence is an **explicit caller-supplied JSON export** of existing exec_command results, not a direct connection from the public Worker. The command only parses and summarizes exported evidence.
- Local learning is a single append-only **feedback.jsonl** text file, maximum **256 KiB**, keyed by a SHA-256 hash of the supplied project identifier. It stores short generic patterns/lessons, outcomes and user-reported verification flags. **Only generic lessons should be entered: the tool does not intentionally ingest raw logs, code, credentials, private project names, or file paths, but its filter is not a substitute for user redaction.**
- The file lives under **%LOCALAPPDATA%/godprompt/feedback.jsonl** on Windows, **$XDG_STATE_HOME/godprompt/feedback.jsonl** when set on Linux/macOS, otherwise **~/.local/state/godprompt/feedback.jsonl**. An optional GODPROMPT_FEEDBACK_FILE can override this with an **absolute local path**. It is created only by learn, with restrictive permissions where supported.
- Hosted GodPrompt MCP is still **stateless** and never sees the local text file. For hosted reviews, share **only carefully sanitized** review_input fields; prefer a local stdio MCP for sensitive tasks. Each user has a separate local file and no cross-user synchronization.

The learning file is deliberately **not** a trained model or rule-promotion engine. An agent can consult recurring lessons and use them as provisional guidance, then explicitly verify changes. Feedback is never silently promoted into public GodPrompt policies. It stops accepting new events when it reaches 256 KiB; archive/rotate it manually, rather than silently deleting history.

## Installation (after release)

The source branch includes **bin/godprompt-proof.mjs**, which can be run from a checked-out repository with:

~~~shell
node bin/godprompt-proof.mjs ...
~~~

After a release containing this change, the npm binary will be **godprompt-proof**.

No second tunnel, MCP endpoint or Codexify installation is created. The local coding agent may run it using its **existing authorized terminal tool**.

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
          "exit_code": 0,
          "stdout": "redacted"
        }
      }
    }
  ]
}
~~~

Use the **real tool response**, never fabricate a success exit code. If the connector wraps its response differently or returns only narrative text, the bridge reports a missing structured receipt and the GodPrompt reviewer should **HOLD**. The exported shape is an interoperability format, not an assertion that every Codexify version emits that exact JSON envelope.

~~~powershell
node bin/godprompt-proof.mjs codexify --contract contract.json --export codexify-export.json
~~~

The returned review_input contains bounded receipt summaries and a digest of the submitted structured result. It intentionally does **not** repeat raw stdout/stderr. It does not interpret free-text assertions like "tests passed" as verified command execution.

For either provider, send the returned review_input to GodPrompt's existing review_work_evidence and supply **actual independently checked acceptance evidence** separately. Even a REPORTED_READY_FOR_INDEPENDENT_REVIEW response is not authorization to merge, deploy, spend, publish or make completion claims.

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

Only recognized, generic **HOLD issue codes** become local text-file lessons. The command does not copy issue descriptions, task text, logs or code. A reported-ready response is **not** treated as proof of success and stores nothing. Since the review is caller-supplied, these records remain unverified learning hints until independently checked.

A project key is hashed before storage; the filename does not contain the key. The verified flag means **someone reported** independent verification, not that the CLI authenticated it. The CLI blocks obvious secrets, URLs, e-mail addresses and file paths in lessons, but these filters cannot guarantee perfect redaction; use generic lessons only.

This design needs **no periodic job**. The coding agent can use lessons at the beginning of a task and learn after checking the outcome, if explicitly instructed by the user's workflow. Global rule promotion and measured workflow uplift are separate review-gated priorities.
