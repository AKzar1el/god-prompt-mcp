import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_EOCD_SEARCH = 65_557;
const ZIP64_U16_SENTINEL = 0xffff;
const ZIP64_U32_SENTINEL = 0xffffffff;
const FIXED_DOS_TIME = 0x0000;
const FIXED_DOS_DATE = 0x0021; // 1980-01-01
const ZIP_HOST_UNIX = 3;
const CANONICAL_FILE_MODE = 0o644;

function assertRange(buffer, offset, length, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`${label} is outside the archive bounds`);
  }
}

function findEndOfCentralDirectory(buffer) {
  const minOffset = Math.max(0, buffer.length - MAX_EOCD_SEARCH);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;

    assertRange(buffer, offset, 22, "ZIP end-of-central-directory record");
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength === buffer.length) return offset;
  }

  throw new Error("ZIP end-of-central-directory record not found");
}

export function normalizeMcpbBuffer(input) {
  const buffer = Buffer.from(input);
  const eocdOffset = findEndOfCentralDirectory(buffer);

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== totalEntries) {
    throw new Error("Multi-disk ZIP archives are not supported");
  }
  if (
    totalEntries === ZIP64_U16_SENTINEL ||
    centralDirectorySize === ZIP64_U32_SENTINEL ||
    centralDirectoryOffset === ZIP64_U32_SENTINEL
  ) {
    throw new Error("ZIP64 MCPB archives are not supported by this normalizer");
  }

  assertRange(buffer, centralDirectoryOffset, centralDirectorySize, "ZIP central directory");
  if (centralDirectoryOffset + centralDirectorySize > eocdOffset) {
    throw new Error("ZIP central directory overlaps the end-of-central-directory record");
  }

  let cursor = centralDirectoryOffset;
  const entries = [];

  for (let index = 0; index < totalEntries; index += 1) {
    assertRange(buffer, cursor, 46, `Central-directory entry ${index}`);
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Invalid central-directory signature at entry ${index}`);
    }

    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraFieldLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const entryLength = 46 + fileNameLength + extraFieldLength + commentLength;

    assertRange(buffer, cursor, entryLength, `Central-directory entry ${index}`);
    const fileName = Buffer.from(
      buffer.subarray(cursor + 46, cursor + 46 + fileNameLength)
    );

    if (localHeaderOffset === ZIP64_U32_SENTINEL) {
      throw new Error(`ZIP64 local-header offset is not supported at entry ${index}`);
    }

    assertRange(buffer, localHeaderOffset, 30, `Local-file header ${index}`);
    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Invalid local-file-header signature at entry ${index}`);
    }

    buffer.writeUInt16LE(FIXED_DOS_TIME, cursor + 12);
    buffer.writeUInt16LE(FIXED_DOS_DATE, cursor + 14);
    buffer.writeUInt8(ZIP_HOST_UNIX, cursor + 5);
    buffer.writeUInt32LE(CANONICAL_FILE_MODE << 16, cursor + 38);
    buffer.writeUInt16LE(FIXED_DOS_TIME, localHeaderOffset + 10);
    buffer.writeUInt16LE(FIXED_DOS_DATE, localHeaderOffset + 12);

    entries.push({
      index,
      fileName,
      localHeaderOffset,
      centralRecord: Buffer.from(buffer.subarray(cursor, cursor + entryLength)),
    });
    cursor += entryLength;
  }

  if (cursor !== centralDirectoryOffset + centralDirectorySize) {
    throw new Error("ZIP central-directory size does not match parsed entries");
  }

  const entriesByOffset = [...entries].sort(
    (left, right) => left.localHeaderOffset - right.localHeaderOffset
  );
  const prefixLength = entriesByOffset[0]?.localHeaderOffset ?? centralDirectoryOffset;
  if (prefixLength > centralDirectoryOffset) {
    throw new Error("ZIP local-file records start after the central directory");
  }

  for (let index = 0; index < entriesByOffset.length; index += 1) {
    const entry = entriesByOffset[index];
    const nextOffset =
      entriesByOffset[index + 1]?.localHeaderOffset ?? centralDirectoryOffset;
    if (nextOffset <= entry.localHeaderOffset) {
      throw new Error("ZIP local-file offsets are not strictly increasing");
    }
    assertRange(
      buffer,
      entry.localHeaderOffset,
      nextOffset - entry.localHeaderOffset,
      `Local-file record ${entry.index}`
    );
    entry.localRecord = Buffer.from(
      buffer.subarray(entry.localHeaderOffset, nextOffset)
    );
  }

  const canonicalEntries = [...entries].sort((left, right) => {
    const byName = Buffer.compare(left.fileName, right.fileName);
    return byName || left.index - right.index;
  });
  const localChunks = [Buffer.from(buffer.subarray(0, prefixLength))];
  const centralChunks = [];
  let nextLocalOffset = prefixLength;

  for (const entry of canonicalEntries) {
    if (!entry.localRecord) {
      throw new Error(`Missing local-file record for central entry ${entry.index}`);
    }
    localChunks.push(entry.localRecord);
    const centralRecord = Buffer.from(entry.centralRecord);
    centralRecord.writeUInt32LE(nextLocalOffset, 42);
    centralChunks.push(centralRecord);
    nextLocalOffset += entry.localRecord.length;
  }

  if (nextLocalOffset !== centralDirectoryOffset) {
    throw new Error("ZIP local-file records do not end at the central directory");
  }

  const postCentral = Buffer.from(
    buffer.subarray(centralDirectoryOffset + centralDirectorySize, eocdOffset)
  );
  const eocd = Buffer.from(buffer.subarray(eocdOffset));
  eocd.writeUInt32LE(nextLocalOffset, 16);

  return {
    buffer: Buffer.concat([...localChunks, ...centralChunks, postCentral, eocd]),
    normalizedEntries: entries.length,
  };
}

export async function normalizeMcpbFile(filePath) {
  const absolutePath = resolve(filePath);
  const input = await readFile(absolutePath);
  const { buffer, normalizedEntries } = normalizeMcpbBuffer(input);
  await writeFile(absolutePath, buffer);
  return normalizedEntries;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/normalize-mcpb.mjs <bundle.mcpb>");
  }

  const normalizedEntries = await normalizeMcpbFile(filePath);
  process.stdout.write(`Normalized timestamps for ${normalizedEntries} MCPB entries.\n`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
