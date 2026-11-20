import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { initialConversation, type ShoppingIntent, type TurnResponse } from "../../src/domain/conversation";
import { projectExaAnswer } from "../../src/server/exa-research";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { priceView } from "../../src/domain/price-view";
import { priceMaterial } from "../helpers/v5-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture quartz wristwatch with a steel case", budget: { minimum: 400, maximum: 500, currency: "SGD" } };
const identity = "Fixture data. Fixture Meridian Watch Q17 steel is a quartz wristwatch with a steel case.";
const positives = [
  "Q17 steel costs SGD 437.00 for one unit, tax included.",
  "## Q17 steel\n\n| Selected model | Price | Purchase details |\n| --- | --- | --- |\n| Q17 steel | SGD 437.00 | One watch. Tax included. |\n\nNo membership or voucher is required.",
  "Choose the steel Q17 for your order. The tag reads SGD 437.00 for one watch, including tax. This is the item amount without joining a club.",
  "**Your selected option:** Q17 steel\n\n**Item price:** SGD 437.00\n\nOne watch, tax included.",
  `Fixture specifications. ${"Complete fixture description. ".repeat(190)}\n\n**Item price:** SGD 437.00. One watch, tax included.`,
];
const negatives = [
  "With a membership voucher.", "Membership required.", "Only available with membership.", "The displayed price applies only to members.", "A membership voucher is needed.", "This amount is available only after joining the annual club.",
  "Not tax included.", "Without tax included.", "Tax is excluded from the displayed amount.", "Excludes GST.", "The price above excludes tax.", "Delivery charged separately at checkout.",
  "Tax included unless a voucher is unavailable.", "The displayed price changes unless the buyer lives overseas.",
  "Minimum purchase of three units.", "For three units.", "The displayed amount is for a box of three watches.", "Per-month installments.",
  "For Q17 resin.", "For Q17 resin only.", "Price applies to Q17 resin only.", "Q17 resin variant only.",
  "Shipping SGD 15 is mandatory.", "Shipping costs SGD 15.", "Q17 steel requires SGD 15 shipping in addition to the displayed price.",
  "Q17 steel costs SGD 537.00 for one unit, tax included.",
];
function materialWith(text: string, current: ShoppingIntent = intent) {
  const material = priceMaterial(current, { text: `${identity}\n\nQ17 steel costs SGD 437.00 for one unit, tax included.\n\n${text}` });
  const review = material.answer.products[0]!.price.sourceReviews[0]!;
  for (const match of material.citations[0]!.text.matchAll(/SGD\s+(?:537\.00|15)/g)) {
    review.moneyMentions.push({ quote: match[0], role: "reference", scope: "reference-only", assessment: { ...review.assessment, support: [{ url: review.url, quote: match[0] }] } });
  }
  return material;
}
function project(material: ReturnType<typeof priceMaterial>, current: ShoppingIntent = intent) {
  const result = projectExaAnswer(material, current);
  expect(result.status).toBe("ready");
  if (result.status !== "ready") throw new Error("Expected a fixture comparison");
  return result.research;
}
describe("V5 complete ordinary prices and independent source alarms", () => {
  it.each(positives)("accepts ordinary complete source formatting %s", (text) => {
    const research = project(priceMaterial(intent, { text: `${identity}\n\n${text}` }));
    expect(research.products[0]!.priceEvidence).toMatchObject({ state: "applicable", usableMoney: { minorUnits: 43700, currency: "SGD" } });
    expect(research.choice?.productId).toBe("fixture-q17");
  });
  it.each(negatives)("blocks the source alarm even with optimistic empty conditions and favorable reference roles %s", (text) => {
    const material = materialWith(text);
    const research = project(material);
    const product = research.products[0]!;
    expect(product.priceEvidence.state).toBe("observed");
    expect(product.priceEvidence.alarms.length).toBeGreaterThan(0);
    expect(product.eligible).toBe(false);
    expect(research.choice).toBeNull();
    expect(priceView(product.priceEvidence, research.sources).text).toContain("SGD 437.00");
    expect(research.sources[0]!.text).toBe(material.citations[0]!.text);
    expect(research.intent).toEqual(intent);
  });
  it.each(negatives)("preserves the same negative through the actual research route %s", async (text) => {
    let calls = 0;
    const app = createApp({ conversations: createConversationService({ research: async ({ intent: current }) => { calls++; return projectExaAnswer(materialWith(text, current), current); }, quota: { reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) } }) });
    const first = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phase: "prepare", operationId: randomUUID(), message: "a quartz wristwatch with a steel case between SGD400 and500" }) });
    const prepared = await first.json() as TurnResponse;
    if (prepared.kind !== "prepared") throw new Error("Expected prepared request");
    const cookie = first.headers.get("set-cookie")!.split(";")[0]!;
    const response = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ phase: "research", preparedId: prepared.preparedId }) });
    const result = await response.json() as TurnResponse;
    expect(result.kind).toBe("research");
    if (result.kind !== "research") throw new Error("Expected research");
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]).toMatchObject({ eligible: false, priceEvidence: { state: "observed" } });
    expect(result.research.products[0]!.priceEvidence.alarms.length).toBeGreaterThan(0);
    expect(result.research.sources[0]!.text).toContain(text);
    expect(result.state.intent.budget).toEqual(intent.budget);
    const held = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ phase: "prepare", operationId: randomUUID(), message: "Show me more details." }) });
    expect((await held.json() as TurnResponse).kind).toBe("message");
    expect(calls).toBe(1);
  });
  it.each(["Q17 steel", "Lumen 7.2 (warm)", "Rook [wide] + amber"])("keeps arbitrary selected variant %s usable", (variant) => {
    const material = priceMaterial(intent, { variant });
    const research = project(material);
    expect(research.choice?.productId).toBe("fixture-q17");
    expect(research.products[0]!.priceEvidence).toMatchObject({ state: "applicable", variant });
  });
  it.each([399.99, 400, 500, 500.01])("enforces exact inclusive integer bounds for %s", (amount) => {
    const quote = `SGD ${amount.toFixed(2)}`;
    const research = project(priceMaterial(intent, { amount, quote, text: `${identity}\n\nItem price ${quote}. One watch, tax included.` }));
    expect(research.products[0]!.priceEvidence.state).toBe("applicable");
    expect(research.products[0]!.eligible).toBe(amount >= 400 && amount <= 500);
    expect(research.intent.budget).toEqual(intent.budget);
  });
  it.each(["SGD 437.00 to SGD 537.00", "SGD 437.00–537.00", "SGD 437.00 for Q17 resin only", "| Q17 resin | SGD 437.00 | One watch |", "Q17 resin\nSGD 437.00\nTax included."])("keeps contradictory scalar, row and variant context %s", (text) => {
    const research = project(priceMaterial(intent, { text: `${identity}\n\n${text}` }));
    expect(research.choice).toBeNull();
    expect(research.products[0]!.priceEvidence.alarms.length).toBeGreaterThan(0);
  });
  it("does not borrow currency from another row to repair a bare dollar monetary witness", () => {
    const material = priceMaterial(intent, { text: `${identity}\n\nPrice: 437 SGD.\n\nNow $437.`, quote: "Now $437" });
    const research = project(material);
    expect(research.products[0]!.priceEvidence).toMatchObject({ state: "observed", blockers: expect.arrayContaining(["ambiguous-currency"]) });
    expect(research.choice).toBeNull();
    expect(research.sources[0]!.moneyOccurrences).toHaveLength(2);
  });
  it("preserves a literal amount when cut, discarded or unreviewed sources prevent applicability", () => {
    const material = priceMaterial(intent);
    material.citations[0]!.text += "\n\n" + "Fixture paragraph. ".repeat(1500) + "\n\nThe price excludes tax.";
    const research = project(material);
    expect(research.sources[0]!.textTruncated).toBe(true);
    expect(research.sources[0]!.originalLength).toBe(material.citations[0]!.text.length);
    expect(research.products[0]!.priceEvidence).toMatchObject({ state: "observed", blockers: expect.arrayContaining(["source-context-incomplete"]) });
    expect(research.choice).toBeNull();
  });
});
