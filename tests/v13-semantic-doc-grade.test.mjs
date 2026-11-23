import test from "node:test";
import assert from "node:assert/strict";
import { gradePinnedUvxHelp } from "../benchmarks/agent-ab/real-repos/v13-semantic-doc-grade.mjs";

const fence = String.fromCharCode(96).repeat(3);
const inline = String.fromCharCode(96);
const pkg = "mcp-trendpulse==0.3.0";
const commands = (review, compare) => [
  fence + "bash", review, compare, fence,
].join("\n");

test("V13 accepts semantically equivalent pinned uvx commands without layout or flag-order bias", () => {
  const pairs = [
    ["uvx --from " + pkg, "mcp-trendpulse-cli"],
    ["uvx --python 3.11 --from " + pkg, "mcp-trendpulse-cli"],
    ["uvx --from " + pkg + " --python 3.11", "mcp-trendpulse-cli"],
    ["uvx --python=3.11 --from=" + pkg, "mcp-trendpulse-cli"],
    ["uvx -p python3.11 --from " + pkg, "mcp-trendpulse-cli"],
    ["uvx --from '" + pkg + "'", "'mcp-trendpulse-cli'"],
  ];
  for (const [prefix, cli] of pairs) {
    const source = commands(prefix + " " + cli + " rss-review --help",
      prefix + " " + cli + " rss-compare --help");
    const result = gradePinnedUvxHelp(source);
    assert.equal(result.status, "PASS", source + ": " + JSON.stringify(result));
    assert.deepEqual(result.accepted, ["rss-review", "rss-compare"]);
  }
});

test("V13 accepts pinned commands in inline prose and separate fenced blocks", () => {
  const source = "Published tools: " +
    inline + "uvx --python 3.11 --from " + pkg +
      " mcp-trendpulse-cli rss-review --help" + inline + "\n\n" +
    fence + "powershell\nuvx --from " + pkg +
      " mcp-trendpulse-cli rss-compare --help\n" + fence;
  assert.equal(gradePinnedUvxHelp(source).status, "PASS");
});

test("V13 rejects missing, unpinned, wrong-version and chained example commands", () => {
  const goodReview = "uvx --from " + pkg + " mcp-trendpulse-cli rss-review --help";
  const badCompare = [
    "",
    "uvx --from mcp-trendpulse mcp-trendpulse-cli rss-compare --help",
    "uvx --from mcp-trendpulse==0.2.99 mcp-trendpulse-cli rss-compare --help",
    "uvx --from " + pkg + " mcp-trendpulse-cli rss-compare --help && echo ok",
    "uvx --from " + pkg + " mcp-trendpulse-cli rss-compare",
    "uvx --from " + pkg + " mcp-trendpulse-cli rss-review --help",
  ];
  for (const value of badCompare) {
    assert.equal(gradePinnedUvxHelp(commands(goodReview, value)).status, "FAIL", value);
  }
});

test("V13 does not misgrade unfamiliar possible valid options; it requires review", () => {
  const review = "uvx --offline --from " + pkg + " mcp-trendpulse-cli rss-review --help";
  const compare = "uvx --from " + pkg + " mcp-trendpulse-cli rss-compare --help";
  const result = gradePinnedUvxHelp(commands(review, compare));
  assert.equal(result.status, "REVIEW");
  assert.ok(result.review_candidates.length > 0);
});

test("V13 never executes Markdown command text, redirects or shell expansion", () => {
  const malicious = "uvx --from " + pkg + " mcp-trendpulse-cli rss-review --help > output.txt";
  const safe = "uvx --from " + pkg + " mcp-trendpulse-cli rss-compare --help";
  assert.equal(gradePinnedUvxHelp(commands(malicious, safe)).status, "FAIL");
});

test("V13 fails closed on malformed quotes and command line syntax", () => {
  const broken = "uvx --from '" + pkg + " mcp-trendpulse-cli rss-review --help";
  const compare = "uvx --from " + pkg + " mcp-trendpulse-cli rss-compare --help";
  assert.equal(gradePinnedUvxHelp(commands(broken, compare)).status, "REVIEW");
});
