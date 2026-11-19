import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { manualResearchFiles } from "../helpers/manual-research";

const exec = promisify(execFile);
function command(
  files: Awaited<ReturnType<typeof manualResearchFiles>>,
  mode: "create" | "inspect",
) {
  return [
    "--import",
    "tsx",
    "scripts/manual-research-allowance.ts",
    mode,
    "--ledger",
    files.ledgerPath,
    "--grant",
    files.grantPath,
    ...(mode === "create"
      ? [
          "--grant-id",
          files.approval.grantId,
          "--approval-reference",
          files.approval.approvalReference,
          "--reviewed-commit",
          files.approval.reviewedCommit,
          "--approved-at",
          files.approval.approvedAt,
          "--expected-ledger-sha256",
          files.approval.expectedLedgerSha256,
        ]
      : []),
  ];
}
const environment = { PATH: process.env.PATH, NODE_ENV: "development" };

describe("private manual allowance CLI", () => {
  it("creates once and inspects the actual policy without changing ledger bytes or mtime", async () => {
    const files = await manualResearchFiles();
    const ledgerBefore = await stat(files.ledgerPath);
    const created = await exec(process.execPath, command(files, "create"), {
      env: environment,
    });
    expect(JSON.parse(created.stdout)).toMatchObject({
      eligible: true,
      remainingAttempts: 10,
      remainingReservedUsd: 0.5,
      acknowledgedUncertainAttempts: 1,
    });
    const grantBefore = await stat(files.grantPath);
    const repeated = await exec(process.execPath, command(files, "create"), {
      env: environment,
    });
    expect(repeated.stdout).toBe(created.stdout);
    const inspected = await exec(process.execPath, command(files, "inspect"), {
      env: { NODE_ENV: "production" },
    });
    expect(inspected.stdout).toBe(created.stdout);
    expect(await readFile(files.ledgerPath, "utf8")).toBe(files.original);
    expect((await stat(files.ledgerPath)).mtimeMs).toBe(ledgerBefore.mtimeMs);
    expect((await stat(files.grantPath)).mtimeMs).toBe(grantBefore.mtimeMs);
    expect(created.stderr + repeated.stderr + inspected.stderr).toBe("");
  });

  it("rejects creation outside development and returns a failing inspection for a missing grant", async () => {
    const files = await manualResearchFiles();
    await expect(
      exec(process.execPath, command(files, "create"), {
        env: { NODE_ENV: "production" },
      }),
    ).rejects.toMatchObject({ code: 1 });
    await expect(
      exec(process.execPath, command(files, "inspect"), { env: environment }),
    ).rejects.toMatchObject({
      code: 2,
      stdout: expect.stringContaining('"eligible":false'),
    });
    expect(await readFile(files.ledgerPath, "utf8")).toBe(files.original);
    await expect(stat(files.grantPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
