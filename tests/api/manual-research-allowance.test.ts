import { randomUUID } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { createResearchQuota } from "../../src/server/research-quota";
import { manualResearchFiles } from "../helpers/manual-research";
import { startManualServer } from "../helpers/manual-composition";

afterEach(() => vi.unstubAllEnvs());
async function setup() {
  const files = await manualResearchFiles();
  vi.stubEnv("NODE_ENV", "development");
  await createResearchQuota(files.ledgerPath, {
    manualGrantPath: files.grantPath,
  }).createManualGrant(files.approval);
  return files;
}
async function submit(
  url: string,
  message = "A quiet H13 air purifier under SGD300. Must have washable prefilter.",
) {
  const operationId = randomUUID();
  const post = (body: unknown) =>
    fetch(`${url}/api/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const prepared = await (
    await post({
      phase: "prepare",
      message,
      operationId,
      preferences: defaultIntent(),
    })
  ).json();
  return prepared.kind === "prepared"
    ? (
        await post({
          phase: "research",
          operationId,
          preferences: prepared.preferences,
        })
      ).json()
    : prepared;
}

describe("manual allowance through the actual server entry point and SDK", () => {
  it("keeps help free, permits ten requests across a server restart and refuses the eleventh", async () => {
    const files = await setup();
    let totalRequests = 0;
    for (const count of [4, 6]) {
      const server = await startManualServer(files, {
        grantPath: files.grantPath,
      });
      try {
        expect(await submit(server.url, "Does this cost money?")).toMatchObject(
          { kind: "message" },
        );
        expect(server.requests).toHaveLength(0);
        for (let index = 0; index < count; index++)
          expect(await submit(server.url)).toMatchObject({ kind: "research" });
        totalRequests += server.requests.length;
        if (totalRequests === 10)
          expect(await submit(server.url)).toMatchObject({
            kind: "research-unavailable",
            reason: "quota",
          });
        expect(server.requests).toHaveLength(count);
      } finally {
        await server.close();
      }
    }
    const ledger = JSON.parse(await readFile(files.ledgerPath, "utf8"));
    expect(ledger.attempts).toHaveLength(18);
    expect(ledger.attempts.slice(0, 8)).toEqual(files.baseline.attempts);
    expect(ledger.stopped).toBe(true);
  }, 20_000);

  it.each(["default", "missing", "production", "test"])(
    "never dispatches with %s composition",
    async (mode) => {
      const files = await setup();
      const server = await startManualServer(files, {
        ...(mode !== "default"
          ? {
              grantPath:
                mode === "missing"
                  ? `${files.grantPath}.absent`
                  : files.grantPath,
            }
          : {}),
        mode: ["production", "test"].includes(mode) ? mode : "development",
      });
      try {
        expect(await submit(server.url)).toMatchObject({
          kind: "research-unavailable",
          reason: ["production", "test"].includes(mode) ? "disabled" : "quota",
        });
        expect(server.requests).toHaveLength(0);
        expect(await readFile(files.ledgerPath, "utf8")).toBe(files.original);
      } finally {
        await server.close();
      }
    },
  );

  it("rereads revocation while the same server is running", async () => {
    const files = await setup();
    const server = await startManualServer(files, {
      grantPath: files.grantPath,
    });
    try {
      expect(await submit(server.url)).toMatchObject({ kind: "research" });
      await unlink(files.grantPath);
      expect(await submit(server.url)).toMatchObject({
        kind: "research-unavailable",
        reason: "quota",
      });
      expect(server.requests).toHaveLength(1);
    } finally {
      await server.close();
    }
  });

  it("cancels the actual SDK transport, retains the reservation and stops the manual allowance", async () => {
    const files = await setup();
    const server = await startManualServer(files, {
      grantPath: files.grantPath,
    });
    try {
      server.deferNext();
      const controller = new AbortController();
      const request = fetch(`${server.url}/api/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "research",
          operationId: randomUUID(),
          preferences: {
            ...defaultIntent(),
            productDescription: "Synthetic test air purifier",
            budgetClarified: true,
          },
        }),
        signal: controller.signal,
      });
      await expect.poll(() => server.requests.length).toBe(1);
      controller.abort();
      await expect(request).rejects.toBeDefined();
      await expect.poll(() => server.aborts).toBe(1);
      await expect
        .poll(
          async () =>
            JSON.parse(await readFile(files.ledgerPath, "utf8")).attempts.at(-1)
              .state,
        )
        .toBe("uncertain");
      expect(await submit(server.url)).toMatchObject({
        kind: "research-unavailable",
        reason: "quota",
      });
      expect(server.requests).toHaveLength(1);
      const ledger = JSON.parse(await readFile(files.ledgerPath, "utf8"));
      expect(ledger.attempts.at(-1)).toMatchObject({
        reportedCostUsd: null,
        reservedUsd: 0.05,
        state: "uncertain",
      });
      expect(ledger.attempts.slice(0, 8)).toEqual(files.baseline.attempts);
    } finally {
      await server.close();
    }
  });
});
