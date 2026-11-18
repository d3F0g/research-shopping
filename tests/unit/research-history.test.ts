import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UnversionedResearchResponseSchema,
  UnversionedResearchSnapshotSchema,
} from "../../src/domain/research-history-unversioned";
import capture from "../fixtures/research-history/unversioned-application-response.json";
import browserSnapshot from "../fixtures/research-history/unversioned-browser-snapshot.json";
import provenance from "../fixtures/research-history/provenance.json";
import { HistoricalApplicationTurnResponseSchema } from "../../src/domain/research-history";
import { ApplicationTurnResponseSchema } from "../../src/domain/research";
import {
  AccountStateSchema,
  WorkspaceResultSchema,
} from "../../src/domain/workspace";
import { defaultPreferences } from "../../src/domain/contracts";
import { runTurn, loadAccount, workspaceCommand } from "../../src/client/api";
import {
  legacyBrowserResponse,
  version2Response,
  storedResearchTurn,
} from "../fixtures/research-history/records";

afterEach(() => vi.unstubAllGlobals());

function legacy() {
  return UnversionedResearchResponseSchema.parse({
    ...capture,
    research: browserSnapshot,
  });
}

describe("frozen unversioned research records", () => {
  it("retains the actual serialized capture without refreshing or adding proof", () => {
    const decoded = UnversionedResearchResponseSchema.parse(capture);
    expect(decoded).toEqual(capture);
    expect(decoded.research).not.toHaveProperty("evidenceVersion");
    expect(decoded.research.products).toEqual([]);
    expect(decoded.research.retrievedAt).toBe(capture.research.retrievedAt);
  });

  it("retains the original browser fixture as an unversioned snapshot", () => {
    const decoded = UnversionedResearchSnapshotSchema.parse(browserSnapshot);
    expect(decoded).toEqual(browserSnapshot);
    expect(decoded.products[0]).not.toHaveProperty("identity");
    expect(decoded.products[0].facts[0].quote).toBe(
      "Automated fixture headphones have wireless audio.",
    );
  });

  it.each(provenance.records)(
    "preserves the recorded bytes of $file",
    (record) => {
      const bytes = readFileSync(
        new URL(`../fixtures/research-history/${record.file}`, import.meta.url),
      );
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        record.sha256,
      );
    },
  );

  it("keeps historical preferences independent of a later preference change", () => {
    const saved = legacy();
    const preferences = structuredClone(saved.preferences);
    preferences.hard.budget = { currency: "USD", amount: 100 };
    preferences.hard.category = "laptops";
    const restored = UnversionedResearchResponseSchema.parse(
      JSON.parse(JSON.stringify(saved)),
    );
    expect(restored.preferences).toEqual(capture.preferences);
    expect(restored.research).toEqual(browserSnapshot);
  });

  it.each([undefined, null, "2", 2, 3, 99])(
    "rejects an explicitly present evidenceVersion of %s",
    (version) => {
      const response = legacy();
      Object.assign(response.research, { evidenceVersion: version });
      expect(
        UnversionedResearchResponseSchema.safeParse(response).success,
      ).toBe(false);
    },
  );

  it.each(
    [
      [],
      ["preferences"],
      ["preferences", "hard"],
      ["preferences", "hard", "budget"],
      ["preferences", "soft"],
      ["research"],
      ["research", "products", "0"],
      ["research", "products", "0", "facts", "0"],
      ["research", "sources", "0"],
    ].map((path) => ({ path })),
  )("rejects unknown fields at $path instead of stripping them", ({ path }) => {
    const response = legacy();
    let target: object = response;
    for (const key of path) target = Reflect.get(target, key) as object;
    Object.assign(target, { assessmentVersion: 3 });
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });

  it("requires saved preference values instead of supplying defaults", () => {
    const response = legacy();
    Reflect.deleteProperty(response.preferences.hard, "pendingConstraint");
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });

  it("does not accept a future category or feature in old research preferences", () => {
    for (const extra of [
      { category: "monitors" },
      { requiredFeatures: ["4k-display"] },
    ]) {
      const response = legacy();
      Object.assign(response.preferences.hard, extra);
      expect(
        UnversionedResearchResponseSchema.safeParse(response).success,
      ).toBe(false);
    }
  });

  it("retains a legacy price-only record with its original quote", () => {
    const response = legacy();
    const quote = "Automated fixture headphones were listed at SGD 229.00.";
    response.research.sources[0].highlights = [quote];
    response.research.products[0].facts = [];
    response.research.products[0].price = {
      kind: "page-observed-unverified",
      sourceId: "fixture-source",
      quote,
    };
    expect(UnversionedResearchResponseSchema.parse(response)).toEqual(response);
    Object.assign(response.research.products[0].price, { amount: 229 });
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });

  it("rejects fabricated quotes, missing evidence, and unbound source references", () => {
    const fabricated = legacy();
    fabricated.research.products[0].facts[0].quote = "Unrecorded specification";
    const missing = legacy();
    missing.research.products[0].facts = [];
    const unbound = legacy();
    unbound.research.products[0].facts[0].sourceId = "missing-source";
    for (const response of [fabricated, missing, unbound])
      expect(
        UnversionedResearchResponseSchema.safeParse(response).success,
      ).toBe(false);
  });

  it("rejects new identity and price-context records in the unversioned shape", () => {
    const identity = legacy();
    Object.assign(identity.research.products[0], {
      identity: {
        kind: "single-product-heading",
        sourceId: "fixture-source",
        quote: "Automated fixture headphones",
      },
    });
    const context = legacy();
    Object.assign(context.research.products[0], {
      price: {
        kind: "page-price-context-unverified",
        sourceId: "fixture-source",
        quote: "Automated fixture headphones",
      },
    });
    for (const response of [identity, context])
      expect(
        UnversionedResearchResponseSchema.safeParse(response).success,
      ).toBe(false);
  });

  it("rejects unknown grounding fields and duplicate source identities", () => {
    const grounding = legacy();
    Object.assign(grounding.research, {
      grounding: [
        { field: "facts", sourceIds: ["fixture-source"], confidence: 1 },
      ],
    });
    const duplicate = legacy();
    duplicate.research.sources.push(
      structuredClone(duplicate.research.sources[0]),
    );
    for (const response of [grounding, duplicate])
      expect(
        UnversionedResearchResponseSchema.safeParse(response).success,
      ).toBe(false);
  });

  it.each([
    "http://example.com/product",
    "https://localhost/product",
    "https://127.0.0.1/product",
    "https://user:password@example.com/product",
    "https://example.com:8443/product",
  ])("rejects unsafe historical source URL %s", (url) => {
    const response = legacy();
    response.research.sources[0].url = url;
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });
});

describe("raw historical version dispatch and fresh boundaries", () => {
  const history = () => ({
    revision: 3,
    epoch: 0,
    preferences: defaultPreferences(),
    budgetQuestions: [],
    turns: [capture, legacyBrowserResponse, version2Response].map(
      storedResearchTurn,
    ),
    pendingOperationId: null,
  });

  it("decodes exact old and v2 responses together without changing their fields", () => {
    const workspace = history();
    const account = {
      status: "signed-in",
      user: { id: "fixture-user", email: "fixture@example.test" },
      workspace,
    };
    expect(AccountStateSchema.parse(account)).toEqual(account);
    const result = { workspace, operation: null };
    expect(WorkspaceResultSchema.parse(result)).toEqual(result);
    expect(ApplicationTurnResponseSchema.safeParse(capture).success).toBe(
      false,
    );
    expect(ApplicationTurnResponseSchema.parse(version2Response)).toEqual(
      version2Response,
    );
  });

  it.each([undefined, null, "2", 0, 1, 3, 99])(
    "rejects explicit version %s in account and command envelopes",
    (version) => {
      const workspace = history();
      const value = structuredClone(capture);
      Object.assign(value.research, { evidenceVersion: version });
      workspace.turns[0].body.value = value;
      expect(
        HistoricalApplicationTurnResponseSchema.safeParse(value).success,
      ).toBe(false);
      expect(
        AccountStateSchema.safeParse({
          status: "signed-in",
          user: { id: "a", email: "a@example.test" },
          workspace,
        }).success,
      ).toBe(false);
      expect(
        WorkspaceResultSchema.safeParse({ workspace, operation: null }).success,
      ).toBe(false);
    },
  );

  it.each(
    [
      [],
      ["preferences"],
      ["preferences", "hard"],
      ["preferences", "hard", "budget"],
      ["preferences", "soft"],
      ["research"],
      ["research", "products", "0"],
      ["research", "products", "0", "identity"],
      ["research", "products", "0", "price"],
      ["research", "products", "0", "facts", "0"],
      ["research", "sources", "0"],
    ].map((path) => ({ path })),
  )("rejects extra v2 fields at $path without fallback", ({ path }) => {
    const response = structuredClone(version2Response);
    let target: object = response;
    for (const key of path) target = Reflect.get(target, key) as object;
    Object.assign(target, { assessmentVersion: 3 });
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(response).success,
    ).toBe(false);
    expect(ApplicationTurnResponseSchema.safeParse(response).success).toBe(
      false,
    );
  });

  it("rejects missing v2 identity even when the remaining payload fits legacy", () => {
    const response = {
      ...legacyBrowserResponse,
      research: { ...browserSnapshot, evidenceVersion: 2 },
    };
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(response).success,
    ).toBe(false);
  });

  it("accepts a complete source-only v2 snapshot", () => {
    const response = {
      ...capture,
      research: { ...capture.research, evidenceVersion: 2 },
    };
    expect(HistoricalApplicationTurnResponseSchema.parse(response)).toEqual(
      response,
    );
  });

  it("leaves ordinary replies on the ordinary contract", () => {
    const ordinary = {
      kind: "message",
      message: "Hello",
      preferences: defaultPreferences(),
      notes: [],
      toolActivity: [],
    };
    expect(HistoricalApplicationTurnResponseSchema.parse(ordinary)).toEqual(
      ApplicationTurnResponseSchema.parse(ordinary),
    );
  });

  it("keeps current preference defaults and normalization out of stored research", () => {
    const response = structuredClone(version2Response);
    if (response.kind !== "research")
      throw new Error("Expected research fixture");
    response.preferences.hard.excludedBrands = [" Fixture brand "];
    const current = ApplicationTurnResponseSchema.parse(response);
    expect(current.preferences?.hard.excludedBrands).toEqual(["Fixture brand"]);
    expect(HistoricalApplicationTurnResponseSchema.parse(response)).toEqual(
      response,
    );
    Reflect.deleteProperty(response.preferences.hard, "pendingConstraint");
    expect(
      ApplicationTurnResponseSchema.parse(response).preferences?.hard
        .pendingConstraint,
    ).toBeNull();
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(response).success,
    ).toBe(false);
    expect(response.preferences.hard).not.toHaveProperty("pendingConstraint");
  });

  it.each(
    [
      [],
      ["preferences"],
      ["preferences", "hard"],
      ["preferences", "hard", "budget"],
      ["preferences", "soft"],
    ].map((path) => ({ path })),
  )("retains current unavailable-response strictness at $path", ({ path }) => {
    const response = {
      kind: "research-unavailable",
      message: "Offline fixture failure",
      reason: "provider-error",
      preferences: structuredClone(version2Response.preferences),
      notes: [],
    };
    expect(ApplicationTurnResponseSchema.parse(response)).toEqual(response);
    let target: object = response;
    for (const key of path) target = Reflect.get(target, key) as object;
    Object.assign(target, { unknownEvidence: "fixture" });
    expect(ApplicationTurnResponseSchema.safeParse(response).success).toBe(
      false,
    );
    expect(
      HistoricalApplicationTurnResponseSchema.safeParse(response).success,
    ).toBe(false);
  });

  it("rejects legacy fresh network output while accepting a mixed saved envelope", async () => {
    const workspace = history();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(capture))
      .mockResolvedValueOnce(Response.json(version2Response))
      .mockResolvedValueOnce(
        Response.json({
          status: "signed-in",
          user: { id: "a", email: "a@example.test" },
          workspace,
        }),
      )
      .mockResolvedValueOnce(Response.json({ workspace, operation: null }));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await expect(
      runTurn("headphones", defaultPreferences(), signal),
    ).rejects.toThrow("unreadable");
    expect(await runTurn("headphones", defaultPreferences(), signal)).toEqual(
      version2Response,
    );
    expect((await loadAccount(signal)).status).toBe("signed-in");
    expect(
      (
        await workspaceCommand(
          {
            revision: 3,
            operationId: crypto.randomUUID(),
            command: { kind: "message", text: "hello" },
          },
          signal,
        )
      ).workspace,
    ).toEqual(workspace);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});
