import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultIntent, type ShoppingIntent } from "../../src/domain/contracts";
import { TurnTransportResponseSchema } from "../../src/domain/research";
import { updateIntent } from "../../src/domain/preferences";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import {
  ambiguousBudgetCommands,
  independentBudgetClauses,
  negatedBudgetCommands,
  originalBudgetRequest,
  positiveMonetaryClauses,
} from "../fixtures/budget-negation";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { localProvider } from "../helpers/local-exa";

describe("HTTP budget mutation polarity before paid research", () => {
  let provider: Awaited<ReturnType<typeof localProvider>>;
  let app: ReturnType<typeof createApp>;
  let requests: number;
  const reserve = vi.fn(async () => "admitted" as const);
  const settle = vi.fn(async () => {});
  let research: ReturnType<
    typeof vi.fn<ReturnType<typeof createExaProductResearch>>
  >;

  beforeEach(async () => {
    requests = 0;
    reserve.mockClear();
    settle.mockClear();
    provider = await localProvider((_request, response) => {
      requests++;
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(syntheticAnswer()));
    });
    research = vi.fn(
      createExaProductResearch("fake-test-key", { baseUrl: provider.baseUrl }),
    );
    app = createApp({
      researchTurns: createResearchTurns({
        research,
        quota: { reserve, settle },
      }),
    });
  });
  afterEach(async () => {
    await provider.close();
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
  const prepare = (message: string, preferences: ShoppingIntent) =>
    post({ phase: "prepare", message, preferences, operationId: randomUUID() });
  const priorIntent = () =>
    updateIntent(originalBudgetRequest, defaultIntent()).preferences;
  const expectNoDispatch = () => {
    expect(reserve).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
    expect(research).not.toHaveBeenCalled();
    expect(requests).toBe(0);
  };

  it.each(negatedBudgetCommands)(
    "does not prepare a paid submission for %s",
    async (message) => {
      const previous = priorIntent();
      const result = await prepare(message, previous);
      expect(result.kind).toBe("message");
      expect(result.preferences).toEqual(previous);
      expectNoDispatch();
    },
  );

  it.each(ambiguousBudgetCommands)(
    "blocks research until a compound or ambiguous instruction is resolved: %s",
    async (message) => {
      const previous = priorIntent();
      const result = await prepare(message, previous);
      expect(result.kind).toBe("clarification");
      expect(result.preferences.budget).toEqual(previous.budget);
      expect(result.preferences.pendingChange?.message).toBe(message);
      const direct = await post({
        phase: "research",
        preferences: result.preferences,
        operationId: randomUUID(),
      });
      expect(direct.kind).toBe("clarification");
      const thanks = await prepare("Thanks", result.preferences);
      expect(thanks.kind).toBe("message");
      expect(thanks.preferences.pendingChange).toEqual(
        result.preferences.pendingChange,
      );
      expect((await prepare("Compare options", thanks.preferences)).kind).toBe(
        "clarification",
      );
      expectNoDispatch();
    },
  );

  it("retains an earlier pending currency change through a negated command and ordinary replies", async () => {
    const pending = await prepare(
      "Under CHF500. Must be nickel-free.",
      priorIntent(),
    );
    const result = await prepare(
      "Do not increase my budget to SGD3000",
      pending.preferences,
    );
    expect(result.kind).toBe("message");
    expect(result.preferences).toEqual(pending.preferences);
    const thanks = await prepare("Thanks", result.preferences);
    expect((await prepare("Compare options", thanks.preferences)).kind).toBe(
      "clarification",
    );
    expectNoDispatch();
  });

  it.each([
    "Increase my budget to SGD3000",
    "Change my budget to SGD3000",
    "Raise my maximum budget to SGD3000",
    "Set my maximum to SGD3000",
    "No more than SGD3000",
    "A neutron interferometer under SGD3000. Must not contain nickel.",
    "Increase my spending to SGD3000",
    "Change the amount to SGD3000",
    "Raise my discretionary allocation to SGD3000",
    ...independentBudgetClauses,
    ...positiveMonetaryClauses,
  ])(
    "dispatches one local request for the accepted counterpart %s",
    async (message) => {
      const prepared = await prepare(message, priorIntent());
      expect(prepared.kind).toBe("prepared");
      expect(prepared.preferences.budget).toEqual({
        minimum: 1000,
        amount: 3000,
        currency: "SGD",
      });
      expectNoDispatch();
      await post({
        phase: "research",
        preferences: prepared.preferences,
        operationId: randomUUID(),
      });
      expect(reserve).toHaveBeenCalledTimes(1);
      expect(settle).toHaveBeenCalledTimes(1);
      expect(research).toHaveBeenCalledTimes(1);
      expect(requests).toBe(1);
    },
  );
});
