import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { defaultPreferences } from "../../src/domain/legacy-contracts";
import {
  editIntent,
  migrateLegacyPreferences,
  updateIntent,
} from "../../src/domain/preferences";

describe("one current intent reducer", () => {
  it.each([
    "A ceramic fermentation crock with a water-seal lid",
    "A quiet H13 air purifier for a nursery",
    "A photogrammetry turntable with repeatable indexed motion",
    "A 193 nm lithography test reticle",
  ])(
    "retains complete open description %s without a vocabulary gate",
    (description) => {
      const result = updateIntent(description, defaultIntent());
      expect(result.clarification).toBeUndefined();
      expect(result.preferences.productDescription).toBe(description);
    },
  );
  it("extracts strong freeform criteria and origins while keeping the complete request", () => {
    const text =
      "A purifier under SGD400. Must have a washable prefilter. Prefer quiet operation. Exclude Sony.";
    const result = updateIntent(text, defaultIntent());
    expect(result.preferences).toMatchObject({
      productDescription: text,
      budget: { amount: 400, currency: "SGD" },
      budgetClarified: true,
      criteria: [
        {
          wording: "a washable prefilter",
          strength: "hard",
          origin: { kind: "message", text },
        },
        { wording: "quiet operation", strength: "flexible" },
        { wording: "Exclude Sony", strength: "hard" },
      ],
    });
  });
  it("keeps hard criteria and historical snapshots across budget and detail updates", () => {
    const first = updateIntent(
      "A travel kettle under SGD200. Must have no plastic in contact with water.",
      defaultIntent(),
    ).preferences;
    const snapshot = structuredClone(first);
    const second = updateIntent("Raise budget to SGD300", first).preferences;
    expect(second.budget?.amount).toBe(300);
    expect(second.criteria).toEqual(first.criteria);
    expect(first).toEqual(snapshot);
    const concise = updateIntent("Shorter", second);
    expect(concise.reply).toBeTypeOf("string");
    expect(concise.preferences.criteria).toEqual(first.criteria);
  });
  it("applies an atomic batch and only removes an identified criterion", () => {
    const previous = updateIntent(
      "A purifier under SGD300. Must have washable prefilter. Must have H13 filtration.",
      defaultIntent(),
    ).preferences;
    const criterion = previous.criteria[0]!;
    const result = editIntent(
      previous,
      {
        kind: "batch",
        edits: [
          { kind: "set-budget", value: { amount: 350, currency: "SGD" } },
          {
            kind: "replace-criterion",
            id: criterion.id,
            wording: "replaceable prefilter",
            strength: "hard",
          },
          { kind: "remove-criterion", id: previous.criteria[1]!.id },
        ],
      },
      "Update my preferences",
    );
    expect(result.preferences.criteria).toMatchObject([
      { id: criterion.id, wording: "replaceable prefilter", strength: "hard" },
    ]);
    expect(result.preferences.budget?.amount).toBe(350);
    const ambiguous = updateIntent(
      "Remove that requirement",
      result.preferences,
    );
    expect(ambiguous.clarification?.reason).toBe("constraint");
    expect(ambiguous.preferences.budget).toEqual(result.preferences.budget);
    expect(ambiguous.preferences.criteria).toEqual(result.preferences.criteria);
    expect(ambiguous.preferences.pendingChange?.message).toBe(
      "Remove that requirement",
    );
    expect(
      updateIntent("Remove replaceable prefilter", result.preferences)
        .preferences.criteria,
    ).toEqual([]);
  });
  it.each([
    "under EUR100",
    "under $100",
    "under SGD0",
    "under SGD100.001",
    "under SGD1000001",
    "under SGD100 or SGD200",
  ])(
    "clarifies invalid or ambiguous budget %s without mutating previous intent",
    (text) => {
      const previous = defaultIntent();
      const result = updateIntent(`A coffee scale ${text}`, previous);
      expect(result.clarification).toBeDefined();
      expect(result.preferences.budget).toEqual(previous.budget);
      expect(result.preferences.criteria).toEqual(previous.criteria);
      expect(result.preferences.pendingChange).not.toBeNull();
    },
  );
  it.each([
    ["Air purifier under 40 dB, budget SGD300", 300],
    ["Shelf under30cm, budget SGD200", 200],
    ["All 32 GB laptops under SGD1500", 1500],
    ["Travel bottle under 200 grams, budget USD40", 40],
  ] as const)(
    "keeps explicit measurements separate from money in %s",
    (message, amount) => {
      const result = updateIntent(message, defaultIntent());
      expect(result.clarification).toBeUndefined();
      expect(result.preferences.budget?.amount).toBe(amount);
      expect(result.preferences.productDescription).toBe(message);
    },
  );
  it.each([
    "under CHF200",
    "under 200 CHF",
    "under ₹200",
    "under 200 euros",
    "under SGD2e3",
    "under SGD200m",
    "under SGD100.001",
  ])("does not reuse a prior currency for %s", (budgetText) => {
    const previous = updateIntent(
      "A projector under SGD300",
      defaultIntent(),
    ).preferences;
    const result = updateIntent(`A projector ${budgetText}`, previous);
    expect(result.clarification).toBeDefined();
    expect(result.preferences.budget).toEqual(previous.budget);
    expect(result.preferences.criteria).toEqual(previous.criteria);
    expect(result.preferences.pendingChange).not.toBeNull();
  });
  it.each(["under USD200", "under 200 USD", "under US$200"])(
    "accepts supported currency binding in %s",
    (budgetText) => {
      const result = updateIntent(`A projector ${budgetText}`, defaultIntent());
      expect(result.preferences.budget).toEqual({
        amount: 200,
        currency: "USD",
      });
      expect(result.clarification).toBeUndefined();
    },
  );
  it("never reuses a removed criterion ID after allocating a batch", () => {
    const added = editIntent(
      defaultIntent(),
      {
        kind: "batch",
        edits: Array.from({ length: 12 }, (_, i) => ({
          kind: "add-criterion" as const,
          wording: `Requirement ${i}`,
          strength: "hard" as const,
        })),
      },
      "Add requirements",
    ).preferences;
    const removedId = added.criteria.at(-1)!.id;
    const removed = editIntent(
      added,
      { kind: "remove-criterion", id: removedId },
      "Remove requirement",
    ).preferences;
    const replaced = editIntent(
      removed,
      { kind: "add-criterion", wording: "New meaning", strength: "hard" },
      "Add new requirement",
    ).preferences;
    expect(replaced.criteria.at(-1)!.id).not.toBe(removedId);
    expect(replaced.revision).toBeGreaterThan(added.revision);
  });
  it("refuses overflow without dropping hard requirements", () => {
    const previous = defaultIntent();
    for (let i = 0; i < 12; i++)
      previous.criteria.push({
        id: `criterion-${i + 1}`,
        wording: `Requirement ${i}`,
        strength: "hard",
        origin: { kind: "edit", text: `Requirement ${i}` },
      });
    const result = updateIntent("Must have one more safety property", previous);
    expect(result.clarification).toBeDefined();
    expect(result.preferences.budget).toEqual(previous.budget);
    expect(result.preferences.criteria).toEqual(previous.criteria);
    expect(result.preferences.pendingChange).not.toBeNull();
  });
  it("retains oversized legacy preferences for review rather than dropping requirements", () => {
    const previous = defaultPreferences();
    previous.hard.excludedBrands = Array.from(
      { length: 20 },
      (_, i) => `Brand ${i}`,
    );
    const result = migrateLegacyPreferences(previous);
    expect(result).toMatchObject({
      status: "needs-review",
      preferences: previous,
    });
  });
  it("migrates active legacy preferences without changing the saved object", () => {
    const previous = defaultPreferences();
    previous.hard.category = "headphones";
    previous.hard.excludedBrands = ["Sony"];
    previous.hard.requiredFeatures = ["wireless"];
    const snapshot = structuredClone(previous);
    const next = migrateLegacyPreferences(previous);
    expect(next.status).toBe("ready");
    if (next.status === "ready")
      expect(
        next.intent.criteria.map((criterion) => criterion.wording),
      ).toEqual(["wireless", "Exclude Sony", "value"]);
    expect(previous).toEqual(snapshot);
  });
});
