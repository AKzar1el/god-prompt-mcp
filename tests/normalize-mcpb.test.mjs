import test from "node:test";
import assert from "node:assert/strict";

import { normalizeMcpbBuffer } from "../scripts/normalize-mcpb.mjs";

function makeEmptyZip({ unix }) {
  const name = Buffer.from("a.txt");
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0x1234, 10);
  local.writeUInt16LE(0x5678, 12);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(0, 18);
  local.writeUInt32LE(0, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  name.copy(local, 30);

  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE((unix ? 3 << 8 : 0) | 20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0x1234, 12);
  central.writeUInt16LE(0x5678, 14);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(0, 20);
  central.writeUInt32LE(0, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(unix ? 0o644 << 16 : 0, 38);
  central.writeUInt32LE(0, 42);
  name.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([local, central, eocd]);
}

function makeOrderedEmptyZip(names) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;

  for (const value of names) {
    const name = Buffer.from(value);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0x1234, 10);
    local.writeUInt16LE(0x5678, 12);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x1234, 12);
    central.writeUInt16LE(0x5678, 14);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(0o644 << 16, 38);
    central.writeUInt32LE(localOffset, 42);
    name.copy(central, 46);

    locals.push(local);
    centrals.push(central);
    localOffset += local.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...locals, centralDirectory, eocd]);
}

test("normalizes Windows and Unix ZIP host metadata identically", () => {
  const windows = normalizeMcpbBuffer(makeEmptyZip({ unix: false })).buffer;
  const unix = normalizeMcpbBuffer(makeEmptyZip({ unix: true })).buffer;
  assert.deepEqual(windows, unix);
});

test("normalizes ZIP entry order by filename", () => {
  const forward = normalizeMcpbBuffer(
    makeOrderedEmptyZip(["a.txt", "b.txt"])
  ).buffer;
  const reverse = normalizeMcpbBuffer(
    makeOrderedEmptyZip(["b.txt", "a.txt"])
  ).buffer;
  assert.deepEqual(forward, reverse);
});
