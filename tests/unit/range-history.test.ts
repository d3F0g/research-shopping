import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HistoricalResults } from "../../src/client/HistoricalResults";
import {
  defaultIntent,
  ShoppingIntentSchema,
} from "../../src/domain/contracts";
import {
  defaultIntent as version3Intent,
  PrepareTurnRequestSchema as Version3PrepareRequestSchema,
} from "../../src/domain/research-intent-v3";
import { HistoricalApplicationTurnResponseSchema } from "../../src/domain/research-history";
import { migrateVersion3Intent } from "../../src/domain/preferences";
import { syntheticComparison } from "../e2e/support/dynamic-fixture";

describe("frozen version 3 before range semantics", () => {
  it("keeps old requests and all completed response kinds unchanged", () => {
    const preferences = {
      ...version3Intent(),
      productDescription: "Art prints",
      budget: { amount: 2000, currency: "SGD" as const },
      budgetClarified: true,
    };
    const request = {
      phase: "prepare",
      message: "Art prints",
      preferences,
      operationId: "00000000-0000-4000-8000-000000000001",
    };
    expect(Version3PrepareRequestSchema.parse(request)).toEqual(request);
    for (const value of [
      { kind: "message", message: "Hello" },
      { kind: "question", question: "budget", message: "Budget?" },
      { kind: "clarification", reason: "budget", message: "Clarify budget" },
      {
        kind: "research-unavailable",
        reason: "quota",
        message: "Research unavailable",
      },
    ]) {
      const raw = { responseVersion: 3, ...value, preferences, notes: [] };
      const before = JSON.stringify(raw);
      expect(HistoricalApplicationTurnResponseSchema.parse(raw)).toEqual(raw);
      expect(JSON.stringify(raw)).toBe(before);
    }
    expect(ShoppingIntentSchema.safeParse(preferences).success).toBe(false);
    expect(migrateVersion3Intent(preferences)).toEqual({
      ...preferences,
      version: 5,
    });
    expect(preferences.version).toBe(3);
    expect(defaultIntent().version).toBe(5);
  });

  it("renders old research read-only and refuses to reinterpret a v3 range", () => {
    const comparison = syntheticComparison();
    const intent = { ...comparison.intent, version: 3 };
    const raw = {
      responseVersion: 3,
      kind: "research",
      preferences: intent,
      notes: [],
      answer: comparison.summary,
      research: { ...comparison, evidenceVersion: 3, intent },
    };
    const before = JSON.stringify(raw);
    const outcome = HistoricalApplicationTurnResponseSchema.parse(raw);
    expect(outcome).toEqual(raw);
    const html = renderToStaticMarkup(
      createElement(HistoricalResults, { outcome }),
    );
    expect(html).toContain("Synthetic Aster Scan");
    expect(html).not.toContain("Edit preferences");
    expect(html).not.toContain("Compare options");
    expect(JSON.stringify(raw)).toBe(before);
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse({
        ...raw,
        preferences: { ...intent, budget: { ...intent.budget!, minimum: 100 } },
      }).success,
    ).toBe(false);
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse({
        ...raw,
        responseVersion: 99,
      }).success,
    ).toBe(false);
  });
});
