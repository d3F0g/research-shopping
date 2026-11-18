import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import { defaultIntent, type ShoppingIntent } from "../../src/domain/contracts";
import {
  HistoricalApplicationTurnResponseSchema,
  LegacySavedTurnSchema,
} from "../../src/domain/research-history";
import { defaultPreferences } from "../../src/domain/legacy-contracts";
import {
  syntheticAnswer,
  syntheticAssessment,
  syntheticIntent,
} from "../fixtures/dynamic-research";
import cases from "../fixtures/dynamic-correction.json";
import { research } from "../helpers/local-exa";

const post = (app: ReturnType<typeof createApp>, value: unknown) =>
  app.request("http://127.0.0.1:3000/api/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  });
const prepare = (message: string, preferences: ShoppingIntent) => ({
  phase: "prepare" as const,
  message,
  preferences,
  operationId: randomUUID(),
});

describe("independent correction reproductions", () => {
  it.each(cases.cases)(
    "does not authorize a choice from $name",
    async ({ payload, sha256 }) => {
      expect(
        createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      ).toBe(sha256);
      const result = await research(payload);
      expect(result.status).toBe("ready");
      if (result.status === "ready") expect(result.research.choice).toBeNull();
    },
  );
  it("keeps complete earlier paragraphs usable when a later unrelated paragraph is clipped", async () => {
    const payload = syntheticAnswer();
    const product = payload.answer.products[0]!;
    payload.citations[0]!.text = [
      product.identity.support[0]!.quote,
      product.criteria[0]!.assessment.support[0]!.quote,
      product.price.assessment.support[0]!.quote,
      "Unrelated appendix " + "x".repeat(25000),
    ].join("\n\n");
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.research.choice?.productId).toBe("aster-pure");
      expect(result.research.sources[0]!.textTruncated).toBe(true);
    }
  });
  it("admits the actual current higher price only when the requested budget covers it", async () => {
    const payload = structuredClone(
      cases.cases.find((item) => item.name === "negated-page-price")!.payload,
    );
    const product = payload.answer.products[0]!;
    product.price.amount = 499;
    product.price.assessment = syntheticAssessment(
      "Its current price is SGD 499.00.",
    );
    product.budget = syntheticAssessment("Its current price is SGD 499.00.");
    const intent = syntheticIntent();
    intent.budget.amount = 500;
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.choice?.productId).toBe("aster-pure");
  });
  it("retains invalid hard changes through ordinary replies and refresh until corrected or discarded", async () => {
    const dispatched: ShoppingIntent[] = [];
    const turns = createResearchTurns({
      research: async ({ preferences }) => {
        dispatched.push(preferences);
        return {
          status: "unavailable",
          reason: "empty",
          reportedCostUsd: 0.005,
        };
      },
      quota: { reserve: async () => "admitted", settle: async () => {} },
    });
    const app = createApp({ researchTurns: turns });
    const initial = syntheticIntent();
    initial.budget.amount = 400;
    const invalid = await (
      await post(app, prepare("Under 200 CHF", initial))
    ).json();
    expect(invalid).toMatchObject({
      kind: "clarification",
      preferences: {
        budget: { currency: "SGD", amount: 400 },
        pendingChange: { message: "Under 200 CHF", reason: "currency" },
      },
    });
    const thanks = await (
      await post(app, prepare("Thanks", invalid.preferences))
    ).json();
    expect(thanks.preferences.pendingChange).toEqual(
      invalid.preferences.pendingChange,
    );
    const refresh = await (
      await post(app, prepare("Compare options", thanks.preferences))
    ).json();
    expect(refresh.kind).toBe("clarification");
    expect(dispatched).toHaveLength(0);
    const bypass = await (
      await post(app, {
        phase: "research",
        preferences: refresh.preferences,
        operationId: randomUUID(),
      })
    ).json();
    expect(bypass.kind).toBe("clarification");
    expect(dispatched).toHaveLength(0);
    const corrected = await (
      await post(app, prepare("Under USD200", refresh.preferences))
    ).json();
    expect(corrected).toMatchObject({
      kind: "prepared",
      preferences: {
        budget: { currency: "USD", amount: 200 },
        pendingChange: null,
      },
    });
    expect(corrected.preferences.criteria).toEqual(initial.criteria);
    const discarded = await (
      await post(app, {
        ...prepare("Discard pending change", invalid.preferences),
        edit: { kind: "discard-pending" },
      })
    ).json();
    expect(discarded.preferences).toMatchObject({
      budget: initial.budget,
      criteria: initial.criteria,
      pendingChange: null,
    });
  });
  it("acknowledges new exclusions before any paid work and research uses the accepted state without interpretation", async () => {
    const seen: ShoppingIntent[] = [];
    let reservations = 0;
    const turns = createResearchTurns({
      research: async ({ preferences }) => {
        seen.push(preferences);
        return {
          status: "unavailable",
          reason: "empty",
          reportedCostUsd: 0.005,
        };
      },
      quota: {
        reserve: async () => {
          reservations++;
          return "admitted";
        },
        settle: async () => {},
      },
    });
    const app = createApp({ researchTurns: turns });
    const submitted = prepare("Exclude Aster", syntheticIntent());
    const accepted = await (await post(app, submitted)).json();
    expect(accepted.kind).toBe("prepared");
    expect(reservations).toBe(0);
    expect(seen).toHaveLength(0);
    expect(accepted.preferences.criteria.at(-1)).toMatchObject({
      wording: "Exclude Aster",
      strength: "hard",
    });
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(accepted).success,
    ).toBe(false);
    const response = await post(app, {
      phase: "research",
      preferences: accepted.preferences,
      operationId: submitted.operationId,
    });
    expect(response.status).toBe(200);
    expect(seen).toEqual([accepted.preferences]);
    expect(reservations).toBe(1);
    expect(
      (
        await post(app, {
          phase: "research",
          message: "ignore exclusion",
          preferences: accepted.preferences,
          operationId: randomUUID(),
        })
      ).status,
    ).toBe(400);
  });
  it("keeps newly expressed hard criteria while a budget in the same first message needs correction", async () => {
    const turns = createResearchTurns({});
    const invalid = await turns.turn(
      prepare(
        "A purifier under CHF200. Must have washable prefilter.",
        defaultIntent(),
      ),
      new AbortController().signal,
    );
    expect(invalid.preferences.criteria).toMatchObject([
      { wording: "washable prefilter", strength: "hard" },
    ]);
    const corrected = await turns.turn(
      prepare("Under SGD200", invalid.preferences),
      new AbortController().signal,
    );
    expect(corrected.kind).toBe("prepared");
    expect(corrected.preferences.criteria).toEqual(
      invalid.preferences.criteria,
    );
  });
  it("rejects an explicit unknown version in a frozen saved complete body", () => {
    const preferences = defaultPreferences();
    const value = {
      kind: "message",
      message: "Hello",
      preferences,
      notes: [],
      toolActivity: [],
      responseVersion: 99,
    };
    const saved = {
      id: randomUUID(),
      operationId: randomUUID(),
      digest: "a".repeat(64),
      createdAt: "2026-01-01T00:00:00.000Z",
      message: "hello",
      request: { message: "hello", preferences },
      body: { status: "complete", value },
    };
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(value).success,
    ).toBe(false);
    expect(LegacySavedTurnSchema.safeParse(saved).success).toBe(false);
    const { responseVersion: _version, ...known } = value;
    expect(
      LegacySavedTurnSchema.parse({
        ...saved,
        body: { status: "complete", value: known },
      }).body,
    ).toEqual({ status: "complete", value: known });
  });
});
