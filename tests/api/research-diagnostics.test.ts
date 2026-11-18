import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import { researchDiagnosticPath, type ResearchDiagnosticSink } from "../../src/server/research-diagnostics";
import { createResearchTurns } from "../../src/server/research-turns";
import { historicalReplay, syntheticExtraction, syntheticRawStructure } from "../fixtures/page-evidence";

async function localResearch(payload: unknown, sink?: ResearchDiagnosticSink, signal = new AbortController().signal, settlements: { cost: number | null; complete: boolean }[] = []) {
  let calls = 0;
  const server = createServer((_incoming, outgoing) => {
    calls++;
    outgoing.writeHead(200, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  try {
    const turns = createResearchTurns({
      research: createExaProductResearch("fake-private-key-never-retained", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, diagnosticSink: sink }),
      quota: { async reserve() { return "admitted"; }, async settle(_id, cost, complete) { settlements.push({ cost, complete }); } },
    });
    const result = await turns.turn({ message: "Headphones under SGD400", operationId: "private-operation-id-never-retained", preferences }, signal);
    return { result, settlements, calls };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("opt-in private proof diagnostics", () => {
  it.each([
    {}, { NODE_ENV: "development" },
    { NODE_ENV: "development", EXA_RESEARCH_DIAGNOSTIC_PATH: "relative.json" },
    { NODE_ENV: "production", EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json" },
    { NODE_ENV: "test", EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json" },
  ])("does not opt in from an unset, relative or non-development path", (environment) => {
    expect(researchDiagnosticPath(environment)).toBeUndefined();
  });

  it("accepts only an explicit absolute development path", () => {
    expect(researchDiagnosticPath({ NODE_ENV: "development", EXA_RESEARCH_DIAGNOSTIC_PATH: "/tmp/proof.json" })).toBe("/tmp/proof.json");
  });

  it("retains schema decisions, exact raw structure and native kind with owner-only permissions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "page-evidence-private-"));
    const path = join(directory, "proof.json");
    try {
      const { result, calls, settlements } = await localResearch({
        ...historicalReplay, results: [syntheticRawStructure],
        output: { content: JSON.stringify({ observations: [syntheticExtraction] }) },
        headers: { authorization: "header-private-never-retained" },
        cookies: "cookie-private-never-retained", environment: "env-private-never-retained",
        notices: [{ code: "RESTRICTIONS_RELAXED", message: "provider-message-never-retained" }],
      }, path);
      expect(result.kind).toBe("research");
      expect(calls).toBe(1);
      expect(settlements).toEqual([{ cost: 0.007, complete: true }]);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
      const text = await readFile(path, "utf8");
      const artifact = JSON.parse(text);
      expect(artifact).toMatchObject({ schemaStatus: "valid", extractionStatus: "valid", reportedCostUsd: 0.007, resultCount: 1, native: { kind: "string", truncated: false } });
      expect(artifact.results[0].highlights[0].text).toBe(syntheticRawStructure.highlights[0]);
      expect(artifact.decisions).toEqual(expect.arrayContaining([expect.objectContaining({ path: "source-identity", code: "admitted" }), expect.objectContaining({ path: "native-field", field: "quotedFacts", code: "admitted" })]));
      expect(text).not.toMatch(/private-.*never-retained|provider-message-never-retained/);
      expect(JSON.stringify(result)).not.toMatch(/schemaStatus|nativeContent|decisionSpans|sha256/);
      expect(JSON.stringify(result)).not.toContain(path);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("prioritizes decision spans and metadata under a 128 KiB serialized byte cap", async () => {
    const payload = {
      ...historicalReplay,
      results: Array.from({ length: 5 }, (_, index) => ({ ...syntheticRawStructure, url: `https://reviews.example.com/model-${index}`, highlights: ["Unrelated introduction. ".repeat(500) + "\n" + syntheticRawStructure.highlights[0], ...Array.from({ length: 5 }, () => "😀\n\"\\".repeat(20_000))] })),
      output: { content: { observations: [], unknown: "😀\"\\".repeat(80_000) } },
    };
    let text = "";
    const { result } = await localResearch(payload, (artifact) => { text = artifact; });
    expect(result.kind).toBe("research");
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(128 * 1024);
    const artifact = JSON.parse(text);
    expect(artifact).toMatchObject({ reportedCostUsd: 0.007, resultCount: 5, extractionStatus: "malformed", native: { kind: "object", truncated: true } });
    expect(artifact.native.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.decisionSpans.some((span: { text: string }) => span.text.includes("# Aster Wave 2 - Teal (800073)"))).toBe(true);
    expect(artifact.results.flatMap((source: { highlights: { truncated: boolean }[] }) => source.highlights).some((highlight: { truncated: boolean }) => highlight.truncated)).toBe(true);
  });

  it("does not retry, change cost settlement or public results when a sink fails", async () => {
    const baseline = await localResearch(historicalReplay);
    const failed = await localResearch(historicalReplay, () => { throw new Error("sink failed"); });
    expect(failed.calls).toBe(1);
    expect(failed.settlements).toEqual(baseline.settlements);
    expect(failed.result.kind).toBe("research");
    if (failed.result.kind === "research" && baseline.result.kind === "research") {
      expect(failed.result.research.products).toEqual(baseline.result.research.products);
    }
  });

  it("does not overwrite an existing artifact and still completes the paid operation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "page-evidence-private-"));
    const path = join(directory, "proof.json");
    try {
      await localResearch(historicalReplay, path);
      const first = await readFile(path, "utf8");
      const second = await localResearch(historicalReplay, path);
      expect(second.result.kind).toBe("research");
      expect(second.calls).toBe(1);
      expect(await readFile(path, "utf8")).toBe(first);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("keeps cost settlement when the destination cannot be opened", async () => {
    const directory = await mkdtemp(join(tmpdir(), "page-evidence-private-"));
    try {
      const { result, calls, settlements } = await localResearch(historicalReplay, join(directory, "missing", "proof.json"));
      expect(result.kind).toBe("research");
      expect(calls).toBe(1);
      expect(settlements).toEqual([{ cost: 0.007, complete: true }]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("preserves cancellation even while the optional sink is pending", async () => {
    const controller = new AbortController();
    const settlements: { cost: number | null; complete: boolean }[] = [];
    await expect(localResearch(historicalReplay, async () => { controller.abort(); await new Promise(() => {}); }, controller.signal, settlements)).rejects.toMatchObject({ name: "AbortError" });
    expect(settlements).toEqual([{ cost: null, complete: false }]);
  });
});
