import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { CategorySchema, FeatureSchema, defaultPreferences, type Feature, type Preferences } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";

const name = "Aster Wave 2";
const url = "https://reviews.example.com/aster-wave-2";
const categoryQuote = `${name} is a pair of wireless headphones.`;
const featureEvidence: Record<Feature, { positive: string; negative: string }> = {
  "active-noise-cancelling": { positive: "has active noise cancelling.", negative: "lacks active noise cancelling." },
  wireless: { positive: "supports wireless audio.", negative: "is not wireless." },
  multipoint: { positive: "supports multipoint.", negative: "does not support multipoint." },
  "long-battery-life": { positive: "has long battery life.", negative: "lacks long battery life." },
  lightweight: { positive: "is lightweight.", negative: "is not lightweight." },
  "oled-display": { positive: "has an OLED display.", negative: "does not have an OLED display." },
  "high-memory": { positive: "has 32 GB of memory.", negative: "does not have 32 GB of memory." },
  "long-battery": { positive: "has long battery life.", negative: "lacks long battery life." },
  portable: { positive: "is portable.", negative: "is not portable." },
};
const categoryEvidence: Record<NonNullable<Preferences["hard"]["category"]>, string> = {
  headphones: `${name} is a pair of headphones.`,
  laptops: `${name} is a laptop.`,
};

async function observe({
  model = name,
  facts = [categoryQuote],
  price = null,
  highlights = [...facts, ...(price ? [price] : [])],
  category = "headphones",
  requiredFeatures = [],
  excludedBrands = [],
  sourceTitle = "Automated fixture evidence",
  duplicates = false,
  message = "Headphones under SGD300",
}: {
  model?: string;
  facts?: string[];
  price?: string | null;
  highlights?: string[];
  category?: Preferences["hard"]["category"];
  requiredFeatures?: Preferences["hard"]["requiredFeatures"];
  excludedBrands?: string[];
  sourceTitle?: string;
  duplicates?: boolean;
  message?: string;
}) {
  const requests: Record<string, unknown>[] = [];
  const server = createServer((incoming, outgoing) => {
    const chunks: Buffer[] = [];
    incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
    incoming.on("end", () => {
      requests.push(JSON.parse(Buffer.concat(chunks).toString()));
      outgoing.writeHead(200, { "Content-Type": "application/json" });
      const observation = { name: model, url, quotedFacts: facts, priceQuote: price };
      outgoing.end(JSON.stringify({
        results: [{ title: sourceTitle, url, highlights }],
        output: { content: { observations: duplicates ? [observation, observation] : [observation] }, grounding: [] },
        costDollars: { total: 0.007 },
      }));
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const preferences = defaultPreferences();
  preferences.hard.category = category;
  preferences.hard.requiredFeatures = requiredFeatures;
  preferences.hard.excludedBrands = excludedBrands;
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
  it.each(CategorySchema.options.flatMap((category) => FeatureSchema.options.map((feature) => ({ category, feature }))))(
    "rejects a literal $feature contradiction with independent positive $category evidence",
    async ({ category, feature }) => {
      const categoryFact = categoryEvidence[category];
      const positive = `${name} ${featureEvidence[feature].positive}`;
      const negative = `${name} ${featureEvidence[feature].negative}`;
      const accepted = await observe({ category, facts: [categoryFact, positive], requiredFeatures: [feature] });
      expect(accepted.snapshot.products).toHaveLength(1);
      expect(accepted.snapshot.products[0].facts).toEqual(expect.arrayContaining([{ sourceId: "source-1", quote: categoryFact }]));
      for (const facts of [[categoryFact, negative], [categoryFact]]) {
        const rejected = await observe({ category, facts, highlights: [categoryFact, negative], requiredFeatures: [feature] });
        expect(rejected.snapshot.products).toEqual([]);
        expect(rejected.snapshot.sources[0].highlights).toContain(negative);
      }
    },
  );

  it.each([
    "is wired-only.",
    "is wired only.",
    "supports wired audio only.",
    "supports wired connections only.",
    "only supports wired audio.",
    "supports only wired connections.",
    "uses wired audio only.",
    "has only wired connections.",
    "can only use wired audio.",
  ])("rejects an attributable exclusive wired clause with positive category evidence: %s", async (clause) => {
    const negative = `${name} ${clause}`;
    const baseline = await observe({ facts: [categoryQuote], requiredFeatures: ["wireless"] });
    expect(baseline.snapshot.products).toHaveLength(1);
    const { snapshot } = await observe({ facts: [categoryQuote], highlights: [categoryQuote, negative], requiredFeatures: ["wireless"] });
    expect(snapshot.products).toEqual([]);
    expect(snapshot.sources[0].highlights).toContain(negative);
  });

  it.each([
    "is a wired-only headset.",
    "is wired-only headphones.",
    "is a pair of wired-only headphones.",
    "is wired-only earbuds.",
    "is an over-ear wired-only headset.",
    "is the wired-only headset.",
    "is the pair of wired-only earbuds.",
    "are wired-only headphones.",
    "are a pair of wired-only headphones.",
    "is a wired only headset.",
    "is a wired-only over-ear headset.",
    "is a lightweight wired-only headset.",
    "is a wired-only lightweight headset.",
    "is a lightweight over-ear wired-only headset.",
    "is a pair of wired-only in-ear earbuds.",
    "is a pair of closed-back wired-only headphones.",
    "is a noise-cancelling wired-only headset.",
    "is a wired-only noise-canceling headset.",
    "is a wired-only gaming headset.",
    "is a wired-only stereo headset.",
    "is a wired-only portable headset.",
    "are a pair of open-back wired-only headphones.",
    "is an on-ear wired-only headset.",
  ])("rejects an exclusive wired noun phrase with independent category evidence: %s", async (clause) => {
    const categoryFact = categoryEvidence.headphones;
    const negative = `${name} ${clause}`;
    const baseline = await observe({ facts: [categoryFact], requiredFeatures: ["wireless"] });
    expect(baseline.snapshot.products).toHaveLength(1);
    expect(baseline.snapshot.products[0].facts).toEqual([{ sourceId: "source-1", quote: categoryFact }]);
    for (const facts of [[categoryFact, negative], [categoryFact]]) {
      const { snapshot } = await observe({ facts, highlights: [categoryFact, negative], requiredFeatures: ["wireless"] });
      expect(snapshot.products).toEqual([]);
      expect(snapshot.sources[0].highlights).toContain(negative);
    }
  });

  it.each([
    "supports wired and wireless audio.",
    "supports only wired and wireless audio.",
    "supports not only wired audio but also wireless audio.",
    "does not support wired audio but supports wireless audio.",
    "is not wired-only and supports wireless audio.",
    "supports wireless audio and only uses wired connections for charging.",
    "is not a wired-only headset.",
    "isn't a wired-only headset.",
    "is not a pair of wired-only headphones.",
    "are not wired-only earbuds.",
    "is a headset with wired and wireless audio.",
    "is a pair of wired and wireless headphones.",
    "is a wired and Bluetooth headset.",
    "is a wireless headset with wired-only charging.",
  ])("does not treat dual connectivity as exclusive wired support: %s", async (clause) => {
    const positive = `${name} ${clause}`;
    const { snapshot } = await observe({ facts: [categoryQuote, positive], requiredFeatures: ["wireless"] });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].facts).toEqual(expect.arrayContaining([{ sourceId: "source-1", quote: positive }]));
  });

  it.each([
    `Orbit Quiet only supports wired audio.`,
    `${name} Pro only supports wired audio.`,
    `${name} supports wireless audio while Orbit Quiet only supports wired audio.`,
    `Orbit Quiet is a wired-only headset.`,
    `${name} Pro is a wired-only headset.`,
    `${name} supports wireless audio while Orbit Quiet is a wired-only headset.`,
  ])("does not bind another model's exclusive wired clause to this model: %s", async (other) => {
    const { snapshot } = await observe({ facts: [categoryQuote], highlights: [categoryQuote, other], requiredFeatures: ["wireless"] });
    expect(snapshot.products).toHaveLength(1);
  });

  it("retains an exact exclusive wired fact when wireless is not required", async () => {
    const negative = `${name} only supports wired audio.`;
    const { snapshot } = await observe({ facts: [categoryEvidence.headphones, negative] });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].facts).toEqual(expect.arrayContaining([{ sourceId: "source-1", quote: negative }]));
  });

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
    `${name} lacks wireless support.`,
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

  it("rejects an excluded manufacturer explicitly attached to the exact model in the source title", async () => {
    const { snapshot } = await observe({
      model: "WH-1000XM6", facts: ["WH-1000XM6 is a pair of wireless headphones."],
      sourceTitle: "Sony WH-1000XM6 wireless headphones", excludedBrands: ["Sony"],
    });
    expect(snapshot.products).toEqual([]);
  });

  it("does not infer a model's brand from an unrelated comparison mention", async () => {
    const { snapshot } = await observe({ sourceTitle: "Sony WH-1000XM6 versus Aster Wave 2", excludedBrands: ["Sony"] });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].unresolvedConstraints.join(" ")).toMatch(/brand exclusions.*verification/i);
  });

  it("publishes one identity when the provider repeats an observation", async () => {
    const { snapshot } = await observe({ duplicates: true });
    expect(snapshot.products).toHaveLength(1);
  });

  it("retains category evidence and a valid price when extraction fills all three fact slots", async () => {
    const { snapshot } = await observe({
      facts: [`${name} supports multipoint.`, `${name} has a 30-hour battery.`, categoryQuote],
      price: `${name} costs SGD 229.00.`,
    });
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].facts).toEqual(expect.arrayContaining([{ sourceId: "source-1", quote: categoryQuote }]));
    expect(snapshot.products[0].price?.quote).toBe(`${name} costs SGD 229.00.`);
    for (const citation of [...snapshot.products[0].facts, snapshot.products[0].price!]) {
      expect(snapshot.sources[0].highlights).toContain(citation.quote);
    }
  });
});
