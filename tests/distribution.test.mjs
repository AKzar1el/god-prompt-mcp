import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const serverJson = JSON.parse(
  await readFile(new URL("../server.json", import.meta.url), "utf8")
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
const registryPublishWorkflow = await readFile(
  new URL("../.github/workflows/publish-registry.yml", import.meta.url),
  "utf8"
);
const wranglerConfig = JSON.parse(
  await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
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

test("keeps the Worker-only Agents SDK out of npm runtime dependencies", () => {
  assert.equal(packageJson.dependencies?.agents, undefined);
  assert.equal(packageJson.devDependencies?.agents, "^0.0.98");
});

test("pins cross-platform bundle inputs to LF line endings", () => {
  assert.match(gitAttributes, /^\* text=auto eol=lf$/m);
  assert.equal(buildTsconfig.compilerOptions?.newLine, "lf");
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

test("uses the setup-node OIDC path without the v6 dummy auth-token fallback", () => {
  assert.match(npmPublishWorkflow, /actions\/setup-node@v7/);
  assert.doesNotMatch(npmPublishWorkflow, /NODE_AUTH_TOKEN\s*:/);
  assert.doesNotMatch(npmPublishWorkflow, /registry-url\s*:/);
});

test("binds McpAgent to the Durable Object name required by serve()", () => {
  assert.deepEqual(wranglerConfig.durable_objects?.bindings, [
    {
      name: "MCP_OBJECT",
      class_name: "GodPromptMCP",
    },
  ]);
  assert.match(workerSource, /MCP_OBJECT:\s*DurableObjectNamespace/);
});
