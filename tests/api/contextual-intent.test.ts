import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { defaultIntent, type ShoppingIntent } from "../../src/domain/contracts";
import { type IntentActions, type IntentInterpreter } from "../../src/domain/intent-actions";
import { createResearchTurns } from "../../src/server/research-turns";
import { submitTurn } from "../helpers/turns";

const span = (text: string, quote = text) => ({ start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, text: quote });
const parsed = (actions: IntentActions["actions"]): ReturnType<IntentInterpreter> => Promise.resolve({ status: "ready", interpretation: { disposition: "research", actions } });
const request = (message: string, preferences = defaultIntent()) => ({ phase: "prepare" as const, message, preferences, operationId: randomUUID() });
const signal = () => new AbortController().signal;

describe("contextual request preparation", () => {
  it.each(["SGD", "S$", "SGD$30"])("researches SGD30 to SGD40 automatically after %s without another model call", async (answer) => {
    const message = "I want to buy a powerbank that costs around $30-40";
    const interpretIntent = vi.fn<IntentInterpreter>(async () => parsed([{ kind: "start-request", source: span(message) }, { kind: "budget", source: span(message), operation: "replace-range", draft: { amount: 40, minimum: 30, currency: null } }]));
    const seen: ShoppingIntent[] = [];
    const turns = createResearchTurns({ interpretIntent, quota: { reserve: async () => "admitted", settle: async () => {} }, research: async ({ preferences }) => { seen.push(preferences); return { status: "unavailable", reason: "empty", reportedCostUsd: 0.005 }; } });
    const first = await submitTurn(turns, request(message), signal());
    expect(first).toMatchObject({ kind: "clarification", preferences: { budget: null, pendingChange: { kind: "money", missingSlot: "currency", draft: { amount: 40, minimum: 30, currency: null } } } });
    expect(seen).toHaveLength(0);
    const result = await submitTurn(turns, { ...request(answer, first.preferences), questionId: first.preferences.pendingChange!.id }, signal());
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "empty", preferences: { budget: { currency: "SGD", minimum: 30, amount: 40 }, pendingChange: null } });
    expect(seen).toHaveLength(1);
    expect(interpretIntent).not.toHaveBeenCalled();
    expect(seen[0]!.productDescription).toBe(message);
  });
  it("preserves a resolved pending answer with the interpreter absent", async () => {
    const message = "powerbank $30-40";
    const first = await createResearchTurns({ interpretIntent: async () => parsed([{ kind: "start-request", source: span(message) }, { kind: "budget", source: span(message), operation: "replace-range", draft: { amount: 40, minimum: 30, currency: null } }]) }).turn(request(message), signal());
    const result = await createResearchTurns({}).turn(request("SGD", first.preferences), signal());
    expect(result).toMatchObject({ kind: "prepared", preferences: { budget: { minimum: 30, amount: 40, currency: "SGD" }, pendingChange: null } });
  });
  it("returns an honest interpretation failure with the entire accepted state preserved", async () => {
    const previous = { ...defaultIntent(), productDescription: "powerbank", budget: { minimum: 30, amount: 40, currency: "SGD" as const } };
    const result = await createResearchTurns({ interpretIntent: async () => { throw new Error("Unavailable"); } }).turn(request("something lighter", previous), signal());
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "intent-unavailable", preferences: previous });
  });
  it("rejects stale question answers before invoking either provider", async () => {
    const interpretation = vi.fn<IntentInterpreter>();
    const result = await createResearchTurns({ interpretIntent: interpretation }).turn({ ...request("SGD"), questionId: "question-123" }, signal());
    expect(result.kind).toBe("message");
    expect(interpretation).not.toHaveBeenCalled();
  });
  it("never publishes a model response after the request is cancelled", async () => {
    const controller = new AbortController();
    const message = "A wool carder";
    const turns = createResearchTurns({ interpretIntent: async () => { controller.abort(); return parsed([{ kind: "start-request", source: span(message) }]); } });
    await expect(turns.turn(request(message), controller.signal)).rejects.toThrow();
  });
});
