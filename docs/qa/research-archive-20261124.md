# GodPrompt research archive — 2026-11-24

## Decision

The 21 stacked research PRs below are retained in the dedicated [V19 archive branch](https://github.com/AKzar1el/god-prompt-mcp/tree/archive/godprompt-v19-research-20261124), pinned at commit `e98d4cbada8d30fb5d78855f7f7aac6aade29aba`. Every listed head was verified to be an ancestor of that exact archived tip. These commits are **not merged into the stable runtime**. Their historical branch code and receipts remain accessible; no paid model calls or new experiments were made during this consolidation.

V18: all three baseline and all three guided fixes accepted, 7.44% directional wall-time improvement below the preregistered 15% threshold, with higher input usage; NO-GO.

V19: five independent public issues and 15 original attempts. Baseline 5/5, generic guidance 5/5 (22.64% slower per accepted fix and 99.21% more reported input tokens), evidence tool 4/5 (56.75% slower per accepted fix; one timed-out trial has missing usage). The original Click receipt remains a timeout, and the concurrent-baseline interference qualification is retained. See [V19 evidence and limitations](https://github.com/AKzar1el/god-prompt-mcp/blob/e98d4cbada8d30fb5d78855f7f7aac6aade29aba/docs/qa/godprompt-v19-source-evidence-pilot-no-go-20261124.md).

These small studies do not demonstrate repeatable agent-productivity uplift. Do not ship experimental defaults or claim verified productivity gains. A future study needs exclusive per-arm execution locks, independently blinded adjudication and a new unseen cohort. Independently useful bug fixes require a clean production PR, focused regression evidence and the full protected CI gate.

## Indexed historical PRs

| PR | Pinned head | Scope |
| --- | --- | --- |
| [#242](https://github.com/AKzar1el/god-prompt-mcp/pull/242) | [ea72ac09e20b](https://github.com/AKzar1el/god-prompt-mcp/commit/ea72ac09e20b83c86d1b568533dd08e68341ba89) | fix(classifier): harden automation and engineering task intent routing |
| [#243](https://github.com/AKzar1el/god-prompt-mcp/pull/243) | [d68a2c904eda](https://github.com/AKzar1el/god-prompt-mcp/commit/d68a2c904eda77615979267afaac1680ff2b02a6) | test: prepare isolated Codexify public-repo coding-agent A/B pilot |
| [#244](https://github.com/AKzar1el/god-prompt-mcp/pull/244) | [f2ea9b679c90](https://github.com/AKzar1el/god-prompt-mcp/commit/f2ea9b679c90ad8d94eb4684d234b1bc4a054ef6) | fix(classifier): honor real public-repo repair and extension intent |
| [#245](https://github.com/AKzar1el/god-prompt-mcp/pull/245) | [ec528e9280cf](https://github.com/AKzar1el/god-prompt-mcp/commit/ec528e9280cf550d1ef586e33f95c8fedff024ab) | fix(classifier): reject negated ship intents; record tool-using A/B |
| [#246](https://github.com/AKzar1el/god-prompt-mcp/pull/246) | [f1727584f900](https://github.com/AKzar1el/god-prompt-mcp/commit/f1727584f9007fbb678d167f356e7aab15c23787) | fix(classifier): route hardening repairs; report cross-repo agentic A/B |
| [#247](https://github.com/AKzar1el/god-prompt-mcp/pull/247) | [a980e8ed0862](https://github.com/AKzar1el/god-prompt-mcp/commit/a980e8ed08626cc360e657b1b3d0b01e4a9f652c) | test(bench): fail closed on tool-less Codex trials; quantify productivity uncertainty |
| [#248](https://github.com/AKzar1el/god-prompt-mcp/pull/248) | [81abcac166c9](https://github.com/AKzar1el/god-prompt-mcp/commit/81abcac166c90c095ec8524679b6b3b603e06ff5) | test(bench): freeze three fresh public-repo A/B/C tasks; verify live Codex MCP calls |
| [#249](https://github.com/AKzar1el/god-prompt-mcp/pull/249) | [21ae878ed890](https://github.com/AKzar1el/god-prompt-mcp/commit/21ae878ed890efb13c233ba8f3f9356728634b26) | fix(mcp): reliable bug-fix routing and two-phase live-agent guidance |
| [#250](https://github.com/AKzar1el/god-prompt-mcp/pull/250) | [a39f2296b6e0](https://github.com/AKzar1el/god-prompt-mcp/commit/a39f2296b6e0f0f8c9fa39e28239340821baa17e) | test(bench): publish V6 ten-task controlled GodPrompt replication |
| [#251](https://github.com/AKzar1el/god-prompt-mcp/pull/251) | [b609f1534e9f](https://github.com/AKzar1el/god-prompt-mcp/commit/b609f1534e9f24421422fe80085ed938f372dd36) | feat(mcp): opt-in compact guidance and first-run V7 controlled pilot |
| [#252](https://github.com/AKzar1el/god-prompt-mcp/pull/252) | [8bdbb357df94](https://github.com/AKzar1el/god-prompt-mcp/commit/8bdbb357df94a7e7ccedf75432ea212670c281f3) | fix(pkg): include V7 compact guidance runtime in npm bundle |
| [#253](https://github.com/AKzar1el/god-prompt-mcp/pull/253) | [f0b220791267](https://github.com/AKzar1el/god-prompt-mcp/commit/f0b220791267017866ba04aad6b1adc59d7cf173) | test(bench): V8 full-denominator coding efficiency audit |
| [#254](https://github.com/AKzar1el/god-prompt-mcp/pull/254) | [e888c9fb2537](https://github.com/AKzar1el/god-prompt-mcp/commit/e888c9fb2537ca8df6b0ded84abe7d3e4a810765) | test(bench): V9 real public-issue trial stopped at native execution policy |
| [#255](https://github.com/AKzar1el/god-prompt-mcp/pull/255) | [5937699e298a](https://github.com/AKzar1el/god-prompt-mcp/commit/5937699e298aa32dc972f123f2d95ff38f1eb5a0) | test(bench): preserve stopped V10 real-issue trial and grader-policy findings |
| [#256](https://github.com/AKzar1el/god-prompt-mcp/pull/256) | [4dbfb69e73c7](https://github.com/AKzar1el/god-prompt-mcp/commit/4dbfb69e73c747ef6f1067b3d6d08dca82576671) | test(bench): preserve V11 rubric-bias stop without productivity claim |
| [#257](https://github.com/AKzar1el/god-prompt-mcp/pull/257) | [f914a8fe09e6](https://github.com/AKzar1el/god-prompt-mcp/commit/f914a8fe09e6c0ff36e517343f2df7f42765b7e9) | test(bench): preserve V12 optional-uvx grader false negative |
| [#258](https://github.com/AKzar1el/god-prompt-mcp/pull/258) | [e91c0f833709](https://github.com/AKzar1el/god-prompt-mcp/commit/e91c0f8337097857a7c63a44e6a8827cfbe7e357) | test(bench): preserve V13-V15 outcomes; research conditional V16 guidance |
| [#259](https://github.com/AKzar1el/god-prompt-mcp/pull/259) | [a121756811d8](https://github.com/AKzar1el/god-prompt-mcp/commit/a121756811d88090c560aadd4603d9b22472e6a8) | test(bench): preserve V16 three-repository no-uplift results |
| [#260](https://github.com/AKzar1el/god-prompt-mcp/pull/260) | [c6030dcc1506](https://github.com/AKzar1el/god-prompt-mcp/commit/c6030dcc15066a32abfe9ce18ce07dbbf3db07e1) | test(bench): preserve V17 difficult recovery no-causal-gain evidence |
| [#261](https://github.com/AKzar1el/god-prompt-mcp/pull/261) | [821b7f26e5a0](https://github.com/AKzar1el/god-prompt-mcp/commit/821b7f26e5a06820118146ce3903720b200d8e43) | V18 matched-checkpoint real-MCP pilot: 7.44% directional, NO-GO |
| [#263](https://github.com/AKzar1el/god-prompt-mcp/pull/263) | [e98d4cbada8d](https://github.com/AKzar1el/god-prompt-mcp/commit/e98d4cbada8d30fb5d78855f7f7aac6aade29aba) | V19 15-run source-evidence pilot: NO-GO on productivity |
