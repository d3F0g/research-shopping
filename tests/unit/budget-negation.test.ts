import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";
import {
  ambiguousBudgetCommands,
  independentBudgetClauses,
  negatedBudgetCommands,
  originalBudgetRequest,
  positiveMonetaryClauses,
} from "../fixtures/budget-negation";

const priorIntent = () =>
  updateIntent(originalBudgetRequest, defaultIntent()).preferences;

describe("negated hard budget changes", () => {
  it.each(negatedBudgetCommands)(
    "acknowledges without changing %s",
    (message) => {
      const previous = priorIntent();
      const result = updateIntent(message, previous);
      expect(result.preferences).toEqual(previous);
      expect(result.reply).toMatch(/budget.*(?:unchanged|not changed)/i);
      expect(result.clarification).toBeUndefined();
    },
  );

  it.each(ambiguousBudgetCommands)("retains an unresolved %s", (message) => {
    const previous = priorIntent();
    const result = updateIntent(message, previous);
    expect(result.preferences.budget).toEqual(previous.budget);
    expect(result.clarification?.reason).toBe("budget");
    expect(result.preferences.pendingChange?.message).toBe(message);
    expect(result.preferences.productDescription).toContain(
      originalBudgetRequest,
    );
    expect(result.preferences.productDescription).toBe(previous.productDescription);
  });

  it("preserves existing pending changes and criteria through no-change commands", () => {
    const previous = updateIntent(
      "Under CHF500. Must be nickel-free. Prefer handmade.",
      priorIntent(),
    ).preferences;
    const result = updateIntent("Don't change my budget to SGD3000", previous);
    expect(result.preferences).toEqual(previous);
    const thanks = updateIntent("Thanks", result.preferences);
    expect(thanks.preferences).toEqual(previous);
    expect(
      updateIntent("Compare options", thanks.preferences).clarification,
    ).toEqual({
      reason: previous.pendingChange!.reason,
      message: previous.pendingChange!.explanation,
    });
  });

  it("keeps unrelated criteria and new hard criteria in compound commands", () => {
    const previous = updateIntent("Prefer handmade", priorIntent()).preferences;
    const message =
      "Do not increase my budget to SGD3000. Must be nickel-free.";
    const result = updateIntent(message, previous);
    expect(result.preferences.criteria).toEqual([
      ...previous.criteria,
      expect.objectContaining({ wording: "nickel-free", strength: "hard" }),
    ]);
    const ordinary = updateIntent("Thanks", result.preferences);
    expect(ordinary.preferences.pendingChange).toEqual(
      result.preferences.pendingChange,
    );
    const refreshed = updateIntent("Compare options", ordinary.preferences);
    expect(refreshed.clarification?.reason).toBe("budget");
    const corrected = updateIntent(
      "Set my maximum budget to SGD1500",
      refreshed.preferences,
    );
    expect(corrected.clarification).toBeUndefined();
    expect(corrected.preferences.pendingChange).toBeNull();
    expect(corrected.preferences.budget).toEqual({
      minimum: 1000,
      amount: 1500,
      currency: "SGD",
    });
    expect(corrected.preferences.criteria).toEqual(result.preferences.criteria);
  });

  it.each([
    ["Increase my budget to SGD3000", 1000, 3000],
    ["Change my budget to SGD3000", 1000, 3000],
    ["Raise my maximum budget to SGD3000", 1000, 3000],
    ["Set my maximum to SGD3000", 1000, 3000],
    ["Update my budget range to between SGD500 and SGD3000", 500, 3000],
    ["No more than SGD1500", 1000, 1500],
    [
      "A neutron interferometer under SGD1500. Must not contain nickel.",
      1000,
      1500,
    ],
    ["Do not include nickel; budget SGD1500", 1000, 1500],
  ])(
    "keeps positive and non-money negation usable in %s",
    (message, minimum, amount) => {
      const result = updateIntent(message as string, priorIntent());
      expect(result.clarification).toBeUndefined();
      expect(result.reply).toBeUndefined();
      expect(result.preferences.budget).toEqual({
        minimum,
        amount,
        currency: "SGD",
      });
    },
  );

  it.each([
    ...independentBudgetClauses,
    ...positiveMonetaryClauses,
    "Increase my spending to SGD3000",
    "Change the amount to SGD3000",
    "Raise my discretionary allocation to SGD3000",
  ])(
    "keeps positive money separate from non-money negation in %s",
    (message) => {
      const result = updateIntent(message, priorIntent());
      expect(result.clarification).toBeUndefined();
      expect(result.reply).toBeUndefined();
      expect(result.preferences.budget).toEqual({
        minimum: 1000,
        amount: 3000,
        currency: "SGD",
      });
    },
  );
});
