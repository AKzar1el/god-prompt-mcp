import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendBoundedReport } from "../scripts/codexify-observer-report-retention.mjs";

test("opt-in observer owns a bounded current report and one previous archive", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "godprompt-report-retention-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const report = join(folder, "reports.jsonl");
  const limit = 120;
  for (let i = 0; i < 10; i++) {
    await appendBoundedReport(report, JSON.stringify({ event: "plan", n: i, completion_authorized: false }) + "\n", limit);
  }
  const current = await readFile(report, "utf8");
  const previous = await readFile(`${report}.previous`, "utf8");
  assert.ok((await stat(report)).size <= limit);
  assert.ok((await stat(`${report}.previous`)).size <= limit);
  assert.ok(current.trim().split("\n").every((x) => JSON.parse(x).completion_authorized === false));
  assert.ok(previous.trim().split("\n").every((x) => JSON.parse(x).completion_authorized === false));
  assert.ok(current.includes('"n":9'));
  assert.ok(!previous.includes('"n":0'), "older summaries must be discarded");
  const before = await readFile(report, "utf8");
  await assert.rejects(appendBoundedReport(report, "x".repeat(121), limit), /oversized/);
  assert.equal(await readFile(report, "utf8"), before, "oversized report must not mutate output");
});
