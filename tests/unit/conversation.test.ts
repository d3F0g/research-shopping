import { describe, expect, it } from "vitest";
import {
  defaultPreferences,
  type ProviderEvent,
} from "../../src/domain/contracts";
import { createShoppingEngine } from "../../src/domain/shopping";
import { createFixtureProviders } from "../../src/server/fixtures";

describe("bounded conversational replies", () => {
  it.each(["hi", "Hello!", "thanks", "thank you", "yes", "okay", "why?"])(
    "answers %s without provider activity or changing constraints",
    async (message) => {
      const events: ProviderEvent[] = [];
      const engine = createShoppingEngine(createFixtureProviders(), {
        onProviderEvent: (event) => events.push(event),
      });
      const preferences = defaultPreferences();
      preferences.hard.category = "headphones";
      preferences.hard.budget = { currency: "SGD", amount: 200 };
      preferences.hard.pendingConstraint = "must be waterproof";
      const result = await engine.turn(message, preferences);
      expect(result.kind).toBe("message");
      expect(result.preferences).toEqual(preferences);
      expect(events).toEqual([]);
      const followup = await engine.turn("under SGD500", result.preferences!);
      expect(followup.kind).toBe("clarification");
      expect(followup.preferences?.hard.pendingConstraint).toBe(
        "must be waterproof",
      );
    },
  );

  it.each([
    "what about laptops?",
    "How about a laptop?",
    "can you show me headphones",
  ])("understands the category in %s", async (message) => {
    const engine = createShoppingEngine(createFixtureProviders());
    const result = await engine.turn(message, defaultPreferences());
    expect(result.kind).toBe("recommendations");
    expect(result.preferences?.hard.pendingConstraint).toBeNull();
  });

  it.each([
    "hi, headphones must be waterproof",
    "yes waterproof",
    "what about waterproof laptops",
    "thanks, under EUR200",
  ])("does not discard a constraint inside %s", async (message) => {
    const engine = createShoppingEngine(createFixtureProviders());
    const result = await engine.turn(message, defaultPreferences());
    expect(result.kind).toBe("clarification");
    expect(result.preferences?.hard.pendingConstraint).toBeTruthy();
  });
});
