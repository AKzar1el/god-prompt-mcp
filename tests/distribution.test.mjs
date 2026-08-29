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

test("keeps GodPrompt unpublished while exposing a Git-installable stdio binary", () => {
  assert.equal(packageJson.private, true);
  assert.equal(packageJson.bin?.["god-prompt-mcp"], "dist/stdio.js");
  assert.equal(packageJson.scripts?.prepare, "npm run build");
  assert.match(stdioSource, /^#!\/usr\/bin\/env node\n/);
});
