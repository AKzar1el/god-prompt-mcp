# Free paired coding-agent benchmark (P5)

This contains 12 **runnable coding microtasks** with known bugs and test oracles. They are original synthetic engineering tasks, **not** SWE-bench Verified, and no scores are proof of real agent productivity until matched agent runs have been performed.

## Run protocol

1. Freeze the exact `suite.json` and `microtasks/` revision. Create two independent clean copies of each task from the same broken baseline.
2. Use exactly the same model, reasoning effort, environment, time budget and tool privileges for baseline and candidate. Allow only the current task's `broken.mjs` file to be changed.
3. Produce a randomized A/B run order: `node benchmarks/agent-ab/run.mjs plan benchmarks/agent-ab/suite.json fixed-seed`. The plan is deterministic, and the seed/hash must be stored with every record.
4. Baseline arm uses the coding agent **without GodPrompt**. Candidate arm uses GodPrompt's scoped Skill and MCP. Prevent candidate context or file changes from bleeding into baseline.
5. For each task, invoke the exact `test_command` in an independent checkout after the agent stops. It is normal for the original broken fixtures to fail before repair. Grading evidence must include the command exit status, task revision and a preserved redacted test receipt, not only an agent claim.
6. Record one baseline and one candidate result for every task in a JSON file: `suite_id`, `plan_hash`, `trials: [{ task_id, revision, baseline, candidate }]`. Each arm needs `model`, `environment`, `revision`, `passed`, `wall_ms`, `tokens`, `tool_calls`, `grade_source: "test_runner" | "agent_report"`.
7. Score only complete matched pairs with `node benchmarks/agent-ab/run.mjs score benchmarks/agent-ab/suite.json results.json fixed-seed`. The scorer rejects incomplete sets and incompatible model/environment IDs.

## Interpret carefully

A/B outcomes are **caller-imported records**; the scorer never invokes a model, tests, or remote resources. The 12 tiny tasks are for early integration screening and not enough to establish benefits on real repositories. Expand to 10-20 real issue/fix tasks with pinned reference tests, independent blinded grading, and multiple seeds before claiming practical performance gain. Reuse SWE-bench Verified only within its license and runtime constraints; do not silently substitute synthetic fixtures for that dataset.

The output `independently_verified:false` and `causal_productivity_gain_claimed:false` are intentional. A full live comparison would need an available coding agent, its explicit model budget and isolated workspaces; the P5 CI does not pretend those runs happened.
