import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import worker from "../dist/index.js";
import { buildArdManifest, PUBLIC_ORIGIN } from "../dist/discovery.js";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);

test("publishes ARD entries for the MCP server and portable Agent Skill", () => {
  const manifest = buildArdManifest();

  assert.equal(manifest.entries.length, 2);

  for (const entry of manifest.entries) {
    assert.match(entry.identifier, /^urn:air:god-prompt-mcp\.tomi-seregi99\.workers\.dev:/);
    assert.equal(entry.version, packageJson.version);
    assert.equal(entry.trustManifest.identity, PUBLIC_ORIGIN);
    assert.equal(entry.trustManifest.identityType, "https");
    assert.equal(typeof entry.url, "string");
    assert.ok(entry.url.startsWith("https://"));
    assert.ok(entry.representativeQueries.length >= 2);
    assert.ok(entry.representativeQueries.length <= 5);
  }

  const [mcp, skill] = manifest.entries;
  assert.equal(mcp.type, "application/mcp-server-card+json");
  assert.equal(mcp.url, `${PUBLIC_ORIGIN}/mcp`);
  assert.deepEqual(mcp.capabilities, [
    "get_god_prompt",
    "get_core_skill",
    "get_protocols",
    "get_gates",
    "get_anti_patterns",
    "classify_task",
    "get_version",
  ]);

  assert.equal(skill.type, "application/ai-skill");
  assert.equal(
    skill.url,
    "https://raw.githubusercontent.com/AKzar1el/god-prompt-mcp/main/skills/god-prompt/SKILL.md"
  );
});

test("serves the current ARD well-known path and predecessor alias", async () => {
  for (const pathname of ["/.well-known/ard.json", "/.well-known/ai-catalog.json"]) {
    const response = await worker.fetch(new Request(`${PUBLIC_ORIGIN}${pathname}`));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/json/);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("link") ?? "", /rel="ard"/);
    assert.deepEqual(await response.json(), buildArdManifest());
  }
});

test("keeps unrelated Worker paths closed", async () => {
  const response = await worker.fetch(new Request(`${PUBLIC_ORIGIN}/not-a-route`));
  assert.equal(response.status, 404);
});
