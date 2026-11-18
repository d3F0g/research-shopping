import { describe, expect, it } from "vitest";
import { defaultIntent, ShoppingIntentSchema, TurnRequestSchema } from "../../src/domain/contracts";
import { defaultPreferences } from "../../src/domain/legacy-contracts";
import { HistoricalApplicationTurnResponseSchema, LegacySavedTurnSchema } from "../../src/domain/research-history";

describe("independent current and historical contracts", () => {
  it("accepts open product wording and a bounded atomic edit", () => {
    const preferences = { ...defaultIntent(), productDescription: "A quiet H13 purifier for a 30 square metre room" };
    expect(ShoppingIntentSchema.parse(preferences).productDescription).toContain("H13");
    expect(TurnRequestSchema.safeParse({ message: "Update preferences", operationId: "00000000-0000-4000-8000-000000000001", preferences, edit: { kind: "batch", edits: [{ kind: "set-budget", value: { amount: 300, currency: "SGD" } }, { kind: "add-criterion", wording: "washable prefilter", strength: "hard" }] } }).success).toBe(true);
  });
  it("freezes legacy requests and every saved body independently of the current intent", () => {
    const preferences = defaultPreferences();
    const value = { kind: "message", message: "Hello", preferences, notes: [], toolActivity: [] };
    expect(HistoricalApplicationTurnResponseSchema.parse(value)).toEqual(value);
    expect(HistoricalApplicationTurnResponseSchema.safeParse({ ...value, responseVersion: 99 }).success).toBe(false);
    expect(ShoppingIntentSchema.safeParse(preferences).success).toBe(false);
    for (const body of [{ status: "pending" }, { status: "question", question: "budget", preferences }, { status: "complete", value }, { status: "interrupted", reason: "cancelled" }]) {
      const turn = { id: "00000000-0000-4000-8000-000000000001", operationId: "00000000-0000-4000-8000-000000000002", digest: "a".repeat(64), createdAt: "2026-01-01T00:00:00.000Z", message: "hello", request: { message: "hello", preferences }, body };
      expect(LegacySavedTurnSchema.parse(turn)).toEqual(turn);
    }
  });
});
