import { describe, expect, it } from "vitest";
import { ResearchSnapshotSchema } from "../../src/domain/research";
import type { ShoppingIntent } from "../../src/domain/contracts";
import {
  syntheticAnswer,
  syntheticAssessment,
  syntheticIntent,
} from "../fixtures/dynamic-research";
import { research } from "../helpers/local-exa";

function comparison(coverage: number[][]) {
  const payload = syntheticAnswer();
  const intent: ShoppingIntent = syntheticIntent();
  intent.criteria.push(
    ...[2, 3, 4].map((index) => ({
      id: `criterion-${index}`,
      wording: ["quiet operation", "low power", "small footprint"][index - 2]!,
      strength: "flexible" as const,
      origin: {
        kind: "message" as const,
        text: "Prefer quiet operation, low power and small footprint.",
      },
    })),
  );
  payload.answer.products = coverage.map((ids, index) => {
    const product = structuredClone(syntheticAnswer().answer.products[0]!);
    product.id = `candidate-${index + 1}`;
    product.name = `Synthetic candidate ${index + 1}`;
    product.criteria.push(
      ...intent.criteria.slice(1).map((criterion) => {
        const quote = `${product.name} white offers ${criterion.wording}.`;
        payload.citations[0]!.text += `\n${quote}`;
        const assessment = syntheticAssessment(
          quote,
          undefined,
          `The source supports ${criterion.wording}.`,
        );
        if (!ids.includes(Number(criterion.id.slice(10)))) {
          assessment.status = "unknown";
          assessment.support = [];
          assessment.rationale = `The source does not establish ${criterion.wording}.`;
        }
        return { criterionId: criterion.id, assessment };
      }),
    );
    return product;
  });
  payload.answer.choice = null;
  return { payload, intent };
}

describe("server-owned evidence coverage", () => {
  it("derives a sole eligible choice when the native hint is absent", async () => {
    const payload = syntheticAnswer();
    payload.answer.choice = null;
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice?.productId).toBe("aster-pure");
    expect(result.research.summary).toContain(
      "conditional choice is Aster Pure 30",
    );
  });

  it.each([false, true])(
    "ranks a strict superset ahead of a weaker hinted product, reversed=%s",
    async (reversed) => {
      const { payload, intent } = comparison([[2], [2, 3]]);
      payload.answer.choice = {
        productId: "candidate-1",
        reasons: [{ kind: "field", name: "identity" }],
      };
      if (reversed) payload.answer.products.reverse();
      const result = await research(payload, intent);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.products.map((product) => product.id)).toEqual([
        "candidate-2",
        "candidate-1",
      ]);
      expect(result.research.choice?.productId).toBe("candidate-2");
      expect(
        result.research.choice?.reasons.map((reason) => reason.assessmentId),
      ).toEqual(expect.arrayContaining(["criterion-2", "criterion-3"]));
      expect(result.research.summary).toContain(
        "conditional choice is Synthetic candidate 2",
      );
      expect(result.research.products[0]!.explanation).toMatchObject({
        reasons: expect.arrayContaining(["criterion-2", "criterion-3"]),
        tradeoffs: ["criterion-4"],
      });
    },
  );

  it("constructs nondominated tiers when an incomparable product separates a subset and superset", async () => {
    const { payload, intent } = comparison([[2], [4], [2, 3]]);
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products.map((product) => product.id)).toEqual([
      "candidate-2",
      "candidate-3",
      "candidate-1",
    ]);
    expect(result.research.choice).toBeNull();
    expect(result.research.summary).toMatch(/tied|incomplete/i);
    expect(result.research.summary).not.toContain(
      "could not establish an option",
    );
  });

  it.each(
    [
      [[2], [3]],
      [[2], [2]],
      [[2, 3], [4]],
    ].map((coverage) => ({ coverage })),
  )(
    "does not invent preference weights for $coverage",
    async ({ coverage }) => {
      const { payload, intent } = comparison(coverage);
      const result = await research(payload, intent);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice).toBeNull();
      expect(result.research.products.map((product) => product.id)).toEqual([
        "candidate-1",
        "candidate-2",
      ]);
    },
  );

  it("permits a valid hint only within the strongest eligible tier", async () => {
    const { payload, intent } = comparison([[2], [3], []]);
    payload.answer.choice = {
      productId: "candidate-2",
      reasons: [{ kind: "criterion", criterionId: "criterion-3" }],
    };
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.choice).toMatchObject({
        productId: "candidate-2",
        reasons: [{ assessmentId: "criterion-3" }],
      });
    payload.answer.choice.productId = "candidate-3";
    payload.answer.choice.reasons = [{ kind: "field", name: "identity" }];
    const lower = await research(payload, intent);
    expect(lower.status).toBe("ready");
    if (lower.status === "ready") expect(lower.research.choice).toBeNull();
  });

  it.each([
    "unknown",
    "conflict",
    "contradicted",
    "product-family",
    "unclear",
  ] as const)("gives no positive preference credit to %s", async (kind) => {
    const { payload, intent } = comparison([[2], [2, 3]]);
    const assessment = payload.answer.products[1]!.criteria[2]!.assessment;
    if (kind === "product-family" || kind === "unclear")
      assessment.scope = kind;
    else {
      assessment.status = kind;
      if (kind === "unknown") assessment.support = [];
      if (kind === "conflict") {
        const quote = "Synthetic candidate 2 white does not offer low power.";
        payload.citations[0]!.text += `\n${quote}`;
        assessment.support.push({ url: payload.citations[0]!.url, quote });
      }
    }
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice).toBeNull();
    expect(result.research.products[1]!.explanation?.reasons).not.toContain(
      "criterion-3",
    );
    expect(result.research.products[1]!.explanation?.tradeoffs).toContain(
      "criterion-3",
    );
  });

  it("orders hard-eligible candidates before stronger flexible coverage and exact relevance before unresolved relevance", async () => {
    const { payload, intent } = comparison([[2, 3, 4], [], [2]]);
    payload.answer.products[0]!.criteria[0]!.assessment.status = "unknown";
    payload.answer.products[0]!.criteria[0]!.assessment.support = [];
    payload.answer.products[2]!.requestMatch.status = "unknown";
    payload.answer.products[2]!.requestMatch.support = [];
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products.map((product) => product.id)).toEqual([
      "candidate-2",
      "candidate-1",
      "candidate-3",
    ]);
    expect(result.research.choice?.productId).toBe("candidate-2");
  });

  it("does not reward additional attributes or repeated supporting passages", async () => {
    const { payload, intent } = comparison([[2], [2, 3]]);
    const weaker = payload.answer.products[0]!;
    weaker.attributes = ["Extra A", "Extra B", "Extra C", "Extra D"].map(
      (name) => ({ name, assessment: structuredClone(weaker.identity) }),
    );
    weaker.criteria[1]!.assessment.support.push(
      ...weaker.criteria[1]!.assessment.support,
    );
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status === "ready")
      expect(result.research.choice?.productId).toBe("candidate-2");
  });

  it.each(["minimum", "maximum", "currency", "conditions", "variant"])(
    "retains the %s price gate without a positive qualifying-price reason",
    async (kind) => {
      const { payload, intent } = comparison([[2]]);
      const price = payload.answer.products[0]!.price;
      if (kind === "minimum")
        intent.budget = { amount: 400, minimum: 300, currency: "SGD" };
      if (kind === "maximum") intent.budget = { amount: 200, currency: "SGD" };
      if (kind === "currency") intent.budget = { amount: 300, currency: "USD" };
      if (kind === "conditions") price.conditionsResolved = false;
      if (kind === "variant") price.variant = "different variant";
      const result = await research(payload, intent);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice).toBeNull();
      expect(result.research.products[0]!.explanation?.reasons).not.toContain(
        "price",
      );
      expect(result.research.summary).toContain(
        "could not establish an option",
      );
      result.research.products[0]!.explanation!.reasons.push("price");
      expect(ResearchSnapshotSchema.safeParse(result.research).success).toBe(
        false,
      );
    },
  );

  it.each(["conditions", "variant"])(
    "refuses an inapplicable native price reason with no budget for %s",
    async (kind) => {
      const { payload, intent } = comparison([[2]]);
      intent.budget = null;
      const price = payload.answer.products[0]!.price;
      if (kind === "conditions") price.conditionsResolved = false;
      else price.variant = "another variant";
      payload.answer.choice = {
        productId: "candidate-1",
        reasons: [{ kind: "field", name: "price" }],
      };
      const result = await research(payload, intent);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice).toBeNull();
      expect(result.research.products[0]!.explanation?.reasons).not.toContain(
        "price",
      );
      const snapshot = structuredClone(result.research);
      snapshot.choice = {
        productId: "candidate-1",
        reasons: [
          {
            assessmentId: "price",
            explanation: "An inapplicable price cannot justify this choice.",
          },
        ],
        caveat: "Synthetic test.",
      };
      expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
    },
  );

  it.each(["missing-product", "unresolved", "unsupported"])(
    "does not revive a %s native hint with a local winner",
    async (kind) => {
      const { payload, intent } = comparison([[2], [2, 3]]);
      payload.answer.choice = {
        productId: kind === "missing-product" ? "missing" : "candidate-1",
        reasons: [
          {
            kind: "criterion",
            criterionId:
              kind === "unresolved" ? "criterion-unknown" : "criterion-3",
          },
        ],
      };
      const result = await research(payload, intent);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice).toBeNull();
      expect(result.research.summary).not.toContain(
        "could not establish an option",
      );
    },
  );

  it("validates explanation references and their assessment status and scope", async () => {
    const { payload, intent } = comparison([[2]]);
    const result = await research(payload, intent);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products[0]!.explanation).toBeDefined();
    for (const explanation of [
      { reasons: ["missing"], tradeoffs: [] },
      { reasons: ["criterion-3"], tradeoffs: [] },
      { reasons: [], tradeoffs: ["criterion-2"] },
      { reasons: [], tradeoffs: ["missing"] },
    ]) {
      const snapshot = structuredClone(result.research);
      snapshot.products[0]!.explanation = explanation;
      expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(false);
    }
  });
});
