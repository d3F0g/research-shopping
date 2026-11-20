import type { ShoppingIntent } from "../../src/domain/conversation";
import { nativeMaterial } from "./v2-material";

export function catalogMaterial(intent: ShoppingIntent) {
  const material = nativeMaterial(intent);
  const product = material.answer.products[0]!;
  const name = "Fixture Meridian Sunglasses - Silver";
  const source = "Fixture data.\n\nOther Sunglasses - Brown \n\n SGD 419 \n\nFixture Meridian Sunglasses - Silver \n\n SGD 868 \n\nAnother Sunglasses - Blue \n\n SGD 305\n\nPromo Codes";
  const assessment = (quote: string): typeof product.identity => ({
    status: "supported", scope: "exact-variant",
    rationale: "Fixture data: a source-based AI interpretation, not verified fit.",
    support: [{ url: material.citations[0]!.url, quote }],
  });
  product.name = name;
  product.variant = "Silver";
  product.identity = assessment(`${name} SGD 868`);
  product.requestMatch = assessment("SGD 868");
  product.criteria = [];
  product.attributes = [];
  product.price = { amount: 868, currency: "SGD", variant: "Silver", moneySupport: { url: material.citations[0]!.url, quote: "SGD 868" }, attribution: assessment("SGD 868"), priceBasis: { kind: "single-item", assessment: assessment("SGD 868") },
    sourceReviews: [{ url: material.citations[0]!.url, reviewComplete: true, relation: "applies", assessment: assessment(`${name} SGD 868`),
      moneyMentions: [
        { quote: "SGD 868", role: "selected", scope: "selected-variant", assessment: assessment("SGD 868") },
        { quote: "SGD 419", role: "other-product", scope: "other-subjects", assessment: assessment("SGD 419") },
        { quote: "SGD 305", role: "other-product", scope: "other-subjects", assessment: assessment("SGD 305") },
      ], conditions: [{ quote: "Promo Codes", text: "Price as listed on Fixture Index.", interpretation: "unknown", rationale: "Fixture source has unresolved promotional context." }],
    }],
  };
  material.citations[0]!.text = source;
  return { ...material, citations: material.citations.map(({ url, title, text }) => ({ url, title, text })) };
}
