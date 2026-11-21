#!/usr/bin/env node
/** Independent read-only public-repo task grader; no model, shell, or network tasks. */
import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const suite = JSON.parse(await readFile(new URL("./suite.json", import.meta.url), "utf8"));
const [taskId, checkoutArg] = process.argv.slice(2);
if (!taskId || !checkoutArg) {
  console.error("Usage: node grader.mjs TASK_ID CHECKOUT_ABSOLUTE_PATH");
  process.exit(2);
}
const task = suite.tasks.find((entry) => entry.task_id === taskId);
if (!task || !resolve(checkoutArg).includes(sep + "real-runs" + sep)) {
  console.error("Unknown task or checkout is outside the experiment workspace");
  process.exit(2);
}
const checkout = resolve(checkoutArg);
const info = await lstat(checkout);
if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Linked or missing checkout");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: checkout, timeout: 8000, encoding: "utf8", windowsHide: true,
}).trim();
if (head !== task.source_sha) throw new Error("Wrong source SHA: refusing to grade");

const status = execFileSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
  cwd: checkout, timeout: 8000, encoding: "utf8", windowsHide: true,
});
const touched = status.split(/\r?\n/).filter(Boolean).map(line => line.slice(3).trim())
  .map(line => line.includes(" -> ") ? line.split(" -> ").at(-1) : line);
const outsideScope = touched.filter(path => !task.allowed_paths.includes(path.replaceAll("\\", "/")));
const failures = [];
let checks = 0;
const check = (name, callback) => {
  checks++;
  try { callback(); }
  catch (error) { failures.push({ name, reason: String(error?.message ?? error).slice(0, 350) }); }
};
const page = (html) => ({
  requestedUrl: "https://example.org/",
  canonicalUrl: "https://example.org/",
  fetchedAt: "2026-08-28T20:00:00.000Z",
  html,
});
const codesOf = (analyzePage, html) => analyzePage(page(html)).findings.map(f => f.code);
const start = performance.now();
if (taskId.startsWith("auvrora-")) {
  const file = resolve(checkout, "src/lib/audit/analyze-page.ts");
  const { analyzePage } = await import(pathToFileURL(file).href);
  if (typeof analyzePage !== "function") throw new Error("No audit analyzer");
  if (taskId === "auvrora-template-inert") {
    const inert = '<html lang="en"><head><title>A sufficiently detailed title for the audit grader</title>' +
      '<meta name="description" content="' + "X".repeat(95) + '">' +
      '<meta name="viewport" content="width=device-width"></head><body>' +
      '<template id="inactive"><h1>Fake</h1><img src="/hidden.png">' +
      '<template><h1>Deep fake</h1><img src="/deep.png"></template>' +
      '<link rel="canonical" href="https://example.org/">' +
      '<meta name="robots" content="noindex"></template></body></html>';
    const inertCodes = codesOf(analyzePage, inert);
    check("inert_template_does_not_hide_missing_h1", () => assert.ok(inertCodes.includes("missing_h1")));
    check("inert_template_canonical_is_not_counted", () => assert.ok(inertCodes.includes("missing_canonical")));
    check("inert_template_images_not_scored", () => assert.ok(!inertCodes.includes("images_missing_alt")));
    check("inert_template_robots_not_scored", () => assert.ok(!inertCodes.includes("noindex_detected")));

    const visible = '<html lang="en"><head><title>A sufficiently detailed title for the audit grader</title>' +
      '<meta name="description" content="' + "X".repeat(95) + '">' +
      '<meta name="viewport" content="width=device-width">' +
      '<link rel="canonical" href="https://example.org/"></head>' +
      '<body><h1>Visible</h1><img alt="Visible" src="/visible">' +
      '<template><h1>Hidden</h1><img src="/hidden"></template></body></html>';
    const visibleCodes = codesOf(analyzePage, visible);
    check("visible_h1_still_counted", () => assert.ok(!visibleCodes.includes("missing_h1")));
    check("inert_template_h1_does_not_duplicate", () => assert.ok(!visibleCodes.includes("multiple_h1")));
    check("visible_img_alt_not_polluted", () => assert.ok(!visibleCodes.includes("images_missing_alt")));
    check("visible_canonical_still_counted", () => assert.ok(!visibleCodes.includes("missing_canonical")));
  } else if (taskId === "auvrora-specific-robots") {
    const html = '<html><head>{META}</head><body><h1>Visible</h1></body></html>';
    const checkDirective = (name, tag, expected) => check(name, () => {
      const codes = codesOf(analyzePage, html.replace("{META}", tag));
      assert.equal(codes.includes("noindex_detected"), expected);
    });
    checkDirective("googlebot_noindex", '<meta name="googlebot" content="noindex, follow">', true);
    checkDirective("bingbot_none", '<meta NAME="BINGBOT" content="NONE">', true);
    checkDirective("googlebot_uppercase", '<meta name="GOOGLEBOT" content="NOINDEX">', true);
    checkDirective("generic_robots_preserved", '<meta name="robots" content="index, noindex">', true);
    checkDirective("googlebot_index_does_not_trigger", '<meta name="googlebot" content="index, follow">', false);
    checkDirective("unrelated_meta_noindex_does_not_trigger", '<meta name="description" content="noindex">', false);
  }
} else if (taskId === "geo-safe-domain-errors") {
  const file = resolve(checkout, "src/core/domain.ts");
  const { DomainInputError, normalizeRequiredDomain, normalizeCompetitorDomains, normalizeDomainInput } =
    await import(pathToFileURL(file).href);
  const sentinel = "PRIVATE-TAIL-SHOULD-NOT-REAPPEAR-97Z4";
  const huge = "bad_domain\r\n" + "X".repeat(1000) + sentinel;
  const capture = (call) => {
    try { call(); return null; } catch (error) { return error; }
  };
  const required = capture(() => normalizeRequiredDomain(huge));
  const competitor = capture(() => normalizeCompetitorDomains([huge], "example.com"));
  for (const [label, error] of [["required", required], ["competitor", competitor]]) {
    check(label + "_retains_error_type", () => assert.ok(error instanceof DomainInputError));
    check(label + "_message_bounded", () => assert.ok((error?.message?.length ?? Infinity) <= 240));
    check(label + "_no_control_characters", () => assert.doesNotMatch(error?.message ?? "", /[\x00-\x1f\x7f]/));
    check(label + "_does_not_echo_tail", () => assert.ok(!String(error?.message).includes(sentinel)));
  }
  check("valid_domain_unchanged", () => assert.equal(normalizeDomainInput("https://www.EXAMPLE.COM/path"), "example.com"));
  check("valid_competitor_unchanged", () => assert.deepEqual(normalizeCompetitorDomains(["www.foo.com", "foo.com"], "example.com"), ["foo.com"]));
}
if (checks === 0) throw new Error("No grader checks matched the task");
const report = {
  schema: "godprompt.real_repo_grade.v1", suite_id: suite.suite_id,
  task_id: taskId, repo: task.repo, source_sha: head,
  checks, passed_checks: checks - failures.length,
  passed: failures.length === 0 && outsideScope.length === 0,
  failures, outside_scope_changes: outsideScope, changed_files: touched,
  elapsed_ms: Math.round((performance.now() - start) * 1000) / 1000,
};
report.receipt_sha256 = createHash("sha256").update(JSON.stringify(report)).digest("hex");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
