import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const guide = await readFile(new URL("../llms-install.md", import.meta.url), "utf8");

test("Cline install verification describes the nine-tool v1.1.1 catalog and older installations", () => {
  const verification = guide.split("## Verify\n")[1]?.split("\n## ")[0];
  assert.ok(verification, "Expected Cline verification instructions");
  assert.match(verification, /nine tools/i);
  for (const name of [
    "get_god_prompt", "get_core_skill", "get_protocols", "get_gates",
    "get_anti_patterns", "classify_task", "get_version",
    "create_work_contract", "review_work_evidence",
  ]) {
    assert.ok(verification.includes(`\`${name}\``), `Missing ${name} from verification instructions`);
  }
  assert.match(verification, /older|version-pinned/i);
  assert.match(verification, /get_version/);
});

test("Cline install guide explains the Windows npx shim fallback without blanket approval", () => {
  assert.match(guide, /spawn npx(?:\.cmd)? (?:ENOENT|EINVAL)/i);
  const windowsSection = guide.split("### Windows stdio launcher fallback\n")[1];
  assert.ok(windowsSection, "Expected a Windows launcher fallback section");
  const configText = windowsSection.match(/```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(configText, "Expected copyable JSON configuration");
  const config = JSON.parse(configText).mcpServers["god-prompt"];
  assert.equal(config.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(config.args, ["/d", "/s", "/c", "npx -y god-prompt-mcp"]);
  assert.deepEqual(config.autoApprove, []);
  assert.match(guide, /autoApprove.*empty/i);
});
