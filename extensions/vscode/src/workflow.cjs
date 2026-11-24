const TYPES = Object.freeze(["BUILD", "DEBUG", "REFACTOR", "CONTENT", "DESIGN", "SHIP", "ANALYZE", "AUTOMATE", "PLAN"]);
const PHASES = Object.freeze(["plan", "execute", "verify", "handoff"]);

function section(text, title) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let start = -1;
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = /^\s{0,3}([~]{3,}|[\x60]{3,})(.*)$/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (fence || !/^##\s/.test(lines[i])) continue;
    if (start >= 0) return lines.slice(start, i).join("\n").trim();
    if (lines[i].trim() === "## " + title) start = i;
  }
  return start < 0 ? "" : lines.slice(start).join("\n").trim();
}

function firstSubsection(text) {
  const lines = text.split("\n");
  let first = false;
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const marker = /^\s{0,3}([~]{3,}|[\x60]{3,})(.*)$/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (!fence && /^###\s/.test(lines[i])) {
      if (first) return lines.slice(0, i).join("\n").trim();
      first = true;
    }
  }
  return text;
}

function buildGuidance(protocols, gates, version) {
  if (!/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version)) throw new Error("Invalid source version");
  const universal = section(gates, "Universal Gate (EVERY task, no exceptions)");
  if (!universal) throw new Error("Universal gate missing");
  const workflows = {};
  for (const type of TYPES) {
    const protocol = section(protocols, type + " Protocol");
    if (!protocol) throw new Error("Protocol missing: " + type);
    const gate = section(gates, type + " Quality Gate");
    workflows[type] = {
      plan: firstSubsection(protocol),
      execute: protocol,
      verify: [universal, gate].filter(Boolean).join("\n\n"),
      handoff: gate || universal,
    };
  }
  return { version, workflows };
}

function guide(guidance, type, phase) {
  if (!TYPES.includes(type) || !PHASES.includes(phase)) throw new Error("Unsupported workflow or phase");
  const content = guidance.workflows[type]?.[phase];
  if (typeof content !== "string" || !content) throw new Error("Bundled guidance is missing");
  return "# GodPrompt " + type + " / " + phase + "\n\n" +
    "Source: GodPrompt MCP " + guidance.version + " bundled reference documents.\n\n" +
    "Guidance only. No repository inspection, command execution, permission grant or verification occurred.\n\n" + content + "\n";
}

function draft(guidance, { task, type, phase }) {
  if (typeof task !== "string" || !task.trim() || task.length > 500 || /[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/.test(task)) {
    throw new Error("Enter a single-line task description of 1-500 characters.");
  }
  const guidanceText = guide(guidance, type, phase);
  return "# Engineering task brief\n\n## Task\n\n> " + task.trim() + "\n\n" +
    "## Scope and authority\n\n- [ ] Identify the exact repository/worktree and revision.\n" +
    "- [ ] List permitted paths and out-of-scope actions.\n- [ ] Record any required user approvals.\n\n" +
    "## Acceptance criteria\n\n- [ ] [Specify an observable outcome.]\n\n" +
    "## Verification plan\n\n- [ ] [Supply an actual repository-appropriate verification command.]\n" +
    "- [ ] Record real exit status, relevant output and artifact identity after execution.\n\n" +
    "## Delivery\n\n- [ ] Summarize changed files, evidence, limitations and rollback.\n\n" + guidanceText;
}

module.exports = { TYPES, PHASES, section, buildGuidance, guide, draft };
