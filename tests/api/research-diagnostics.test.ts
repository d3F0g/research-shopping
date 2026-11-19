import { fixtureIntentInterpreter } from "../helpers/intent";
import { submitTurn } from "../helpers/turns";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createExaProductResearch } from "../../src/server/exa-research";
import {
  researchDiagnosticPath,
  type ResearchDiagnosticSink,
} from "../../src/server/research-diagnostics";
import { createResearchTurns } from "../../src/server/research-turns";
import { syntheticAnswer, syntheticIntent } from "../fixtures/dynamic-research";

async function localResearch(
  payload: unknown,
  sink?: ResearchDiagnosticSink,
  signal = new AbortController().signal,
  settlements: { cost: number | null; complete: boolean }[] = [],
) {
  let calls = 0;
  const server = createServer((_incoming, outgoing) => {
    calls++;
    outgoing.writeHead(200, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const turns = createResearchTurns({ interpretIntent: fixtureIntentInterpreter,
      research: createExaProductResearch("fake-private-key-never-retained", {
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        diagnosticSink: sink,
      }),
      quota: {
        async reserve() {
          return "admitted";
        },
        async settle(_id, cost, complete) {
          settlements.push({ cost, complete });
        },
      },
    });
    const result = await submitTurn(
      turns,
      {
        phase: "prepare",
        message: "Compare options",
        operationId: "00000000-0000-4000-8000-000000000001",
        preferences: syntheticIntent(),
      },
      signal,
    );
    return { result, settlements, calls };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("endpoint-aware private diagnostics", () => {
  it.each([
    {},
    { NODE_ENV: "development" },
    { NODE_ENV: "development", EXA_RESEARCH_DIAGNOSTIC_PATH: "relative.json" },
    { NODE_ENV: "production", EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json" },
    { NODE_ENV: "test", EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json" },
  ])(
    "does not opt in outside an explicit absolute development path",
    (environment) => {
      expect(researchDiagnosticPath(environment)).toBeUndefined();
    },
  );
  it("accepts an explicit absolute development path", () => {
    expect(
      researchDiagnosticPath({
        NODE_ENV: "development",
        EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json",
      }),
    ).toBe("/tmp/proof.json");
  });
  it("retains exact allowlisted answer and citation fields privately and never overwrites", async () => {
    const directory = await mkdtemp(join(tmpdir(), "dynamic-proof-"));
    const path = join(directory, "proof.json");
    try {
      const payload = {
        ...syntheticAnswer(),
        headers: { authorization: "header-private-never-retained" },
        cookies: "cookie-private-never-retained",
        environment: "env-private-never-retained",
        notices: [
          {
            code: "RESTRICTIONS_RELAXED",
            message: "provider-message-never-retained",
          },
        ],
      };
      const { result, calls, settlements } = await localResearch(payload, path);
      expect(result.kind).toBe("research");
      expect(calls).toBe(1);
      expect(settlements).toEqual([{ cost: 0.005, complete: true }]);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      const text = await readFile(path, "utf8");
      const artifact = JSON.parse(text);
      expect(artifact).toMatchObject({
        endpoint: "answer",
        schemaStatus: "valid",
        extractionStatus: "valid",
        reportedCostUsd: 0.005,
        resultCount: 1,
        native: { kind: "object", truncated: false },
      });
      expect(JSON.parse(artifact.native.text)).toEqual(payload.answer);
      expect(artifact.results[0].text.text).toBe(payload.citations[0]!.text);
      expect(text).not.toMatch(
        /private-.*never-retained|provider-message-never-retained/,
      );
      expect(JSON.stringify(result)).not.toMatch(
        /schemaStatus|nativeContent|sha256/,
      );
      expect(JSON.stringify(result)).not.toContain(path);
      const second = await localResearch(syntheticAnswer(), path);
      expect(second.result.kind).toBe("research");
      expect(await readFile(path, "utf8")).toBe(text);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps source/native truncation and hashes under the 128 KiB serialized cap", async () => {
    const payload = {
      ...syntheticAnswer(),
      citations: Array.from({ length: 10 }, (_, index) => ({
        title: '😀"'.repeat(10000),
        url: `https://reviews.example.com/${index}`,
        text: '😀\n"\\'.repeat(20000),
      })),
      answer: { unknown: '😀"\\'.repeat(80000) },
    };
    let text = "";
    const { result } = await localResearch(payload, (artifact) => {
      text = artifact;
    });
    expect(result.kind).toBe("research-unavailable");
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(128 * 1024);
    const artifact = JSON.parse(text);
    expect(artifact).toMatchObject({
      reportedCostUsd: 0.005,
      resultCount: 10,
      extractionStatus: "malformed",
      native: { kind: "object", truncated: true },
    });
    expect(artifact.native.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      artifact.results.every(
        (source: { text: { truncated: boolean } }) => source.text.truncated,
      ),
    ).toBe(true);
  });
  it("settles exactly once with identical public evidence when a sink fails", async () => {
    const baseline = await localResearch(syntheticAnswer());
    const failed = await localResearch(syntheticAnswer(), () => {
      throw new Error("sink failed");
    });
    expect(failed.calls).toBe(1);
    expect(failed.settlements).toEqual(baseline.settlements);
    expect(failed.result.kind).toBe("research");
    if (
      failed.result.kind === "research" &&
      baseline.result.kind === "research"
    )
      expect(failed.result.research.products).toEqual(
        baseline.result.research.products,
      );
  });
  it("settles a completed unusable answer with trusted cost but keeps malformed cost unknown", async () => {
    const completed = await localResearch({
      ...syntheticAnswer(),
      answer: { malformed: true },
    });
    expect(completed.result).toMatchObject({
      kind: "research-unavailable",
      reason: "invalid-response",
    });
    expect(completed.settlements).toEqual([{ cost: 0.005, complete: true }]);
    const untrusted = await localResearch({
      ...syntheticAnswer(),
      costDollars: { total: "0.005" },
    });
    expect(untrusted.result).toMatchObject({
      kind: "research-unavailable",
      reason: "invalid-response",
    });
    expect(untrusted.settlements).toEqual([{ cost: null, complete: true }]);
  });
  it("preserves actual cancellation while an optional sink is pending", async () => {
    const controller = new AbortController();
    const settlements: { cost: number | null; complete: boolean }[] = [];
    await expect(
      localResearch(
        syntheticAnswer(),
        async () => {
          controller.abort();
          await new Promise(() => {});
        },
        controller.signal,
        settlements,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(settlements).toEqual([{ cost: null, complete: false }]);
  });
});
