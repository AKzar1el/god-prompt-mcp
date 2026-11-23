#!/usr/bin/env node
/**
 * V13 research-only semantic check for pinned published-package CLI examples.
 *
 * This is deliberately NOT a shell runner and NEVER executes candidate text.
 * Unsupported but plausible command syntax requests independent adjudication,
 * rather than turning a grading-parser limitation into an incorrect-model score.
 */
const MARK = String.fromCharCode(96);
const DEFAULTS = Object.freeze({
  packageSpec: "mcp-trendpulse==0.3.0",
  program: "mcp-trendpulse-cli",
  subcommands: ["rss-review", "rss-compare"],
});

function shellWords(command) {
  if (typeof command !== "string" || command.includes("\n") || command.includes("\r") ||
      command.length > 1200) return null;
  const words = [];
  let word = "";
  let started = false;
  let quote = null;
  for (const ch of command) {
    if (quote !== null) {
      if (ch === quote) quote = null;
      else if (ch === "\\") return null;
      else { word += ch; started = true; }
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; started = true; continue; }
    if (/\s/u.test(ch)) {
      if (started) { words.push(word); word = ""; started = false; }
      continue;
    }
    // Deliberately refuse shell composition, expansion and escaping:
    // valid but unfamiliar examples go to REVIEW, never to execution.
    if (";&|<>$(){}\\\n".includes(ch) || ch === MARK) return { unsafe: true };
    word += ch;
    started = true;
  }
  if (quote !== null) return null;
  if (started) words.push(word);
  return words;
}

function commandLines(markdown) {
  const found = new Set();
  let inFence = false;
  const fenceMarker = MARK.repeat(3);
  for (const raw of markdown.split(/\r?\n/u)) {
    const line = raw.trim();
    if (line.startsWith(fenceMarker)) {
      inFence = !inFence;
      continue;
    }
    const normalized = line.replace(/^\$\s+/u, "").replace(/^[-*]\s+/u, "");
    if (/^uvx(?:\.exe)?\s/u.test(normalized)) found.add(normalized);
    const spans = line.split(MARK);
    for (let i = 1; i < spans.length; i += 2) {
      const candidate = spans[i].trim().replace(/^\$\s+/u, "");
      if (/^uvx(?:\.exe)?\s/u.test(candidate)) found.add(candidate);
    }
    // Do not accept code quoted as a fragment across multiple lines; it
    // needs human review when a plausible but unsupported form is supplied.
    if (inFence && normalized.startsWith("uvx") && !normalized.includes(" ")) {
      found.add(normalized);
    }
  }
  return [...found];
}

function parseExample(command, opts) {
  const words = shellWords(command);
  if (words === null) return { kind: "review", reason: "Unbalanced or unsupported shell syntax" };
  if (words.unsafe) return { kind: "invalid", reason: "Shell composition or expansion" };
  if (words[0] !== "uvx" && words[0] !== "uvx.exe") {
    return { kind: "invalid", reason: "Not a uvx command" };
  }

  let from = null;
  let i = 1;
  while (i < words.length) {
    const option = words[i];
    if (option === "--from" || option === "--python" || option === "-p") {
      if (i + 1 >= words.length || !words[i + 1] ||
          words[i + 1].startsWith("-")) return { kind: "review", reason: "Incomplete option" };
      if (option === "--from") {
        if (from !== null) return { kind: "review", reason: "Repeated package option" };
        from = words[i + 1];
      }
      i += 2;
      continue;
    }
    if (option.startsWith("--from=")) {
      if (from !== null) return { kind: "review", reason: "Repeated package option" };
      from = option.slice("--from=".length);
      i++;
      continue;
    }
    if (option.startsWith("--python=")) {
      if (!option.slice("--python=".length)) return { kind: "review", reason: "Empty Python selection" };
      i++;
      continue;
    }
    if (option.startsWith("-")) {
      return { kind: "review", reason: "Unrecognized uvx option" };
    }
    break;
  }

  if (from !== opts.packageSpec) return { kind: "invalid", reason: "Wrong or unpinned package" };
  const rest = words.slice(i);
  if (rest.length !== 3 || rest[0] !== opts.program || rest[2] !== "--help" ||
      !opts.subcommands.includes(rest[1])) {
    return { kind: "invalid", reason: "Wrong CLI command or arguments" };
  }
  return { kind: "valid", subcommand: rest[1] };
}

export function gradePinnedUvxHelp(markdown, options = {}) {
  if (typeof markdown !== "string" || markdown.length > 300_000) {
    throw new TypeError("Expected bounded Markdown string");
  }
  const opts = { ...DEFAULTS, ...options };
  const seen = new Set();
  const review = [];
  const rejected = [];
  for (const command of commandLines(markdown)) {
    const result = parseExample(command, opts);
    if (result.kind === "valid") seen.add(result.subcommand);
    if (result.kind === "review") review.push({ command, reason: result.reason });
    if (result.kind === "invalid") rejected.push({ command, reason: result.reason });
  }
  const accepted = opts.subcommands.filter(name => seen.has(name));
  const missing = opts.subcommands.filter(name => !seen.has(name));
  // Do not promote an unfamiliar flag or parser limit into a model failure.
  const status = !missing.length ? "PASS" : review.length ? "REVIEW" : "FAIL";
  return { status, accepted, missing, review_candidates: review, rejected_candidates: rejected };
}
