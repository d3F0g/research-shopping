import { fixtureIntentInterpreter } from "../helpers/intent";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { TurnTransportResponseSchema } from "../../src/domain/research";
import { updateIntent } from "../../src/domain/preferences";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import {
  ambiguousConversationalRanges,
  conversationalRanges,
  negatedConversationalRanges,
} from "../fixtures/conversational-budget";

describe("conversational budgets at the HTTP boundary", () => {
  const setup = () => {
    const reserve = vi.fn(async () => "quota" as const);
    const research = vi.fn(async () => ({
      status: "unavailable" as const,
      reason: "empty" as const,
      reportedCostUsd: 0,
    }));
    const app = createApp({
      researchTurns: createResearchTurns({ interpretIntent: fixtureIntentInterpreter,
        research,
        quota: { reserve, settle: async () => {} },
      }),
    });
    const post = async (body: unknown) => {
      const response = await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      return TurnTransportResponseSchema.parse(await response.json());
    };
    return { post, reserve, research };
  };

  it.each(conversationalRanges)(
    "skips the repeated budget question for %s and honors a stopped quota",
    async (message) => {
      const { post, reserve, research } = setup();
      const operationId = randomUUID();
      const prepared = await post({
        phase: "prepare",
        message,
        preferences: defaultIntent(),
        operationId,
      });
      expect(prepared.kind).toBe("prepared");
      expect(prepared.preferences.budget).toEqual({
        minimum: 500,
        amount: 600,
        currency: "SGD",
      });
      expect(prepared.notes.join(" ")).toContain("uses SGD");
      expect(reserve).not.toHaveBeenCalled();
      const result = await post({
        phase: "research",
        preferences: prepared.preferences,
        operationId,
      });
      expect(result).toMatchObject({
        kind: "research-unavailable",
        reason: "quota",
        message: expect.stringContaining("local usage safeguard"),
      });
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(research).not.toHaveBeenCalled();
    },
  );

  it.each([...negatedConversationalRanges, ...ambiguousConversationalRanges])(
    "does not reserve research for %s",
    async (message) => {
      const { post, reserve, research } = setup();
      const previous = updateIntent(
        "Necklaces between SGD1000 and SGD2000",
        defaultIntent(),
      ).preferences;
      const prepared = await post({
        phase: "prepare",
        message,
        preferences: previous,
        operationId: randomUUID(),
      });
      expect(prepared.kind).toBe("clarification");
      expect(prepared.preferences.budget).toEqual(previous.budget);
      expect(prepared.preferences.pendingChange?.message).toBe(message);
      const researchAttempt = await post({
        phase: "research",
        preferences: prepared.preferences,
        operationId: randomUUID(),
      });
      expect(researchAttempt.kind).toBe("clarification");
      expect(reserve).not.toHaveBeenCalled();
      expect(research).not.toHaveBeenCalled();
    },
  );
});
