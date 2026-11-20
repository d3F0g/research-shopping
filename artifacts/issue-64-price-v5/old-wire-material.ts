import type { ShoppingIntent } from "../../src/domain/conversation";
export function nativeMaterial(intent: ShoppingIntent) {
  const source =
    "Fixture data: Fixture Powerbank Model A is a USB-C powerbank, 10000 mAh, with up to 12 hours battery life. Model A costs SGD 35 for one unit, tax included.";
  const support = [{ url: "https://manufacturer.com/model-a", quote: source }];
  const assessment = {
    status: "supported",
    scope: "exact-variant",
    rationale:
      "Fixture data: the cited Model A passage supports this assessment.",
    support,
  };
  return {
    answer: {
      products: [
        {
          id: "model-a",
          name: "Fixture Powerbank Model A",
          variant: "Model A",
          identity: assessment,
          requestMatch: assessment,
          criteria: intent.requirements.map((r) => ({
            criterionId: r.id,
            assessment,
          })),
          attributes: [{ name: "Battery life", assessment }],
          price: {
            amount: 35,
            currency: "SGD",
            variant: "Model A",
            conditions: ["tax included"],
            conditionsResolved: true,
            assessment,
          },
        },
      ],
      choice: { productId: "model-a" },
      limitations: [
        "Fixture data only. No live research or merchant verification.",
      ],
    },
    citations: [
      {
        url: support[0]!.url,
        title: "Fixture data model page",
        text: source,
        image: "https://manufacturer.com/model-a.png",
      },
    ],
    costDollars: { total: 0.005 },
    requestId: "fixture-request",
  };
}
