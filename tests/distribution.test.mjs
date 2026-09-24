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
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/server"], "2.1.0");
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
  assert.match(workerSource, /createMcpHandler\(createServer\)/);
  assert.match(workerSource, /export class GodPromptMCP/);
  assert.doesNotMatch(workerSource, /McpAgent|\.serve\(/);
});
