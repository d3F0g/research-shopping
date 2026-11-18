import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";
import {
  conversationalRanges,
  negatedConversationalRanges,
  phoneBudgetRequest,
} from "../fixtures/conversational-budget";

describe("financial wording around currencyless ranges", () => {
  it.each(conversationalRanges)("extracts both bounds from %s", (message) => {
    const result = updateIntent(message, defaultIntent());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences).toMatchObject({
      productDescription: message,
      budget: { minimum: 500, amount: 600, currency: "SGD" },
      budgetClarified: true,
    });
    expect(result.notes.join(" ")).toContain("uses SGD");
  });

  it("discloses the selected market currency without rewriting the request", () => {
    const previous = { ...defaultIntent(), region: "US" as const };
    const result = updateIntent(phoneBudgetRequest, previous);
    expect(result.preferences.productDescription).toBe(phoneBudgetRequest);
    expect(result.preferences.budget).toEqual({
      minimum: 500,
      amount: 600,
      currency: "USD",
    });
    expect(result.notes.join(" ")).toContain("uses USD");
  });

  it.each(negatedConversationalRanges)(
    "retains the prior hard range and clarifies %s",
    (message) => {
      const previous = updateIntent(
        "Must be repairable",
        updateIntent("A phone between SGD300 and SGD400", defaultIntent())
          .preferences,
      ).preferences;
      const result = updateIntent(message, previous);
      expect(result.preferences.budget).toEqual(previous.budget);
      expect(result.preferences.criteria).toEqual(previous.criteria);
      expect(result.preferences.pendingChange?.message).toBe(message);
      expect(result.clarification?.reason).toBe("budget");
    },
  );

  it("keeps a positive financial range separate from a negated product clause", () => {
    const result = updateIntent(
      "Do not include a glass back; I can spend 500-600 on a phone",
      defaultIntent(),
    );
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.budget).toEqual({
      minimum: 500,
      amount: 600,
      currency: "SGD",
    });
  });

  it.each([
    "A radio costing around 500-600 Hz",
    "I can spend 500-600 hours researching",
    "A device with model numbers 500-600",
    "A phone around 500-600",
    "A price comparison for model 500-600",
  ])("does not invent money from %s", (message) => {
    const result = updateIntent(message, defaultIntent());
    expect(result.preferences.budget).toBeNull();
    expect(result.preferences.productDescription).toBe(message);
  });

  it.each([
    "A phone costs around 600-500",
    "A phone costs 500-600 or has a price of 700-800",
  ])("clarifies an unresolved financial interval in %s", (message) => {
    const result = updateIntent(message, defaultIntent());
    expect(result.preferences.budget).toBeNull();
    expect(result.clarification?.reason).toBe("budget");
    expect(result.preferences.pendingChange?.message).toBe(message);
  });
});
