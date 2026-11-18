import { describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../src/domain/contracts";
import { updatePreferences } from "../../src/domain/preferences";
import { createShoppingEngine } from "../../src/domain/shopping";
import { createFixtureProviders } from "../../src/server/fixtures";

function existingPreferences() {
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { currency: "SGD", amount: 300 };
  preferences.hard.requiredFeatures = ["wireless"];
  preferences.hard.excludedBrands = ["Bose"];
  return preferences;
}

describe("budget currency clarification", () => {
  it.each(["EUR200", "EUR 200", "200EUR", "200 EUR", "GBP200", "AUD200", "CAD200", "JPY200", "MYR200", "INR200", "€200", "£200", "¥200"])(
    "identifies unsupported %s without replacing accepted preferences",
    (budget) => {
      const previous = existingPreferences();
      const original = structuredClone(previous);
      const message = `under ${budget}`;
      const result = updatePreferences(message, previous);
      expect(result.clarification?.reason).toBe("currency");
      expect(result.preferences).toEqual({
        ...original,
        hard: { ...original.hard, pendingConstraint: message },
      });
      expect(previous).toEqual(original);
    },
  );

  it.each(["SGD", "USD"] as const)("accepts a compact or spaced %s budget", (currency) => {
    const previous = existingPreferences();
    for (const budget of [`${currency}200`, `${currency} 200`, `200${currency}`, `200 ${currency}`]) {
      const result = updatePreferences(`under ${budget}`, previous);
      expect(result.clarification).toBeUndefined();
      expect(result.preferences).toEqual({
        ...previous,
        hard: { ...previous.hard, budget: { currency, amount: 200 } },
      });
    }
  });

  it.each(["European", "poundsaver", "myriad", "headEUR200", "200EURphone"])(
    "does not mistake %s for an unsupported currency token",
    (message) => {
      expect(updatePreferences(message, existingPreferences()).clarification?.reason).toBe("constraint");
    },
  );

  it("keeps an existing pending constraint when reporting unsupported currency", () => {
    const previous = existingPreferences();
    previous.hard.pendingConstraint = "must be waterproof";
    const result = updatePreferences("under EUR200", previous);
    expect(result.clarification?.reason).toBe("currency");
    expect(result.preferences).toEqual(previous);
  });

  it("keeps an existing pending constraint when accepting a supported budget", () => {
    const previous = existingPreferences();
    previous.hard.pendingConstraint = "must be waterproof";
    const result = updatePreferences("under SGD200", previous);
    expect(result.clarification?.reason).toBe("constraint");
    expect(result.preferences).toEqual({
      ...previous,
      hard: { ...previous.hard, budget: { currency: "SGD", amount: 200 } },
    });
  });

  it("still reports unsupported noncurrency requirements as constraints", () => {
    const previous = existingPreferences();
    const message = "headphones delivered tomorrow";
    const result = updatePreferences(message, previous);
    expect(result.clarification?.reason).toBe("constraint");
    expect(result.preferences).toEqual({
      ...previous,
      hard: { ...previous.hard, pendingConstraint: message },
    });
  });

  it("preserves an earlier category clarification before a currency failure", () => {
    const result = updatePreferences("headphones and laptops under EUR200", existingPreferences());
    expect(result.clarification?.reason).toBe("category");
    expect(result.preferences.hard.pendingConstraint).toBe("headphones and laptops under EUR200");
  });

  it.each(["under EUR200", "under 200EUR", "under 200 EUR", "under SGD200 and EUR200"])(
    "returns preserved public preferences and blocks provider dispatch for %s",
    async (message) => {
      const fixtures = createFixtureProviders();
      const discover = vi.fn(fixtures.discovery.discover);
      const engine = createShoppingEngine({ ...fixtures, discovery: { ...fixtures.discovery, discover } });
      const previous = existingPreferences();
      const result = await engine.turn(message, previous);
      expect(result).toMatchObject({
        kind: "clarification",
        reason: "currency",
        preferences: { ...previous, hard: { ...previous.hard, pendingConstraint: message } },
      });
      expect(discover).not.toHaveBeenCalled();
      const followup = await engine.turn("under SGD200", result.preferences!);
      expect(followup).toMatchObject({ kind: "clarification", reason: "constraint" });
      expect(followup.preferences?.hard.pendingConstraint).toBe(message);
      expect(discover).not.toHaveBeenCalled();
      await engine.turn("under SGD200", previous);
      expect(discover).toHaveBeenCalledOnce();
    },
  );
});
