import { describe, expect, it } from "vitest";
import { updateIntent } from "../../src/domain/preferences";
import { syntheticIntent } from "../fixtures/dynamic-research";
import type { Budget, ShoppingIntent } from "../../src/domain/contracts";

describe("local app help", () => {
  it.each([
    "How does this work?",
    "How does it work?",
    "How do I use Fieldnote?",
    "What can you do?",
    "Can you place an order?",
    "Does this cost money?",
    "How much does a search cost?",
  ])(
    "answers %s without changing accepted or pending preferences",
    (message) => {
      const accepted = syntheticIntent();
      const pending = updateIntent("under CHF200", accepted).preferences;
      for (const previous of [accepted, pending]) {
        const result = updateIntent(message, previous);
        expect(result.reply).toBeTruthy();
        expect(result.clarification).toBeUndefined();
        expect(result.preferences).toEqual(previous);
      }
    },
  );

  it.each([
    "What is my budget?",
    "What's my current budget range?",
    "What is my accepted price range?",
    "What is my maximum budget?",
    "What budget did I set?",
    "What price range have I set?",
    "Remind me of my budget",
  ])("answers %s only from accepted state", (message) => {
    const states: { budget: Budget | null; reply: string }[] = [
      {
        budget: { amount: 2000, minimum: 1000, currency: "SGD" },
        reply: "Your accepted budget is SGD 1,000 to SGD 2,000.",
      },
      {
        budget: { amount: 249.95, currency: "USD" },
        reply: "Your accepted budget is up to USD 249.95.",
      },
      { budget: null, reply: "You do not have an accepted budget limit." },
    ];
    for (const state of states) {
      const accepted: ShoppingIntent = {
        ...syntheticIntent(),
        budget: state.budget,
      };
      const pending = updateIntent("under CHF200", accepted).preferences;
      for (const previous of [accepted, pending]) {
        const result = updateIntent(message, previous);
        expect(result.reply).toBe(
          `${state.reply}${previous.pendingChange ? " Your pending change has not been applied." : ""}`,
        );
        expect(result.preferences).toEqual(previous);
        expect(result.clarification).toBeUndefined();
      }
    }
  });

  it.each([
    "How much does a fermentation crock cost?",
    "Can you find a quiet air purifier?",
    "What can a reversible ceramic fermentation crock do?",
    "How does this air purifier work?",
    "What is the budget for a reversible ceramic fermentation crock?",
  ])("preserves shopping questions as research intent for %s", (message) => {
    const result = updateIntent(message, syntheticIntent());
    expect(result.reply).toBeUndefined();
    expect(result.preferences.productDescription).toContain(message);
  });
});
