import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
const wranglerConfig = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
);
const agentPlugin = JSON.parse(
  await readFile(new URL("../plugin.json", import.meta.url), "utf8")
);
const agentMcp = JSON.parse(
  await readFile(new URL("../mcp.json", import.meta.url), "utf8")
);
const cursorPlugin = JSON.parse(
  await readFile(new URL("../.cursor-plugin/plugin.json", import.meta.url), "utf8")
);
const cursorMcp = JSON.parse(
  await readFile(new URL("../cursor-mcp.json", import.meta.url), "utf8")
);
const claudePlugin = JSON.parse(
  await readFile(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8")
);
const claudeMcp = JSON.parse(
  await readFile(new URL("../.mcp.json", import.meta.url), "utf8")
);
const geminiExtension = JSON.parse(
  await readFile(new URL("../gemini-extension.json", import.meta.url), "utf8")
);
const agentSkill = await readFile(
  new URL("../skills/god-prompt/SKILL.md", import.meta.url),
  "utf8"
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

test("uses the split MCP SDK v2 without the Workers-only Agents SDK", () => {
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/sdk"], undefined);
  assert.equal(packageJson.dependencies?.["@modelcontextprotocol/server"], "2.0.0");
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
  const expectedServer = {
    type: "stdio",
    command: "npx",
    args: ["-y", "god-prompt-mcp"],
  };

  assert.equal(agentPlugin.version, packageJson.version);
  assert.equal(cursorPlugin.version, packageJson.version);
  assert.equal(claudePlugin.version, packageJson.version);
  assert.equal(geminiExtension.version, packageJson.version);
  assert.equal(mcpbManifest.version, packageJson.version);
  assert.equal(serverJson.version, packageJson.version);
  assert.deepEqual(agentMcp.mcpServers?.["god-prompt-mcp"], expectedServer);
  assert.deepEqual(claudeMcp.mcpServers?.["god-prompt-mcp"], expectedServer);
  assert.deepEqual(geminiExtension.mcpServers?.["god-prompt-mcp"], {
    command: "npx",
    args: ["-y", "god-prompt-mcp"],
  });
  assert.deepEqual(cursorMcp.mcpServers?.["god-prompt-mcp"], {
    command: "npx",
    args: ["-y", "god-prompt-mcp"],
  });
  assert.equal(cursorPlugin.mcpServers, "cursor-mcp.json");
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
