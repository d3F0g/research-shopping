import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { initialConversation, MoneySchema, type ConversationState } from "../../src/domain/conversation";
import { reduceTurn } from "../../src/domain/turn-reducer";
const turn = (state: ConversationState, message: string) => reduceTurn(state, { phase: "prepare", operationId: randomUUID(), message });
describe("V2 contextual conversation", () => {
  it("preserves original request and both budget bounds through a typed currency answer", () => {
    const first = turn(initialConversation(), "I want to buy a powerbank around $30-40.");
    expect(first.kind).toBe("clarification");
    expect(first.state.pending).toMatchObject({ kind: "currency", minimum: 30, maximum: 40, originalRequest: "I want to buy a powerbank around $30-40." });
    const resolved = turn(first.state, "SGD.");
    expect(resolved.kind).toBe("research");
    expect(resolved.state.intent).toMatchObject({ originalText: "I want to buy a powerbank around $30-40.", budget: { minimum: 30, maximum: 40, currency: "SGD" } });
    expect(resolved.state.messages).toHaveLength(3);
    expect(turn(resolved.state, "Make it 50.").state.intent.budget).toEqual({ minimum: 30, maximum: 50, currency: "SGD" });
    expect(turn(resolved.state, "Actually, USD.").state.intent.budget).toEqual({ minimum: 30, maximum: 40, currency: "USD" });
  });
  it("retains complete negative compound requirements and money in the middle", () => {
    const text = "powerbank under SGD40 with USB-C and no wireless charging";
    const result = turn(initialConversation(), text);
    expect(result.kind).toBe("research");
    expect(result.state.intent.budget).toEqual({ maximum: 40, minimum: undefined, currency: "SGD" });
    expect(result.state.intent.requirements[0]?.text).toBe(text);
  });
  it("resolves currency with an additional hard clause atomically", () => {
    const first = turn(initialConversation(), "A torque wrench around $30-40");
    const resolved = turn(first.state, "USD. Adjustable from 2 to 8 Nm is essential.");
    expect(resolved.kind).toBe("research");
    expect(resolved.state.intent.budget).toMatchObject({ minimum: 30, maximum: 40, currency: "USD" });
    expect(resolved.state.intent.requirements.some((r) => r.text === "Adjustable from 2 to 8 Nm is essential.")).toBe(true);
  });
  it("never partly accepts a combined edit or invents a cheaper amount", () => {
    const state = turn(initialConversation(), "A powerbank between SGD30 and40").state;
    const result = turn(state, "make it 50 and remove that requirement");
    expect(result.kind).toBe("clarification");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.pending).toMatchObject({ message: "make it 50 and remove that requirement" });
    const cheaper = turn(state, "Something cheaper.");
    expect(cheaper.state.intent.budget).toEqual(state.intent.budget);
    expect(cheaper.state.intent.requirements.at(-1)).toMatchObject({ text: "Something cheaper.", strength: "flexible" });
  });
  it("accepts unfamiliar products without a budget or fixed registry", () => {
    expect(turn(initialConversation(), "I want an archival book cradle").kind).toBe("research");
    expect(turn(initialConversation(), "Hello").kind).toBe("message");
    expect(MoneySchema.safeParse(19.99).success).toBe(true);
    expect(MoneySchema.safeParse(19.999).success).toBe(false);
  });
});
