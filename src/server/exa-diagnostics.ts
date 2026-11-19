import { constants } from "node:fs";
import { lstat, open, opendir, realpath, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import type { ExaDiagnosticRecord } from "./exa-research";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 10;
const CAPTURE_NAME = /^exa-capture-[a-f0-9-]{36}\.json$/;

type Budget = { bytes: number; nodes: number };
function encode(value: unknown, budget: Budget, depth = 0): string {
  if (--budget.nodes < 0 || depth > 20) throw new Error("Diagnostic bound");
  let text: string;
  if (typeof value === "string") {
    if (value.length * 6 + 2 > budget.bytes) throw new Error("Diagnostic bound");
    text = JSON.stringify(value);
  } else if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Diagnostic value");
    text = JSON.stringify(value);
  } else if (Array.isArray(value)) {
    if (value.length > budget.nodes) throw new Error("Diagnostic bound");
    budget.bytes -= 2;
    const rows: string[] = [];
    for (let i = 0; i < value.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
      if (!descriptor || !("value" in descriptor)) throw new Error("Diagnostic value");
      if (i) budget.bytes--;
      rows.push(encode(descriptor.value, budget, depth + 1));
    }
    if (budget.bytes < 0) throw new Error("Diagnostic bound");
    return `[${rows.join(",")}]`;
  } else if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) throw new Error("Diagnostic value");
    budget.bytes -= 2;
    const rows: string[] = [];
    for (const key in value) {
      if (--budget.nodes < 0) throw new Error("Diagnostic bound");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) continue;
      if (!("value" in descriptor)) throw new Error("Diagnostic value");
      if (rows.length) budget.bytes--;
      budget.bytes--;
      const name = encode(key, budget, depth + 1);
      rows.push(`${name}:${encode(descriptor.value, budget, depth + 1)}`);
    }
    if (budget.bytes < 0) throw new Error("Diagnostic bound");
    return `{${rows.join(",")}}`;
  } else throw new Error("Diagnostic value");
  budget.bytes -= Buffer.byteLength(text);
  if (budget.bytes < 0) throw new Error("Diagnostic bound");
  return text;
}
function recordText(record: ExaDiagnosticRecord): string {
  const metadata = {
    version: 1,
    capturedAt: record.capturedAt,
    query: record.query,
    intent: record.intent,
    projection: record.projection,
  };
  const response: Record<string, unknown> = Object.create(null);
  let plain = record.response !== null && typeof record.response === "object" &&
    (Object.getPrototypeOf(record.response) === Object.prototype || Object.getPrototypeOf(record.response) === null);
  if (plain) {
    for (const key of ["answer", "citations", "requestId", "costDollars"]) {
      const descriptor = Object.getOwnPropertyDescriptor(record.response, key);
      if (descriptor && "value" in descriptor) response[key] = descriptor.value;
      else if (descriptor) plain = false;
    }
  }
  try {
    if (!plain) throw new Error("Diagnostic value");
    return encode({ ...metadata, raw: { complete: true, response } }, { bytes: MAX_BYTES, nodes: 20_000 });
  } catch {
    try {
      return encode({ ...metadata, raw: { complete: false, omitted: "Raw response exceeds capture bounds or is not plain JSON." } }, { bytes: MAX_BYTES, nodes: 20_000 });
    } catch {
      return encode({ version: 1, capturedAt: record.capturedAt, projection: record.projection, raw: { complete: false, omitted: "Request and response exceed capture bounds." } }, { bytes: MAX_BYTES, nodes: 20_000 });
    }
  }
}
async function privateDirectory(path: string) {
  const stat = await lstat(path);
  return stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid?.() &&
    (stat.mode & 0o7777) === 0o700 && await realpath(path) === resolve(path);
}
async function existingCaptures(path: string): Promise<{ count: number; bytes: number } | null> {
  let count = 0;
  let bytes = 0;
  const directory = await opendir(path);
  for await (const entry of directory) {
    if (entry.name === ".fieldnote-exa-diagnostics.lock") continue;
    if (!CAPTURE_NAME.test(entry.name)) return null;
    const stat = await lstat(join(path, entry.name));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() ||
      (stat.mode & 0o7777) !== 0o600 || stat.nlink !== 1 || stat.size > MAX_BYTES) return null;
    count++;
    bytes += stat.size;
    if (count >= MAX_FILES || bytes >= MAX_FILES * MAX_BYTES) return null;
  }
  return { count, bytes };
}
export function createExaDiagnosticWriter(path: string | undefined): ((record: ExaDiagnosticRecord) => Promise<void>) | undefined {
  if (!path || !isAbsolute(path)) return undefined;
  return async (record) => {
    let lock: Awaited<ReturnType<typeof open>> | undefined;
    let lockIdentity: Awaited<ReturnType<typeof lstat>> | undefined;
    const lockPath = join(path, ".fieldnote-exa-diagnostics.lock");
    const token = randomUUID();
    try {
      if (!(await privateDirectory(path))) return;
      lock = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      lockIdentity = await lock.stat();
      await lock.writeFile(token);
      const existing = await existingCaptures(path);
      if (!existing || !(await privateDirectory(path))) return;
      const text = recordText(record);
      if (existing.bytes + Buffer.byteLength(text) > MAX_FILES * MAX_BYTES) return;
      const file = await open(join(path, `exa-capture-${randomUUID()}.json`), constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(text); } finally { await file.close(); }
    } catch {
      return;
    } finally {
      if (lock && lockIdentity) {
        try {
          const current = await lstat(lockPath);
          const bytes = Buffer.alloc(Buffer.byteLength(token));
          const read = await lock.read(bytes, 0, bytes.length, 0);
          if (!current.isSymbolicLink() && current.dev === lockIdentity.dev && current.ino === lockIdentity.ino &&
            current.uid === lockIdentity.uid && current.nlink === 1 && read.bytesRead === bytes.length && bytes.toString() === token)
            await unlink(lockPath);
        } catch {}
      }
      await lock?.close().catch(() => undefined);
    }
  };
}
