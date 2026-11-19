import { describe, expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { projectExaAnswer } from "../../src/server/exa-research";
import { catalogMaterial } from "../helpers/v3-catalog-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture sunglasses", budget: { minimum: 800, maximum: 1000, currency: "SGD" } };
function project(material: ReturnType<typeof catalogMaterial>) {
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture source observations");
  return result.research;
}
describe("V4 catalog observation without variant price authority", () => {
  it.each([
    "",
    "Fixture Other Brand Silver Navigator Sunglasses\n\nSGD 490 SGD 243 (50% off)",
    "Fixture Meridian Sunglasses -  Silver\n\nSGD 999",
    "Meridian Sunglasses - Silver Edition\n\nSGD 999",
    "New Silver colorway\n\nSGD 999",
    "Limited Silver52mm\n\nSGD 999",
    "Spring collection\n\nSGD 999",
    "Gift set\n\nSGD 999",
    "For Gold only.",
  ])("retains the literal row and every unresolved passage %j", (tail) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += tail ? `\n\n${tail}` : "";
    const snapshot = project(material);
    const product = snapshot.products[0]!;
    expect(snapshot.evidenceVersion).toBe(4);
    expect(product.price).toBeNull();
    expect(product).toMatchObject({ priceObservation: {
      kind: "catalog-row", amount: 868, currency: "SGD",
      attribution: { status: "unknown" },
      row: { origin: { kind: "source-context" }, literal: { text: "Fixture Meridian Sunglasses - Silver \n\n SGD 868 " }, context: { start: 0, end: material.citations[0]!.text.length, text: material.citations[0]!.text } },
      reportedAssessment: { status: "supported", support: [{ origin: { kind: "provider", reportedQuote: "SGD 868" } }] },
      reportedConditions: ["Price as listed on Fixture Index."], reportedConditionsResolved: false,
    } });
    expect(snapshot.choice).toBeNull();
    expect(product.eligible).toBe(false);
    expect(snapshot.sources[0]!.text).toBe(material.citations[0]!.text);
    expect(snapshot.summary).toContain("source row shows SGD 868.00");
    expect(snapshot.summary).not.toMatch(/lists .* at SGD|costs SGD/);
  });
  it.each(["SGD 868–1200", "SGD 868 SGD 500", "SGD 868 for three units"])("retains %s only as raw source text without a scalar endpoint", (line) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = material.citations[0]!.text.replace("SGD 868", line);
    const snapshot = project(material);
    expect(snapshot.products[0]).toMatchObject({ price: null, priceObservation: null });
    expect(snapshot.sources[0]!.text).toContain(line);
  });
  it("preserves the actual native adverse assessment and conditions without assigning attribution", () => {
    const material = catalogMaterial(intent);
    material.answer.products[0]!.price.assessment.status = "contradicted";
    material.answer.products[0]!.price.assessment.rationale = "Fixture provider says this amount does not apply to the chosen variant.";
    material.answer.products[0]!.price.conditions = ["Fixture provider condition: voucher required."];
    const product = project(material).products[0]!;
    expect(product.price).toBeNull();
    expect(product).toMatchObject({ priceObservation: { attribution: { status: "unknown" }, reportedAssessment: { status: "contradicted", rationale: material.answer.products[0]!.price.assessment.rationale }, reportedConditions: material.answer.products[0]!.price.conditions, reportedConditionsResolved: false } });
  });
});
