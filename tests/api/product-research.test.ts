import { once } from "node:events";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { defaultPreferences, type Feature } from "../../src/domain/contracts";
import { createExaProductResearch } from "../../src/server/exa-research";
import { productResearchResponse } from "../fixtures/exa-research";

async function api(
  handler: (incoming: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
async function research(payload: unknown, requiredFeatures: Feature[] = []) {
  const server = await api((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(payload));
  });
  const preferences = defaultPreferences();
  preferences.hard.category = "headphones";
  preferences.hard.requiredFeatures = requiredFeatures;
  try {
    return await createExaProductResearch("fake-test-key", {
      baseUrl: server.baseUrl,
    })({ message: "Headphones", preferences }, new AbortController().signal);
  } finally {
    await server.close();
  }
}

describe("real SDK product research against local HTTP", () => {
  it.each([
    { id: "price-difference", quote: "Aster Wave 2 costs SGD 99 less than its competitors.", price: true },
    { id: "monthly-price", quote: "Aster Wave 2 costs SGD 99/month.", price: true },
    { id: "other-variant-price", quote: "Aster Wave 2 costs SGD 99 for the Pro edition.", price: true },
    { id: "wrong-category", quote: "Aster Wave 2 is a cotton sweater.", price: false },
  ])("keeps the independent QA $id reproduction as source context", async ({ quote, price }) => {
    const result = await research({
      requestId: "adversarial-fixture", costDollars: { total: 0.007 },
      results: [{ title: "Synthetic fixture", url: "https://reviews.example.com/aster-wave-2", highlights: [quote] }],
      output: {
        content: { observations: [{
          name: "Aster Wave 2", url: "https://reviews.example.com/aster-wave-2",
          quotedFacts: price ? [] : [quote], priceQuote: price ? quote : null,
        }] }, grounding: [],
      },
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products).toEqual([]);
    expect(result.research.sources[0].highlights).toContain(quote);
  });

  it("makes one compact canonical search and returns exact source-scoped products and unverified prices", async () => {
    let calls = 0;
    let requestBody: Record<string, unknown> = {};
    const server = await api((incoming, response) => {
      calls++;
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => {
        requestBody = JSON.parse(Buffer.concat(chunks).toString());
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(productResearchResponse));
      });
    });
    const preferences = defaultPreferences();
    preferences.hard.category = "headphones";
    preferences.hard.budget = { amount: 300, currency: "SGD" };
    try {
      const result = await createExaProductResearch("fake-test-key", {
        baseUrl: server.baseUrl,
      })(
        { message: "Headphones under SGD300", preferences },
        new AbortController().signal,
      );
      expect(calls).toBe(1);
      expect(requestBody).toMatchObject({
        numResults: 5,
        contents: { highlights: true },
      });
      expect(requestBody.objective).toBeTypeOf("string");
      expect(requestBody.outputSchema).toBeTypeOf("object");
      expect(requestBody.systemPrompt).toBeTypeOf("string");
      expect(requestBody).not.toHaveProperty("category");
      expect(requestBody).not.toHaveProperty("includeDomains");
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.products).toHaveLength(2);
      expect(result.research.products[0]).toMatchObject({
        name: "Aster Wave 2",
        stock: "unverified",
        price: {
          kind: "page-observed-unverified",
          quote: "Aster Wave 2 is listed at SGD 229.00 on this page.",
        },
      });
      expect(result.research.products[0].unresolvedConstraints).toContain(
        "Current affordability within SGD 300 is unverified",
      );
      expect(result.research.grounding[0]).toEqual({
        field: "provider specific field syntax",
        sourceIds: ["source-1"],
      });
      for (const product of result.research.products)
        for (const citation of [
          ...product.facts,
          ...(product.price ? [product.price] : []),
        ])
          expect(
            result.research.sources.find(
              (source) => source.id === citation.sourceId,
            )?.highlights,
          ).toContain(citation.quote);
    } finally {
      await server.close();
    }
  });
  it.each([
    {
      name: "Invented Model",
      url: "https://reviews.example.com/aster-wave-2",
      quotedFacts: ["Invented Model has 200 hours of battery."],
      priceQuote: null,
    },
    {
      name: "Aster Wave 2",
      url: "https://attacker.example.org/new-destination",
      quotedFacts: [
        "Aster Wave 2 uses Bluetooth wireless audio and active noise cancelling.",
      ],
      priceQuote: null,
    },
    {
      name: "Aster Wave 2",
      url: "https://reviews.example.com/aster-wave-2",
      quotedFacts: ["Orbit Quiet supports wireless audio and multipoint."],
      priceQuote: "Aster Wave 2 costs SGD 1.",
    },
  ])(
    "drops unsupported names, destinations and wrong-model quotations",
    async (observation) => {
      const result = await research({
        ...productResearchResponse,
        output: { content: { observations: [observation] }, grounding: [] },
      });
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.products).toEqual([]);
      expect(result.research.sources).toHaveLength(2);
    },
  );
  it("does not bind one comparison-page model's price to another model", async () => {
    const result = await research({
      ...productResearchResponse,
      results: [
        {
          title: "Comparison",
          url: "https://reviews.example.com/aster-wave-2",
          highlights: ["Aster Wave 2 is wireless. Orbit Quiet costs SGD 999."],
        },
      ],
      output: {
        content: {
          observations: [
            {
              name: "Aster Wave 2",
              url: "https://reviews.example.com/aster-wave-2",
              quotedFacts: ["Aster Wave 2 is wireless."],
              priceQuote: "Orbit Quiet costs SGD 999.",
            },
          ],
        },
        grounding: [],
      },
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.products[0].price).toBeNull();
  });
  it.each([
    "Aster Wave 2 has long battery life. Beta Two costs SGD 99.",
    "Aster Wave 2 Pro costs SGD 99.",
    "It costs SGD 99 for Aster Wave 2.",
    "Aster Wave 2 has long battery life, Beta Two costs SGD 99.",
  ])(
    "keeps ambiguous model or variant price text out of product observations: %s",
    async (quote) => {
      const result = await research({
        ...productResearchResponse,
        results: [
          {
            title: "Comparison",
            url: "https://reviews.example.com/aster-wave-2",
            highlights: [quote],
          },
        ],
        output: {
          content: {
            observations: [
              {
                name: "Aster Wave 2",
                url: "https://reviews.example.com/aster-wave-2",
                quotedFacts: [],
                priceQuote: quote,
              },
            ],
          },
          grounding: [],
        },
      });
      expect(result.status).toBe("ready");
      if (result.status === "ready")
        expect(result.research.products).toEqual([]);
    },
  );
  it("does not turn a negative feature quote into a lead for that required feature", async () => {
    const quote = "Aster Wave 2 does not support wireless audio.";
    const result = await research(
      {
        ...productResearchResponse,
        results: [
          {
            title: "Aster Wave 2",
            url: "https://reviews.example.com/aster-wave-2",
            highlights: [quote],
          },
        ],
        output: {
          content: {
            observations: [
              {
                name: "Aster Wave 2",
                url: "https://reviews.example.com/aster-wave-2",
                quotedFacts: [quote],
                priceQuote: null,
              },
            ],
          },
          grounding: [],
        },
      },
      ["wireless"],
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.products).toEqual([]);
  });
  it("matches an exact named variant containing punctuation without treating its name as regex syntax", async () => {
    const name = "Aster (2026)+";
    const quote = `${name} supports wireless audio.`;
    const result = await research({
      ...productResearchResponse,
      results: [
        {
          title: name,
          url: "https://reviews.example.com/aster-wave-2",
          highlights: [quote],
        },
      ],
      output: {
        content: {
          observations: [
            {
              name,
              url: "https://reviews.example.com/aster-wave-2",
              quotedFacts: [quote],
              priceQuote: null,
            },
          ],
        },
        grounding: [],
      },
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.products[0]?.name).toBe(name);
  });
  it.each([
    "http://reviews.example.com/page",
    "https://127.0.0.1/private",
    "https://user:pass@reviews.example.com/page",
    "javascript:alert(1)",
  ])(
    "never publishes an unsafe returned source destination %s",
    async (url) => {
      const result = await research({
        ...productResearchResponse,
        results: [{ title: "Untrusted", url, highlights: [] }],
        output: undefined,
      });
      expect(result).toMatchObject({ status: "unavailable", reason: "empty" });
    },
  );
  it("retains attributable evidence after an overlong source prefix rather than displaying unrelated text", async () => {
    const response = structuredClone(productResearchResponse);
    response.results[0].highlights[0] =
      "Unrelated introduction. ".repeat(100) +
      response.results[0].highlights[0];
    const result = await research(response);
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.sources[0].highlights[0]).toBe(
        "Aster Wave 2 uses Bluetooth wireless audio and active noise cancelling.",
      );
  });
  it("degrades malformed extraction to sources and discloses relaxed retrieval without changing constraints", async () => {
    const result = await research({
      ...productResearchResponse,
      output: { content: "invalid JSON", grounding: [] },
      notices: [
        {
          code: "RESTRICTIONS_RELAXED",
          message: "restriction removed",
          path: "/query",
        },
      ],
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products).toEqual([]);
    expect(result.research.limitations.join(" ")).toContain(
      "hard requirements remain unchanged",
    );
  });
  it("preserves negation exactly rather than claiming a supported feature", async () => {
    const result = await research({
      ...productResearchResponse,
      results: [
        {
          title: "Aster Wave 2",
          url: "https://reviews.example.com/aster-wave-2",
          highlights: ["Aster Wave 2 does not support wireless audio."],
        },
      ],
      output: {
        content: {
          observations: [
            {
              name: "Aster Wave 2",
              url: "https://reviews.example.com/aster-wave-2",
              quotedFacts: ["Aster Wave 2 does not support wireless audio."],
              priceQuote: null,
            },
          ],
        },
        grounding: [],
      },
    });
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.products[0].facts[0].quote).toContain(
        "does not support",
      );
  });
});
