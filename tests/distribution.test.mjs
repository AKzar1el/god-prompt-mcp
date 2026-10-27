import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const serverJson = JSON.parse(
  await readFile(new URL("../server.json", import.meta.url), "utf8")
);
const mcpbManifest = JSON.parse(
  await readFile(new URL("../manifest.json", import.meta.url), "utf8")
);
const stdioSource = await readFile(
  new URL("../src/stdio.ts", import.meta.url),
  "utf8"
);
const serverSource = await readFile(
  new URL("../src/server.ts", import.meta.url),
  "utf8"
);
const workerSource = await readFile(
  new URL("../src/index.ts", import.meta.url),
  "utf8"
);
const gitAttributes = await readFile(
  new URL("../.gitattributes", import.meta.url),
  "utf8"
).catch(() => "");
const buildTsconfig = JSON.parse(
  await readFile(new URL("../tsconfig.build.json", import.meta.url), "utf8")
);
const npmPublishWorkflow = await readFile(
  new URL("../.github/workflows/publish-npm.yml", import.meta.url),
  "utf8"
);
const ciWorkflow = await readFile(
  new URL("../.github/workflows/ci.yml", import.meta.url),
  "utf8"
);
const mcpbPublishWorkflow = await readFile(
  new URL("../.github/workflows/publish-mcpb.yml", import.meta.url),
  "utf8"
);
const registryPublishWorkflow = await readFile(
  new URL("../.github/workflows/publish-registry.yml", import.meta.url),
  "utf8"
);
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const wranglerConfig = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
);
const agentPlugin = JSON.parse(
  await readFile(new URL("../plugin.json", import.meta.url), "utf8")
);
const agentMcp = JSON.parse(
  await readFile(new URL("../mcp.json", import.meta.url), "utf8")
);
const copilotMarketplace = JSON.parse(
  await readFile(new URL("../.github/plugin/marketplace.json", import.meta.url), "utf8")
);
const gitlabMarketplace = JSON.parse(
  await readFile(new URL("../marketplace.json", import.meta.url), "utf8")
);
const cursorPlugin = JSON.parse(
  await readFile(new URL("../.cursor-plugin/plugin.json", import.meta.url), "utf8")
);
const cursorMcp = JSON.parse(
  await readFile(new URL("../cursor-mcp.json", import.meta.url), "utf8")
);
const logoPng = await readFile(
  new URL("../assets/logo-400.png", import.meta.url)
);
const claudePlugin = JSON.parse(
  await readFile(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8")
);
const claudeMarketplace = JSON.parse(
  await readFile(new URL("../.claude-plugin/marketplace.json", import.meta.url), "utf8")
);
const claudeMcp = JSON.parse(
  await readFile(new URL("../.mcp.json", import.meta.url), "utf8")
);
const geminiExtension = JSON.parse(
  await readFile(new URL("../gemini-extension.json", import.meta.url), "utf8")
);
const kimiPlugin = JSON.parse(
  await readFile(new URL("../.kimi-plugin/plugin.json", import.meta.url), "utf8")
);
const agentSkill = await readFile(
  new URL("../skills/god-prompt/SKILL.md", import.meta.url),
  "utf8"
);
const agentSkillMcp = JSON.parse(
  await readFile(new URL("../skills/god-prompt/mcp.json", import.meta.url), "utf8")
);
const agentSkillProtocols = await readFile(
  new URL("../skills/god-prompt/references/01-PROTOCOLS.md", import.meta.url),
  "utf8"
);
const agentSkillGates = await readFile(
  new URL("../skills/god-prompt/references/02-GATES.md", import.meta.url),
  "utf8"
);
const agentSkillAntiPatterns = await readFile(
  new URL("../skills/god-prompt/references/03-ANTI-PATTERNS.md", import.meta.url),
  "utf8"
);

test("exposes a public npm-installable stdio binary with a bounded package surface", () => {
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.publishConfig?.access, "public");
  assert.equal(packageJson.publishConfig?.registry, "https://registry.npmjs.org/");
  assert.deepEqual(packageJson.files, [
    "dist/stdio.js",
    "dist/server.js",
    "dist/skill-content.js",
    "dist/skills.js",
    "dist/content.js",
    "README.md",
    "LICENSE",
  ]);
  assert.equal(packageJson.bin?.["god-prompt-mcp"], "dist/stdio.js");
  assert.equal(packageJson.mcpName, serverJson.name);
  assert.equal(packageJson.scripts?.prepare, "npm run build");
  assert.equal(packageJson.scripts?.prepublishOnly, "npm test");
  assert.match(stdioSource, /^#!\/usr\/bin\/env node\r?\n/);
});

test("keeps package and Registry discovery metadata aligned with the shipped Agent Skill", () => {
  assert.match(packageJson.description, /MCP server \+ portable Agent Skill/i);
  assert.match(serverJson.description, /MCP \+ Agent Skill/i);
  assert.ok(serverJson.description.length <= 100);

  for (const keyword of [
    "mcp-server",
    "agent-skills",
    "coding-agents",
    "claude-code",
    "codex",
    "cursor",
  ]) {
    assert.ok(packageJson.keywords.includes(keyword), `missing npm keyword: ${keyword}`);
    assert.ok(
      serverJson._meta["io.modelcontextprotocol.registry/publisher-provided"].tags.includes(keyword),
      `missing Registry tag: ${keyword}`
    );
  }
});

test("keeps the packaged README aligned with relevance-scoped core-skill loading", () => {
  assert.match(readme, /`get_core_skill` \| `SKILL\.md` — core protocol \(load when relevant, ~10KB\)/);
  assert.doesNotMatch(readme, /`get_core_skill` \| `SKILL\.md` — always-on protocol/i);
});

test("keeps privacy copy aligned with local and hosted transports", () => {
  assert.match(
    readme,
    /can run either as a local stdio server or through the public Streamable HTTP Worker/
  );
  assert.match(
    readme,
    /Hosted remote tool input is sent over HTTPS to the Cloudflare-hosted Worker/
  );
  assert.doesNotMatch(readme, /GodPrompt MCP is a local stdio server\./);
});

test("uses the split MCP SDK v2 without the Workers-only Agents SDK", () => {
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/sdk"], undefined);
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/server"], "2.3.0");
  assert.equal(packageJson.dependencies?.zod, "^4.6.7");
  assert.equal(packageJson.dependencies?.agents, undefined);
  assert.equal(packageJson.devDependencies?.agents, undefined);
});

test("keeps the public Node runtime on maintained LTS lines", () => {
  assert.equal(packageJson.engines?.node, ">=22");
  assert.equal(mcpbManifest.compatibility?.runtimes?.node, packageJson.engines.node);
  assert.match(ciWorkflow, /node-version: \["22", "24"\]/);
  assert.doesNotMatch(ciWorkflow, /node-version:\s*["']?20/);
  assert.match(mcpbPublishWorkflow, /node-version:\s*22/);
  assert.doesNotMatch(mcpbPublishWorkflow, /node-version:\s*20/);
  assert.doesNotMatch(registryPublishWorkflow, /node-version:\s*20/);
});

test("pins cross-platform bundle inputs to LF line endings", () => {
  assert.match(gitAttributes, /^\* text=auto eol=lf$/m);
  assert.equal(buildTsconfig.compilerOptions?.newLine, "lf");
});

test("keeps agent-platform plugin manifests aligned with the public npm package", () => {
  const pinnedPackage = `god-prompt-mcp@${packageJson.version}`;
  const expectedServer = {
    type: "stdio",
    command: "npx",
    args: ["-y", pinnedPackage],
  };

  assert.equal(agentPlugin.version, packageJson.version);
  assert.equal(cursorPlugin.version, packageJson.version);
  assert.equal(claudePlugin.version, packageJson.version);
  assert.equal(geminiExtension.version, packageJson.version);
  assert.equal(kimiPlugin.version, packageJson.version);
  assert.equal(mcpbManifest.version, packageJson.version);
  assert.equal(serverJson.version, packageJson.version);
  assert.deepEqual(agentMcp.mcpServers?.["god-prompt-mcp"], expectedServer);
  assert.deepEqual(claudeMcp.mcpServers?.["god-prompt-mcp"], expectedServer);
  assert.deepEqual(geminiExtension.mcpServers?.["god-prompt-mcp"], {
    command: "npx",
    args: ["-y", pinnedPackage],
  });
  assert.deepEqual(cursorMcp.mcpServers?.["god-prompt-mcp"], {
    command: "npx",
    args: ["-y", pinnedPackage],
  });
  assert.equal(kimiPlugin.skills, "./skills/");
  assert.deepEqual(kimiPlugin.mcpServers?.["god-prompt-mcp"], {
    command: "npx",
    args: ["-y", pinnedPackage],
  });
  assert.equal(cursorPlugin.mcpServers, "cursor-mcp.json");
});

test("keeps direct Gemini MCP onboarding out of project settings", () => {
  assert.match(
    readme,
    /gemini mcp add --scope user god-prompt npx -- -y god-prompt-mcp/
  );
  assert.doesNotMatch(
    readme,
    /gemini mcp add god-prompt npx -- -y god-prompt-mcp/
  );
});

test("keeps OpenCode v2 onboarding on the native MCP registration path", () => {
  assert.match(
    readme,
    /opencode mcp add god-prompt -- npx -y god-prompt-mcp/
  );
  assert.match(readme, /opencode mcp list/);
  assert.match(readme, /"mcp": \{\s*"servers": \{/);
});

test("ships a decodable 400x400 PNG for MCPB and Cursor distribution", () => {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(logoPng.subarray(0, signature.length), signature);

  let offset = signature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let sawIend = false;
  const idatChunks = [];

  while (offset + 12 <= logoPng.length) {
    const length = logoPng.readUInt32BE(offset);
    const type = logoPng.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    assert.ok(chunkEnd <= logoPng.length, `${type} chunk extends past EOF`);

    if (type === "IHDR") {
      width = logoPng.readUInt32BE(dataStart);
      height = logoPng.readUInt32BE(dataStart + 4);
      bitDepth = logoPng[dataStart + 8];
      colorType = logoPng[dataStart + 9];
      interlace = logoPng[dataStart + 12];
    } else if (type === "IDAT") {
      idatChunks.push(logoPng.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      assert.equal(length, 0);
      sawIend = true;
      offset = chunkEnd;
      break;
    }

    offset = chunkEnd;
  }

  assert.equal(width, 400);
  assert.equal(height, 400);
  assert.equal(bitDepth, 8);
  assert.ok(colorType === 2 || colorType === 6, `unexpected color type: ${colorType}`);
  assert.equal(interlace, 0);
  assert.ok(idatChunks.length > 0);
  assert.equal(sawIend, true);
  assert.equal(offset, logoPng.length);

  const channels = colorType === 2 ? 3 : 4;
  const decoded = inflateSync(Buffer.concat(idatChunks));
  assert.equal(decoded.length, height * (1 + width * channels));
  assert.equal(mcpbManifest.icon, "assets/logo-400.png");
  assert.equal(cursorPlugin.logo, "assets/logo-400.png");
});

test("advertises the hosted Worker alongside local Official Registry packages", () => {
  assert.deepEqual(serverJson.remotes, [
    {
      type: "streamable-http",
      url: "https://god-prompt-mcp.tomi-seregi99.workers.dev/mcp",
    },
  ]);
  assert.deepEqual(
    serverJson.packages.map((entry) => entry.transport?.type),
    ["stdio", "stdio"]
  );
});

test("keeps the Factory Droid README package pin aligned with the public npm package", () => {
  assert.ok(
    readme.includes(
      `droid mcp add god-prompt "npx -y god-prompt-mcp@${packageJson.version}"`
    )
  );
});

test("keeps the Goose session package pin aligned with the public npm package", () => {
  assert.ok(
    readme.includes(
      `goose session --with-extension "npx -y god-prompt-mcp@${packageJson.version}"`
    )
  );
});

test("keeps the OpenClaw MCP onboarding aligned with the public npm package", () => {
  assert.ok(
    readme.includes(
      `openclaw mcp add god-prompt --command npx --arg -y --arg god-prompt-mcp@${packageJson.version}`
    )
  );
  assert.ok(readme.includes("openclaw mcp probe god-prompt"));
  assert.ok(
    readme.includes(
      "npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent openclaw --copy -y"
    )
  );
});

test("keeps Qoder skill and project MCP onboarding aligned with the public npm package", () => {
  const qoderSection = readme.match(/### Qoder\n([\s\S]*?)\n### Qwen Code/)?.[1] ?? "";

  assert.ok(
    qoderSection.includes(
      "npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent qoder --copy -y"
    )
  );
  assert.ok(qoderSection.includes("add `.mcp.json` at the project root"));
  assert.ok(qoderSection.includes(`"args": ["-y", "god-prompt-mcp@${packageJson.version}"]`));
  assert.ok(qoderSection.includes("requires approval before using project-level MCP servers by default"));
});

test("keeps TraeCode skill and MCP onboarding aligned with the public npm package", () => {
  const traeSection = readme.match(/### TraeCode\n([\s\S]*?)\n### OpenClaw/)?.[1] ?? "";

  assert.ok(
    traeSection.includes(
      "npx -y skills@latest add AKzar1el/god-prompt-mcp --skill god-prompt --agent trae --copy -y"
    )
  );
  assert.ok(traeSection.includes('add `.trae/mcp.json`'));
  assert.ok(traeSection.includes(`"args": ["-y", "god-prompt-mcp@${packageJson.version}"]`));
});

test("keeps the Kimi main-branch plugin onboarding aligned with the public npm package", () => {
  assert.ok(
    readme.includes(
      "/plugins install https://github.com/AKzar1el/god-prompt-mcp/tree/main"
    )
  );
  assert.ok(
    readme.includes(`god-prompt-mcp@${packageJson.version}`)
  );
});

test("keeps Junie onboarding on the existing Claude-compatible marketplace", () => {
  assert.ok(
    readme.includes("/extensions marketplace add AKzar1el/god-prompt-mcp")
  );
  assert.ok(readme.includes("/extensions install god-prompt-mcp"));
  assert.equal(claudeMarketplace.name, "god-prompt");
  assert.equal(claudeMarketplace.plugins?.[0]?.name, "god-prompt-mcp");
});

test("ships a portable GodPrompt Agent Skill alongside the MCP configuration", () => {
  assert.match(agentSkill, /^---\r?\nname: god-prompt\r?\n/m);
  assert.match(agentSkill, /references\/01-PROTOCOLS\.md/);
  assert.match(agentSkill, /references\/02-GATES\.md/);
  assert.match(agentSkill, /references\/03-ANTI-PATTERNS\.md/);
  assert.match(agentSkillProtocols, /# .*Protocol/i);
  assert.match(agentSkillGates, /# .*Gate/i);
  assert.match(agentSkillAntiPatterns, /# .*Anti-Pattern/i);
});

test("keeps portable skill authority source-qualified", () => {
  assert.match(agentSkill, /exact instruction\/skill source/i);
  assert.match(agentSkill, /Never transfer trust or an allow decision by name alone/i);
  assert.match(agentSkill, /shadows\/collides with a trusted instruction or skill identifier/i);
  assert.match(agentSkill, /re-resolve both content and provenance/i);
});

test("binds portable-skill context recovery to execution provenance", () => {
  assert.match(agentSkill, /recovery transcript, log, scratch path, or artifact/i);
  assert.match(agentSkill, /active task\/session\/agent/i);
  assert.match(agentSkill, /provenance is unknown or mismatched/i);
  assert.match(agentSkill, /do not treat it as this execution's history/i);
});
test("verifies portable-skill runtime delivery integrity", () => {
  assert.match(agentSkill, /Runtime-delivery integrity guard/i);
  assert.match(agentSkill, /effective runtime-delivered\/materialized content and source/i);
  assert.match(agentSkill, /not proof of delivered bytes/i);
  assert.match(agentSkill, /reload\/reinstall from a verified source/i);
});

test("binds portable-skill approvals to material call arguments", () => {
  assert.match(agentSkill, /Approval-evidence binding/i);
  assert.match(agentSkill, /exact material call parameters/i);
  assert.match(agentSkill, /exposes only the tool name or omits material parameters/i);
});

test("requires portable-skill tool-plane convergence after provider transitions", () => {
  assert.match(agentSkill, /Tool-plane transition readiness/i);
  assert.match(agentSkill, /configuration success or a connected status/i);
  assert.match(agentSkill, /live model-visible\/executable inventory has converged/i);
  assert.match(agentSkill, /stale, incomplete, or cannot be reconciled/i);
});

test("reconciles ambiguous consequential effects before retry", () => {
  assert.match(agentSkill, /Effect-aware retry guard/i);
  assert.match(agentSkill, /not proof that the external effect failed/i);
  assert.match(agentSkill, /real postcondition or authoritative zero-effect state/i);
  assert.match(agentSkill, /Retry\/backoff is only for known-no-effect or replay-safe operations/i);
});

test("requires portable-skill execution quiescence before conflicting takeover", () => {
  assert.match(agentSkill, /Execution-quiescence guard/i);
  assert.match(agentSkill, /not proof that an owned process, tool call, child session, or writer has actually stopped/i);
  assert.match(agentSkill, /conflicting restart\/duplicate execution, destructive cleanup, or declaring an owner stale/i);
  assert.match(agentSkill, /verify current attributable liveness\/ownership from the real process\/session\/lease state/i);
});

test("respects user-reserved actions and actual destructive targets in the portable skill", () => {
  assert.match(agentSkill, /User-action reservation guard/i);
  assert.match(agentSkill, /do not race, duplicate/i);
  assert.match(agentSkill, /re-read the affected state/i);
  assert.match(agentSkill, /Effective destructive-target guard/i);
  assert.match(agentSkill, /actual execution root\/worktree and effective targets/i);
  assert.match(agentSkill, /after relevant argument, variable, glob, and shell\/path expansion/i);
  assert.match(agentSkill, /intended approval\/policy guard covers that exact tool and execution path/i);
  assert.match(agentSkill, /destructive cleanup foreground and observable/i);
});

test("preserves independent rollback recovery artifacts in the portable skill", () => {
  assert.match(agentSkill, /Rollback-recovery preservation guard/i);
  assert.match(agentSkill, /reverse only the minimum necessary scope/i);
  assert.match(agentSkill, /pre-existing backups, snapshots, object version history/i);
  assert.match(agentSkill, /separate, explicit target-specific authorization/i);
});

test("binds lifecycle-hook changes to host-side effects in the portable skill", () => {
  assert.match(agentSkill, /Lifecycle-hook update provenance guard/i);
  assert.match(agentSkill, /effective hooks and host-side commands, arguments, execution identity/i);
  assert.match(agentSkill, /outside the model-visible tool\/approval plane/i);
  assert.match(agentSkill, /explicit scope-bound authority/i);
});

test("binds live effective execution policy to the actual receiving session", async () => {
  assert.match(agentSkill, /Live execution-policy integrity guard/i);
  assert.match(agentSkill, /effective permission\/approval mode/i);
  assert.match(agentSkill, /receiving session\/thread actually governing the current call/i);
  assert.match(agentSkill, /Do not silently transfer or broaden/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Live execution-policy integrity guard/g)].length, 2);
  const scoped = await readFile(
    new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(scoped, /actual receiving session's live/i);
  assert.match(scoped, /delegated handoffs or cross-thread messages/i);
  assert.match(scoped, /stop and\s+reconcile them before proceeding/i);
});

test("keeps the Amp skill-scoped MCP surface pinned and aligned with the registered server tools", () => {
  const registeredToolNames = [
    ...serverSource.matchAll(/server\.registerTool\(\s*"([^"]+)"/g),
  ].map((match) => match[1]);

  assert.equal(agentSkillMcp["god-prompt-mcp"].command, "npx");
  assert.deepEqual(agentSkillMcp["god-prompt-mcp"].args, [
    "-y",
    `god-prompt-mcp@${packageJson.version}`,
  ]);
  assert.deepEqual(
    agentSkillMcp["god-prompt-mcp"].includeTools,
    registeredToolNames
  );
});

test("keeps the GitHub Copilot marketplace aligned with the portable plugin", () => {
  assert.equal(copilotMarketplace.name, "god-prompt");
  assert.equal(copilotMarketplace.metadata?.version, packageJson.version);
  assert.deepEqual(copilotMarketplace.plugins, [
    {
      name: agentPlugin.name,
      description: agentPlugin.description,
      version: packageJson.version,
      source: ".",
    },
  ]);
});

test("keeps the GitLab Duo marketplace aligned with the portable plugin", () => {
  assert.equal(gitlabMarketplace.name, "god-prompt");
  assert.deepEqual(gitlabMarketplace.plugins, [
    {
      name: agentPlugin.name,
      description: agentPlugin.description,
      version: packageJson.version,
      source: "./",
    },
  ]);
});

test("keeps the Claude Code marketplace aligned with the Claude plugin", () => {
  assert.equal(claudeMarketplace.name, "god-prompt");
  assert.deepEqual(claudeMarketplace.plugins, [
    {
      name: claudePlugin.name,
      description: claudePlugin.description,
      version: packageJson.version,
      source: "./",
    },
  ]);
});

test("dispatches npm publishing explicitly from the registry release workflow", () => {
  assert.match(registryPublishWorkflow, /actions:\s*write/);
  assert.match(registryPublishWorkflow, /npm view "god-prompt-mcp" version/);
  assert.match(
    registryPublishWorkflow,
    /gh workflow run publish-npm\.yml[^\n]*--ref main/
  );
  assert.match(registryPublishWorkflow, /-f version="\$VERSION"/);
  assert.match(registryPublishWorkflow, /-f source_sha="\$GITHUB_SHA"/);

  assert.match(npmPublishWorkflow, /workflow_dispatch:/);
  assert.match(npmPublishWorkflow, /version:\s*\n\s*required:\s*true/);
  assert.match(npmPublishWorkflow, /source_sha:\s*\n\s*required:\s*true/);
  assert.match(npmPublishWorkflow, /ref:\s*\$\{\{ inputs\.source_sha \}\}/);
  assert.match(npmPublishWorkflow, /test "\$VERSION" = "\$\{\{ inputs\.version \}\}"/);
  assert.match(npmPublishWorkflow, /test "\$TAG_SHA" = "\$\{\{ inputs\.source_sha \}\}"/);
  assert.match(npmPublishWorkflow, /npm view "god-prompt-mcp@\$\{VERSION\}" version/);
  assert.match(npmPublishWorkflow, /already published; skipping/);
});

test("uses generated release notes instead of a generic compatibility template", () => {
  assert.match(registryPublishWorkflow, /gh release create[^\n]*--generate-notes/);
  assert.doesNotMatch(
    registryPublishWorkflow,
    /Claude Desktop\/MCPB metadata and compatibility release/
  );
});

test("keeps PR MCPB validation strict without rebinding released versions to current main", () => {
  assert.match(mcpbPublishWorkflow, /git ls-remote --exit-code --tags origin/);
  assert.match(mcpbPublishWorkflow, /releases\/download\/\$\{TAG\}\/\$\{ASSET\}/);
  assert.match(mcpbPublishWorkflow, /test "\$RELEASED_SHA" = "\$EXPECTED_SHA"/);
  assert.match(mcpbPublishWorkflow, /test "\$ACTUAL_SHA" = "\$EXPECTED_SHA"/);
});
test("does not release on workflow-only main pushes", () => {
  const pushBlock = registryPublishWorkflow.match(/\n  push:\n([\s\S]*?)\n\npermissions:/)?.[1] ?? "";
  assert.match(pushBlock, /server\.json/);
  assert.doesNotMatch(pushBlock, /publish-npm\.yml/);
  assert.doesNotMatch(pushBlock, /publish-registry\.yml/);
});

test("uses the setup-node OIDC path without the v6 dummy auth-token fallback", () => {
  assert.match(npmPublishWorkflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(npmPublishWorkflow, /NODE_AUTH_TOKEN\s*:/);
  assert.doesNotMatch(npmPublishWorkflow, /registry-url\s*:/);
});

test("serves MCP statelessly while preserving the historical Durable Object namespace", () => {
  assert.deepEqual(wranglerConfig.durable_objects?.bindings, [
    {
      name: "MCP_OBJECT",
      class_name: "GodPromptMCP",
    },
  ]);
  assert.match(workerSource, /createMcpHandler\(createServer,\s*\{/);
  assert.match(workerSource, /maxRequestBodySize:\s*1024\s*\*\s*1024/);
  assert.match(workerSource, /maxToolInputElements:\s*2048/);
  assert.match(workerSource, /export class GodPromptMCP/);
  assert.doesNotMatch(workerSource, /McpAgent|\.serve\(/);
});


test("binds release provenance and installability across all skill surfaces", async () => {
  assert.match(agentSkill, /Release source-to-artifact provenance guard/i);
  assert.match(agentSkill, /Reconcile dirty, untracked, or generated inputs explicitly/i);
  assert.match(agentSkill, /artifact actually published or receiving traffic/i);
  assert.match(agentSkill, /STOP consequential rollout/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Release source-to-artifact provenance guard/g)].length, 2);
  const scoped = await readFile(
    new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(scoped, /For a release or deployment, bind build inputs/i);
  assert.match(scoped, /retrieve\/install\/safely canary each claimed platform/i);
  assert.match(scoped, /report the exact unverified state instead of claiming a successful release/i);
});

test("requires user review checkpoints across generated MCP and Agent Skills", async () => {
  assert.match(agentSkill, /User review\/checkpoint guard/i);
  assert.match(agentSkill, /hard precondition/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/User review\/checkpoint guard/g)].length, 2);
  const scoped = await readFile(
    new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(scoped, /review checkpoint before a send/i);
  assert.match(scoped, /expressly\s+authorizes the specific action/i);
});
test("fences delegated control-plane mutation across generated and scoped skills", async () => {
  assert.match(agentSkill, /Delegated control-plane target guard/i);
  assert.match(agentSkill, /rejected self-target action is not permission/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Delegated control-plane target guard/g)].length, 2);
  const scoped = await readFile(
    new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(scoped, /delegated child must not archive/i);
  assert.match(scoped, /never redirect a rejected self-target action/i);
});

test("keeps mixed notification user origin separate across distribution surfaces", async () => {
  assert.match(agentSkill, /Mixed notification\/user-turn provenance guard/i);
  assert.match(agentSkill, /Do not classify the entire message as automated/i);
  assert.match(agentSkill, /trusted channel\/event-origin evidence/i);
  assert.match(agentSkill, /ask the user to resend it in a distinct turn/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Mixed notification\/user-turn provenance guard/g)].length, 2);
  const scoped = await readFile(
    new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url),
    "utf8"
  );
  assert.match(scoped, /Do not discard a verified human request/i);
  assert.match(scoped, /trusted event\/channel-origin evidence/i);
  assert.match(scoped, /STOP consequential effects/i);
});


test("bounds inspection and delegation overhead across generated MCP and skills", async () => {
  assert.match(agentSkill, /Bounded inspection and delegation economy/i);
  assert.match(agentSkill, /cap output and prefer targeted searches/i);
  assert.match(agentSkill, /fixed per-child context\/tool overhead/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Bounded inspection and delegation economy/g)].length, 2);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /begin with the requested files, symbols, failing tests/i);
  assert.match(scoped, /distinct bounded objectives and ownership/i);
  assert.match(scoped, /Never skip required safety, compliance, or/i);
});

test("requires actual delegated child MCP capability readiness across distributions", async () => {
  assert.match(agentSkill, /Delegated child capability readiness/i);
  assert.match(agentSkill, /actual child\/session/i);
  assert.match(agentSkill, /harmless read-only probe when practical/i);
  assert.match(agentSkill, /never fabricate a tool result/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Delegated child capability readiness/g)].length, 2);
  assert.match(generated, /parent's working tools, inherited configuration/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /exact child\/session/i);
  assert.match(scoped, /harmless read-only probe/i);
  assert.match(scoped, /never fabricate results, borrow parent/i);
});

test("matches delegated result origin to dispatch across distributed skills", async () => {
  assert.match(agentSkill, /Delegated result-to-dispatch provenance/i);
  assert.match(agentSkill, /trusted dispatch\/task receipt/i);
  assert.match(agentSkill, /independent task-scoped artifacts or postconditions/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Delegated result-to-dispatch provenance/g)].length, 2);
  assert.match(generated, /actual child\/session origin/i);
  assert.match(generated, /neither claim completion nor replay ambiguous work/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /trusted dispatch\/task receipt/i);
  assert.match(scoped, /actual child\/session origin/i);
  assert.match(scoped, /independently[\r\n ]+inspect task-scoped artifacts or postconditions/i);
  assert.match(scoped, /neither claim completion nor replay ambiguous work/i);
});

test("verifies materialized delegated transcript artifacts across distributions", async () => {
  assert.match(agentSkill, /Delegated artifact materialization integrity/i);
  assert.match(agentSkill, /empty placeholder, missing target, or unrelated transcript/i);
  assert.match(agentSkill, /independently verified alternate child artifact/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Delegated artifact materialization integrity/g)].length, 2);
  assert.match(generated, /verify the actual task-bound file is accessible/i);
  assert.match(generated, /STOP for reconciliation/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /zero-byte placeholder/i);
  assert.match(scoped, /another child session transcript/i);
  assert.match(scoped, /independently verified alternate child/i);
  assert.match(scoped, /STOP before downstream handoff/i);
});


test("guards resumed worktree-isolated children across distributions", async () => {
  assert.match(agentSkill, /Delegated worktree isolation continuity/i);
  assert.match(agentSkill, /still-existing linked worktree, branch/);
  assert.match(agentSkill, /STOP write-capable resume/);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Delegated worktree isolation continuity/g)].length, 2);
  assert.match(generated, /shared\/main checkout/);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /linked worktree, branch and HEAD/);
  assert.match(scoped, /redirect a resumed child to shared\/main/);
  assert.match(scoped, /STOP write-capable resume/);
});

test("guards temporary verification workspaces against shared source aliases", async () => {
  assert.match(agentSkill, /Verification workspace alias-safety guard/i);
  assert.match(agentSkill, /Windows junctions\/reparse points/i);
  assert.match(agentSkill, /prefer independent source copies/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Verification workspace alias-safety guard/g)].length, 2);
  assert.match(generated, /application-managed cleanup directories/);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /Windows junction\/reparse points/i);
  assert.match(scoped, /A separate-looking Temp project is not isolation/i);
  assert.match(scoped, /verify physical targets and concurrent writers, or STOP/i);
});

test("guards user-directed shipping artifact scope across MCP distributions", async () => {
  assert.match(agentSkill, /User-directed ship-artifact scope freeze/i);
  assert.match(agentSkill, /unless the user explicitly amends the shipping scope/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/User-directed ship-artifact scope freeze/g)].length, 2);
  assert.match(generated, /Freeze the user-specified ready artifact/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /Intervening side questions, optional research/i);
  assert.match(scoped, /restart costly delegated fact-checks/i);
  assert.match(scoped, /unless the user explicitly amends shipping scope/i);
  assert.match(scoped, /material correctness\/security risk, STOP/i);
});

test("preserves resumed model and effort fidelity across MCP distributions", async () => {
  assert.match(agentSkill, /Resumed agent execution-profile fidelity/i);
  assert.match(agentSkill, /effective model and effort/i);
  assert.match(agentSkill, /never silently substitute models/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Resumed agent execution-profile fidelity/g)].length, 2);
  assert.match(generated, /retained agent name or old launch banner/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /actual resumed model and effort/i);
  assert.match(scoped, /A retained agent name or old launch banner/i);
  assert.match(scoped, /Never silently substitute models, raise spend/i);
});


test("nominal read-only probes require verified non-mutating behavior across distributions", async () => {
  assert.match(agentSkill, /Nominal read-only probe integrity/i);
  assert.match(agentSkill, /A probe's name alone is not evidence/i);
  assert.match(agentSkill, /report readiness unverified/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Nominal read-only probe integrity/g)].length, 2);
  assert.match(generated, /lock, or backup files/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /a CLI command called/i);
  assert.match(scoped, /Such a test does not verify live credentials/i);
  assert.match(scoped, /scope-authorized write/i);
  assert.match(scoped, /report readiness unverified/i);
});
test("binds externalized MCP tool results to their own calls across distributions", async () => {
  assert.match(agentSkill, /Direct MCP result-artifact identity guard/i);
  assert.match(agentSkill, /same timestamp-derived path/i);
  assert.match(agentSkill, /do not replay an uncertain mutating call/i);
  const generated = await readFile(new URL("../src/content.ts", import.meta.url), "utf8");
  assert.equal([...generated.matchAll(/Direct MCP result-artifact identity guard/g)].length, 2);
  assert.match(generated, /call-distinct artifacts/i);
  const scoped = await readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8");
  assert.match(scoped, /another call's result/i);
  assert.match(scoped, /STOP downstream effects/i);
  assert.match(scoped, /never blindly replay an uncertain mutating call/i);
});

test("unattended approval handoff is mirrored across consumer surfaces", async () => {
  const [generated, skill, scoped] = await Promise.all([
    readFile(new URL("../src/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
  ]);
  const guard = "**Unattended permission-handoff guard:**";
  assert.equal(generated.split(guard).length - 1, 2);
  assert.equal(skill.split(guard).length - 1, 1);
  for (const text of [generated, skill, scoped]) {
    assert.match(text, /NEEDS_HUMAN_APPROVAL/);
    assert.match(text, /host.{0,80}scheduler slot/i);
    assert.match(text, /Never auto-approve/i);
  }
});

test("project configuration effective-load readiness across consumer surfaces", async () => {
  const [generated, portable, scoped] = await Promise.all([
    readFile(new URL("../src/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
  ]);
  const guard = "**Project configuration effective-load readiness:**";
  assert.equal(generated.split(guard).length - 1, 2);
  assert.equal(portable.split(guard).length - 1, 1);
  for (const value of [generated, portable]) {
    assert.match(value, /pre-warmed, relocated, or delegated session/);
    assert.match(value, /effective instruction content\/source and live governing policy/);
    assert.match(value, /STOP for reload\/reconciliation/);
  }
  assert.match(scoped, /pre-warmed, relocated, resumed, or delegated session/);
  assert.match(scoped, /A valid config file, accepted instruction path/);
  assert.match(scoped, /STOP for reload\/reconciliation/);
});

test("provider-switch lineage guard is preserved across consumer distributions", async () => {
  const [generated, portable, scoped] = await Promise.all([
    readFile(new URL("../src/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
  ]);
  const heading = "**Provider-transition message-lineage integrity:**";
  assert.equal(generated.split(heading).length - 1, 2);
  assert.equal(portable.split(heading).length - 1, 1);
  for (const content of [generated, portable, scoped]) {
    assert.match(content, /previous_message_id/);
    assert.match(content, /transcript\/state/);
    assert.match(content, /host-owned session metadata/);
  }
});

test("guards effective sandbox startup across all consumer surfaces", async () => {
  const [generated, portable, scoped] = await Promise.all([
    readFile(new URL("../src/content.ts", import.meta.url), "utf8"),
    readFile(new URL("../skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../distribution/openai/skills/god-prompt/SKILL.md", import.meta.url), "utf8"),
  ]);
  const guard = "**Effective sandbox startup boundary:**";
  assert.equal(generated.split(guard).length - 1, 2);
  assert.equal(portable.split(guard).length - 1, 1);
  for (const content of [generated, portable]) {
    assert.match(content, /sandbox initialization and required bridge\/proxy controls/);
    assert.match(content, /failIfUnavailable/);
    assert.match(content, /Never silently reroute unsandboxed/);
  }
  assert.match(scoped, /sandbox initialization and bridge\/proxy controls/);
  assert.match(scoped, /failIfUnavailable/);
  assert.match(scoped, /never silently reroute unsandboxed/);
});
