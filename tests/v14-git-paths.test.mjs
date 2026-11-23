import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve, sep } from "node:path";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync,
  rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { changedGitPaths, splitGitNulPaths } from
  "../benchmarks/agent-ab/real-repos/v14-git-paths.mjs";

test("V14 Git NUL path parser preserves every character and refuses truncated output", () => {
  assert.deepEqual(splitGitNulPaths("src/a.py\0tests/hello world.py\0"),
    ["src/a.py", "tests/hello world.py"]);
  assert.deepEqual(splitGitNulPaths(""), []);
  assert.throws(() => splitGitNulPaths("src/file.py"), /Incomplete/);
  assert.throws(() => splitGitNulPaths("src/file.py\0\0"), /Malformed/);
});

test("V14 Git paths correctly identify staged, tracked, and untracked changes", () => {
  const parent = resolve(realpathSync(tmpdir()));
  const dir = mkdtempSync(join(parent, "gp-v14-git-paths-"));
  const child = name => join(dir, name);
  const git = args => execFileSync("git", args, { cwd: dir, encoding: "utf8", windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, timeout: 60000 });
  try {
    assert.ok(lstatSync(dir).isDirectory() && !lstatSync(dir).isSymbolicLink());
    assert.equal(resolve(realpathSync(dir)), resolve(dir));
    git(["init", "--quiet"]);
    git(["config", "user.name", "Benchmark Fixture"]);
    git(["config", "user.email", "fixture@example.invalid"]);
    mkdirSync(child("src/mcp_trendpulse"), { recursive: true });
    writeFileSync(child("src/mcp_trendpulse/cli.py"), "original\n");
    writeFileSync(child("src/mcp_trendpulse/rss_compare.py"), "original\n");
    git(["add", "src/mcp_trendpulse/cli.py", "src/mcp_trendpulse/rss_compare.py"]);
    git(["commit", "--quiet", "-m", "Fixture"]);
    assert.deepEqual(changedGitPaths(dir), []);
    writeFileSync(child("src/mcp_trendpulse/cli.py"), "modified\n");
    writeFileSync(child("src/mcp_trendpulse/rss_compare.py"), "modified\n");
    git(["add", "src/mcp_trendpulse/rss_compare.py"]);
    mkdirSync(child("tests"), { recursive: true });
    writeFileSync(child("tests/test_rss_compare.py"), "new\n");
    assert.deepEqual(changedGitPaths(dir), [
      "src/mcp_trendpulse/cli.py",
      "src/mcp_trendpulse/rss_compare.py",
      "tests/test_rss_compare.py",
    ]);
    writeFileSync(child("tests/space name.py"), "with space\n");
    assert.ok(changedGitPaths(dir).includes("tests/space name.py"));
  } finally {
    // Delete only the freshly generated fixture and only when its physical
    // parent and relative path still match this owned temp scope.
    const realParent = resolve(realpathSync(dirname(dir)));
    const rel = relative(parent, dir);
    if (realParent !== parent || !rel.startsWith("gp-v14-git-paths-") ||
        rel.includes(sep) || !existsSync(dir) || lstatSync(dir).isSymbolicLink() ||
        resolve(realpathSync(dir)) !== resolve(dir)) {
      throw new Error("Temporary Git fixture cleanup identity not verified");
    }
    rmSync(dir, { recursive: true });
  }
});
