import {
  defaultIntent,
  type ShoppingIntent,
} from "../../../src/domain/contracts";
import type {
  Assessment,
  ResearchSnapshot,
} from "../../../src/domain/research";

export function syntheticComparison(
  intent: ShoppingIntent = {
    ...defaultIntent(),
    productDescription:
      "Archival slide scanner under SGD500. Must preserve edge detail.",
    budget: { amount: 500, currency: "SGD" },
    budgetClarified: true,
    criteria: [
      {
        id: "criterion-1",
        wording: "preserve edge detail",
        strength: "hard",
        origin: { kind: "message", text: "Must preserve edge detail." },
      },
    ],
  },
): ResearchSnapshot {
  const products = ["Synthetic Aster Scan", "Synthetic Orbit Scan"];
  const sources = products.map((name, index) => ({
    id: `source-${index + 1}`,
    url: `https://reviews.example.com/synthetic-scanner-${index + 1}`,
    title: `${name} automated fixture page`,
    titleTruncated: false,
    textTruncated: false,
    text: `Synthetic automated evidence only. ${name} is the 35 mm archival slide scanner variant. It preserves edge detail with a film holder. Observed fixture price SGD ${index ? 399 : 299}.00. Test fixture, not a real merchant offer.`,
  }));
  function assessment(
    index: number,
    rationale: string,
    status: Assessment["status"] = "supported",
  ): Assessment {
    const source = sources[index];
    return {
      status,
      scope: "exact-variant",
      rationale,
      support:
        status === "unknown"
          ? []
          : [
              {
                sourceId: source.id,
                start: 0,
                end: source.text.length,
                quote: source.text,
              },
            ],
    };
  }
  return {
    dataKind: "web-research",
    evidenceVersion: 5,
    retrievedAt: "2026-11-18T04:00:00.000Z",
    intent,
    summary:
      "Synthetic automated comparison. Aster has a lower observed fixture price. These are test data.",
    products: products.map((name, index) => ({
      id: `scanner-${index + 1}`,
      name,
      variant: "35 mm",
      identity: assessment(
        index,
        "Synthetic source identifies the exact 35 mm variant.",
      ),
      requestMatch: assessment(
        index,
        "Synthetic source describes an archival slide scanner for the open request.",
      ),
      criteria: intent.criteria.map((criterion) => ({
        criterionId: criterion.id,
        assessment: assessment(
          index,
          index
            ? "Edge performance is not established by this synthetic source."
            : "Synthetic source describes a film holder for edge detail.",
          index ? "unknown" : "supported",
        ),
      })),
      attributes: [
        {
          name: "Film holder",
          assessment: assessment(
            index,
            "A film holder is described in synthetic source evidence.",
          ),
        },
      ],
      price: {
        amount: index ? 399 : 299,
        currency: "SGD",
        conditions: ["Synthetic fixture only. Single unit, 35 mm variant."],
        conditionsResolved: true,
        variant: "35 mm",
        assessment: assessment(
          index,
          "Synthetic source explicitly states SGD and the variant.",
        ),
      },
      budget: intent.budget
        ? assessment(
            index,
            "Synthetic observed price is below SGD500. Current affordability unverified.",
          )
        : null,
      stock: "unverified",
    })),
    choice: {
      productId: "scanner-1",
      reasons: [
        {
          assessmentId: "criterion-1",
          explanation:
            "Aster's synthetic evidence supports the required edge-detail criterion.",
        },
      ],
      caveat:
        "Synthetic choice only. Confirm the exact variant, real price and stock with the merchant.",
    },
    sources,
    limitations: [
      "Synthetic test-authored observations. No real retrieval, product quality, price, stock or delivery established.",
    ],
    requestId: "synthetic-browser-fixture",
    reportedCostUsd: 0,
  };
}
