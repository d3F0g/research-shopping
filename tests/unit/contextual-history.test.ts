import { describe, expect, it } from "vitest";
import { defaultIntent as version4Intent, TurnRequestSchema as Version4TurnRequestSchema } from "../../src/domain/research-intent-v4";
import { ApplicationTurnResponseSchema as Version4ResponseSchema } from "../../src/domain/research-evidence-v4";
import { HistoricalApplicationTurnResponseSchema } from "../../src/domain/research-history";
import { migrateVersion4Intent } from "../../src/domain/preferences";
import { ApplicationTurnResponseSchema } from "../../src/domain/research";

describe("frozen version four history", () => {
  it("preserves every old response kind and request without permitting current fields", () => {
    const preferences = { ...version4Intent(), productDescription: "powerbank", budget: { minimum: 30, amount: 40, currency: "SGD" as const } };
    const request = { phase: "prepare", preferences, message: "SGD", operationId: "00000000-0000-4000-8000-000000000001" };
    expect(Version4TurnRequestSchema.parse(request)).toEqual(request);
    for (const kind of [
      { kind: "message", message: "Hello" },
      { kind: "question", question: "budget", message: "Budget?" },
      { kind: "clarification", reason: "currency", message: "Currency?" },
      { kind: "research-unavailable", reason: "quota", message: "Paused" },
    ]) {
      const raw = { ...kind, responseVersion: 4, preferences, notes: [] };
      const saved = JSON.stringify(raw);
      expect(Version4ResponseSchema.parse(raw)).toEqual(raw);
      expect(HistoricalApplicationTurnResponseSchema.parse(raw)).toEqual(raw);
      expect(ApplicationTurnResponseSchema.safeParse(raw).success).toBe(false);
      expect(JSON.stringify(raw)).toBe(saved);
    }
    expect(Version4TurnRequestSchema.safeParse({ ...request, questionId: "question-1" }).success).toBe(false);
  });
  it("recovers a pending draft only from saved genuine original request text", () => {
    const previous = { ...version4Intent(), productDescription: "powerbank $30-40\nFollow-up: SGD", pendingChange: { message: "SGD", reason: "currency" as const, explanation: "State the amount" } };
    const saved = JSON.stringify(previous);
    expect(migrateVersion4Intent(previous).pendingChange).toMatchObject({ kind: "legacy" });
    const migrated = migrateVersion4Intent(previous, "powerbank $30-40");
    expect(migrated.pendingChange).toMatchObject({ kind: "money", missingSlot: "currency", draft: { minimum: 30, amount: 40, currency: null } });
    expect(JSON.stringify(previous)).toBe(saved);
    expect(previous.version).toBe(4);
  });
});
