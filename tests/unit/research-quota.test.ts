import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createResearchQuota } from "../../src/server/research-quota";

const digest = "a".repeat(64);
async function ledger() {
  return join(await mkdtemp(join(tmpdir(), "fieldnote-quota-")), "usage.json");
}
describe("persistent research admission", () => {
  it("reserves before dispatch and survives service restarts without repeat admission", async () => {
    const path = await ledger();
    const id = randomUUID();
    expect(await createResearchQuota(path).reserve(id, digest)).toBe(
      "admitted",
    );
    const disk = JSON.parse(await readFile(path, "utf8"));
    expect(disk.attempts[0]).toMatchObject({
      id,
      digest,
      state: "pending",
      reservedUsd: 0.05,
    });
    expect(await createResearchQuota(path).reserve(id, "b".repeat(64))).toBe(
      "duplicate",
    );
    expect(await createResearchQuota(path).reserve(randomUUID(), digest)).toBe(
      "busy",
    );
    await createResearchQuota(path).settle(id, 0.007, true);
    expect(await createResearchQuota(path).reserve(randomUUID(), digest)).toBe(
      "admitted",
    );
  });
  it.each([null, 0.06])(
    "retains and stops after unknown or excessive cost %s",
    async (cost) => {
      const path = await ledger();
      const quota = createResearchQuota(path);
      const id = randomUUID();
      await quota.reserve(id, digest);
      await quota.settle(id, cost, true);
      expect(
        await createResearchQuota(path).reserve(randomUUID(), digest),
      ).toBe("quota");
      expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({
        stopped: true,
        attempts: [{ state: "uncertain", reservedUsd: 0.05 }],
      });
    },
  );
  it("does not refund a failed or cancelled request even with a reported zero cost", async () => {
    const path = await ledger();
    const quota = createResearchQuota(path);
    const id = randomUUID();
    await quota.reserve(id, digest);
    await quota.settle(id, 0, false);
    expect(await quota.reserve(randomUUID(), digest)).toBe("quota");
  });
  it("bounds all completed attempts beneath the two-dollar local allowance", async () => {
    const path = await ledger();
    const quota = createResearchQuota(path);
    for (let i = 0; i < 40; i++) {
      const id = randomUUID();
      expect(await quota.reserve(id, digest)).toBe("admitted");
      await quota.settle(id, 0.007, true);
    }
    expect(await createResearchQuota(path).reserve(randomUUID(), digest)).toBe(
      "quota",
    );
  });
  it("fails closed on corrupt state and unresolved lock ownership", async () => {
    const path = await ledger();
    await writeFile(path, "not valid JSON");
    expect(await createResearchQuota(path).reserve(randomUUID(), digest)).toBe(
      "quota",
    );
    const locked = await ledger();
    await writeFile(`${locked}.lock`, "another owner");
    expect(
      await createResearchQuota(locked).reserve(randomUUID(), digest),
    ).toBe("quota");
  });
  it("admits only one concurrent operation across independent quota instances", async () => {
    const path = await ledger();
    const outcomes = await Promise.all([
      createResearchQuota(path).reserve(randomUUID(), digest),
      createResearchQuota(path).reserve(randomUUID(), digest),
    ]);
    expect(outcomes.filter((outcome) => outcome === "admitted")).toHaveLength(
      1,
    );
  });
});
