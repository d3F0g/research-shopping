import type { ShoppingIntent } from "../../src/domain/conversation";
import { nativeMaterial } from "./v2-material";

export function catalogMaterial(intent: ShoppingIntent) {
  const material = nativeMaterial(intent);
  const product = material.answer.products[0]!;
  const name = "Fixture Meridian Sunglasses - Silver";
  const source = "Fixture data.\n\nOther Sunglasses - Brown \n\n SGD 419 \n\nFixture Meridian Sunglasses - Silver \n\n SGD 868 \n\nAnother Sunglasses - Blue \n\n SGD 305\n\nPromo Codes";
  const assessment = (quote: string) => ({
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
  product.price = { amount: 868, currency: "SGD", variant: "Silver", conditions: ["Price as listed on Fixture Index."], conditionsResolved: false, assessment: assessment("SGD 868") };
  material.citations[0]!.text = source;
  return material;
}
