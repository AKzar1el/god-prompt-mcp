const assert = require("node:assert/strict");
const vscode = require("vscode");
exports.run = async function () {
  const ext = vscode.extensions.getExtension("tomiseregi.godprompt-engineering");
  assert.ok(ext);
  await ext.activate();
  const guideUri = await vscode.commands.executeCommand("godpromptEngineering.openGuide", { type: "DEBUG", phase: "verify" });
  const guide = vscode.workspace.textDocuments.find(d => d.uri.toString() === guideUri);
  assert.ok(guide?.isUntitled && guide.languageId === "markdown");
  assert.ok(guide.getText().includes("DEBUG Quality Gate"));
  const briefUri = await vscode.commands.executeCommand("godpromptEngineering.draftBrief", { type: "BUILD", phase: "plan", task: "Add one test" });
  const brief = vscode.workspace.textDocuments.find(d => d.uri.toString() === briefUri);
  assert.ok(brief?.isUntitled);
  assert.ok(brief.getText().includes("> Add one test"));
  assert.ok(brief.getText().includes("Acceptance criteria"));
  await assert.rejects(vscode.commands.executeCommand("godpromptEngineering.openGuide", { type: "INVALID", phase: "plan" }));
  if (process.env.EDITOR_TEST_RECEIPT) require("node:fs").writeFileSync(process.env.EDITOR_TEST_RECEIPT, JSON.stringify({ extension: ext.id, version: vscode.version, status: "passed" }), { flag: "wx" });
  console.log("GODPROMPT_EXTENSION_HOST_OK " + vscode.version);
};
