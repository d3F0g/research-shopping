import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, type Preferences, type Feature } from "../../src/domain/contracts";
import { ResearchSnapshotSchema } from "../../src/domain/research";
import { createExaProductResearch } from "../../src/server/exa-research";
import { historicalReplay, historicalSources, syntheticExtraction, syntheticRawStructure, testAuthoredExtractions } from "../fixtures/page-evidence";
import oracle from "../fixtures/research-corpus/page-evidence/actual-page-oracles.json";

async function replay(payload: unknown, features: Preferences["hard"]["requiredFeatures"] = []) {
  let calls = 0;
  const server = createServer((_incoming, outgoing) => {
    calls++;
    outgoing.writeHead(200, { "Content-Type": "application/json" });
    outgoing.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.requiredFeatures = features;
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  try {
    const result = await createExaProductResearch("fake-test-key", { baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })({ message: "Headphones under SGD400", preferences }, new AbortController().signal);
    expect(calls).toBe(1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected source context");
    expect(result.research.reportedCostUsd).toBe(0.007);
    return result.research;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function synthetic(highlight = syntheticRawStructure.highlights[0], extraction = syntheticExtraction) {
  return { costDollars: { total: 0.007 }, results: [{ ...syntheticRawStructure, highlights: [highlight] }], output: { content: { observations: [extraction] } } };
}

describe("normalized historical application capture with test-authored extraction", () => {
  it("admits JBL and the exact HN Teal identity with full price context, never post-gap specifications", async () => {
    const snapshot = await replay(historicalReplay);
    expect(snapshot.evidenceVersion).toBe(2);
    expect(snapshot.products.map((product) => product.name)).toEqual(testAuthoredExtractions.map((item) => item.name));
    expect(snapshot.products[0]).toMatchObject({ facts: [], price: null, identity: { kind: "single-product-heading", quote: "# JBL Tour One M3 Premium wireless over-ear Noise Cancelling headphones" } });
    expect(snapshot.products[1]).toMatchObject({ facts: [], price: { kind: "page-price-context-unverified", quote: "S$ 349 was S$ 499 SGD You Save S$ 150" } });
    for (const product of snapshot.products) {
      expect(product.stock).toBe("unverified");
      expect(product).not.toHaveProperty("amount");
      expect(product.unresolvedConstraints.join(" ")).toContain("affordability within SGD 400 is unverified");
      for (const citation of [product.identity, ...product.facts, ...(product.price ? [product.price] : [])]) {
        const source = snapshot.sources.find((source) => source.id === citation.sourceId)!;
        expect(source.highlights.some((window) => window.includes(product.identity.quote) && window.includes(citation.quote))).toBe(true);
      }
    }
    expect(snapshot.sources).toHaveLength(5);
    expect(snapshot.sources[3].highlights.join(" ")).toContain("EARBUDS");
    expect(snapshot.sources[4].highlights.join(" ")).toContain("at the time of writing");
    expect(snapshot.products.map((product) => product.name).join(" ")).not.toMatch(/Black|BLK|Bose|ShopBack/);
    expect(snapshot.products[1].price).not.toHaveProperty("currency");
  });

  it.each([undefined, { content: "not JSON" }, { content: "malformed".repeat(9000) }, { content: ["invalid shape"] }, { content: { observations: [] } }, { content: { observations: testAuthoredExtractions.map(({ identityQuote: _identity, ...rest }) => rest) } }])("keeps independently proved headings when native extraction is absent or incomplete", async (output) => {
    const snapshot = await replay({ ...historicalReplay, output });
    expect(snapshot.products.map((product) => product.name)).toEqual(testAuthoredExtractions.map((item) => item.name));
    expect(snapshot.products.every((product) => product.facts.length === 0 && product.price === null)).toBe(true);
    expect(snapshot.limitations.join(" ")).toContain("extraction was incomplete");
  });

  it.each(oracle.syntheticControls.filter((item) => /variant-mismatch|accessory-heading|negated-class/.test(item.id)))("rejects invalid source identity in $id", async ({ source }) => {
    const snapshot = await replay({ ...historicalReplay, results: [source] });
    expect(snapshot.products).toEqual([]);
  });

  it.each([
    ["S$ 29 per month for 12 months SGD", "S$ 29 per month for 12 months SGD"],
    ["S$ 349 was S$ 499 SGD You Save S$ 150", "S$ 349"],
    ["S$ 349 was S$ 499 SGD You Save S$ 150", "You Save S$ 150"],
    ["Black variant S$ 349. Teal variant price unavailable.", "Black variant S$ 349."],
    ["SGD 349 SGD 599 42% off", "SGD 349 SGD 599 42% off"],
    ["$349", "$349"],
  ])("keeps forbidden price context out of the lead: %s / %s", async (block, candidate) => {
    const source = structuredClone(historicalSources[1]);
    source.highlights[0] = source.highlights[0].replace(testAuthoredExtractions[1].priceQuote!, block);
    const snapshot = await replay({ ...historicalReplay, results: [source], output: { content: { observations: [{ ...testAuthoredExtractions[1], priceQuote: candidate }] } } });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].price).toBeNull();
  });

  it("keeps a wrong native model from renaming a real source identity or lending it claims", async () => {
    const snapshot = await replay({ ...historicalReplay, output: { content: { observations: [{ ...testAuthoredExtractions[1], name: "Sennheiser MOMENTUM 4 Black", priceQuote: "S$ 349" }] } } });
    expect(snapshot.products.map((product) => product.name)).toEqual(testAuthoredExtractions.map((item) => item.name));
    expect(snapshot.products.every((product) => !product.facts.length && product.price === null)).toBe(true);
  });

  it("keeps Shop.com conditional on an intact heading and never infers its price roles or merges Teal", async () => {
    const flattened = await replay({ ...historicalReplay, results: [historicalSources[2]] });
    expect(flattened.products).toEqual([]);
    const source = { ...historicalSources[2], highlights: ["# Sennheiser Momentum 4 Wireless Headphones\nSGD 349.00 SGD 599.00 42% off"] };
    const intact = await replay({ ...historicalReplay, results: [source], output: undefined });
    expect(intact.products).toEqual([]);
    const matchedTitle = await replay({ ...historicalReplay, results: [{ ...source, title: "Sennheiser Momentum 4 Wireless Headphones" }], output: undefined });
    expect(matchedTitle.products[0]).toMatchObject({ name: "Sennheiser Momentum 4 Wireless Headphones", price: null, facts: [] });
  });
});

describe("synthetic raw-structure fixtures with test-authored extraction", () => {
  it("publishes genuinely useful intact specifications with their contiguous heading proof", async () => {
    const snapshot = await replay(synthetic());
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].facts.map((fact) => fact.quote)).toEqual(syntheticExtraction.quotedFacts);
    expect(snapshot.products[0].price?.quote).toBe("Price: SGD 349");
    expect(snapshot.sources[0].highlights[0]).toContain("# Aster Wave 2 - Teal (800073)");
    expect(snapshot.sources[0].highlights[0]).toContain("Battery life: Up to 60 hours on a full charge.");
  });

  it.each(["...", "…", "## Related products", "# Orbit Quiet", "## Comparison", "Variations", "Choose a color"])("does not transfer a specification across %s", async (boundary) => {
    const highlight = syntheticRawStructure.highlights[0].replace("## Specifications", `${boundary}\n## Specifications`);
    const snapshot = await replay(synthetic(highlight));
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0]).toMatchObject({ facts: [], price: null });
  });

  it("does not stitch a different highlight to a heading", async () => {
    const response = synthetic();
    response.results[0].highlights = ["# Aster Wave 2 - Teal (800073)\nWireless over-ear headphones", "Driver size: 42 mm.\nPrice: SGD 349"];
    const snapshot = await replay(response);
    expect(snapshot.products[0]).toMatchObject({ facts: [], price: null });
  });

  it.each(["Aster Wave 2 - Black (509266) has 42 mm drivers.", "Aster Wave 2 - Teal (800073) Pro has 42 mm drivers.", "Orbit Quiet has 42 mm drivers.", "Driver size: 42 mm for the Black variant."])("does not inherit a different model or variant's specification: %s", async (fact) => {
    const highlight = syntheticRawStructure.highlights[0].replace("Driver size: 42 mm.", fact);
    const snapshot = await replay(synthetic(highlight, { ...syntheticExtraction, quotedFacts: [fact] }));
    expect(snapshot.products[0].facts).toEqual([]);
  });

  it("cannot clip a negative prefix from a quoted specification", async () => {
    const highlight = syntheticRawStructure.highlights[0].replace("Driver size: 42 mm.", "Not supported: Driver size: 42 mm.");
    const snapshot = await replay(synthetic(highlight, { ...syntheticExtraction, quotedFacts: ["Driver size: 42 mm."] }));
    expect(snapshot.products[0].facts).toEqual([]);
  });

  it("rejects omitted scoped label negatives and leaves unrelated negatives after boundaries alone", async () => {
    const negative = syntheticRawStructure.highlights[0].replace("Wireless: Yes", "Wireless: No");
    expect((await replay(synthetic(negative), ["wireless"])).products).toEqual([]);
    const unrelated = syntheticRawStructure.highlights[0] + "\n## Related products\n# Orbit Quiet\nWireless: No";
    expect((await replay(synthetic(unrelated), ["wireless"])).products).toHaveLength(1);
  });

  it.each([
    ["active-noise-cancelling", "ANC"], ["wireless", "Wireless"], ["multipoint", "Multipoint"],
    ["long-battery-life", "Long battery life"], ["lightweight", "Lightweight"], ["oled-display", "OLED"],
    ["high-memory", "32 GB"], ["long-battery", "Long battery"], ["portable", "Portable"],
  ] as [Feature, string][])("rejects an omitted scoped %s label contradiction", async (feature, label) => {
    const highlight = syntheticRawStructure.highlights[0] + `\n${label}: No`;
    expect((await replay(synthetic(highlight), [feature])).products).toEqual([]);
  });

  it.each(["Orbit Quiet is not wireless.", "Aster Wave 2 - Teal (800073) Pro is not wireless.", "Orbit Quiet Wireless: No"])("does not apply another model's negative to the heading: %s", async (other) => {
    const snapshot = await replay(synthetic(syntheticRawStructure.highlights[0] + `\n${other}`), ["wireless"]);
    expect(snapshot.products).toHaveLength(1);
  });

  it("stops flattened scope at another heading even after an allowed description heading", async () => {
    const highlight = "# Aster Wave 2 - Teal (800073) Wireless over-ear headphones ## Description # Orbit Quiet Driver size: 42 mm.";
    const snapshot = await replay(synthetic(highlight));
    expect(snapshot.products[0]).toMatchObject({ facts: [], price: null });
  });

  it.each(["Pro", "case for travel"])("cannot shorten a flattened designation before %s", async (suffix) => {
    const snapshot = await replay({ costDollars: { total: 0.007 }, results: [{
      title: "Aster Wave 2 Wireless Headphones", url: syntheticRawStructure.url,
      highlights: [`# Aster Wave 2 Wireless Headphones ${suffix} SGD 349`],
    }] });
    expect(snapshot.products).toEqual([]);
  });

  it("drops distant facts without truncating identity proof or joining disjoint fragments", async () => {
    const highlight = syntheticRawStructure.highlights[0].replace("## Specifications", "Details ".repeat(100) + "\n## Specifications");
    expect((await replay(synthetic(highlight))).products).toEqual([]);
    const closed = highlight.replace("Wireless over-ear headphones\n", "Wireless over-ear headphones.\n");
    const snapshot = await replay(synthetic(closed));
    expect(snapshot.products[0]).toMatchObject({ facts: [], price: null });
    expect(snapshot.sources[0].highlights.every((window) => window.length <= 640)).toBe(true);
  });

  it("deduplicates exact source designations without merging source evidence", async () => {
    const response = synthetic();
    response.results.push({ ...response.results[0], url: "https://other.example.com/same-model" });
    const snapshot = await replay(response);
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.sources).toHaveLength(2);
    expect(snapshot.products[0].identity.sourceId).toBe("source-1");
  });

  it("requires version 2, identity proof and a shared visible contiguous scoped window", async () => {
    const snapshot = await replay(synthetic());
    expect(ResearchSnapshotSchema.safeParse({ ...snapshot, evidenceVersion: undefined }).success).toBe(false);
    expect(ResearchSnapshotSchema.safeParse({ ...snapshot, evidenceVersion: 999 }).success).toBe(false);
    expect(ResearchSnapshotSchema.safeParse({ ...snapshot, products: [{ ...snapshot.products[0], identity: undefined }] }).success).toBe(false);
    snapshot.sources[0].highlights = [snapshot.products[0].identity.quote, ...snapshot.products[0].facts.map((fact) => fact.quote)];
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
  });
});
