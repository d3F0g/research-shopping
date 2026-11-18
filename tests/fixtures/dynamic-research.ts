import { defaultIntent } from "../../src/domain/contracts";

export const syntheticIntent = () => ({
  ...defaultIntent(), productDescription: "A quiet H13 air purifier under SGD300. Must have washable prefilter.",
  budget: { amount: 300, currency: "SGD" as const }, budgetClarified: true,
  criteria: [{ id: "criterion-1", wording: "washable prefilter", strength: "hard" as const, origin: { kind: "message" as const, text: "Must have washable prefilter." } }],
});
export const syntheticAssessment = (quote: string, url = "https://reviews.example.com/aster-pure", rationale = "The page describes the selected Aster Pure 30 variant.") => ({
  status: "supported" as "supported" | "unknown" | "contradicted" | "conflict", rationale,
  scope: "exact-variant" as "exact-variant" | "product-family" | "unclear", support: [{ url, quote }],
});
export function syntheticAnswer() {
  const identity = "Aster Pure 30 white is an H13 air purifier for rooms up to 30 square metres.";
  const filter = "Aster Pure 30 white has a washable prefilter.";
  const price = "Aster Pure 30 white is listed at SGD 249.00, including tax, for one unit.";
  return {
    requestId: "synthetic-answer-fixture", costDollars: { total: 0.005 },
    citations: [{ url: "https://reviews.example.com/aster-pure", title: "Synthetic fixture. Aster Pure 30", text: `${identity}\n${filter}\n${price}` }],
    answer: {
      products: [{
        id: "aster-pure", name: "Aster Pure 30", variant: "white",
        identity: syntheticAssessment(identity), requestMatch: syntheticAssessment(identity, undefined, "The H13 purifier is sized for the requested room."),
        criteria: [{ criterionId: "criterion-1", assessment: syntheticAssessment(filter, undefined, "The washable prefilter meets this requirement.") }],
        attributes: [{ name: "Room size", assessment: syntheticAssessment(identity, undefined, "Its stated coverage is up to 30 square metres; actual conditions may differ.") }],
        price: { amount: 249, currency: "SGD" as "SGD" | "USD", conditions: ["One unit", "Tax included"], conditionsResolved: true, variant: "white", assessment: syntheticAssessment(price) },
        budget: syntheticAssessment(price, undefined, "The observed SGD 249 fits the SGD 300 limit, before any unlisted delivery fees."),
      }],
      choice: { productId: "aster-pure", reasonIds: ["criterion-1", "budget"] } as { productId: string; reasonIds: string[] } | null,
      limitations: ["Synthetic provider extraction for automated tests. No live product or price claim."],
    },
  };
}
