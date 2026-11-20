import type { z } from "zod";
import type { NativeAnswerSchema } from "../../src/server/exa-research";
import type { ShoppingIntent } from "../../src/domain/conversation";
type Answer = z.infer<typeof NativeAnswerSchema>;
type Product = Omit<Answer["products"][number], "price"> & { price: NonNullable<Answer["products"][number]["price"]> };
export type NativeFixture = { answer: Omit<Answer, "products" | "choice"> & { products: Product[]; choice: NonNullable<Answer["choice"]> }; citations: { url: string; title: string; text: string; image: string }[]; costDollars: { total: number }; requestId: string };
export function nativeMaterial(intent: ShoppingIntent): NativeFixture {
  const source =
    "Fixture data: Fixture Powerbank Model A is a USB-C powerbank, 10000 mAh, with up to 12 hours battery life. Model A costs SGD 35 for one unit, tax included.";
  const support = [{ url: "https://manufacturer.com/model-a", quote: source }];
  const assessment: Product["identity"] = {
    status: "supported",
    scope: "exact-variant",
    rationale:
      "Fixture data: the cited Model A passage supports this assessment.",
    support,
  };
  return {
    answer: {
      answerVersion: 2,
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
            moneySupport: support[0]!,
            attribution: assessment,
            priceBasis: { kind: "single-item", assessment },
            sourceReviews: [{ url: support[0]!.url, reviewComplete: true, relation: "applies", assessment,
              moneyMentions: [{ quote: source, role: "selected", scope: "selected-variant", assessment }],
              conditions: [{ quote: "tax included", text: "tax included", interpretation: "included-in-amount", rationale: "Fixture source includes tax in the amount." }],
            }],
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
