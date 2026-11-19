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
  it("retains complete hard follow-ups beside a budget and distinguishes specification numbers", () => {
    const state = turn(initialConversation(), "I want a robot vacuum").state;
    const next = turn(state, "Under USD180, and it must work without a phone app.");
    expect(next.state.intent.originalText).toBe("I want a robot vacuum");
    expect(next.state.intent.budget?.maximum).toBe(180);
    expect(next.state.intent.requirements.at(-1)?.text).toBe("Under USD180, and it must work without a phone app.");
    expect(turn(initialConversation(), "Find a USB-C charger under SGD70, at least 65 W.").state.intent.budget).toMatchObject({ maximum: 70, currency: "SGD" });
  });
});

describe("free contextual operations", () => {
  it.each([
    "Thanks. How do I change the theme?", "Compare the first and third options", "Which one is best overall?",
    "Just show me the best one", "Which has the stronger evidence for background-noise rejection?",
    "Why is the second so much cheaper?", "Compare their noise and battery life.", "Compare the current options.",
    "The search failed. What happened?", "Cancel that.", "Did it stop?", "What do you remember about my requirements?",
    "Open the supporting source for the recommended light.", "I don't like any of those", "Don't change my existing budget",
  ])("retains requirements and avoids research for %s", (message) => {
    const state = turn(initialConversation(), "An archival book cradle under USD 80. No plastic supports.").state;
    const result = turn(state, message);
    expect(result.kind).toBe("message");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.messages.at(-1)?.role).toBe("assistant");
  });
  it("expands retained details and never invents a price ceiling for cheaper", () => {
    const state = turn(initialConversation(), "Find an archival book cradle between USD 30 and 80.").state;
    const detail = turn(state, "Show me more details");
    expect(detail.kind).toBe("message");
    expect(detail.state.intent.responseLength).toBe("expanded");
    const cheaper = turn(state, "Something cheaper");
    expect(cheaper.kind).toBe("message");
    expect(cheaper.state.intent.budget).toEqual(state.intent.budget);
    expect(cheaper.state.intent.requirements.at(-1)?.strength).toBe("flexible");
  });
  it("separates explicit flexible clauses from hard requirements", () => {
    const first = turn(initialConversation(), "I want a tactile label maker. Braille is essential; portability would be nice.");
    expect(first.state.intent.requirements.find((r) => r.text.includes("portability"))?.strength).toBe("flexible");
    expect(first.state.intent.requirements.find((r) => r.text.includes("Braille"))?.strength).toBe("hard");
    const next = turn(first.state, "Quiet would be nice. No disposable cartridges. Under USD180.");
    expect(next.state.intent.requirements.find((r) => r.text.includes("Quiet"))?.strength).toBe("flexible");
    expect(next.state.intent.requirements.find((r) => r.text.includes("No disposable"))?.strength).toBe("hard");
    expect(next.state.intent.budget?.maximum).toBe(180);
  });
  it("asks for missing replacement fit without rejecting unfamiliar products", () => {
    const first = turn(initialConversation(), "I need a replacement tip for my white cane.");
    expect(first.kind).toBe("clarification");
    expect(first.state.intent.originalText).toContain("white cane");
    const next = turn(first.state, "It has an 8 mm screw fitting. USD 25 max.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.requirements.some((r) => r.text.includes("8 mm screw"))).toBe(true);
  });
});
