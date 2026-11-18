import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, type Preferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";

const name = "Aster Wave 2";
const url = "https://reviews.example.com/aster-wave-2";
const categoryQuote = `${name} is a pair of wireless headphones.`;

async function observe({
  model = name,
  facts = [categoryQuote],
  price = null,
  highlights = [...facts, ...(price ? [price] : [])],
  category = "headphones",
  requiredFeatures = [],
  message = "Headphones under SGD300",
}: {
  model?: string;
  facts?: string[];
  price?: string | null;
  highlights?: string[];
  category?: Preferences["hard"]["category"];
  requiredFeatures?: Preferences["hard"]["requiredFeatures"];
  message?: string;
}) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      requests.push(JSON.parse(Buffer.concat(chunks).toString()));
      outgoing.writeHead(200, { "Content-Type": "application/json" });
      outgoing.end(JSON.stringify({
        results: [{ title: "Automated fixture evidence", url, highlights }],
        output: { content: { observations: [{ name: model, url, quotedFacts: facts, priceQuote: price }] }, grounding: [] },
        costDollars: { total: 0.007 },
      }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = category;
  preferences.hard.requiredFeatures = requiredFeatures;
  preferences.hard.budget = { currency: "SGD", amount: 300 };
  try {
    const result = await createExaProductResearch("fake-test-key", {
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    })({ message, preferences }, new AbortController().signal);
    expect(requests).toHaveLength(1);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected safe source context");
    return { snapshot: result.research, request: requests[0] };
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

describe("supported product evidence through the actual SDK", () => {
  it.each([
    "costs SGD 99 less than its competitors.",
    "costs SGD 99/month.",
    "costs SGD 99 for the Pro edition.",
    "costs SGD 99 for the Plus model.",
    "costs SGD 99 to SGD 199.",
    "costs SGD 99–199.",
    "costs from SGD 99.",
    "costs SGD 99 and up.",
    "costs SGD 99 after a discount of SGD 20.",
    "costs SGD 99 less with a coupon.",
    "costs SGD 99 for replacement ear pads.",
    "costs SGD 99 for the carrying case.",
    "costs SGD 99 per month.",
    "costs SGD 99 in four installments.",
    "costs SGD 99 for a subscription.",
    "costs SGD 99 or USD 80.",
    "costs SGD 99, while Orbit Quiet costs SGD 199.",
    "costs SGD 99 including the Pro edition.",
    "Pro costs SGD 99.",
    "costs $99.",
  ])("keeps a relevant model but does not project a scalar price from %s", async (suffix) => {
    const price = `${name} ${suffix}`;
    const { snapshot } = await observe({ price });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].price).toBeNull();
    expect(snapshot.products[0].facts[0].quote).toBe(categoryQuote);
    expect(snapshot.sources[0].highlights).toContain(price);
  });

  it.each([
    "costs SGD 99.",
    "costs SGD 99.50.",
    "retails for USD 1,299.00.",
    "is priced at EUR 299.",
    "is listed at S$229.00 on this page.",
    "was listed at US$179.00 when reviewed.",
  ])("retains a complete scalar price with its explicit currency from %s", async (suffix) => {
    const price = `${name} ${suffix}`;
    const { snapshot } = await observe({ price });
    expect(snapshot.products[0].price).toEqual({ sourceId: "source-1", quote: price, kind: "page-observed-unverified" });
    expect(snapshot.sources[0].highlights).toContain(price);
  });

  it.each([
    `${name} costs SGD 99/month.`,
    `${name} costs SGD 99 less than its competitors.`,
    `${name} costs SGD 99 for the Pro edition.`,
    `Unlike Orbit Quiet, ${name} costs SGD 99.`,
  ])("rejects an extracted price fragment without its complete source context from %s", async (context) => {
    const { snapshot } = await observe({ price: `${name} costs SGD 99`, highlights: [categoryQuote, context] });
    expect(snapshot.products[0].price).toBeNull();
  });

  it.each([
    `${name} is a cotton sweater.`,
    `${name} is a headphone case.`,
    `${name} is a stand for headphones.`,
    `${name} is not a pair of headphones.`,
    `${name} is a pair of headphones for the Pro edition.`,
    `${name} has long battery life.`,
    `${name} Pro is a pair of headphones.`,
    `Orbit Quiet is a pair of headphones.`,
  ])("requires a supported class statement for the exact model instead of %s", async (fact) => {
    const { snapshot } = await observe({ facts: [fact], price: `${name} costs SGD 99.` });
    expect(snapshot.products).toEqual([]);
    expect(snapshot.sources[0].highlights).toContain(fact);
    expect(snapshot.limitations.join(" ")).toMatch(/category|attribut/i);
  });

  it("keeps laptop category and memory facts with a complete price for the named variant", async () => {
    const model = "Aster Book 14 Pro";
    const facts = [`${model} is a laptop.`, `${model} has 32 GB of memory.`];
    const price = `${model} costs USD 1299.`;
    const { snapshot } = await observe({ model, facts, price, category: "laptops" });
    expect(snapshot.products[0]).toMatchObject({ name: model, facts: facts.map((quote) => ({ quote })), price: { quote: price } });
  });

  it.each([
    `${name} is not wireless.`,
    `${name} isn't wireless.`,
    `${name} isn’t wireless.`,
    `${name} doesn’t support Bluetooth.`,
    `${name} supports wired only.`,
    `${name} supports only wired audio.`,
    `${name} costs SGD 99 without wireless support.`,
  ])("rejects a known hard-feature contradiction anywhere in the source evidence: %s", async (negative) => {
    const { snapshot } = await observe({
      facts: [categoryQuote], price: negative, highlights: [categoryQuote, negative], requiredFeatures: ["wireless"],
    });
    expect(snapshot.products).toEqual([]);
    expect(snapshot.sources[0].highlights).toContain(negative);
  });

  it("does not hide a direct contradictory source statement omitted by extraction", async () => {
    const { snapshot } = await observe({
      facts: [categoryQuote], highlights: [categoryQuote, `${name} is not wireless.`], requiredFeatures: ["wireless"],
    });
    expect(snapshot.products).toEqual([]);
  });

  it("preserves a negative fact when that feature is not required", async () => {
    const negative = `${name} is not wireless.`;
    const { snapshot } = await observe({ facts: [`${name} is a pair of headphones.`, negative] });
    expect(snapshot.products[0].facts[1].quote).toBe(negative);
  });

  it("preserves the submitted model comparison and research objective alongside current preferences", async () => {
    const message = "Compare Sony WH-1000XM5 with Bose QuietComfort Ultra for microphone quality on airplane calls";
    const { request } = await observe({ message, requiredFeatures: ["wireless"] });
    expect(`${request.query} ${request.objective}`).toContain(message);
    expect(request.query).toContain("headphones");
    expect(request.query).toContain("wireless");
    expect(request.query).toContain("SGD 300");
    expect(request).toMatchObject({ numResults: 5, contents: { highlights: true } });
    expect(request.type ?? "auto").toBe("auto");
  });
});
