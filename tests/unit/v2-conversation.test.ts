import { evidenceContext } from "../../src/domain/rendered-evidence";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { initialConversation, MoneySchema, type ConversationState } from "../../src/domain/conversation";
import { StoredConversationSchema } from "../../src/domain/workspace";
import { reduceTurn } from "../../src/domain/turn-reducer";
import { projectExaAnswer } from "../../src/server/exa-research";
import { nativeMaterial } from "../helpers/v2-material";
import { createConversationService } from "../../src/server/conversations";
import type { ResearchOperation } from "../../src/domain/research";
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
  it("inspects reported source disagreement without accepting the report as a requirement", () => {
    const state = turn(initialConversation(), "Find a waterproof backpack under USD100. It must protect contents in heavy rain.").state;
    const result = turn(state, "One source says waterproof and another says only splash-resistant. Which is it?");
    expect(result.kind).toBe("message");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.messages.at(-1)?.text).toContain("no retained research");
  });
  it("keeps a referenced product price separate from the budget and retains buyer eligibility", () => {
    const state = turn(initialConversation(), "Find a compact photo printer between GBP50 and100. No disposable batteries.").state;
    const history = structuredClone(state.messages);
    const result = turn(state, "That GBP89 one looks good. I'm not a member and won't subscribe.");
    expect(result.kind).toBe("message");
    expect(result.state.intent.budget).toEqual({ minimum: 50, maximum: 100, currency: "GBP" });
    expect(result.state.intent.requirements.slice(0, state.intent.requirements.length)).toEqual(state.intent.requirements);
    expect(result.state.intent.requirements.at(-1)).toMatchObject({ text: "I'm not a member and won't subscribe.", strength: "hard" });
    expect(result.state.messages.slice(0, history.length)).toEqual(history);
  });
  it.each([
    "That GBP89 one looks good and make it70.",
    "I like the first one and change my budget to GBP80.",
    "That GBP89 one looks good. I'm not a member and remove the minimum.",
    "That GBP89 one looks good. I'm not a member and I need archival ink.",
    "One source says waterproof. Which is it? Remove the budget.",
    "One source says waterproof. Which is it and make it GBP80?",
  ])("keeps all of an unsupported contextual compound pending: %s", (message) => {
    const state = turn(initialConversation(), "Find an unfamiliar tool between GBP50 and100.").state;
    const result = turn(state, message);
    expect(result.kind).toBe("clarification");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.pending).toMatchObject({ kind: "edit", message });
  });
  it.each([
    "That GBP89 one looks good. I'm not a member and won't subscribe.",
    "That GBP89 one looks good and remove the minimum.",
  ])("retains the original typed currency draft through contextual message %s", (message) => {
    const state = turn(initialConversation(), "Find an unfamiliar tool between $50 and100.").state;
    const result = turn(state, message);
    expect(result.kind).toBe("clarification");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.pending).toEqual(state.pending);
    expect(turn(result.state, "GBP").state.intent.budget).toEqual({ minimum: 50, maximum: 100, currency: "GBP" });
  });
  it.each([
    "Thanks. How do I change the theme?", "Compare the first and third options", "Which one is best overall?",
    "Just show me the best one", "Which has the stronger evidence for background-noise rejection?",
    "Why is the second so much cheaper?", "Compare their noise and battery life.", "Compare the current options.",
    "The search failed. What happened?", "Cancel that.", "Did it stop?", "What do you remember about my requirements?",
    "Open the supporting source for the recommended light.", "I don't like any of those", "Don't change my existing budget",
  ])("retains requirements and avoids research for %s", (message) => {
    const state = turn(initialConversation(), "An archival book cradle under USD 80. No plastic supports.").state;
    const result = turn(state, message);
    expect(result.kind).toBe(message === "Cancel that." ? "cancel" : "message");
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


describe("retained snapshot answers", () => {
  function researched() {
    const state = turn(initialConversation(), "A USB-C powerbank between SGD30 and40.").state;
    const projected = projectExaAnswer(nativeMaterial(state.intent), state.intent);
    if (projected.status !== "ready") throw new Error("Fixture research was not projected");
    const research = projected.research;
    research.products = [0, 1, 2].map((index) => ({ ...structuredClone(research.products[0]!), id: `fixture-${index}`, name: `Fixture option ${index + 1}` }));
    research.choice = { productId: "fixture-0", rationale: "Fixture data: this option has supported USB-C evidence." };
    state.messages.push({ id: "fixture-response", role: "assistant", text: "Fixture data comparison", research });
    return StoredConversationSchema.parse(state);
  }
  it("compares exact displayed ordinals and retains their evidence provenance", () => {
    const state = researched();
    const result = turn(state, "Compare the first and third options");
    expect(result.kind).toBe("message");
    expect(result.state.messages.at(-1)?.text).toContain("Fixture option 1");
    expect(result.state.messages.at(-1)?.text).toContain("Fixture option 3");
    expect(result.state.messages.at(-1)?.text).not.toContain("Fixture option 2");
    expect(result.state.messages.at(-1)?.detail).toContain("https://manufacturer.com/model-a");
    const firstTwo = turn(state, "Compare the first two").state.messages.at(-1)?.text;
    expect(firstTwo).toContain("Fixture option 1");
    expect(firstTwo).toContain("Fixture option 2");
    expect(firstTwo).not.toContain("Fixture option 3");
  });
  it("keeps concise held answers useful and retains full qualified evidence without changing snapshots", () => {
    const state = researched();
    const product = state.messages.at(-1)!.research!.products[0]!;
    product.attributes[0]!.assessment.rationale = "Up to 12 hours, only with low-power devices; high-power use has not been established.";
    const qualified = product.attributes[0]!.assessment.rationale;
    const accepted = structuredClone(state.messages);
    const short = turn(state, "Keep it short.");
    const question = turn(short.state, "What about battery life?");
    const answer = question.state.messages.at(-1)!;
    expect(question.kind).toBe("message");
    expect(answer.text).toContain(qualified);
    expect(answer.text).toContain("AI source assessment supported");
    expect(answer.text.length).toBeLessThan(850);
    expect(answer.text).not.toContain("https://");
    expect(answer.detail).toContain(qualified);
    expect(answer.detail).toContain("up to 12 hours battery life");
    expect(answer.detail).toContain("tax included");
    expect(question.state.messages.slice(0, accepted.length)).toEqual(accepted);
    expect(StoredConversationSchema.safeParse(question.state).success).toBe(true);
    expect(StoredConversationSchema.safeParse(state).success).toBe(true);
    const expanded = turn(question.state, "Show me more details.");
    expect(expanded.state.messages.at(-1)?.text).toContain("https://manufacturer.com/model-a");
    expect(expanded.state.messages.at(-1)?.text).toContain(qualified);
  });
  it("shows the whole brief native finding when its complete supporting passage is long", () => {
    const state = researched();
    const assessment = state.messages.at(-1)!.research!.products[0]!.attributes[0]!.assessment;
    assessment.rationale = "Up to 12 hours, only with ANC off; runtime with ANC enabled is unknown.";
    const passage = evidenceContext(assessment.support[0]!);
    const answer = turn(state, "What about battery life?").state.messages.at(-1)!;
    expect(answer.text).toContain(`Battery life: (AI source assessment supported, exact-variant) ${assessment.rationale}`);
    expect(answer.text).not.toContain(passage);
    expect(answer.detail).toContain(assessment.rationale);
    expect(answer.detail).toContain(passage);
    expect(answer.detail).toContain("https://manufacturer.com/model-a");
  });
  it.each(["unknown", "conflict"] as const)("keeps %s prominent and discloses long adverse findings whole", (status) => {
    const state = researched();
    const assessment = state.messages.at(-1)!.research!.products[0]!.attributes[0]!.assessment;
    assessment.status = status;
    assessment.rationale = "A long positive-looking battery claim ".repeat(8) + "does not hold for the requested variant; a second retained passage contradicts it.";
    const result = turn(state, "What about battery life?");
    const answer = result.state.messages.at(-1)!;
    expect(answer.text).toContain(`Battery life: (AI source assessment ${status}, exact-variant)`);
    expect(answer.text).not.toContain("positive-looking");
    expect(answer.detail).toContain(assessment.rationale);
    expect(answer.detail).toContain("https://manufacturer.com/model-a");
  });
  it("does not display an unsupported brief native claim as a finding", () => {
    const state = researched();
    const assessment = state.messages.at(-1)!.research!.products[0]!.attributes[0]!.assessment;
    assessment.status = "unknown";
    assessment.support = [];
    assessment.rationale = "Up to 12 hours, only with ANC off.";
    const answer = turn(state, "What about battery life?").state.messages.at(-1)!;
    expect(answer.text).toContain("Battery life: (AI source assessment unknown, exact-variant)");
    expect(answer.text).not.toContain(assessment.rationale);
    expect(answer.detail).toContain(assessment.rationale);
  });
  it("keeps oversized passages whole in canonical history and makes display omissions explicit", () => {
    const state = researched();
    const research = state.messages.at(-1)!.research!;
    if (research.evidenceVersion !== 4) throw new Error("Expected current fixture evidence");
    research.products[0]!.attributes = Array.from({ length: 6 }, () => structuredClone(research.products[0]!.attributes[0]!));
    for (const attribute of research.products[0]!.attributes) attribute.assessment.support = Array.from({ length: 3 }, () => ({ ...attribute.assessment.support[0]!, context: { start: 0, end: 4000, text: "x".repeat(4000) } }));
    const result = turn(state, "Compare the first two.");
    const answer = result.state.messages.at(-1)!;
    expect(answer.detail!.length).toBeLessThanOrEqual(24000);
    expect(answer.detail).toContain("Additional complete evidence remains in the original research message");
    expect(answer.detail).not.toContain("x");
    expect(result.state.messages[1]?.research).toEqual(research);
  });
  it("asks for an ambiguous referent and answers only the chosen option with unknown attributes", () => {
    const state = researched();
    const ambiguous = turn(state, "Is that one good for denim?");
    expect(ambiguous.kind).toBe("message");
    expect(ambiguous.state.messages.at(-1)?.text).toMatch(/Which displayed option/);
    const resolved = turn(ambiguous.state, "I mean the second machine.");
    expect(resolved.kind).toBe("message");
    const answer = resolved.state.messages.at(-1)?.text;
    expect(answer).toContain("Fixture option 2");
    expect(answer).not.toContain("Fixture option 1");
    expect(answer).toContain("Missing attributes remain unknown");
  });
  it("rechecks budget and changed hard wording before repeating a recommendation", () => {
    const state = researched();
    expect(turn(state, "Just show me the best one").state.messages.at(-1)?.text).toContain("Fixture option 1");
    state.intent.budget = { minimum: 10, maximum: 20, currency: "SGD" };
    expect(turn(state, "Just show me the best one").state.messages.at(-1)?.text).toContain("cannot choose a compliant best");
    state.intent.budget = { minimum: 30, maximum: 40, currency: "SGD" };
    state.intent.requirements[0]!.text += " Must be waterproof.";
    expect(turn(state, "Just show me the best one").state.messages.at(-1)?.text).toContain("changed requirements");
  });
});

describe("complete contextual changes", () => {
  it("retains unknown compound operations without accepting a partial command", () => {
    const state = turn(initialConversation(), "I need a USB-C charger between SGD30 and40. No wireless charging.").state;
    const result = turn(state, "Compare the first two and change my budget to SGD80");
    expect(result.kind).toBe("clarification");
    expect(result.state.intent).toEqual(state.intent);
    expect(result.state.pending).toMatchObject({ kind: "edit", message: "Compare the first two and change my budget to SGD80" });
  });
  it("preserves the typed currency draft when a combined currency edit cannot be applied", () => {
    const state = turn(initialConversation(), "I need an archival book cradle around $30-40").state;
    const result = turn(state, "SGD and remove the minimum");
    expect(result.kind).toBe("clarification");
    expect(result.state.pending).toEqual(state.pending);
    expect(result.state.intent).toEqual(state.intent);
    const resolved = turn(result.state, "SGD");
    expect(resolved.kind).toBe("research");
    expect(resolved.state.intent.budget).toMatchObject({ minimum: 30, maximum: 40, currency: "SGD" });
  });
  it("replaces the objective while preserving unmentioned hard criteria and both bounds", () => {
    const state = turn(initialConversation(), "I need a desktop microphone between SGD100 and150. It must work without a phone app.").state;
    const next = turn(state, "Actually I need a portable recorder under SGD200.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.originalText).toContain("portable recorder");
    expect(next.state.intent.requirements.some((r) => r.text.includes("without a phone app"))).toBe(true);
    expect(next.state.intent.budget).toEqual({ minimum: 100, maximum: 200, currency: "SGD" });
    expect(next.state.messages[0]?.text).toContain("desktop microphone");
  });
  it("discards constraints only when the whole previous objective is explicitly abandoned", () => {
    const state = turn(initialConversation(), "Find a desk lamp between SGD60 and100. It must clamp onto the desk.").state;
    const next = turn(state, "Actually forget the lamp. I need a floor lamp under SGD180; freestanding is essential.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.requirements.some((r) => r.text.includes("clamp"))).toBe(false);
    expect(next.state.intent.budget).toEqual({ maximum: 180, currency: "SGD" });
    expect(next.state.messages[0]?.text).toContain("clamp");
  });
});


describe("bounded named scalar corrections", () => {
  it("updates one literal attribute value and keeps its unit, other requirements and history", () => {
    const state = turn(initialConversation(), "Find waterproof hiking boots in EU size 42, up to GBP140. No plastic trim.").state;
    const next = turn(state, "Actually size 43.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.productDescription).toContain("EU size 43");
    expect(next.state.intent.productDescription).not.toContain("size 42");
    expect(next.state.intent.originalText).not.toContain("size 42");
    expect(next.state.intent.productDescription).toContain("No plastic trim");
    expect(next.state.intent.budget).toEqual(state.intent.budget);
    expect(next.state.intent.requirements.find((r) => r.text.includes("size 43"))?.originMessageId).toBe(next.state.messages.at(-1)?.id);
    expect(next.state.messages[0]?.text).toContain("EU size 42");
    const flexible = turn(next.state, "Brown would be nice.");
    expect(flexible.state.intent.requirements.at(-1)).toMatchObject({ strength: "flexible" });
  });
  it("works for an unfamiliar literal numeric attribute without a feature registry", () => {
    const state = turn(initialConversation(), "Find an archival book cradle with opening angle 120 degrees under USD100.").state;
    const next = turn(state, "Actually opening angle 140 degrees.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.productDescription).toContain("opening angle 140 degrees");
    expect(next.state.intent.budget).toEqual(state.intent.budget);
  });
  it("updates a scalar immediately before sentence punctuation", () => {
    const state = turn(initialConversation(), "I need an archival cradle with opening angle 120.").state;
    const next = turn(state, "Actually opening angle 140.");
    expect(next.kind).toBe("research");
    expect(next.state.intent.productDescription).toContain("opening angle 140.");
  });
  it.each([
    ["Find a stand with height 42 cm. It must have height 55 cm when extended.", "Actually height 43 cm."],
    ["Find a stand with height 42 cm.", "Actually width 43 cm."],
    ["Find a stand with height 42 cm.", "Actually height 43 kg."],
    ["Find a stand with height 42 cm.", "Actually height 43 cm and remove the budget."],
    ["Find a stand with height 42 to 55 cm.", "Actually height 43."],
    ["Find a stand with height 42 cm or 55 cm.", "Actually height 43 cm."],
  ])("retains a complete ambiguous or unsupported scalar correction", (request, message) => {
    const state = turn(initialConversation(), request).state;
    const next = turn(state, message);
    expect(next.kind).toBe("clarification");
    expect(next.state.intent).toEqual(state.intent);
    expect(next.state.pending).toMatchObject({ kind: "edit", message });
  });
});


describe("text cancellation effect", () => {
  it("aborts active research, rejects its late result and retains the accepted request", async () => {
    let signal: AbortSignal | undefined;
    let finish: (() => void) | undefined;
    const quota = { reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) };
    const research: ResearchOperation = async ({ intent }, abort) => {
      signal = abort;
      await new Promise<void>((resolve) => { finish = resolve; });
      return projectExaAnswer(nativeMaterial(intent), intent);
    };
    const service = createConversationService({ research, quota });
    const id = service.create();
    const prepared = service.prepare(id, { phase: "prepare", operationId: randomUUID(), message: "A USB-C powerbank under SGD40." });
    if (prepared.kind !== "prepared") throw new Error("No prepared request");
    const response = service.research(id, prepared.preparedId, new AbortController().signal);
    await vi.waitFor(() => expect(signal).toBeDefined());
    const cancelled = service.prepare(id, { phase: "prepare", operationId: randomUUID(), message: "Cancel that." });
    expect(cancelled.kind).toBe("message");
    expect(signal!.aborted).toBe(true);
    expect(cancelled.state.intent).toEqual(prepared.state.intent);
    finish!();
    expect((await response).kind).toBe("research-unavailable");
    expect(service.state(id).messages.some((message) => message.research)).toBe(false);
    expect(quota.reserve).toHaveBeenCalledTimes(1);
    expect(quota.settle).toHaveBeenCalledWith(expect.any(String), 0.005, false);
  });
});


describe("complete nonnumeric corrections", () => {
  it.each([
    "I meant manual, sorry. No batteries or mains power.",
    "Actually other brands are fine, but still no Sony.",
  ])("retains every new hard clause in %s", (message) => {
    const state = turn(initialConversation(), "Find an unfamiliar hand tool under USD180.").state;
    const next = turn(state, message);
    expect(next.kind).toBe("research");
    expect(next.state.intent.requirements.at(-1)).toMatchObject({ text: message, strength: "hard" });
    expect(next.state.intent.budget).toEqual(state.intent.budget);
  });
});


describe("punctuated brand release", () => {
  it.each([".", "!", "?", ""])("releases a named brand ending in %s while retaining hard exclusions, interface and both bounds", (punctuation) => {
    let state = turn(initialConversation(), "Find a charger between SGD30 and40. No Sony. Only USB-C.").state;
    const before = structuredClone(state.intent);
    state = turn(state, `Only Lumenvale${punctuation}`).state;
    expect(state.intent.requirements.at(-1)).toMatchObject({ kind: "brand", strength: "hard", text: `Only Lumenvale${punctuation}` });
    const accepted = structuredClone(state.messages);
    const released = turn(state, `Show me other brands${punctuation}`);
    expect(released.kind).toBe("research");
    expect(released.state.intent.productDescription).not.toContain("Lumenvale");
    expect(released.state.intent.requirements).toEqual(before.requirements);
    expect(released.state.intent.productDescription).toContain("No Sony");
    expect(released.state.intent.productDescription).toContain("Only USB-C");
    expect(released.state.intent.budget).toEqual({ minimum: 30, maximum: 40, currency: "SGD" });
    expect(released.state.messages.slice(0, accepted.length)).toEqual(accepted);
  });
  it("does not remove an interface-only contextual follow-up or a compound hard clause", () => {
    let state = turn(initialConversation(), "Find a charger under USD100.").state;
    state = turn(state, "Only USB-C.").state;
    state = turn(state, "Only Lumenvale with replaceable cables.").state;
    expect(state.intent.requirements.slice(-2).every((requirement) => requirement.kind !== "brand")).toBe(true);
    const released = turn(state, "Show me other brands.");
    expect(released.state.intent.requirements).toEqual(state.intent.requirements);
  });
});

describe("conventional financial thousands", () => {
  it.each([
    ["Necklaces between1kto2k", 1000, 2000],
    ["An archival cradle between 1.5k and 2K.", 1500, 2000],
    ["Find an unfamiliar instrument budget of 1k-2.25k.", 1000, 2250],
  ])("retains both numeric bounds and resolves only currency for %s", (message, minimum, maximum) => {
    const first = turn(initialConversation(), message as string);
    expect(first.kind).toBe("clarification");
    expect(first.state.pending).toMatchObject({ kind: "currency", originalRequest: message, minimum, maximum });
    const resolved = turn(first.state, "SGD.");
    expect(resolved.kind).toBe("research");
    expect(resolved.state.intent.budget).toEqual({ minimum, maximum, currency: "SGD" });
    expect(resolved.state.intent.originalText).toBe(message);
  });
  it.each([
    ["Find a synthesizer between USD1.2k and USD2k.", { minimum: 1200, maximum: 2000, currency: "USD" }],
    ["Find an instrument under EUR1.5k.", { maximum: 1500, currency: "EUR" }],
  ])("accepts explicit currency for %s", (message, budget) => {
    const result = turn(initialConversation(), message as string);
    expect(result.kind).toBe("research");
    expect(result.state.intent.budget).toEqual(budget);
  });
  it.each([
    "Find a Model1kto2k accessory.",
    "Find a model 1k to 2k accessory.",
    "Find an audio device between1kto2k Hz.",
    "Find a 1k ohm resistor.",
    "Find a 4k monitor.",
  ])("does not manufacture money from a model or measurement in %s", (message) => {
    const result = turn(initialConversation(), message);
    expect(result.state.intent.budget).toBeNull();
    expect(result.state.pending).toBeNull();
  });
});
