import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import type { IntentInterpreter } from "../../src/domain/intent-actions";
import { TurnTransportResponseSchema } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import { postTurn } from "../helpers/turns";

describe("simple shopping without model interpretation", () => {
  it.each(["absent", "unavailable"] as const)(
    "retains the exact powerbank range and researches after SGD when the interpreter is %s",
    async (availability) => {
      const interpretIntent = vi.fn<IntentInterpreter>(async () => {
        throw new Error("Synthetic unavailable interpreter");
      });
      const reserve = vi.fn(async () => "admitted" as const);
      const research = vi.fn(async () => ({
        status: "unavailable" as const,
        reason: "empty" as const,
        reportedCostUsd: 0,
      }));
      const app = createApp({
        researchTurns: createResearchTurns({
          ...(availability === "absent" ? {} : { interpretIntent }),
          research,
          quota: { reserve, settle: async () => {} },
        }),
      });
      const message = "I want to buy a powerbank that costs around $30-40";
      const firstResponse = await postTurn(app, {
        message,
        preferences: defaultIntent(),
        operationId: randomUUID(),
      });
      expect(firstResponse.status).toBe(200);
      const first = TurnTransportResponseSchema.parse(await firstResponse.json());
      expect(first).toMatchObject({
        kind: "clarification",
        reason: "currency",
        preferences: {
          budget: null,
          pendingChange: {
            kind: "money",
            originalRequest: message,
            missingSlot: "currency",
            draft: { minimum: 30, amount: 40, currency: null },
          },
        },
      });
      expect(reserve).not.toHaveBeenCalled();
      expect(research).not.toHaveBeenCalled();
      const secondResponse = await postTurn(app, {
        message: "SGD",
        preferences: first.preferences,
        questionId: first.preferences.pendingChange!.id,
        operationId: randomUUID(),
      });
      expect(secondResponse.status).toBe(200);
      const second = TurnTransportResponseSchema.parse(await secondResponse.json());
      expect(second).toMatchObject({
        kind: "research-unavailable",
        reason: "empty",
        preferences: {
          productDescription: expect.stringContaining("powerbank"),
          budget: { minimum: 30, amount: 40, currency: "SGD" },
          pendingChange: null,
        },
      });
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(research).toHaveBeenCalledTimes(1);
      expect(research).toHaveBeenCalledWith(
        { preferences: second.preferences },
        expect.any(AbortSignal),
      );
      expect(interpretIntent).not.toHaveBeenCalled();
    },
  );
});
