import { expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { projectExaAnswer } from "../../src/server/exa-research";
import { priceMaterial } from "../helpers/v5-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture quartz watch", budget: { maximum: 500, currency: "SGD" } };
const identity = "Fixture data. Fixture Meridian Watch Q17 steel is a quartz wristwatch with a steel case.";
it.each(["## Offer information", "## Listed selection notes", "## Terms for this listing"])("does not require a positive heading dictionary for %s", (heading) => {
  const material = priceMaterial(intent, { text: `${identity}\n\n${heading}\nPrice: SGD 437.00\nOne watch, tax included.` });
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.state).toBe("applicable");
  expect(result.research.choice?.productId).toBe("fixture-q17");
});
it("retains the actual different variant heading as a blocker with optimistic native assessments", () => {
  const material = priceMaterial(intent, { text: `${identity}\n\nQ17 resin\nSGD 437.00\nTax included.` });
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.alarms.some((alarm) => alarm.kind === "uncertain-attribution")).toBe(true);
  expect(result.research.choice).toBeNull();
});
it.each(["AX2", "T88", "z9x", "RQ-704"])("blocks an unmatched possible identifier %s without inferring its family", (identifier) => {
  const variant = `${identifier} steel`;
  const description = `Fixture data. Fixture Meridian Watch ${variant} is a quartz wristwatch with a steel case.`;
  for (const heading of [variant, `${identifier} resin`]) {
    const result = projectExaAnswer(priceMaterial(intent, { variant, text: `${description}\n\n${heading}\nSGD 437.00\nTax included.` }), intent);
    if (result.status !== "ready") throw new Error("Expected fixture comparison");
    expect(result.research.products[0]!.priceEvidence.state).toBe(heading === variant ? "applicable" : "observed");
    expect(result.research.choice !== null).toBe(heading === variant);
  }
});
it.each(["Variant: resin", "Model AX2", "For one AX2 only."])("preserves an explicit different scope marker %s", (heading) => {
  const result = projectExaAnswer(priceMaterial(intent, { text: `${identity}\n\n${heading}\nSGD 437.00\nTax included.` }), intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.alarms.some((alarm) => alarm.kind === "variant-contradiction")).toBe(true);
  expect(result.research.choice).toBeNull();
});
it.each(["| Offer information | SGD 437.00 |", "Variant: Q17 steel\nSGD 437.00"])("does not require a table-label dictionary or reject its actual marked variant: %s", (text) => {
  const result = projectExaAnswer(priceMaterial(intent, { text: `${identity}\n\n${text}\nOne watch, tax included.` }), intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.state).toBe("applicable");
});
it("masks actual monetary occurrences before looking for a possible adjacent identifier", () => {
  const material = priceMaterial(intent, { text: `${identity}\n\nPrevious amount SGD444\nPrice: SGD 437.00\nTax included.` });
  const review = material.answer.products[0]!.price.sourceReviews[0]!;
  review.moneyMentions.push({ quote: "SGD444", role: "reference", scope: "reference-only", assessment: { ...review.assessment, support: [{ url: review.url, quote: "SGD444" }] } });
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.sources[0]!.moneyOccurrences).toHaveLength(2);
  expect(result.research.products[0]!.priceEvidence.state).toBe("applicable");
});
it.each(["The item", "This watch", "The selected watch", "The model"])("does not turn an ordinary prose subject %s into a different-variant claim", (subject) => {
  const result = projectExaAnswer(priceMaterial(intent, { text: `${identity}\n\n${subject} costs SGD 437.00 for one watch, tax included.` }), intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.state).toBe("applicable");
  expect(result.research.choice?.productId).toBe("fixture-q17");
});
it.each(["Model AX2", "AX2"])("keeps a different explicit or possible model subject %s unresolved", (subject) => {
  const result = projectExaAnswer(priceMaterial(intent, { text: `${identity}\n\n${subject} costs SGD 437.00 for one watch, tax included.` }), intent);
  if (result.status !== "ready") throw new Error("Expected fixture comparison");
  expect(result.research.products[0]!.priceEvidence.state).toBe("observed");
  expect(result.research.products[0]!.priceEvidence.alarms.length).toBeGreaterThan(0);
  expect(result.research.choice).toBeNull();
});
