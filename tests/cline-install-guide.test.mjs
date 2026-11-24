import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const guide = await readFile(new URL("../llms-install.md", import.meta.url), "utf8");

test("Cline verification is version-aware for v1.1.1 and v1.5.0", () => {
  const verification = guide.split("## Verify\n")[1]?.split("\n## ")[0];
  assert.ok(verification, "Expected Cline verification instructions");
  assert.match(verification, /v1\.1\.1/);
  assert.match(verification, /nine tools/i);
  assert.match(verification, /v1\.5\.0/);
  assert.match(verification, /22 tools/i);
  for (const name of [
    "get_god_prompt",
    "get_core_skill",
    "get_protocols",
    "get_gates",
    "get_anti_patterns",
    "classify_task",
    "get_version",
    "create_work_contract",
    "review_work_evidence",
    "review_code_change",
    "audit_requirements",
    "build_test_matrix",
    "get_tailored_guidance",
    "diagnose_failure",
    "assess_release_readiness",
    "create_context_handoff",
    "compare_evaluation_runs",
    "audit_agent_trajectory",
    "trace_change_impact",
    "review_mcp_tool_contracts",
    "audit_agent_instructions",
    "design_adversarial_tests"
]) {
    assert.ok(verification.includes(String.fromCharCode(96) + name + String.fromCharCode(96)), "Missing " + name + " from version-aware guide");
  }
  assert.match(verification, /GODPROMPT_CODEXIFY_CHECKPOINT=1/);
  assert.match(verification, /version-pinned|installed version/i);
  assert.match(verification, /autoApprove.*empty/i);
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
