import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { createOpenAIIntentInterpreter } from "../../src/server/openai-intent";
import { localProvider } from "../helpers/local-exa";

const message = "I need a wool carder";
const interpretation = { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: message.length, text: message } }] };
const request = () => ({ phase: "prepare" as const, message, preferences: defaultIntent(), operationId: randomUUID() });
const envelope = (inputTokens = 2000, outputTokens = 100) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(interpretation) }] }], usage: { input_tokens: inputTokens, output_tokens: outputTokens } });
const ledgerPath = async () => join(await mkdtemp(join(tmpdir(), "fieldnote-receipt-boundary-")), "receipts.json");
const signal = () => new AbortController().signal;

describe("intent receipt lifecycle at admission and settlement", () => {
  it.each([
    "complete-null-usage", "complete-null-interpretation", "complete-wrong-cost", "complete-over-input", "complete-over-output", "duplicate-operation", "pending-with-settlement", "pending-before-complete", "uncertain-without-stop",
  ])("blocks both reuse and fresh dispatch from %s", async (variant) => {
    const path = await ledgerPath();
    let calls = 0;
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: async () => { calls++; return new Response(JSON.stringify(envelope())); } });
    const originalRequest = request();
    expect(await interpret(originalRequest, signal())).toEqual({ status: "ready", interpretation });
    const ledger = JSON.parse(await readFile(path, "utf8"));
    const receipt = ledger.receipts[0];
    if (variant === "complete-null-usage") { receipt.usage = null; receipt.estimatedCostUsd = null; }
    if (variant === "complete-null-interpretation") receipt.interpretation = null;
    if (variant === "complete-wrong-cost") receipt.estimatedCostUsd = 0;
    if (variant === "complete-over-input") { receipt.usage.inputTokens = 13000; receipt.estimatedCostUsd = 0.027; }
    if (variant === "complete-over-output") { receipt.usage.outputTokens = 3000; receipt.estimatedCostUsd = 0.034; }
    if (variant === "duplicate-operation") ledger.receipts.push(structuredClone(receipt));
    if (variant === "pending-with-settlement") receipt.state = "pending";
    if (variant === "pending-before-complete") ledger.receipts.unshift({ ...receipt, operationId: randomUUID(), state: "pending", interpretation: null, usage: null, estimatedCostUsd: null });
    if (variant === "uncertain-without-stop") receipt.state = "uncertain";
    const corrupted = JSON.stringify(ledger);
    await writeFile(path, corrupted);
    calls = 0;
    expect(await interpret(originalRequest, signal())).toEqual({ status: "unavailable" });
    expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
    expect(calls).toBe(0);
    expect(await readFile(path, "utf8")).toBe(corrupted);
  });

  it.each([[13000, 100], [2000, 3000]])("keeps known usage and returns unavailable for %i input and %i output tokens", async (inputTokens, outputTokens) => {
    const path = await ledgerPath();
    let calls = 0;
    const provider = await localProvider((_incoming, response) => {
      calls++;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(envelope(inputTokens, outputTokens)));
    });
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: ((_url, init) => fetch(`${provider.baseUrl}/v1/responses`, init)) as typeof fetch });
    try {
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(1);
      expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ stopped: true, receipts: [{ state: "uncertain", reservedUsd: 0.05, usage: { inputTokens, outputTokens }, estimatedCostUsd: (inputTokens * 2 + outputTokens * 10) / 1_000_000 }] });
    } finally { await provider.close(); }
  });

  it("retains known usage when returned actions fail validation", async () => {
    const path = await ledgerPath();
    const raw = envelope();
    raw.output[0]!.content[0]!.text = '{"unexpected":true}';
    const interpret = createOpenAIIntentInterpreter("fake-test-key", { ledgerPath: path, fetch: async () => new Response(JSON.stringify(raw)) });
    expect(await interpret(request(), signal())).toEqual({ status: "unavailable" });
    expect(JSON.parse(await readFile(path, "utf8"))).toMatchObject({ stopped: true, receipts: [{ state: "uncertain", reservedUsd: 0.05, interpretation: null, usage: { inputTokens: 2000, outputTokens: 100 }, estimatedCostUsd: 0.005 }] });
  });
});
