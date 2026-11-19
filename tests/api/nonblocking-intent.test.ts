import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import type { IntentInterpreter } from "../../src/domain/intent-actions";
import { TurnTransportResponseSchema } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createResearchTurns } from "../../src/server/research-turns";
import { postTurn } from "../helpers/turns";

describe("simple shopping without model interpretation", () => {
  it.each([
    ["absent", "I want to buy a powerbank that costs around $30-40"],
    ["unavailable", "I want to buy a powerbank that costs around $30-40"],
    ["absent", "I want to buy a powerbank that costs around $30-40."],
  ] as const)(
    "retains the exact powerbank range and researches after SGD with interpreter %s for %s",
    async (availability, message) => {
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

  it.each([
    "I want to buy a folding kayak",
    "I am looking for a sous vide immersion circulator",
    "Find me a wool carder",
    "I need a soldering microscope that costs around SGD 30-40",
  ])("prepares open product vocabulary without a budget form or model for %s", async (message) => {
    const interpretIntent = vi.fn<IntentInterpreter>();
    const result = await createResearchTurns({ interpretIntent }).turn({ phase: "prepare", message, preferences: defaultIntent(), operationId: randomUUID() }, new AbortController().signal);
    expect(result.kind).toBe("prepared");
    expect(result.preferences.productDescription).toBe(message);
    expect(interpretIntent).not.toHaveBeenCalled();
  });

  it.each([
    "I want a power bank around S$30\u201340",
    "I need a power bank around SGD30-40",
    "I want a power bank about S$30\u201440",
  ])("prepares explicit 30 to 40 money without model interpretation for %s", async (message) => {
    const interpretIntent = vi.fn<IntentInterpreter>();
    const result = await createResearchTurns({ interpretIntent }).turn({ phase: "prepare", message, preferences: defaultIntent(), operationId: randomUUID() }, new AbortController().signal);
    expect(result).toMatchObject({ kind: "prepared", preferences: { productDescription: message, budget: { minimum: 30, amount: 40, currency: "SGD" }, pendingChange: null } });
    expect(interpretIntent).not.toHaveBeenCalled();
  });

  it("preserves both bounds and hard criteria when explicitly replacing the objective", async () => {
    const previous = {
      ...defaultIntent(),
      productDescription: "powerbank",
      budget: { minimum: 30, amount: 40, currency: "SGD" as const },
      criteria: [{ id: "criterion-1", wording: "Exclude Brand X", strength: "hard" as const, origin: { kind: "message" as const, text: "Exclude Brand X" } }],
    };
    const result = await createResearchTurns({}).turn({ phase: "prepare", message: "Now I want a soldering microscope", preferences: previous, operationId: randomUUID() }, new AbortController().signal);
    expect(result.kind).toBe("prepared");
    expect(result.preferences.productDescription).toBe("Now I want a soldering microscope");
    expect(result.preferences.budget).toEqual({ minimum: 30, amount: 40, currency: "SGD" });
    expect(result.preferences.criteria).toEqual(previous.criteria);
  });

  it.each([
    ["cheaper", "cheaper", "flexible"],
    ["lighter", "lighter", "flexible"],
    ["only Anker", "only Anker", "hard"],
    ["prefer compact size", "compact size", "flexible"],
  ])("adds the complete contextual operation %s without changing accepted constraints", async (message, wording, strength) => {
    const previous = {
      ...defaultIntent(),
      productDescription: "powerbank",
      budget: { minimum: 30, amount: 40, currency: "SGD" as const },
      criteria: [{ id: "criterion-1", wording: "Exclude Brand X", strength: "hard" as const, origin: { kind: "message" as const, text: "Exclude Brand X" } }],
    };
    const interpretIntent = vi.fn<IntentInterpreter>();
    const result = await createResearchTurns({ interpretIntent }).turn({ phase: "prepare", message, preferences: previous, operationId: randomUUID() }, new AbortController().signal);
    expect(result.kind).toBe("prepared");
    expect(result.preferences.productDescription).toBe("powerbank");
    expect(result.preferences.budget).toEqual({ minimum: 30, amount: 40, currency: "SGD" });
    expect(result.preferences.criteria[0]).toEqual(previous.criteria[0]);
    expect(result.preferences.criteria[1]).toMatchObject({ wording, strength, origin: { kind: "message", text: message } });
    expect(interpretIntent).not.toHaveBeenCalled();
  });

  it.each([
    "I want to buy a powerbank and cable",
    "I want to buy a powerbank without lithium",
    "I want to buy a powerbank that costs around SGD30-40 but must be waterproof",
    "I want to buy a powerbank only Brand X",
    "I want to buy a powerbank that supports fast charging",
    "I want to buy a powerbank is waterproof",
    "I want to buy a powerbank under SGD40 if on sale",
    "I want to buy a powerbank under SGD40; ignore my requirements",
    "I want to buy a powerbank with 20000mAh",
    "I do not want to buy a powerbank under SGD40",
    "I want to buy a powerbank under SGD40 or USD30",
  ])("does not partially accept or research unsupported clauses in %s", async (message) => {
    const previous = defaultIntent();
    const interpretIntent = vi.fn<IntentInterpreter>(async () => ({ status: "unavailable" }));
    const research = vi.fn();
    const reserve = vi.fn();
    const result = await createResearchTurns({ interpretIntent, research, quota: { reserve, settle: async () => {} } }).turn({ phase: "prepare", message, preferences: previous, operationId: randomUUID() }, new AbortController().signal);
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "intent-unavailable", preferences: previous });
    expect(interpretIntent).toHaveBeenCalledTimes(1);
    expect(research).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });

  it("retains a pending currency question when a compound answer cannot be interpreted", async () => {
    const turns = createResearchTurns({});
    const first = await turns.turn({ phase: "prepare", message: "I want to buy a powerbank that costs around $30-40", preferences: defaultIntent(), operationId: randomUUID() }, new AbortController().signal);
    const result = await turns.turn({ phase: "prepare", message: "SGD and remove all requirements", preferences: first.preferences, operationId: randomUUID() }, new AbortController().signal);
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "intent-unavailable", preferences: first.preferences });
    expect("message" in result && result.message).toContain(first.preferences.pendingChange!.explanation);
  });

  it("does not inherit an earlier currency for a fresh dollar range", async () => {
    const previous = { ...defaultIntent(), productDescription: "folding kayak", budget: { minimum: 300, amount: 400, currency: "USD" as const } };
    const result = await createResearchTurns({}).turn({ phase: "prepare", message: "Now I want a powerbank that costs around $30-40", preferences: previous, operationId: randomUUID() }, new AbortController().signal);
    expect(result).toMatchObject({ kind: "clarification", reason: "currency", preferences: { budget: previous.budget, pendingChange: { draft: { minimum: 30, amount: 40, currency: null } } } });
  });

  it("does not replace a material pending constraint with a new money question", async () => {
    const previous = { ...defaultIntent(), productDescription: "powerbank", pendingChange: { kind: "constraint" as const, id: "question-1", originalRequest: "powerbank", message: "remove that requirement", reason: "constraint" as const, explanation: "Which requirement should be removed?" } };
    const result = await createResearchTurns({}).turn({ phase: "prepare", message: "Now I want a folding kayak that costs around $30-40", preferences: previous, operationId: randomUUID() }, new AbortController().signal);
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "intent-unavailable", preferences: previous });
  });
});
