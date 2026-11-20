/** Baseline intentionally fails every targeted test. Graders must use isolated copies. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  clamp,stableUnique,strictInteger,encodeQueryValue,paginate,utcDayKey,
  safeRelative,parseCsvRow,cappedBackoff,mergeConfig,sortNumbers,countBy,
} from "./broken.mjs";
test("clamp-bounds",()=>assert.equal(clamp(5,0,10),5));
test("stable-unique",()=>assert.deepEqual(stableUnique(["a","b","a","c"]),["a","b","c"]));
test("parse-integer",()=>assert.ok(Number.isNaN(strictInteger("12oops"))));
test("percent-encode",()=>assert.equal(encodeQueryValue("a&b=c"),"a%26b%3Dc"));
test("paginate-last-page",()=>assert.deepEqual(paginate([0,1,2,3,4],2,2),[4]));
test("utc-day-key",()=>assert.equal(utcDayKey("2026-01-25T23:10:00Z"),"2026-01-25"));
test("relative-path",()=>assert.equal(safeRelative("src/../../.env"),false));
test("csv-quoted-comma",()=>assert.deepEqual(parseCsvRow('a,"b,c",d'),["a","b,c","d"]));
test("retry-cap",()=>assert.equal(cappedBackoff(7,100,800),800));
test("merge-no-mutate",()=>{
 const defaults={mode:"safe",retry:2};
 const result=mergeConfig(defaults,{retry:3});
 assert.equal(result.retry,3);
 assert.equal(defaults.retry,2);
});
test("sort-numeric",()=>assert.deepEqual(sortNumbers([9,10,2]),[2,9,10]));
test("group-prototype",()=>{
 const grouped=countBy(["__proto__","ok","__proto__"]);
 assert.equal(Object.hasOwn(grouped,"__proto__"),true);
 assert.equal(grouped["__proto__"],2);
 assert.equal(grouped.ok,1);
});
