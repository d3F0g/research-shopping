import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  UnversionedResearchResponseSchema,
  UnversionedResearchSnapshotSchema,
} from "../../src/domain/research-history-unversioned";
import capture from "../fixtures/research-history/unversioned-application-response.json";
import browserSnapshot from "../fixtures/research-history/unversioned-browser-snapshot.json";
import provenance from "../fixtures/research-history/provenance.json";

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

  it.each(provenance.records)("preserves the recorded bytes of $file", (record) => {
    const bytes = readFileSync(new URL(`../fixtures/research-history/${record.file}`, import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
  });

  it("keeps historical preferences independent of a later preference change", () => {
    const saved = legacy();
    const preferences = structuredClone(saved.preferences);
    preferences.hard.budget = { currency: "USD", amount: 100 };
    preferences.hard.category = "laptops";
    const restored = UnversionedResearchResponseSchema.parse(JSON.parse(JSON.stringify(saved)));
    expect(restored.preferences).toEqual(capture.preferences);
    expect(restored.research).toEqual(browserSnapshot);
  });

  it.each([undefined, null, "2", 2, 3, 99])("rejects an explicitly present evidenceVersion of %s", (version) => {
    const response = legacy();
    Object.assign(response.research, { evidenceVersion: version });
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it.each([
    [], ["preferences"], ["preferences", "hard"], ["preferences", "hard", "budget"],
    ["preferences", "soft"], ["research"], ["research", "products", "0"],
    ["research", "products", "0", "facts", "0"], ["research", "sources", "0"],
  ].map((path) => ({ path })))("rejects unknown fields at $path instead of stripping them", ({ path }) => {
    const response = legacy();
    let target: object = response;
    for (const key of path) target = Reflect.get(target, key) as object;
    Object.assign(target, { assessmentVersion: 3 });
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it("requires saved preference values instead of supplying defaults", () => {
    const response = legacy();
    Reflect.deleteProperty(response.preferences.hard, "pendingConstraint");
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it("does not accept a future category or feature in old research preferences", () => {
    for (const extra of [{ category: "monitors" }, { requiredFeatures: ["4k-display"] }]) {
      const response = legacy();
      Object.assign(response.preferences.hard, extra);
      expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
    }
  });

  it("retains a legacy price-only record with its original quote", () => {
    const response = legacy();
    const quote = "Automated fixture headphones were listed at SGD 229.00.";
    response.research.sources[0].highlights = [quote];
    response.research.products[0].facts = [];
    response.research.products[0].price = {
      kind: "page-observed-unverified", sourceId: "fixture-source", quote,
    };
    expect(UnversionedResearchResponseSchema.parse(response)).toEqual(response);
    Object.assign(response.research.products[0].price, { amount: 229 });
    expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects fabricated quotes, missing evidence, and unbound source references", () => {
    const fabricated = legacy();
    fabricated.research.products[0].facts[0].quote = "Unrecorded specification";
    const missing = legacy();
    missing.research.products[0].facts = [];
    const unbound = legacy();
    unbound.research.products[0].facts[0].sourceId = "missing-source";
    for (const response of [fabricated, missing, unbound])
      expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects new identity and price-context records in the unversioned shape", () => {
    const identity = legacy();
    Object.assign(identity.research.products[0], {
      identity: { kind: "single-product-heading", sourceId: "fixture-source", quote: "Automated fixture headphones" },
    });
    const context = legacy();
    Object.assign(context.research.products[0], {
      price: { kind: "page-price-context-unverified", sourceId: "fixture-source", quote: "Automated fixture headphones" },
    });
    for (const response of [identity, context])
      expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it("rejects unknown grounding fields and duplicate source identities", () => {
    const grounding = legacy();
    Object.assign(grounding.research, { grounding: [{ field: "facts", sourceIds: ["fixture-source"], confidence: 1 }] });
    const duplicate = legacy();
    duplicate.research.sources.push(structuredClone(duplicate.research.sources[0]));
    for (const response of [grounding, duplicate])
      expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
  });

  it.each(["http://example.com/product", "https://localhost/product", "https://127.0.0.1/product", "https://user:password@example.com/product", "https://example.com:8443/product"])(
    "rejects unsafe historical source URL %s", (url) => {
      const response = legacy();
      response.research.sources[0].url = url;
      expect(UnversionedResearchResponseSchema.safeParse(response).success).toBe(false);
    },
  );
});
