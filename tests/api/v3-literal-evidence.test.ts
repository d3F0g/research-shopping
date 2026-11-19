import { describe, expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { projectExaAnswer } from "../../src/server/exa-research";
import { catalogMaterial } from "../helpers/v3-catalog-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture sunglasses", budget: { minimum: 800, maximum: 1000, currency: "SGD" } };
function project(material = catalogMaterial(intent)) {
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  return result.research;
}
describe("versioned literal source evidence", () => {
  it("retains unique whitespace-aligned identity and its observed catalog amount without resolving conditions", () => {
    const snapshot = project();
    const product = snapshot.products[0]!;
    expect(snapshot).toMatchObject({ version: 2, evidenceVersion: 3, choice: null });
    expect(product.identity.status).toBe("supported");
    expect(product.identity.support[0]).toMatchObject({ origin: { kind: "provider", reportedQuote: "Fixture Meridian Sunglasses - Silver SGD 868", match: "whitespace" }, literal: { text: "Fixture Meridian Sunglasses - Silver \n\n SGD 868" } });
    expect(product.price).toMatchObject({ amount: 868, currency: "SGD", variant: "Silver", conditionsResolved: false, conditions: ["Price as listed on Fixture Index."] });
    expect(product.eligible).toBe(false);
    expect(snapshot.intent.budget).toEqual(intent.budget);
  });
  it.each(["Fixture Meridian Sunglasses — Silver SGD 868", "Fixture Meridian Sunglasses - Silver … SGD 868", "Fixture Meridian Silver SGD 868", "Fixture Meridian Sunglasses - silver SGD 868", "Fixture Meridian Sunglasses - Sil\u200bver SGD 868"])("does not repair non-whitespace changes in %s", (quote) => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.identity.support[0]!.quote = quote;
    expect(project(material).products[0]!.identity.status).toBe("unknown");
  });
  it("rejects duplicate equivalent source spans rather than selecting the first occurrence", () => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += "\n\nFixture Meridian Sunglasses - Silver SGD 868";
    expect(project(material).products[0]!.identity.status).toBe("unknown");
  });
});
