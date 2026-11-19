import { fixtureIntentInterpreter } from "../helpers/intent";
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import type { ShoppingIntent } from "../../src/domain/contracts";
import { updateIntent } from "../../src/domain/preferences";
import type { ResearchOperation } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import { syntheticIntent } from "../fixtures/dynamic-research";
import { postTurn } from "../helpers/turns";

it("answers help and current-budget queries during Hono preparation with no quota or provider call, while product questions dispatch", async () => {
  const research = vi.fn<ResearchOperation>(async () => ({
    status: "unavailable",
    reason: "empty",
    reportedCostUsd: 0,
  }));
  const reserve = vi.fn(async () => "admitted" as const);
  const settle = vi.fn(async () => undefined);
  const app = createApp({
    researchTurns: createResearchTurns({ interpretIntent: fixtureIntentInterpreter,
      research,
      quota: { reserve, settle },
    }),
  });
  const range: ShoppingIntent = {
    ...syntheticIntent(),
    budget: { minimum: 1000, amount: 2000, currency: "SGD" },
  };
  const states = [
    range,
    { ...range, budget: null },
    updateIntent("under CHF200", range).preferences,
  ];
  for (const preferences of states) {
    for (const message of [
      "How does it work?",
      "What is my budget?",
      "What's my current budget range?",
    ]) {
      const response = await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phase: "prepare",
          message,
          preferences,
          operationId: randomUUID(),
        }),
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.kind).toBe("message");
      expect(result.preferences).toEqual(preferences);
      if (message !== "How does it work?") {
        expect(result.message).toContain(
          preferences.budget
            ? "SGD 1,000 to SGD 2,000"
            : "do not have an accepted budget limit",
        );
        if (preferences.pendingChange)
          expect(result.message).toContain(
            "pending change has not been applied",
          );
      }
    }
  }
  expect(reserve).not.toHaveBeenCalled();
  expect(settle).not.toHaveBeenCalled();
  expect(research).not.toHaveBeenCalled();
  const message = "How does this reversible ceramic fermentation crock work?";
  const response = await postTurn(app, {
    message,
    preferences: range,
    operationId: randomUUID(),
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    kind: "research-unavailable",
    reason: "empty",
  });
  expect(reserve).toHaveBeenCalledTimes(1);
  expect(settle).toHaveBeenCalledTimes(1);
  expect(research).toHaveBeenCalledTimes(1);
  expect(research.mock.calls[0]![0]).toMatchObject({
    preferences: {
      budget: range.budget,
      criteria: range.criteria,
      productDescription: expect.stringContaining(message),
    },
  });
});
