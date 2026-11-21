// LOCAL ONLY: bound the summaries owned by one opt-in observer.
// Never rename, truncate, delete, or otherwise touch Codexify's audit source.
import { appendFile, rename, rm, stat } from "node:fs/promises";

export const MAX_REPORT_BYTES = 1024 * 1024;

export async function appendBoundedReport(path, line, maxBytes = MAX_REPORT_BYTES) {
  const bytes = Buffer.byteLength(line, "utf8");
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_REPORT_BYTES ||
      bytes > maxBytes) {
    throw new Error("Invalid report size limit or oversized summary");
  }
  let length = 0;
  try {
    length = (await stat(path)).size;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (length + bytes > maxBytes) {
    // Only this observer owns this output; close each append before rotating.
    // Keep exactly one prior file, not a growing archive directory.
    await rm(`${path}.previous`, { force: true });
    try {
      await rename(path, `${path}.previous`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await appendFile(path, line, { mode: 0o600 });
}
