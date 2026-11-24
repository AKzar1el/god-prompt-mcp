const vscode = require("vscode");
const guidance = require("./guidance.json");
const { TYPES, PHASES, guide, draft } = require("./workflow.cjs");

async function chooseWorkflow(options) {
  if (options !== undefined) {
    if (!options || typeof options !== "object" || !TYPES.includes(options.type) || !PHASES.includes(options.phase)) {
      throw new Error("Choose a supported GodPrompt task type and phase.");
    }
    return { type: options.type, phase: options.phase };
  }
  const type = await vscode.window.showQuickPick(TYPES, { title: "GodPrompt engineering workflow", placeHolder: "Choose the task type" });
  if (!type) return;
  const phase = await vscode.window.showQuickPick(PHASES, { title: "GodPrompt workflow phase", placeHolder: "Choose the current phase" });
  if (!phase) return;
  return { type, phase };
}

async function showMarkdown(content) {
  const document = await vscode.workspace.openTextDocument({ language: "markdown", content });
  await vscode.window.showTextDocument(document, { preview: false });
  return document.uri.toString();
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("godpromptEngineering.openGuide", async options => {
      const choice = await chooseWorkflow(options);
      if (!choice) return;
      return showMarkdown(guide(guidance, choice.type, choice.phase));
    }),
    vscode.commands.registerCommand("godpromptEngineering.draftBrief", async options => {
      const choice = await chooseWorkflow(options);
      if (!choice) return;
      const task = options !== undefined ? options.task : await vscode.window.showInputBox({
        title: "GodPrompt task brief", prompt: "Enter a short task description (no secrets)",
        ignoreFocusOut: true,
        validateInput: text => text.trim() && text.length <= 500 ? undefined : "Enter 1-500 characters.",
      });
      if (task === undefined) return;
      return showMarkdown(draft(guidance, { ...choice, task }));
    }),
  );
}

exports.activate = activate;
