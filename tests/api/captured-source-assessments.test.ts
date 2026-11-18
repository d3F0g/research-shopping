import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import captures from "../fixtures/research-corpus/native-alignment/captured-fields.json";
import categoryCaptures from "../fixtures/research-corpus/existing-category-captures.json";
import {
  syntheticAnswer,
  syntheticAssessment,
  syntheticIntent,
} from "../fixtures/dynamic-research";
import { research } from "../helpers/local-exa";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
describe("test-authored answer assessments over unchanged captured source fields", () => {
  it("retains original native and source hashes without relabeling synthesis as a quote", async () => {
    const raw = captures.fields.results[2]!;
    const text = raw.highlights[0]!.text;
    expect(raw.highlights[0]!.truncated).toBe(false);
    expect(digest(text)).toBe(raw.highlights[0]!.sha256);
    expect(digest(captures.fields.native.text)).toBe(
      captures.fields.native.sha256,
    );
    const heading = text.split("\n")[0]!;
    const priceBlock = text.slice(text.indexOf("S$ 349"), text.indexOf("..."));
    const payload = syntheticAnswer();
    const product = payload.answer.products[0]!;
    payload.citations = [{ url: raw.url.text, title: raw.title.text, text }];
    product.name = "Sennheiser MOMENTUM 4 Wireless";
    product.variant = "Teal (800073)";
    product.identity = syntheticAssessment(heading, raw.url.text);
    product.requestMatch = syntheticAssessment(heading, raw.url.text);
    product.criteria = [];
    product.attributes = [
      {
        name: "Battery",
        assessment: syntheticAssessment(
          "You get up to 60 hours of playback on a full charge, making them ideal for long journeys or all-day listening sessions.",
          raw.url.text,
          "The page claims up to 60 hours; the test conditions are not specified.",
        ),
      },
      {
        name: "Sound quality",
        assessment: {
          ...syntheticAssessment(
            "",
            raw.url.text,
            "Driver size and marketing language do not establish measured sound quality.",
          ),
          status: "unknown",
          scope: "unclear",
          support: [],
        },
      },
    ];
    product.price = {
      amount: 349,
      currency: "SGD",
      variant: product.variant,
      conditions: [
        "Sale price",
        "Was S$499",
        "Shipping and tax treatment not established",
      ],
      conditionsResolved: false,
      assessment: syntheticAssessment(priceBlock, raw.url.text),
    };
    product.budget = {
      ...syntheticAssessment(
        "",
        raw.url.text,
        "The total price and sale applicability are not established.",
      ),
      status: "unknown",
      scope: "unclear",
      support: [],
    };
    payload.answer.limitations = [
      "TEST-AUTHORED extraction over unchanged captured source fields. This is not a genuine answer response or a semantic-model evaluation.",
    ];
    const intent = syntheticIntent();
    intent.criteria = [];
    intent.productDescription =
      "Headphones for music under SGD400. Compare sound quality and battery life.";
    intent.budget.amount = 400;
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.sources[0]!.text).toBe(text);
    expect(result.research.products[0]!.identity.support[0]!.quote).toBe(
      heading,
    );
    expect(
      result.research.products[0]!.price?.assessment.support[0]!.quote,
    ).toContain(priceBlock);
    expect(result.research.products[0]!.price?.conditionsResolved).toBe(false);
    expect(
      result.research.products[0]!.attributes[0]!.assessment.support[0]!.quote,
    ).toContain("up to 60 hours");
    expect(result.research.products[0]!.attributes[1]!.assessment.status).toBe(
      "unknown",
    );
    expect(result.research.choice).toBeNull();
  });
  it("rejects a nonliteral original native quotation while preserving the real source context", async () => {
    const raw = captures.fields.results[0]!;
    const text = raw.highlights[0]!.text;
    const native = JSON.parse(captures.fields.native.text).observations[0];
    expect(text).not.toContain(native.quotedFacts[0]);
    const payload = syntheticAnswer();
    const product = payload.answer.products[0]!;
    payload.citations = [{ url: raw.url.text, title: raw.title.text, text }];
    product.criteria[0]!.assessment = syntheticAssessment(
      native.quotedFacts[0],
      raw.url.text,
    );
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products[0]!.criteria[0]!.assessment).toMatchObject({
      status: "unknown",
      support: [],
    });
    expect(result.research.sources[0]!.text).toBe(text);
  });
  it.each(categoryCaptures)(
    "keeps $name source identity usable without a category parser",
    async (capture) => {
      expect(digest(capture.quote)).toBe(capture.contentSha256);
      const payload = syntheticAnswer();
      const product = payload.answer.products[0]!;
      payload.citations = [
        { url: capture.url, title: capture.name, text: capture.quote },
      ];
      product.name = capture.name;
      product.identity = syntheticAssessment(capture.quote, capture.url);
      product.requestMatch = syntheticAssessment(capture.quote, capture.url);
      const result = await research(payload);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.products[0]!.identity).toMatchObject({
        status: "supported",
        support: [{ quote: capture.quote }],
      });
      expect(result.research.products[0]!.price).toBeNull();
      expect(result.research.choice).toBeNull();
    },
  );
});
