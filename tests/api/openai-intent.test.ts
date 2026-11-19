import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { createOpenAIIntentInterpreter } from "../../src/server/openai-intent";
import { localProvider } from "../helpers/local-exa";

const message = "I want to buy a powerbank that costs around $30-40";
const interpretation = { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: message.length, text: message } }, { kind: "budget", source: { start: 0, end: message.length, text: message }, operation: "replace-range", draft: { amount: 40, minimum: 30, currency: null } }] };
const request = () => ({ phase: "prepare" as const, message, preferences: defaultIntent(), operationId: randomUUID() });
const envelope = (value: unknown = interpretation) => ({ status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 2000, output_tokens: 100 } });
const ledgerPath = async () => join(await mkdtemp(join(tmpdir(), "fieldnote-intent-")), "receipts.json");
const signal = () => new AbortController().signal;
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

describe("bounded OpenAI Responses intent transport", () => {
  it("uses strict Responses JSON, reuses completed operations after restart and never exceeds two reservations", async () => {
    const bodies: Record<string, unknown>[] = [];
    const provider = await localProvider((incoming, response) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => {
        expect(incoming.url).toBe("/v1/responses");
        expect(incoming.headers.authorization).toBe("Bearer fake-test-key");
        const body = Buffer.concat(chunks).toString();
        expect(Buffer.byteLength(body)).toBeLessThanOrEqual(12_000);
        bodies.push(JSON.parse(body));
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(envelope()));
      });
    });
    const path = await ledgerPath();
    const options = { ledgerPath: path, fetch: ((_url, init) => fetch(`${provider.baseUrl}/v1/responses`, init)) as typeof fetch };
    try {
      const first = request();
      expect(await createOpenAIIntentInterpreter("fake-test-key", options)(first, signal())).toEqual({ status: "ready", interpretation });
      expect(await createOpenAIIntentInterpreter("fake-test-key", options)(first, signal())).toEqual({ status: "ready", interpretation });
      expect(await createOpenAIIntentInterpreter("fake-test-key", options)({ ...first, message: "changed" }, signal())).toEqual({ status: "unavailable" });
      expect(await createOpenAIIntentInterpreter("fake-test-key", options)(request(), signal())).toEqual({ status: "ready", interpretation });
      expect(await createOpenAIIntentInterpreter("fake-test-key", options)(request(), signal())).toEqual({ status: "unavailable" });
      expect(bodies).toHaveLength(2);
      expect(bodies[0]).toMatchObject({ model: "gpt-6.2-sol", store: false, max_output_tokens: 2048, text: { format: { type: "json_schema", strict: true } } });
      expect(bodies[0]).not.toHaveProperty("tools");
      expect(bodies[0]).not.toHaveProperty("reasoning");
      expect(JSON.stringify(bodies[0])).not.toContain('"oneOf"');
      const ledger = JSON.parse(await readFile(path, "utf8"));
      expect(ledger.receipts).toHaveLength(2);
      expect(ledger.receipts[0]).toMatchObject({ state: "complete", reservedUsd: 0.05, estimatedCostUsd: 0.005, usage: { inputTokens: 2000, outputTokens: 100 } });
      expect(JSON.stringify(ledger)).not.toContain("fake-test-key");
      expect(JSON.stringify(ledger)).not.toContain("reportedCostUsd");
    } finally { await provider.close(); }
  });
  it.each(["headers", "body"])("cancels the actual upstream %s wait and retains the uncertain reservation", async (phase) => {
    const observed = deferred();
    const closed = deferred();
    let calls = 0;
    const provider = await localProvider((_incoming, response) => {
      calls++;
      response.on("close", closed.resolve);
      if (phase === "body") { response.writeHead(200, { "content-type": "application/json" }); response.write('{"status":'); }
      observed.resolve();
    });
    const path = await ledgerPath();
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: ((_url, init) => fetch(`${provider.baseUrl}/v1/responses`, init)) as typeof fetch });
    const controller = new AbortController();
    try {
      const active = interpret(request(), controller.signal);
      await observed.promise;
      controller.abort();
      await expect(active).rejects.toThrow();
      await closed.promise;
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(1);
      expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ stopped: true, receipts: [{ reservedUsd: 0.05, state: "uncertain" }] });
    } finally { await provider.close(); }
  });
  it.each(["refusal", "invalid-provenance", "missing-usage", "excessive-usage", "http-error", "incomplete", "oversized"])("does not retry or refund %s", async (failure) => {
    let calls = 0;
    const path = await ledgerPath();
    const provider = await localProvider((_incoming, response) => {
      calls++;
      response.writeHead(failure === "http-error" ? 500 : 200, { "content-type": "application/json" });
      const raw = envelope();
      if (failure === "refusal") raw.output[0]!.content = [{ type: "refusal", text: "No" }];
      if (failure === "invalid-provenance") raw.output[0]!.content[0]!.text = JSON.stringify({ ...interpretation, actions: [{ kind: "start-request", source: { start: 0, end: 5, text: "invented" } }] });
      if (failure === "missing-usage") Reflect.deleteProperty(raw, "usage");
      if (failure === "excessive-usage") raw.usage.output_tokens = 3000;
      if (failure === "incomplete") raw.status = "incomplete";
      response.end(failure === "oversized" ? "x".repeat(70_000) : JSON.stringify(raw));
    });
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: ((_url, init) => fetch(`${provider.baseUrl}/v1/responses`, init)) as typeof fetch });
    try {
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(1);
      expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ stopped: true, receipts: [{ reservedUsd: 0.05, state: "uncertain" }] });
    } finally { await provider.close(); }
  });
  it("rejects an oversized UTF-8 input before dispatch or reservation", async () => {
    let calls = 0;
    const path = await ledgerPath();
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: async () => { calls++; throw new Error("Unexpected call"); } });
    expect(await interpret({ ...request(), message: "💼".repeat(2000) }, signal())).toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
    await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("keeps a crashed pending receipt closed to both retry and new operations", async () => {
    const path = await ledgerPath();
    const first = request();
    let calls = 0;
    const provider = await localProvider((_incoming, response) => { calls++; response.destroy(); });
    try {
      const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: ((_url, init) => fetch(`${provider.baseUrl}/v1/responses`, init)) as typeof fetch });
      expect(await interpret(first, signal())).toEqual({ status: "unavailable" });
      expect(await interpret(first, signal())).toEqual({ status: "unavailable" });
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(1);
    } finally { await provider.close(); }
  });
});
