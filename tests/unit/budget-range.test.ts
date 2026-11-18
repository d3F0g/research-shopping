import { describe, expect, it } from "vitest";
import { BudgetSchema, defaultIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";

describe("dynamic budget ranges", () => {
  it("keeps the exact necklace request and both thousand-denominated bounds", () => {
    const result = updateIntent("Necklaces between 1k to 2k", defaultIntent());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.productDescription).toBe("Necklaces between 1k to 2k");
    expect(result.preferences.budget).toEqual({ minimum: 1000, amount: 2000, currency: "SGD" });
    expect(result.preferences.budgetClarified).toBe(true);
    expect(result.notes.join(" ")).toContain("SGD");
  });

  it("validates the numeric interval at the request boundary", () => {
    expect(BudgetSchema.safeParse({ minimum: 1000, amount: 2000, currency: "SGD" }).success).toBe(true);
    expect(BudgetSchema.safeParse({ minimum: 2000, amount: 1000, currency: "SGD" }).success).toBe(false);
  });
});
