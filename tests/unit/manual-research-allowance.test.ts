import { randomUUID } from "node:crypto";
import { readFile, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResearchQuota } from "../../src/server/research-quota";
import {
  digest,
  manualResearchFiles,
  sha256,
} from "../helpers/manual-research";

afterEach(() => vi.unstubAllEnvs());
async function active(count = 8) {
  vi.stubEnv("NODE_ENV", "development");
  const files = await manualResearchFiles(count);
  const quota = createResearchQuota(files.ledgerPath, {
    manualGrantPath: files.grantPath,
  });
  await quota.createManualGrant(files.approval);
  return { ...files, quota };
}

describe("bounded manual research allowance", () => {
  it("creates and inspects without changing the original ledger or spending a reservation", async () => {
    const files = await active();
    const before = await stat(files.ledgerPath);
    expect(await files.quota.inspect()).toMatchObject({
      eligible: true,
      reason: "ready",
      remainingAttempts: 10,
      remainingReservedUsd: 0.5,
      acknowledgedUncertainAttempts: 1,
    });
    await files.quota.createManualGrant(files.approval);
    expect(await readFile(files.ledgerPath, "utf8")).toBe(files.original);
    expect((await stat(files.ledgerPath)).mtimeMs).toBe(before.mtimeMs);
    expect((await stat(files.grantPath)).mode & 0o777).toBe(0o600);
    expect(
      await createResearchQuota(files.ledgerPath).reserve(randomUUID(), digest),
    ).toBe("quota");
  });

  it("allows exactly ten additional reservations across restarts without refunding cheap costs", async () => {
    const files = await active();
    for (let index = 0; index < 10; index++) {
      const quota = createResearchQuota(files.ledgerPath, {
        manualGrantPath: files.grantPath,
      });
      const id = randomUUID();
      expect(await quota.reserve(id, digest)).toBe("admitted");
      expect(await quota.reserve(id, digest)).toBe("duplicate");
      expect(await quota.reserve(randomUUID(), digest)).toBe("busy");
      await quota.settle(id, 0.001, true);
    }
    expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
    expect(await files.quota.inspect()).toMatchObject({
      eligible: false,
      remainingAttempts: 0,
      remainingReservedUsd: 0,
    });
    const disk = JSON.parse(await readFile(files.ledgerPath, "utf8"));
    expect(disk.stopped).toBe(true);
    expect(disk.attempts).toHaveLength(18);
    expect(disk.attempts.slice(0, 8)).toEqual(files.baseline.attempts);
    const grantBefore = await readFile(files.grantPath, "utf8");
    await files.quota.createManualGrant(files.approval);
    expect(await readFile(files.grantPath, "utf8")).toBe(grantBefore);
    expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
  });

  it.each([
    [null, true],
    [0, false],
    [0.06, true],
  ] as const)(
    "stops again after cost %s with successful=%s",
    async (cost, successful) => {
      const files = await active();
      const id = randomUUID();
      expect(await files.quota.reserve(id, digest)).toBe("admitted");
      await files.quota.settle(id, cost, successful);
      expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
      expect(await files.quota.inspect()).toMatchObject({
        eligible: false,
        reason: "stopped",
        remainingAttempts: 9,
      });
      expect(
        JSON.parse(await readFile(files.ledgerPath, "utf8")).attempts.at(-1),
      ).toMatchObject({ state: "uncertain", reservedUsd: 0.05 });
    },
  );

  it("revokes the next reservation but still settles work already admitted", async () => {
    const files = await active();
    const id = randomUUID();
    expect(await files.quota.reserve(id, digest)).toBe("admitted");
    await unlink(files.grantPath);
    await files.quota.settle(id, 0.005, true);
    expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
    expect(
      JSON.parse(await readFile(files.ledgerPath, "utf8")).attempts.at(-1)
        .state,
    ).toBe("complete");
  });

  it("preserves one pending operation across independent concurrent instances", async () => {
    const files = await active();
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        createResearchQuota(files.ledgerPath, {
          manualGrantPath: files.grantPath,
        }).reserve(randomUUID(), digest),
      ),
    );
    expect(outcomes.filter((value) => value === "admitted")).toHaveLength(1);
    expect(
      JSON.parse(await readFile(files.ledgerPath, "utf8")).attempts,
    ).toHaveLength(9);
  });

  it("uses the same lock and ledger through canonical and symlink paths", async () => {
    const files = await active();
    const alias = join(files.directory, "alias.json");
    await symlink(files.ledgerPath, alias);
    const outcomes = await Promise.all([
      files.quota.reserve(randomUUID(), digest),
      createResearchQuota(alias, { manualGrantPath: files.grantPath }).reserve(
        randomUUID(),
        digest,
      ),
    ]);
    expect(outcomes.filter((value) => value === "admitted")).toHaveLength(1);
    expect(JSON.parse(await readFile(alias, "utf8")).attempts).toHaveLength(9);
    expect(await readFile(alias, "utf8")).toBe(
      await readFile(files.ledgerPath, "utf8"),
    );
  });

  it("fails inspection and creation closed while another process owns the canonical lock", async () => {
    const files = await active();
    const before = await stat(files.ledgerPath);
    await writeFile(`${files.ledgerPath}.lock`, "synthetic other owner");
    expect(await files.quota.inspect()).toMatchObject({
      eligible: false,
      reason: "invalid-state",
    });
    await expect(
      files.quota.createManualGrant(files.approval),
    ).rejects.toBeDefined();
    expect(await readFile(files.ledgerPath, "utf8")).toBe(files.original);
    expect((await stat(files.ledgerPath)).mtimeMs).toBe(before.mtimeMs);
    expect(await readFile(`${files.ledgerPath}.lock`, "utf8")).toBe(
      "synthetic other owner",
    );
  });

  it("retains the global forty attempt and two dollar ceilings", async () => {
    const files = await active(39);
    const id = randomUUID();
    expect(await files.quota.reserve(id, digest)).toBe("admitted");
    await files.quota.settle(id, 0.005, true);
    expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
  });

  it.each([
    "missing-grant",
    "corrupt-grant",
    "missing-ledger",
    "wrong-path",
    "changed-prefix",
    "reordered-prefix",
    "truncated-prefix",
    "extra-field",
    "larger-limit",
    "larger-allowance",
    "changed-acknowledgment",
  ])("fails closed for %s", async (fault) => {
    const files = await active();
    const grant = JSON.parse(await readFile(files.grantPath, "utf8"));
    const ledger = structuredClone(files.baseline);
    if (fault === "missing-grant") await unlink(files.grantPath);
    if (fault === "corrupt-grant") await writeFile(files.grantPath, "invalid");
    if (fault === "missing-ledger") await unlink(files.ledgerPath);
    if (fault === "wrong-path")
      grant.ledgerPath = join(files.directory, "different.json");
    if (fault === "extra-field") grant.ignoreUncertainty = true;
    if (fault === "larger-limit") grant.maxAttempts = 11;
    if (fault === "larger-allowance") grant.reservedAllowanceUsd = 0.6;
    if (fault === "changed-acknowledgment")
      grant.baseline.uncertainAttemptIds = [randomUUID()];
    if (
      [
        "wrong-path",
        "extra-field",
        "larger-limit",
        "larger-allowance",
        "changed-acknowledgment",
      ].includes(fault)
    )
      await writeFile(files.grantPath, JSON.stringify(grant));
    if (fault === "changed-prefix") ledger.attempts[0]!.reportedCostUsd = 0;
    if (fault === "reordered-prefix") ledger.attempts.reverse();
    if (fault === "truncated-prefix") ledger.attempts.pop();
    if (fault.endsWith("prefix"))
      await writeFile(files.ledgerPath, JSON.stringify(ledger));
    expect(await files.quota.reserve(randomUUID(), digest)).toBe("quota");
    expect(await files.quota.inspect()).toMatchObject({ eligible: false });
    if (fault === "missing-ledger")
      await expect(readFile(files.ledgerPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
  });

  it("never falls back to ordinary admission when a configured grant is missing or empty", async () => {
    const files = await manualResearchFiles();
    const raw = JSON.stringify({ version: 1, stopped: false, attempts: [] });
    await writeFile(files.ledgerPath, raw);
    for (const manualGrantPath of [files.grantPath, ""]) {
      expect(
        await createResearchQuota(files.ledgerPath, {
          manualGrantPath,
        }).reserve(randomUUID(), digest),
      ).toBe("quota");
      expect(await readFile(files.ledgerPath, "utf8")).toBe(raw);
    }
  });

  it.each(["pending", "overrun", "known-failure", "not-stopped"])(
    "cannot acknowledge a baseline containing %s",
    async (fault) => {
      vi.stubEnv("NODE_ENV", "development");
      const files = await manualResearchFiles();
      if (fault === "pending") files.baseline.attempts[0]!.state = "pending";
      if (fault === "overrun")
        files.baseline.attempts[0]!.reportedCostUsd = 0.06;
      if (fault === "known-failure")
        files.baseline.attempts.at(-1)!.reportedCostUsd = 0;
      if (fault === "not-stopped") files.baseline.stopped = false;
      const raw = JSON.stringify(files.baseline);
      await writeFile(files.ledgerPath, raw);
      const quota = createResearchQuota(files.ledgerPath, {
        manualGrantPath: files.grantPath,
      });
      await expect(
        quota.createManualGrant({
          ...files.approval,
          expectedLedgerSha256: sha256(raw),
        }),
      ).rejects.toBeDefined();
      await expect(readFile(files.grantPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
      expect(await readFile(files.ledgerPath, "utf8")).toBe(raw);
    },
  );

  it("requires development, the expected ledger bytes and identical approval for creation", async () => {
    const files = await manualResearchFiles();
    const quota = createResearchQuota(files.ledgerPath, {
      manualGrantPath: files.grantPath,
    });
    await expect(quota.createManualGrant(files.approval)).rejects.toBeDefined();
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      quota.createManualGrant({
        ...files.approval,
        expectedLedgerSha256: "0".repeat(64),
      }),
    ).rejects.toBeDefined();
    await quota.createManualGrant(files.approval);
    const originalGrant = await readFile(files.grantPath, "utf8");
    await expect(
      quota.createManualGrant({ ...files.approval, grantId: randomUUID() }),
    ).rejects.toBeDefined();
    expect(await readFile(files.grantPath, "utf8")).toBe(originalGrant);
  });
});
