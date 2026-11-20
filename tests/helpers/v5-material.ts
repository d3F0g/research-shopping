import type { ShoppingIntent } from "../../src/domain/conversation";

export function priceMaterial(intent: ShoppingIntent, options: { text?: string; quote?: string; variant?: string; amount?: number; currency?: string } = {}) {
  const variant = options.variant ?? "Q17 steel";
  const name = `Fixture Meridian Watch ${variant}`;
  const identity = `Fixture data. ${name} is a quartz wristwatch with a steel case.`;
  const text = options.text ?? `${identity}\n\n| Selected model | Price | Purchase details |\n| --- | --- | --- |\n| ${variant} | SGD 437.00 | One watch. Tax included. |\n\nNo membership or voucher is required.`;
  const quote = options.quote ?? "SGD 437.00";
  const url = "https://fixture-manufacturer.example/watch-q17";
  const assessment = { status: "supported", scope: "exact-variant", rationale: "Fixture data. Source-based AI interpretation of the cited passage.", support: [{ url, quote: identity }] };
  const priceAssessment = { ...assessment, support: [{ url, quote }] };
  return {
    answer: {
      answerVersion: 2,
      products: [{ id: "fixture-q17", name, variant, identity: assessment, requestMatch: assessment,
        criteria: intent.requirements.map((r) => ({ criterionId: r.id, assessment })), attributes: [{ name: "Case", assessment }],
        price: { amount: options.amount ?? 437, currency: options.currency ?? "SGD", variant,
          moneySupport: { url, quote }, attribution: priceAssessment,
          priceBasis: { kind: "single-item", assessment: priceAssessment },
          sourceReviews: [{ url, reviewComplete: true, relation: "applies", assessment: priceAssessment,
            moneyMentions: [{ quote, role: "selected", assessment: priceAssessment }], conditions: [] }],
        },
      }],
      choice: { productId: "fixture-q17" }, limitations: ["Fixture data only. No live research or merchant verification."],
    },
    citations: [{ url, title: "Fixture data watch page", text }], requestId: "fixture-price-v5", costDollars: { total: 0.005 },
  };
}
