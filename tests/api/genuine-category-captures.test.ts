import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { CategorySchema, defaultPreferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import captures from "../fixtures/research-corpus/existing-category-captures.json";

async function observe(capture: (typeof captures)[number], quote = capture.quote) {
  let calls = 0;
  const server = createServer((_request, response) => {
    calls++;
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      requestId: "historical-capture-fixture",
      results: [{
        title: "Historical captured review fixture. Not current evidence.",
        url: capture.url,
        highlights: [quote],
      }],
      output: { content: { observations: [{
        name: capture.name,
        url: capture.url,
        quotedFacts: [quote],
        priceQuote: null,
      }] } },
      costDollars: { total: 0 },
    }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = CategorySchema.parse(capture.category);
  try {
    const result = await createExaProductResearch("fake-capture-test-key", {
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    })({ message: capture.category, preferences }, new AbortController().signal);
    expect(calls).toBe(1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected a safe historical source excerpt");
    return result.research;
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("genuine class captures through the actual SDK", () => {
  it.each(captures)("retains the unchanged $id model and class sentence", async (capture) => {
    expect(createHash("sha256").update(capture.quote).digest("hex")).toBe(capture.contentSha256);
    const research = await observe(capture);
    expect(research.products.map((product) => product.name)).toEqual(capture.expectedAcceptedNames);
    expect(research.products[0]).toMatchObject({
      facts: [{ sourceId: "source-1", quote: capture.quote }],
      price: null,
      stock: "unverified",
      unresolvedConstraints: ["Stock and delivery to SG are unverified"],
    });
    expect(research.sources).toEqual([{
      id: "source-1",
      title: "Historical captured review fixture. Not current evidence.",
      url: capture.url,
      highlights: [capture.quote],
    }]);
  });

  it.each([
    { capture: 0, rule: "wrong model", quote: "The Other Model are open-back headphones designed for neutral listening." },
    { capture: 0, rule: "other variant", quote: "The Sennheiser HD 560S Pro are open-back headphones designed for neutral listening." },
    { capture: 0, rule: "negated class", quote: "The Sennheiser HD 560S are not open-back headphones designed for neutral listening." },
    { capture: 0, rule: "accessory", quote: "The Sennheiser HD 560S are replacement pads for open-back headphones designed for neutral listening." },
    { capture: 0, rule: "accessory after class", quote: "The Sennheiser HD 560S are open-back headphones replacement pads designed for neutral listening." },
    { capture: 0, rule: "unrecognized purpose", quote: "The Sennheiser HD 560S are open-back headphones designed for a different model." },
    { capture: 1, rule: "wrong model", quote: "The Other Model is a 14-inch thin and light Windows laptop." },
    { capture: 1, rule: "other variant", quote: "The Acer Swift 3 14 (2020) Pro is a 14-inch thin and light Windows laptop." },
    { capture: 1, rule: "negated class", quote: "The Acer Swift 3 14 (2020) is not a 14-inch thin and light Windows laptop." },
    { capture: 1, rule: "accessory", quote: "The Acer Swift 3 14 (2020) is a replacement case for a 14-inch thin and light Windows laptop." },
    { capture: 1, rule: "accessory after class", quote: "The Acer Swift 3 14 (2020) is a 14-inch thin and light Windows laptop replacement screen." },
    { capture: 1, rule: "wrong class", quote: "The Acer Swift 3 14 (2020) is a 14-inch thin and light Windows tablet." },
  ])("rejects synthetic $rule control for capture $capture", async ({ capture, quote }) => {
    const research = await observe(captures[capture], quote);
    expect(research.products).toEqual([]);
    expect(research.sources[0].highlights).toEqual([quote]);
  });
});
