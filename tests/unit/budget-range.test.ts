import { describe, expect, it } from "vitest";
import { BudgetSchema, defaultIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";

describe("dynamic budget ranges", () => {
  it("keeps the exact necklace request and both thousand-denominated bounds", () => {
    const result = updateIntent("Necklaces between 1k to 2k", defaultIntent());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.productDescription).toBe(
      "Necklaces between 1k to 2k",
    );
    expect(result.preferences.budget).toEqual({
      minimum: 1000,
      amount: 2000,
      currency: "SGD",
    });
    expect(result.preferences.budgetClarified).toBe(true);
    expect(result.notes.join(" ")).toContain("SGD");
  });

  it("expands a single thousand-denominated cap without guessing its currency", () => {
    expect(
      updateIntent("A projector under SGD200k", defaultIntent()).preferences
        .budget,
    ).toEqual({ amount: 200000, currency: "SGD" });
  });

  it("validates the numeric interval at the request boundary", () => {
    expect(
      BudgetSchema.safeParse({ minimum: 1000, amount: 2000, currency: "SGD" })
        .success,
    ).toBe(true);
    expect(
      BudgetSchema.safeParse({ minimum: 2000, amount: 1000, currency: "SGD" })
        .success,
    ).toBe(false);
  });
});

describe("range wording and retained constraints", () => {
  it.each([
    ["Necklaces between1kto2k", 1000, 2000, "SGD"],
    ["Art prints between 1.25k and 2.5k", 1250, 2500, "SGD"],
    ["Coffee grinder from SGD100 to SGD200", 100, 200, "SGD"],
    ["Desk budget USD100-200", 100, 200, "USD"],
    ["A watch between 1,000 and 2,000 USD", 1000, 2000, "USD"],
    ["A desk SGD100–200", 100, 200, "SGD"],
  ])(
    "accepts %s without a product vocabulary",
    (message, minimum, amount, currency) => {
      const result = updateIntent(message, defaultIntent());
      expect(result.clarification).toBeUndefined();
      expect(result.preferences.budget).toEqual({ minimum, amount, currency });
    },
  );

  it.each([
    "A radio between 1k and 2k Hz",
    "A radio between 1kand2kHz",
    "A shelf between 10 and 20 cm",
    "A bottle under 2 kg",
    "A 4K monitor with 32 GB support",
  ])("keeps measurements and names out of money in %s", (message) => {
    const result = updateIntent(message, defaultIntent());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.budget).toBeNull();
    expect(result.preferences.productDescription).toBe(message);
  });

  it.each([
    "Necklaces between 2k and 1k",
    "Necklaces between SGD1k and USD2k",
    "Necklaces between $1k and $2k",
    "Necklaces between EUR1k and EUR2k",
    "Necklaces between 1e3 and 2e3",
    "Necklaces between 1k and 2k, budget SGD3k",
    "Necklaces between 1k and",
    "Necklaces between -1k and 2k",
  ])("retains an unresolved budget for %s", (message) => {
    const result = updateIntent(message, defaultIntent());
    expect(result.clarification).toBeDefined();
    expect(result.preferences.pendingChange?.message).toBe(message);
    expect(result.preferences.budget).toBeNull();
  });

  it("preserves a floor on cap changes and unrelated changes, until explicitly removed", () => {
    const first = updateIntent(
      "Necklaces between 1k to 2k. Must be silver.",
      defaultIntent(),
    ).preferences;
    const second = updateIntent("under 1.5k", first).preferences;
    expect(second.budget).toEqual({
      minimum: 1000,
      amount: 1500,
      currency: "SGD",
    });
    expect(second.criteria).toEqual(first.criteria);
    const conflict = updateIntent("under 500", second);
    expect(conflict.clarification?.reason).toBe("budget");
    expect(conflict.preferences.budget).toEqual(second.budget);
    expect(updateIntent("Thanks", second).preferences.budget).toEqual(
      second.budget,
    );
    expect(
      updateIntent("Remove minimum budget", second).preferences.budget,
    ).toEqual({ amount: 1500, currency: "SGD" });
    expect(updateIntent("Remove budget", second).preferences.budget).toBeNull();
    expect(first.budget).toEqual({
      minimum: 1000,
      amount: 2000,
      currency: "SGD",
    });
  });

  it("requires both bounds when changing an established range currency", () => {
    const first = updateIntent(
      "Necklaces between 1k and 2k",
      defaultIntent(),
    ).preferences;
    const conflict = updateIntent("under USD1500", first);
    expect(conflict.clarification?.reason).toBe("currency");
    expect(conflict.preferences.budget).toEqual(first.budget);
    expect(
      updateIntent("between USD500 and USD1500", first).preferences.budget,
    ).toEqual({ minimum: 500, amount: 1500, currency: "USD" });
  });
});

it.each([
  "Do not clear minimum budget",
  "Do not clear budget",
  "Clear minimum and under SGD500",
])(
  "does not remove a hard floor through negated or compound wording: %s",
  (message) => {
    const previous = updateIntent(
      "Necklaces between 1k and 2k",
      defaultIntent(),
    ).preferences;
    const result = updateIntent(message, previous);
    expect(result.preferences.budget).toEqual(previous.budget);
    if (message.startsWith("Clear minimum and"))
      expect(result.clarification).toBeDefined();
  },
);

it("clears only the floor through an explicit standalone command", () => {
  const previous = updateIntent(
    "Necklaces between 1k and 2k",
    defaultIntent(),
  ).preferences;
  const result = updateIntent("Clear minimum budget", previous);
  expect(result.clarification).toBeUndefined();
  expect(result.preferences.budget).toEqual({ amount: 2000, currency: "SGD" });
});
