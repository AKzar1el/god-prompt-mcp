#!/usr/bin/env node
/**
 * Deterministic, rename-safe and whitespace-safe Git changed-path discovery.
 * No mutation, no network. Git's NUL format is never trimmed or line-sliced.
 */
import { execFileSync } from "node:child_process";

export function splitGitNulPaths(raw) {
  if (typeof raw !== "string") throw new TypeError("Git output must be UTF-8 text");
  if (!raw) return [];
  if (!raw.endsWith("\0")) throw new Error("Incomplete Git -z output");
  const items = raw.slice(0, -1).split("\0");
  if (items.some(name => !name || name.includes("\0"))) {
    throw new Error("Malformed Git path");
  }
  return items;
}

export function changedGitPaths(cwd) {
  const opts = { cwd, encoding: "utf8", windowsHide: true, timeout: 60000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } };
  const tracked = splitGitNulPaths(
    execFileSync("git", ["diff", "--name-only", "-z", "HEAD"], opts));
  const untracked = splitGitNulPaths(
    execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], opts));
  return [...new Set([...tracked, ...untracked])].map(p => p.replaceAll("\\", "/")).sort();
}
