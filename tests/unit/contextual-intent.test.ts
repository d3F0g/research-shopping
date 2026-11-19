import { describe, expect, it } from "vitest";
import { MoneyDraftSchema, defaultIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";

describe("answers to pending money questions", () => {
  it.each(["SGD", "S$", "SGD$30"])("resolves only the missing currency with %s", (answer) => {
    const first = updateIntent("I want to buy a powerbank that costs around $30-40", defaultIntent());
    expect(first.clarification?.reason).toBe("currency");
    const second = updateIntent(answer, first.preferences);
    expect(second.clarification).toBeUndefined();
    expect(second.preferences.budget).toEqual({ minimum: 30, amount: 40, currency: "SGD" });
    expect(second.preferences.pendingChange).toBeNull();
    expect(second.preferences.productDescription).toBe(first.preferences.productDescription);
  });
  it("preserves the floor and criteria when the ceiling changes", () => {
    const initial = updateIntent("powerbank SGD30-40; only Anker", defaultIntent()).preferences;
    const result = updateIntent("make it 50", initial);
    expect(result.preferences.budget).toEqual({ minimum: 30, amount: 50, currency: "SGD" });
    expect(result.preferences.criteria).toEqual(initial.criteria);
    expect(result.preferences.productDescription).toBe(initial.productDescription);
  });
});

describe("amendments while currency is unresolved", () => {
  it("retains the missing currency and floor when the user changes only the ceiling", () => {
    const first = updateIntent("powerbank $30-40", defaultIntent());
    const amended = updateIntent("make it 50", first.preferences);
    expect(amended.preferences.budget).toBeNull();
    expect(amended.preferences.pendingChange).toMatchObject({ kind: "money", missingSlot: "currency", draft: { minimum: 30, amount: 50, currency: null } });
    const resolved = updateIntent("SGD", amended.preferences);
    expect(resolved.preferences.budget).toEqual({ minimum: 30, amount: 50, currency: "SGD" });
  });
});

describe("local versus general intent routing", () => {
  it("sends compound monetary and product changes to the structured interpreter", async () => {
    const { resolveLocalIntent } = await import("../../src/domain/preferences");
    const previous = updateIntent("powerbank $30-40", defaultIntent()).preferences;
    expect(resolveLocalIntent("make it 50; only Anker", previous)).toBeNull();
    expect(resolveLocalIntent("under SGD50; prefer lighter", { ...previous, pendingChange: null })).toBeNull();
  });
});

it("rejects inverted pending bounds at the state boundary", () => {
  expect(MoneyDraftSchema.safeParse({ amount: 20, minimum: 30, currency: null }).success).toBe(false);
});

it("cannot remove an accepted floor by confirming an already explicit replacement currency", () => {
  const previous = { ...defaultIntent(), productDescription: "phone", budget: { minimum: 1000, amount: 2000, currency: "USD" as const } };
  const first = updateIntent("under SGD1800", previous);
  expect(first.preferences.budget).toEqual(previous.budget);
  const second = updateIntent("SGD", first.preferences);
  expect(second.preferences.budget).toEqual(previous.budget);
  expect(second.clarification).toBeDefined();
});
