import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const digest = "a".repeat(64);
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function manualResearchFiles(count = 8) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "fieldnote-manual-")));
  const ledgerPath = join(directory, "usage.json");
  const grantPath = join(directory, "manual-grant.json");
  const baseline = {
    version: 1,
    stopped: true,
    attempts: Array.from({ length: count }, (_, index) => ({
      id: randomUUID(),
      digest,
      state: index === count - 1 ? "uncertain" : "complete",
      reservedUsd: 0.05,
      reportedCostUsd: index === count - 1 ? null : 0.005,
    })),
  };
  await writeFile(ledgerPath, JSON.stringify(baseline, null, 2));
  const original = await readFile(ledgerPath, "utf8");
  const approval = {
    grantId: randomUUID(),
    approvalReference: "Synthetic test approval, no paid use",
    reviewedCommit: "b".repeat(40),
    approvedAt: "2026-11-19T00:00:00.000Z",
    expectedLedgerSha256: sha256(original),
  };
  return { directory, ledgerPath, grantPath, baseline, original, approval };
}
