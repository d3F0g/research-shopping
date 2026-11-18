import { describe, expect, it } from "vitest";
import { updateIntent } from "../../src/domain/preferences";
import { syntheticIntent } from "../fixtures/dynamic-research";

describe("local app help", () => {
  it.each([
    "How does this work?",
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
    "How much does a fermentation crock cost?",
    "Can you find a quiet air purifier?",
    "What can a reversible ceramic fermentation crock do?",
  ])("preserves shopping questions as research intent for %s", (message) => {
    const result = updateIntent(message, syntheticIntent());
    expect(result.reply).toBeUndefined();
    expect(result.preferences.productDescription).toContain(message);
  });
});
