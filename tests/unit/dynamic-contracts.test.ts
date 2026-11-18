import { describe, expect, it } from "vitest";
import {
  defaultIntent,
  ShoppingIntentSchema,
  TurnRequestSchema,
} from "../../src/domain/contracts";
import capture from "../fixtures/research-corpus/page-evidence/normalized-historical-application-response.json";
import { createShoppingEngine } from "../../src/domain/shopping";
import { createFixtureProviders } from "../../src/server/fixtures";
import { defaultPreferences } from "../../src/domain/legacy-contracts";
import {
  HistoricalApplicationTurnResponseSchema,
  LegacySavedTurnSchema,
} from "../../src/domain/research-history";

describe("independent current and historical contracts", () => {
  it("accepts open product wording and a bounded atomic edit", () => {
    const preferences = {
      ...defaultIntent(),
      productDescription: "A quiet H13 purifier for a 30 square metre room",
    };
    expect(
      ShoppingIntentSchema.safeParse({
        ...preferences,
        criteria: [
          {
            id: "criterion-99999999999999999",
            wording: "Too large",
            strength: "hard",
            origin: { kind: "edit", text: "Too large" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      ShoppingIntentSchema.parse(preferences).productDescription,
    ).toContain("H13");
    expect(
      TurnRequestSchema.safeParse({
        phase: "prepare",
        message: "Update preferences",
        operationId: "00000000-0000-4000-8000-000000000001",
        preferences,
        edit: {
          kind: "batch",
          edits: [
            { kind: "set-budget", value: { amount: 300, currency: "SGD" } },
            {
              kind: "add-criterion",
              wording: "washable prefilter",
              strength: "hard",
            },
          ],
        },
      }).success,
    ).toBe(true);
  });
  it("reads every historical response kind without changing its preference or evidence version", async () => {
    const preferences = defaultPreferences();
    const engine = createShoppingEngine(createFixtureProviders());
    const recommendation = await engine.turn(
      "Headphones under SGD300",
      preferences,
    );
    expect(recommendation.kind).toBe("recommendations");
    const historical = [
      {
        kind: "message",
        message: "Hello",
        preferences,
        notes: [],
        toolActivity: [],
      },
      {
        kind: "clarification",
        reason: "category",
        message: "Which category?",
        preferences,
        notes: [],
        toolActivity: [],
      },
      { ...recommendation, toolActivity: [] },
      {
        kind: "no-match",
        message: "No fixture fits",
        preferences,
        notes: [],
        toolActivity: [],
      },
      {
        kind: "error",
        code: "provider-failed",
        message: "Fixture failed",
        retryable: false,
        preferences: null,
        notes: [],
        toolActivity: [],
      },
      capture,
      {
        ...capture,
        research: { ...capture.research, evidenceVersion: 2, products: [] },
      },
    ];
    for (const response of historical)
      expect(HistoricalApplicationTurnResponseSchema.parse(response)).toEqual(
        response,
      );
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse({
        ...capture,
        research: { ...capture.research, evidenceVersion: 99 },
      }).success,
    ).toBe(false);
  });
  it("freezes legacy requests and every saved body independently of the current intent", () => {
    const preferences = defaultPreferences();
    const value = {
      kind: "message",
      message: "Hello",
      preferences,
      notes: [],
      toolActivity: [],
    };
    expect(HistoricalApplicationTurnResponseSchema.parse(value)).toEqual(value);
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse({
        ...value,
        responseVersion: 99,
      }).success,
    ).toBe(false);
    expect(ShoppingIntentSchema.safeParse(preferences).success).toBe(false);
    for (const body of [
      { status: "pending" },
      { status: "question", question: "budget", preferences },
      { status: "complete", value },
      { status: "interrupted", reason: "cancelled" },
    ]) {
      const turn = {
        id: "00000000-0000-4000-8000-000000000001",
        operationId: "00000000-0000-4000-8000-000000000002",
        digest: "a".repeat(64),
        createdAt: "2026-01-01T00:00:00.000Z",
        message: "hello",
        request: { message: "hello", preferences },
        body,
      };
      expect(LegacySavedTurnSchema.parse(turn)).toEqual(turn);
    }
  });
});
