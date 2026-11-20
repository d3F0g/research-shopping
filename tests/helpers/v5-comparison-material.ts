import type { ShoppingIntent } from "../../src/domain/conversation";
import { priceMaterial } from "./v5-material";

export function comparisonMaterial(intent: ShoppingIntent, adverse = false) {
  const options = [
    { variant: "Q17 steel", amount: 437 },
    { variant: "Nacre 4 brushed", amount: 457 },
    { variant: "Rook [wide] + amber", amount: 487 },
  ];
  const materials = options.map(({ variant, amount }, index) => {
    const name = `Fixture Meridian Watch ${variant}`, quote = `SGD ${amount}.00`;
    const identity = `Fixture data. ${name} is a quartz wristwatch with a steel case.`;
    const text = index === 1 ? `${identity}\n\nFor this selected watch, the item price is ${quote}. One watch, tax included. No membership or voucher is required.` : `${identity}\n\n| Selected model | Price | Purchase details |\n| --- | --- | --- |\n| ${variant} | ${quote} | One watch. Tax included. |\n\nNo membership or voucher is required.`;
    const material = priceMaterial(intent, { variant, amount, quote, text });
    const original = material.citations[0]!.url, url = `https://example.com/fixture-watch-${index}`;
    return JSON.parse(JSON.stringify(material).replaceAll(original, url)) as ReturnType<typeof priceMaterial>;
  });
  const citations = materials.flatMap((material) => material.citations);
  if (adverse) citations[2]!.text += "\n\nThis amount is available only after joining the annual club.";
  const products = materials.map((material, index) => {
    const product = material.answer.products[0]!;
    product.id = `fixture-watch-${index}`;
    product.price.sourceReviews = citations.map((source, sourceIndex) => {
      const quote = `SGD ${options[sourceIndex]!.amount}.00`;
      const assessment = { ...product.identity, support: [{ url: source.url, quote: source.text.split("\n\n")[0]! }] };
      return { url: source.url, reviewComplete: true, relation: sourceIndex === index ? "applies" : "other-product-or-topic", assessment,
        moneyMentions: [{ quote, role: sourceIndex === index ? "selected" : "other-product", scope: sourceIndex === index ? "selected-variant" : "other-subjects", assessment: { ...assessment, support: [{ url: source.url, quote }] } }], conditions: [],
      };
    });
    return product;
  });
  return { ...materials[0]!, answer: { ...materials[0]!.answer, products, choice: { productId: products[0]!.id } }, citations };
}
