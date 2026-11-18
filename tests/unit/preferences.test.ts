import { describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { defaultPreferences } from "../../src/domain/contracts";
import { updatePreferences } from "../../src/domain/preferences";
import { createShoppingEngine } from "../../src/domain/shopping";
import { createFixtureProviders } from "../../src/server/fixtures";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";

function existingPreferences() {
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { currency: "SGD", amount: 300 };
  preferences.hard.requiredFeatures = ["wireless"];
  preferences.hard.excludedBrands = ["Bose"];
  return preferences;
}

describe("budget currency clarification", () => {
  it.each(["ALL", "TRY", "TOP"])("recognizes %s only beside a budget amount", (currency) => {
    const previous = existingPreferences();
    for (const token of [`${currency}200`, `${currency} 200`, `200${currency}`, `200 ${currency}`, `${currency.toLowerCase()}200`, `200 ${currency.toLowerCase()}`]) {
      const message = `under ${token}`;
      const result = updatePreferences(message, previous);
      expect(result.clarification?.reason).toBe("currency");
      expect(result.preferences.hard).toEqual({ ...previous.hard, pendingConstraint: message });
      expect(result.notes).toEqual([]);
    }
    const ordinary = updatePreferences(`${currency.toLowerCase()} headphones`, previous);
    expect(ordinary.clarification?.reason).not.toBe("currency");
    expect(ordinary.preferences.hard.budget).toEqual(previous.hard.budget);
    for (const token of [`model${currency}200`, `${currency}200phone`, `model200${currency}`]) {
      const embedded = updatePreferences(token, previous);
      expect(embedded.clarification?.reason).toBe("constraint");
      expect(embedded.preferences.hard.budget).toEqual(previous.hard.budget);
    }
  });

  it("never assigns a regional default to a runtime unsupported currency amount", () => {
    for (const region of ["SG", "US"] as const) {
      const previous = existingPreferences();
      previous.hard.region = region;
      previous.hard.budget = { currency: region === "SG" ? "SGD" : "USD", amount: 300 };
      for (const currency of Intl.supportedValuesOf("currency").filter((code) => code !== "SGD" && code !== "USD")) {
        for (const token of [`${currency}200`, `${currency} 200`, `200${currency}`, `200 ${currency}`]) {
          const message = `under ${token}`;
          const result = updatePreferences(message, previous);
          expect(result.clarification?.reason, message).toBe("currency");
          expect(result.preferences.hard.budget, message).toEqual(previous.hard.budget);
          expect(result.preferences.hard.pendingConstraint, message).toBe(message);
        }
      }
    }
  });

  it("does not mistake all before a memory specification for a currency", () => {
    const result = updatePreferences("all 32 GB laptops under SGD2000", existingPreferences());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.hard.budget).toEqual({ currency: "SGD", amount: 2000 });
    expect(result.preferences.hard.requiredFeatures).toEqual(["high-memory"]);
  });

  it.each(["CHF", "HKD", "CNY", "₹", "₩"])(
    "does not infer a default currency from an amount with unsupported %s",
    (suffix) => {
      const previous = existingPreferences();
      const message = `under 200 ${suffix}`;
      const result = updatePreferences(message, previous);
      expect(result.clarification?.reason).toBe("currency");
      expect(result.preferences).toEqual({
        ...previous,
        hard: { ...previous.hard, pendingConstraint: message },
      });
      expect(result.notes).toEqual([]);
    },
  );

  it.each(["under 200", "under $200", "headphones under 200 for commuting", "under 200 with wireless"])(
    "retains regional default-currency behavior for %s",
    (message) => {
      const result = updatePreferences(message, existingPreferences());
      expect(result.clarification).toBeUndefined();
      expect(result.preferences.hard.budget).toEqual({ currency: "SGD", amount: 200 });
      expect(result.notes).toHaveLength(1);
    },
  );

  it.each(["under SGD200 and CHF200", "under USD200 and CHF", "under 200 unrecognized", "head200EUR", "EUR200phone", "v2eur"])(
    "keeps the previous budget when %s contains unexplained text",
    (message) => {
      const previous = existingPreferences();
      const result = updatePreferences(message, previous);
      expect(result.clarification).toBeDefined();
      expect(result.preferences.hard.budget).toEqual(previous.hard.budget);
      expect(result.preferences.hard.pendingConstraint).toBe(message);
      expect(result.notes).toEqual([]);
    },
  );

  it("keeps other recognized edits when a new unknown requirement blocks a budget change", () => {
    const previous = existingPreferences();
    const message = "exclude Sony under SGD200 and must be waterproof";
    const result = updatePreferences(message, previous);
    expect(result.clarification?.reason).toBe("constraint");
    expect(result.preferences.hard).toEqual({
      ...previous.hard,
      excludedBrands: ["Bose", "Sony"],
      pendingConstraint: message,
    });
  });

  it("keeps a budget separate from a recognized numeric laptop specification", () => {
    const result = updatePreferences("laptop under SGD2000 with 32 GB memory", existingPreferences());
    expect(result.clarification).toBeUndefined();
    expect(result.preferences.hard.budget).toEqual({ currency: "SGD", amount: 2000 });
    expect(result.preferences.hard.requiredFeatures).toEqual(["high-memory"]);
  });

  it("does not accept an unexplained model name as part of a budget request", () => {
    const previous = existingPreferences();
    const result = updatePreferences("headphones under SGD200 Sony WH-1000XM5", previous);
    expect(result.clarification?.reason).toBe("constraint");
    expect(result.preferences.hard.budget).toEqual(previous.hard.budget);
  });

  it("does not apply a proposed budget with a conflicting standalone currency", () => {
    const previous = existingPreferences();
    const result = updatePreferences("under USD200 SGD", previous);
    expect(result.clarification?.reason).toBe("currency");
    expect(result.preferences.hard.budget).toEqual(previous.hard.budget);
  });

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

  it.each([
    "under 200 CHF", "under 200 HKD", "under 200 CNY", "under 200 ₹", "under 200 ₩",
    "under ALL200", "under ALL 200", "under 200ALL", "under 200 ALL",
    "under TRY200", "under TRY 200", "under 200TRY", "under 200 TRY",
    "under TOP200", "under TOP 200", "under 200TOP", "under 200 TOP",
  ])(
    "preserves the HTTP budget and blocks research for %s",
    async (message) => {
      const research = vi.fn(async () => ({ status: "unavailable", reason: "empty" }) as const);
      const reserve = vi.fn(async () => "admitted" as const);
      const app = createApp({ researchTurns: createResearchTurns({ research, quota: { reserve, settle: vi.fn() } }) });
      const previous = existingPreferences();
      const response = await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, preferences: previous, operationId: randomUUID() }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toMatchObject({
        kind: "clarification",
        reason: "currency",
        preferences: { ...previous, hard: { ...previous.hard, pendingConstraint: message } },
        notes: [],
        toolActivity: [],
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(research).not.toHaveBeenCalled();
      const followup = await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "under SGD200", preferences: body.preferences, operationId: randomUUID() }),
      });
      expect(await followup.json()).toMatchObject({
        kind: "clarification",
        reason: "constraint",
        preferences: { hard: { budget: { currency: "SGD", amount: 200 }, pendingConstraint: message } },
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(research).not.toHaveBeenCalled();
      await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "under SGD200", preferences: previous, operationId: randomUUID() }),
      });
      expect(reserve).toHaveBeenCalledOnce();
      expect(research).toHaveBeenCalledOnce();
    },
  );
});
