import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);
const stdioSource = await readFile(
  new URL("../src/stdio.ts", import.meta.url),
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
  assert.equal(packageJson.scripts?.prepare, "npm run build");
  assert.equal(packageJson.scripts?.prepublishOnly, "npm test");
  assert.match(stdioSource, /^#!\/usr\/bin\/env node\n/);
});
