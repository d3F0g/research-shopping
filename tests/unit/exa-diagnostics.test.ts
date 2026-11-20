import { afterEach, describe, expect, it } from "vitest";
import { chmod, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createExaDiagnosticWriter } from "../../src/server/exa-diagnostics";
import type { ExaDiagnosticRecord } from "../../src/server/exa-research";
import { initialConversation } from "../../src/domain/conversation";

const directories: string[] = [];
afterEach(async () => { for (const path of directories.splice(0)) await rm(path, { recursive: true, force: true }); });
async function directory() {
  const path = await realpath(await mkdtemp(join(tmpdir(), "fieldnote-diagnostic-test-")));
  directories.push(path);
  await chmod(path, 0o700);
  return path;
}
function record(response: unknown = { answer: { products: [] }, citations: [], requestId: "fixture-request" }): ExaDiagnosticRecord {
  return { capturedAt: "2026-11-19T00:00:00Z", query: "Fixture private shopping request", intent: initialConversation().intent, response, projection: { stage: "answer-schema", issues: [{ path: ["products"], code: "invalid_type" }] } };
}
async function captures(path: string) { return (await readdir(path)).filter((name) => name.startsWith("exa-capture-")); }
describe("opt-in private Exa diagnostics", () => {
  it("is disabled without an absolute configured directory", () => {
    expect(createExaDiagnosticWriter(undefined)).toBeUndefined();
    expect(createExaDiagnosticWriter("relative/path")).toBeUndefined();
  });
  it("writes only selected provider fields with private modes and no header data", async () => {
    const path = await directory();
    const response = JSON.parse('{"answer":{"products":[],"__proto__":{"polluted":true}},"citations":[],"requestId":"fixture-request","headers":{"authorization":"fixture-secret"},"apiKey":"fixture-secret"}');
    await createExaDiagnosticWriter(path)!(record(response));
    const names = await captures(path);
    expect(names).toHaveLength(1);
    const file = join(path, names[0]!);
    expect((await lstat(file)).mode & 0o777).toBe(0o600);
    const text = await readFile(file, "utf8");
    const saved = JSON.parse(text);
    expect(saved.raw.complete).toBe(true);
    expect(saved.raw.response.answer.__proto__).toEqual({ polluted: true });
    expect(saved.query).toBe("Fixture private shopping request");
    expect(text).not.toContain("fixture-secret");
    expect({}).not.toHaveProperty("polluted");
    expect(await readdir(path)).toEqual(names);
  });
  it("keeps oversized or deeply nested raw data explicitly omitted within the file bound", async () => {
    const path = await directory();
    await createExaDiagnosticWriter(path)!(record({ answer: "x".repeat(3 * 1024 * 1024) }));
    const file = join(path, (await captures(path))[0]!);
    expect((await lstat(file)).size).toBeLessThan(2 * 1024 * 1024);
    expect(JSON.parse(await readFile(file, "utf8")).raw).toMatchObject({ complete: false });
    let nested: unknown = "Fixture text";
    for (let i = 0; i < 100; i++) nested = { nested };
    await createExaDiagnosticWriter(path)!(record({ answer: nested }));
    for (const name of await captures(path)) expect(JSON.parse(await readFile(join(path, name), "utf8")).raw.complete).toBe(false);
  });
  it("does not invoke getters or custom serialization", async () => {
    const path = await directory();
    let invoked = false;
    const response = { get answer() { invoked = true; return "unsafe"; } };
    await createExaDiagnosticWriter(path)!(record(response));
    expect(invoked).toBe(false);
    const saved = JSON.parse(await readFile(join(path, (await captures(path))[0]!), "utf8"));
    expect(saved.raw.complete).toBe(false);
    await createExaDiagnosticWriter(path)!(record({ answer: { toJSON() { invoked = true; return "unsafe"; } } }));
    expect(invoked).toBe(false);
    for (const name of await captures(path)) expect(JSON.parse(await readFile(join(path, name), "utf8")).raw.complete).toBe(false);
  });
  it("counts existing capture files across writer restarts and never overwrites", async () => {
    const path = await directory();
    for (let i = 0; i < 10; i++) {
      await writeFile(join(path, `exa-capture-${randomUUID()}.json`), `Fixture data ${i}`, { mode: 0o600 });
    }
    const before = await Promise.all((await captures(path)).sort().map(async (name) => [name, await readFile(join(path, name), "utf8")]));
    await createExaDiagnosticWriter(path)!(record());
    await createExaDiagnosticWriter(path)!(record());
    expect(await Promise.all((await captures(path)).sort().map(async (name) => [name, await readFile(join(path, name), "utf8")]))).toEqual(before);
    expect(await readdir(path)).toHaveLength(10);
  });
  it("leaves another process lock untouched and does not wait", async () => {
    const path = await directory();
    await writeFile(join(path, ".fieldnote-exa-diagnostics.lock"), "fixture-other-process", { mode: 0o600 });
    await createExaDiagnosticWriter(path)!(record());
    expect(await captures(path)).toHaveLength(0);
    expect(await readFile(join(path, ".fieldnote-exa-diagnostics.lock"), "utf8")).toBe("fixture-other-process");
  });
  it("refuses symlink directories, unsafe modes, symlink entries", async () => {
    const target = await directory();
    const parent = await directory();
    const linked = join(parent, "linked");
    await symlink(target, linked);
    await createExaDiagnosticWriter(linked)!(record());
    expect(await captures(target)).toHaveLength(0);
    await chmod(target, 0o755);
    await createExaDiagnosticWriter(target)!(record());
    expect(await captures(target)).toHaveLength(0);
    await chmod(target, 0o700);
    const outside = join(parent, "untouched");
    await writeFile(outside, "Fixture outside data", { mode: 0o600 });
    await symlink(outside, join(target, `exa-capture-${randomUUID()}.json`));
    await createExaDiagnosticWriter(target)!(record());
    expect(await readFile(outside, "utf8")).toBe("Fixture outside data");
    expect(await readdir(target)).toHaveLength(1);
  });
  it("rejects hardlinked capture entries", async () => {
    const path = await directory();
    const parent = await directory();
    const outside = join(parent, "untouched");
    await writeFile(outside, "Fixture outside data", { mode: 0o600 });
    await link(outside, join(path, `exa-capture-${randomUUID()}.json`));
    await createExaDiagnosticWriter(path)!(record());
    expect(await readdir(path)).toHaveLength(1);
    expect(await readFile(outside, "utf8")).toBe("Fixture outside data");
  });
  it.each(["file", "directory", "symlink"])("rejects a capture under an ancestor .git %s", async (kind) => {
    const root = await directory();
    const path = join(root, "captures");
    await mkdir(path, { mode: 0o700 });
    if (kind === "file") await writeFile(join(root, ".git"), "gitdir: fixture", { mode: 0o600 });
    if (kind === "directory") await mkdir(join(root, ".git"));
    if (kind === "symlink") await symlink("fixture-missing-git", join(root, ".git"));
    await createExaDiagnosticWriter(path)!(record());
    expect(await readdir(path)).toEqual([]);
  });
  it.each(["artifacts", "history", "public"])("rejects the reserved %s ancestor outside a repository", async (name) => {
    const root = await directory();
    const path = join(root, name, "captures");
    await mkdir(path, { mode: 0o700, recursive: true });
    await chmod(path, 0o700);
    await createExaDiagnosticWriter(path)!(record());
    expect(await readdir(path)).toEqual([]);
  });
  it("rejects capture within the current source checkout", async () => {
    const path = await mkdtemp(join(process.cwd(), ".diagnostic-test-"));
    directories.push(path);
    await chmod(path, 0o700);
    await createExaDiagnosticWriter(path)!(record());
    expect(await readdir(path)).toEqual([]);
  });
  it("serializes concurrent writers without exceeding the directory cap", async () => {
    const path = await directory();
    for (let i = 0; i < 9; i++) await writeFile(join(path, `exa-capture-${randomUUID()}.json`), "Fixture data", { mode: 0o600 });
    await Promise.all(Array.from({ length: 12 }, () => createExaDiagnosticWriter(path)!(record())));
    expect(await captures(path)).toHaveLength(10);
    expect(await readdir(path)).toHaveLength(10);
  });
});
