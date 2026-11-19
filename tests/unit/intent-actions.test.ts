import { describe, expect, it } from "vitest";
import { updateIntent } from "../../src/domain/preferences";
import { defaultIntent } from "../../src/domain/contracts";
import { applyIntentActions, type IntentActions } from "../../src/domain/intent-actions";

const span = (text: string, quote = text) => ({ start: text.indexOf(quote), end: text.indexOf(quote) + quote.length, text: quote });
const previous = () => ({ ...defaultIntent(), productDescription: "powerbank", budget: { minimum: 30, amount: 40, currency: "SGD" as const }, criteria: [{ id: "criterion-1", wording: "only Anker", strength: "hard" as const, origin: { kind: "message" as const, text: "only Anker" } }] });
const apply = (message: string, actions: IntentActions["actions"]) => applyIntentActions(previous(), message, { disposition: "research", actions });

describe("validated model operations", () => {
  it.each(["cheaper", "lighter"])("keeps %s flexible and retains all hard constraints", (message) => {
    const result = apply(message, [{ kind: "add-criterion", strength: "flexible", source: span(message) }]);
    expect(result?.preferences.budget).toEqual(previous().budget);
    expect(result?.preferences.criteria).toEqual([...previous().criteria, expect.objectContaining({ wording: message, strength: "flexible" })]);
    expect(result?.preferences.productDescription).toBe("powerbank");
  });
  it("rejects invented provenance, hard promotion and unauthorized removal", () => {
    expect(apply("lighter", [{ kind: "add-criterion", strength: "hard", source: span("lighter") }])).toBeNull();
    expect(apply("lighter", [{ kind: "add-criterion", strength: "flexible", source: { start: 0, end: 7, text: "cheaper" } }])).toBeNull();
    expect(apply("lighter", [{ kind: "remove-criterion", id: "criterion-1", source: span("lighter") }])).toBeNull();
    expect(apply("do not remove only Anker", [{ kind: "remove-criterion", id: "criterion-1", source: span("do not remove only Anker", "remove only Anker") }])).toBeNull();
  });
  it("never converts an accepted range from a standalone currency", () => {
    expect(apply("USD", [])).toBeNull();
  });
  it("requires an explicit new request before replacing accepted intent", () => {
    expect(apply("lighter", [{ kind: "start-request", source: span("lighter") }])).toBeNull();
    const text = "New request: a wool carder";
    const result = apply(text, [{ kind: "start-request", source: span(text, "a wool carder") }]);
    expect(result?.preferences).toMatchObject({ productDescription: "a wool carder", budget: previous().budget, criteria: previous().criteria });
    expect(apply("do not start over", [{ kind: "start-request", source: span("do not start over") }])).toBeNull();
  });
  it("parses all monetary context, including negation, instead of the model-selected positive slice", () => {
    const message = "do not change my budget to SGD 500";
    const result = apply(message, [{ kind: "budget", source: span(message, "SGD 500"), operation: "set-maximum", draft: { amount: 500, minimum: null, currency: "SGD" } }]);
    expect(result).toBeNull();
  });
  it("keeps the accepted budget while a new objective has an unresolved currency", () => {
    const message = "Instead I want a laptop around $300-400";
    const result = apply(message, [{ kind: "start-request", source: span(message) }, { kind: "budget", source: span(message), operation: "replace-range", draft: { amount: 400, minimum: 300, currency: null } }]);
    expect(result?.preferences.budget).toEqual(previous().budget);
    expect(result?.preferences.criteria).toEqual(previous().criteria);
    expect(result?.preferences.pendingChange).toMatchObject({ kind: "money", draft: { minimum: 300, amount: 400, currency: null } });
  });
  it("rejects a negated full-span budget removal", () => {
    const message = "Do not remove my budget";
    const result = apply(message, [{ kind: "remove-budget", bound: "all", source: span(message) }]);
    expect(result).toBeNull();
  });
  it("preserves the unresolved currency while applying a compound ceiling and brand amendment", () => {
    const pending = updateIntent("powerbank $30-40", defaultIntent()).preferences;
    const message = "make it 50; only Anker";
    const result = applyIntentActions(pending, message, { disposition: "research", actions: [
      { kind: "budget", source: span(message, "make it 50"), operation: "set-maximum", draft: { amount: 50, minimum: null, currency: null } },
      { kind: "add-criterion", source: span(message, "only Anker"), strength: "hard" },
    ] });
    expect(result?.preferences.budget).toBeNull();
    expect(result?.preferences.pendingChange).toMatchObject({ draft: { amount: 50, minimum: 30, currency: null } });
    expect(result?.preferences.criteria).toMatchObject([{ wording: "only Anker", strength: "hard" }]);
  });
  it("only removes the selected lower bound", () => {
    const text = "Remove the minimum budget";
    const result = apply(text, [{ kind: "remove-budget", bound: "minimum", source: span(text) }]);
    expect(result?.preferences.budget).toEqual({ amount: 40, currency: "SGD" });
    expect(apply(text, [{ kind: "remove-budget", bound: "all", source: span(text) }])).toBeNull();
  });
});
