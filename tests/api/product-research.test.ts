import { localProvider, research } from "../helpers/local-exa";
import { describe, expect, it } from "vitest";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { createApp } from "../../src/server/app";
import {
  syntheticAnswer,
  syntheticAssessment,
  syntheticIntent,
} from "../fixtures/dynamic-research";

describe("dynamic source assessments through actual local SDK transport", () => {
  it("publishes one answer through the normal Hono path with exact sources and conditional choice", async () => {
    const calls: { path: string; body: Record<string, unknown> }[] = [];
    const provider = await localProvider((incoming, response) => {
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
      incoming.on("end", () => {
        calls.push({
          path: incoming.url!,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        });
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(syntheticAnswer()));
      });
    });
    const settlements: unknown[] = [];
    try {
      const app = createApp({
        researchTurns: createResearchTurns({
          research: createExaProductResearch("fake-test-key", {
            baseUrl: provider.baseUrl,
          }),
          quota: {
            async reserve() {
              return "admitted";
            },
            async settle(...args) {
              settlements.push(args);
            },
          },
        }),
      });
      const response = await app.request("http://127.0.0.1:3000/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Compare options",
          preferences: syntheticIntent(),
          operationId: "00000000-0000-4000-8000-000000000001",
        }),
      });
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toMatchObject({
        kind: "research",
        responseVersion: 3,
        research: {
          evidenceVersion: 3,
          choice: { productId: "aster-pure" },
          products: [
            { stock: "unverified", price: { amount: 249, currency: "SGD" } },
          ],
        },
      });
      expect(result.answer).toContain("washable prefilter");
      expect(result.research.sources[0].text).toBe(
        syntheticAnswer().citations[0]!.text,
      );
      expect(calls).toHaveLength(1);
      expect(calls[0]!.path).toBe("/answer");
      expect(calls[0]!.body).toMatchObject({
        text: true,
        userLocation: "SG",
        query: syntheticIntent().productDescription,
      });
      expect(calls[0]!.body).not.toHaveProperty("objective");
      expect(calls[0]!.body).not.toHaveProperty("contents");
      expect(calls[0]!.body.outputSchema).toBeTypeOf("object");
      expect(settlements).toEqual([
        ["00000000-0000-4000-8000-000000000001", 0.005, true],
      ]);
      expect(JSON.stringify(result)).not.toContain("fake-test-key");
    } finally {
      await provider.close();
    }
  });
  it.each(["unknown", "contradicted", "conflict"] as const)(
    "keeps %s hard evidence visible and refuses a choice",
    async (status) => {
      const payload = syntheticAnswer();
      const negative =
        "Aster Pure 30 white does not have a washable prefilter.";
      payload.citations[0]!.text += `\n${negative}`;
      const assessment = payload.answer.products[0]!.criteria[0]!.assessment;
      assessment.status = status;
      assessment.rationale =
        status === "conflict"
          ? "The retained sources disagree about the washable prefilter."
          : "The hard requirement is not established.";
      assessment.support =
        status === "conflict"
          ? [
              ...assessment.support,
              { url: payload.citations[0]!.url, quote: negative },
            ]
          : status === "unknown"
            ? []
            : [{ url: payload.citations[0]!.url, quote: negative }];
      const result = await research(payload);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice).toBeNull();
      expect(result.research.summary).toContain("could not establish");
      expect(result.research.products[0]!.criteria[0]!.assessment.status).toBe(
        status,
      );
      expect(result.research.sources[0]!.text).toContain(negative);
    },
  );
  it.each([
    "missing-criterion",
    "missing-relevance",
    "wrong-product",
    "family-scope",
    "different-price-variant",
    "membership",
    "bare-dollar",
    "us-dollar-misread",
    "unrelated-currency",
    "wrong-currency",
    "fractional-cent",
    "over-budget",
    "missing-price",
    "unsupported-manufacturer",
  ])("does not promote %s into a compliant choice", async (kind) => {
    const payload = syntheticAnswer();
    const product = payload.answer.products[0]!;
    if (kind === "missing-criterion") product.criteria = [];
    if (kind === "missing-relevance")
      delete (product as Partial<typeof product>).requestMatch;
    if (kind === "wrong-product") {
      product.requestMatch.status = "contradicted";
      product.requestMatch.rationale =
        "This is a sweater, not the requested purifier.";
    }
    if (kind === "family-scope")
      product.criteria[0]!.assessment.scope = "product-family";
    if (kind === "different-price-variant") product.price.variant = "Pro";
    if (kind === "membership") {
      product.price.conditionsResolved = false;
      product.price.conditions = ["Membership required"];
    }
    if (kind === "bare-dollar") {
      payload.citations[0]!.text = payload.citations[0]!.text.replaceAll(
        "SGD ",
        "$",
      );
      product.price.assessment.support[0]!.quote =
        product.price.assessment.support[0]!.quote.replace("SGD ", "$");
    }
    if (kind === "us-dollar-misread" || kind === "unrelated-currency") {
      const quote =
        kind === "us-dollar-misread"
          ? "Aster Pure 30 white is listed at US$249.00."
          : "Aster Pure 30 white is listed at USD249.00. Its replacement filter costs SGD20.";
      payload.citations[0]!.text += `\n${quote}`;
      product.price.assessment = syntheticAssessment(quote);
    }
    if (kind === "wrong-currency") product.price.currency = "USD";
    if (kind === "fractional-cent") product.price.amount = 249.001;
    if (kind === "over-budget") {
      product.price.amount = 499;
      payload.citations[0]!.text = payload.citations[0]!.text.replace(
        "249.00",
        "499.00",
      );
      product.price.assessment.support[0]!.quote =
        product.price.assessment.support[0]!.quote.replace("249.00", "499.00");
    }
    if (kind === "missing-price") Object.assign(product, { price: null });
    if (kind === "unsupported-manufacturer") {
      product.criteria[0]!.assessment.support[0]!.quote =
        "https://sony.example.com";
      product.criteria[0]!.assessment.rationale =
        "Seller hostname is not manufacturer evidence.";
    }
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.research.choice).toBeNull();
      expect(result.research.summary).not.toMatch(/My conditional choice/);
    }
  });
  it.each([
    ["Aster Pure 30 white costs SGD99 per unit.", true],
    ["Aster Pure 30 white costs SGD99/month for 12 months.", false],
    ["Save SGD99 on SGD499 for Aster Pure 30 white.", false],
    ["Aster Pure 30 white costs SGD99 with trade-in.", false],
    ["Aster Pure 30 white costs SGD99 with a voucher.", false],
    ["Aster Pure 30 white costs SGD99 for members only.", false],
  ] as const)(
    "checks complete price context despite native eligibility claims for %s",
    async (text, eligible) => {
      const payload = syntheticAnswer();
      const product = payload.answer.products[0]!;
      payload.citations[0]!.text += `\n\n${text}`;
      product.price.amount = 99;
      product.price.conditions = [];
      product.price.conditionsResolved = true;
      product.price.assessment = syntheticAssessment("SGD99");
      product.budget = syntheticAssessment(text);
      const result = await research(payload);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(Boolean(result.research.choice)).toBe(eligible);
      if (eligible)
        expect(
          result.research.products[0]!.price?.assessment.support[0]!.quote,
        ).toBe(text);
    },
  );
  it("does not consider an unexplained eligibility condition fulfilled", async () => {
    const payload = syntheticAnswer();
    payload.answer.products[0]!.price.conditions = [
      "Requires a platinum benefit",
    ];
    payload.answer.products[0]!.price.conditionsResolved = true;
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.choice).toBeNull();
  });
  it.each([
    "unreturned-url",
    "numeric-reference",
    "rewritten-quote",
    "ambiguous-url",
    "clipped-qualifier",
  ])("keeps %s out of admitted quotation support", async (kind) => {
    const payload = syntheticAnswer();
    const product = payload.answer.products[0]!;
    const citation = product.criteria[0]!.assessment.support[0]!;
    if (kind === "unreturned-url")
      citation.url = "https://unreturned.example.com/pure";
    if (kind === "numeric-reference") citation.url = "[1]";
    if (kind === "rewritten-quote")
      citation.quote = "The prefilter is washable.";
    if (kind === "ambiguous-url")
      payload.citations.push({
        ...payload.citations[0]!,
        text: "Contradictory duplicate",
      });
    if (kind === "clipped-qualifier") {
      const prefix = "x".repeat(24000 - citation.quote.length);
      payload.citations[0]!.text =
        prefix +
        citation.quote +
        " Only the Pro variant, not the selected model.";
    }
    const result = await research(payload);
    if (kind === "ambiguous-url")
      expect(result).toMatchObject({
        status: "unavailable",
        reason: "empty",
        reportedCostUsd: 0.005,
      });
    else {
      expect(result.status).toBe("ready");
      if (result.status === "ready") {
        expect(result.research.choice).toBeNull();
        expect(
          result.research.products[0]!.criteria[0]!.assessment,
        ).toMatchObject({ status: "unknown", support: [] });
      }
    }
  });
  it.each([
    "http://reviews.example.com/pure",
    "https://127.0.0.1/private",
    "https://user:pass@reviews.example.com/pure",
    "javascript:alert(1)",
  ])("rejects unsafe citation %s", async (url) => {
    const payload = syntheticAnswer();
    payload.citations[0]!.url = url;
    expect(await research(payload)).toMatchObject({
      status: "unavailable",
      reason: "empty",
    });
  });
  it("accepts an unfamiliar product and requirement without registry edits", async () => {
    const payload = syntheticAnswer();
    const intent = syntheticIntent();
    intent.productDescription = "A reversible ceramic fermentation crock";
    intent.criteria[0]!.wording = "water-seal lid";
    const sentence =
      "The Koru Crock 2L is a ceramic fermentation crock with a water-seal lid.";
    payload.citations[0]!.text += `\n${sentence}`;
    const product = payload.answer.products[0]!;
    product.name = "Koru Crock 2L";
    product.identity = syntheticAssessment(sentence);
    product.requestMatch = syntheticAssessment(sentence);
    product.criteria[0]!.assessment = syntheticAssessment(sentence);
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.choice?.productId).toBe("aster-pure");
  });
  it("preserves exact paragraph context, sale conditions and raw source whitespace", async () => {
    const payload = syntheticAnswer();
    const quote =
      "Aster Pure 30 white costs SGD 199.00 for members only. Sale ends Friday.";
    payload.citations[0]!.text += `\n\n${quote}\n  Shipping is charged separately.\n`;
    payload.answer.products[0]!.price = {
      ...payload.answer.products[0]!.price,
      amount: 199,
      conditions: ["Members only", "Sale ends Friday", "Shipping separate"],
      conditionsResolved: false,
      assessment: syntheticAssessment(quote),
    };
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]!.price?.conditions).toEqual([
      "Members only",
      "Sale ends Friday",
      "Shipping separate",
    ]);
    expect(result.research.sources[0]!.text).toBe(payload.citations[0]!.text);
  });
});
