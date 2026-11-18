import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, type Feature } from "../../src/domain/contracts";
import { ApplicationTurnResponseSchema, ResearchSnapshotSchema, type ResearchSnapshot } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { historicalReplay } from "../fixtures/page-evidence";
import { otherModelFacts, scopedResponse, scopedText } from "../fixtures/page-evidence-security";

async function turn(payload: unknown, features: Feature[] = []) {
  const requests: unknown[] = [];
  const settlements: { cost: number | null; complete: boolean }[] = [];
  let diagnostic = "";
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(JSON.parse(body));
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.budget = { amount: 400, currency: "SGD" };
  preferences.hard.requiredFeatures = features;
  try {
    const app = createApp({ researchTurns: createResearchTurns({
      research: createExaProductResearch("fake-key-local-only", {
        baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        diagnosticSink: (artifact) => { diagnostic = artifact; },
      }),
      quota: { async reserve() { return "admitted"; }, async settle(_id, cost, complete) { settlements.push({ cost, complete }); } },
    }) }, { apiPort: 6393, webPort: 6394 });
    const response = await app.request("http://127.0.0.1:6393/api/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Headphones under SGD400", preferences, operationId: randomUUID() }) });
    expect(response.status).toBe(200);
    expect(requests).toHaveLength(1);
    const result = ApplicationTurnResponseSchema.parse(await response.json());
    return { result, diagnostic: JSON.parse(diagnostic), settlements };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function research(payload: unknown, features: Feature[] = []) {
  const outcome = await turn(payload, features);
  expect(outcome.result.kind).toBe("research");
  expect(outcome.settlements).toEqual([{ cost: 0.007, complete: true }]);
  if (outcome.result.kind !== "research") throw new Error("Expected research");
  return outcome.result;
}

describe("independent security reproductions through the SDK and Hono", () => {
  it.each(otherModelFacts)("rejects a specification attributed to a different subject: %s", async (fact) => {
    const { research: snapshot } = await research(scopedResponse(scopedText.replace("Driver size: 42 mm.", fact), { quotedFacts: [fact] }));
    expect(snapshot.products[0]?.facts ?? []).toEqual([]);
  });
  it("does not inherit fields after an unmarked competing product label", async () => {
    const { research: snapshot } = await research(scopedResponse(scopedText.replace("Driver size: 42 mm.", "Orbit Quiet\nBattery life: 60 hours."), { quotedFacts: ["Battery life: 60 hours."] }));
    expect(snapshot.products[0]?.facts ?? []).toEqual([]);
    expect(snapshot.products[0]?.price ?? null).toBeNull();
  });
  it("rejects an intact base heading when the title identifies Pro", async () => {
    const { research: snapshot } = await research(scopedResponse(scopedText, {}, "Aster Wave 2 Pro | Synthetic raw-structure fixture"));
    expect(snapshot.products).toEqual([]);
  });
  it("applies an omitted hard negative after an inline specification marker", async () => {
    const { research: snapshot } = await research(scopedResponse("# Aster Wave 2 Wireless over-ear headphones ## Specifications Wireless: No", { quotedFacts: [], priceQuote: null }), ["wireless"]);
    expect(snapshot.products).toEqual([]);
  });
  it.each([
    ["", 1],
    ["Aster Wave 2 is a pair of wired-only headphones.", 0],
    ["Aster Wave 2 does not support Bluetooth.", 0],
    ["Aster Wave 2 isn't wireless.", 0],
    ["Aster Wave 2 isn’t wireless.", 0],
    ["Aster Wave 2 costs SGD 99 without wireless support.", 0],
    ["Orbit Quiet costs SGD 99 without wireless support.", 1],
    ["Aster Wave 2 Pro costs SGD 99 without wireless support.", 1],
    ["Aster Wave 2 costs SGD 99 without wireless support for Orbit Quiet.", 1],
    ["Orbit Quiet is a pair of wired-only headphones.", 1],
    ["Aster Wave 2 Pro is a pair of wired-only headphones.", 1],
    ["These headphones are wired-only.", 1],
    ["Aster Wave 2 supports Bluetooth.", 1],
  ] as const)("checks independently attributed constraints across highlights without borrowing %s", async (statement, expected) => {
    const payload = scopedResponse(scopedText, { quotedFacts: [], priceQuote: null });
    if (statement) payload.results[0].highlights.push(statement);
    const { research: snapshot } = await research(payload, ["wireless"]);
    expect(snapshot.products).toHaveLength(expected);
    if (expected) expect(snapshot.products[0].facts).toEqual([]);
  });
  it.each(["per month for 12 months", "with trade-in of a qualifying device"])("preserves adjacent price qualification: %s", async (qualifier) => {
    const { research: snapshot } = await research(scopedResponse(scopedText + `\n${qualifier}`));
    expect(snapshot.products[0]?.price ?? null).toBeNull();
  });
  it("does not lend another product's price to the heading", async () => {
    const { research: snapshot } = await research(scopedResponse(scopedText.replace("Price: SGD 349", "Orbit Quiet\nPrice: SGD 349")));
    expect(snapshot.products[0]?.price ?? null).toBeNull();
  });
  it("retains allowlisted raw evidence after outer metadata fails without changing unknown-cost settlement", async () => {
    const payload = { ...historicalReplay, warnings: [{ code: 17 }], headers: { authorization: "secret-header-sentinel" }, environment: { KEY: "secret-env-sentinel" }, cookies: "secret-cookie-sentinel" };
    const { result, diagnostic, settlements } = await turn(payload);
    expect(result).toMatchObject({ kind: "research-unavailable", reason: "invalid-response" });
    expect(settlements).toEqual([{ cost: null, complete: true }]);
    expect(diagnostic).toMatchObject({ schemaStatus: "invalid", requestId: historicalReplay.requestId, reportedCostUsd: 0.007, resultCount: 5, native: { kind: "object" } });
    expect(diagnostic.results).toHaveLength(5);
    expect(JSON.parse(diagnostic.native.text)).toEqual(historicalReplay.output.content);
    expect(JSON.stringify(diagnostic)).not.toMatch(/secret-(?:header|env|cookie)-sentinel|fake-key-local-only|Headphones under SGD400/);
  });
});

describe("complete scoped attributes and adjacent prices", () => {
  it.each([
    "Driver size: 42 mm.", "Transducer size: 42.5 mm.",
    "Battery life: Up to 60 hours on a full charge.", "Runtime: 20 hours with ANC on.",
    "Weight: 250 g.", "Weighs 0.25 kg.", "Memory: 32 GB RAM.",
    "Supports Bluetooth.", "Provides wireless audio and multipoint.",
    "Does not support Bluetooth.", "These headphones are not wireless.",
    "Aster Wave 2 has long battery life.", "Aster Wave 2 is portable.",
    "Lacks multipoint.", "Has 20 hours of playback on a full charge.",
    "Aster Wave 2 is a wired-only headset.",
    "Aster Wave 2 isn't wireless.",
  ])("admits a complete own attribute and rejects an appended different subject: %s", async (fact) => {
    const own = await research(scopedResponse(scopedText.replace("Driver size: 42 mm.", fact), { quotedFacts: [fact] }));
    expect(own.research.products[0].facts).toEqual([{ sourceId: "source-1", quote: fact }]);
    const foreign = fact.replace(/\.$/, "") + " for Another Model.";
    const other = await research(scopedResponse(scopedText.replace("Driver size: 42 mm.", foreign), { quotedFacts: [foreign] }));
    expect(other.research.products[0]?.facts ?? []).toEqual([]);
  });

  it.each(["Description", "Specifications", "Key Features", "Features", "Highlights"])("segments actual inline %s markers without inventing line breaks", async (label) => {
    const text = `# Aster Wave 2 Wireless over-ear headphones ## ${label} Wireless: Yes`;
    const good = await research(scopedResponse(text, { quotedFacts: ["Wireless: Yes"], priceQuote: null }), ["wireless"]);
    expect(good.research.products[0].facts).toEqual([{ sourceId: "source-1", quote: "Wireless: Yes" }]);
    expect(good.research.sources[0].highlights[0]).toBe(text);
    const bad = await research(scopedResponse(text.replace("Wireless: Yes", "Wireless: No"), { quotedFacts: [], priceQuote: null }), ["wireless"]);
    expect(bad.research.products).toEqual([]);
  });

  it.each(["Pro", "Black", "2026", "64 GB"])("requires the title and intact heading to retain the same %s designation", async (variant) => {
    const title = `Aster Wave 2 ${variant} | Synthetic raw-structure fixture`;
    const mismatched = await research(scopedResponse(scopedText, {}, title));
    expect(mismatched.research.products).toEqual([]);
    const matched = await research(scopedResponse(scopedText.replace("# Aster Wave 2", `# Aster Wave 2 ${variant}`), { name: `Aster Wave 2 ${variant}`, identityQuote: `# Aster Wave 2 ${variant}` }, title));
    expect(matched.research.products[0].name).toBe(`Aster Wave 2 ${variant}`);
  });

  it.each(["Per month for 12 months.", "With trade-in of a qualifying device.", "Deposit only.", "For replacement pads."])("does not omit %s beside a complete direct price", async (qualifier) => {
    const category = "Aster Wave 2 is a pair of wireless headphones.";
    const price = "Aster Wave 2 costs SGD 349.";
    const make = (text: string) => scopedResponse(text, { identityQuote: null, quotedFacts: [category], priceQuote: price }, "Synthetic direct-statement fixture");
    const baseline = await research(make(`${category} ${price}`));
    expect(baseline.research.products[0].price?.quote).toBe(price);
    for (const text of [`${category} ${price}\n${qualifier}`, `${category}\n${qualifier}\n${price}`]) {
      const result = await research(make(text));
      expect(result.research.products[0].price).toBeNull();
    }
  });

  it("keeps a whole multi-line sale block while rejecting a shortened amount", async () => {
    const block = "SGD 349\nwas SGD 499\nYou Save SGD 150";
    const text = scopedText.replace("Price: SGD 349", block);
    const complete = await research(scopedResponse(text, { priceQuote: block }));
    expect(complete.research.products[0].price).toMatchObject({ quote: "SGD 349 was SGD 499 You Save SGD 150", kind: "page-price-context-unverified" });
    const clipped = await research(scopedResponse(text, { priceQuote: "SGD 349" }));
    expect(clipped.research.products[0].price).toBeNull();
  });
});

const extraFields: [string, (snapshot: ResearchSnapshot) => unknown][] = [
  ["snapshot", (snapshot) => ({ ...snapshot, assessmentVersion: 999 })],
  ["product", (snapshot) => ({ ...snapshot, products: [{ ...snapshot.products[0], availability: "in-stock" }] })],
  ["identity", (snapshot) => ({ ...snapshot, products: [{ ...snapshot.products[0], identity: { ...snapshot.products[0].identity, variant: "Black" } }] })],
  ["citation", (snapshot) => ({ ...snapshot, products: [{ ...snapshot.products[0], facts: [{ ...snapshot.products[0].facts[0], evidenceVersion: 999 }] }] })],
  ["price", (snapshot) => ({ ...snapshot, products: [{ ...snapshot.products[0], price: { ...snapshot.products[0].price, amount: 349 } }] })],
  ["source", (snapshot) => ({ ...snapshot, sources: [{ ...snapshot.sources[0], merchantVerified: true }] })],
  ["grounding", (snapshot) => ({ ...snapshot, grounding: [{ field: "facts", sourceIds: ["source-1"], evidenceVersion: 999 }] })],
];
describe("strict current live contract", () => {
  it.each(extraFields)("rejects unknown %s fields without stripping", async (_name, add) => {
    const { research: snapshot } = await research(scopedResponse());
    expect(ResearchSnapshotSchema.safeParse(add(snapshot)).success).toBe(false);
  });
  it("rejects a stray version on the network envelope", async () => {
    const result = await research(scopedResponse());
    expect(ApplicationTurnResponseSchema.safeParse({ ...result, assessmentVersion: 999 }).success).toBe(false);
  });
  it.each(["hard", "soft", "budget"])("rejects unknown nested preference fields in the live response: %s", async (field) => {
    const result = await research(scopedResponse());
    const preferences = structuredClone(result.preferences);
    if (field === "budget") Object.assign(preferences.hard.budget!, { evidenceVersion: 999 });
    else Object.assign(preferences[field as "hard" | "soft"], { evidenceVersion: 999 });
    expect(ApplicationTurnResponseSchema.safeParse({ ...result, preferences }).success).toBe(false);
  });
});
