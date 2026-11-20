import { describe, expect, it } from "vitest";
import { initialConversation } from "../../src/domain/conversation";
import { ResearchSnapshotSchema } from "../../src/domain/research";
import { projectExaAnswer } from "../../src/server/exa-research";
import { priceView } from "../../src/domain/price-view";
import { catalogMaterial } from "../helpers/v3-catalog-material";

const intent = { ...initialConversation().intent, productDescription: "Fixture sunglasses", budget: { minimum: 800, maximum: 1000, currency: "SGD" } };
function project(material: ReturnType<typeof catalogMaterial>) {
  const result = projectExaAnswer(material, intent);
  if (result.status !== "ready") throw new Error("Expected fixture source observations");
  return result.research;
}
describe("V5 retained catalog observations without applicability", () => {
  it.each(["", "Fixture Other Brand Silver Navigator Sunglasses\n\nSGD 490 SGD 243 (50% off)", "Fixture Meridian Sunglasses -  Silver\n\nSGD 999", "Meridian Sunglasses - Silver Edition\n\nSGD 999", "New Silver colorway\n\nSGD 999", "Limited Silver52mm\n\nSGD 999", "Spring collection\n\nSGD 999", "Gift set\n\nSGD 999", "For Gold only."])("retains literal money and every unresolved passage %j", (tail) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text += tail ? `\n\n${tail}` : "";
    const snapshot = project(material), product = snapshot.products[0]!;
    expect(snapshot.evidenceVersion).toBe(5);
    expect(product.priceEvidence.state).toBe("observed");
    expect(priceView(product.priceEvidence, snapshot.sources).label).toBe("SGD 868.00");
    expect(product.priceEvidence.report!.sourceReviews[0]!.conditions[0]!.text).toBe("Price as listed on Fixture Index.");
    expect(snapshot.choice).toBeNull();
    expect(product.eligible).toBe(false);
    expect(snapshot.sources[0]!.text).toBe(material.citations[0]!.text);
    expect(snapshot.summary).toContain("SGD 868.00, observed and unverified");
    expect(snapshot.summary).not.toMatch(/lists .* at SGD|costs SGD/);
  });
  it.each(["SGD 868–1200", "SGD 868 SGD 500", "SGD 868 for three units"])("keeps %s unresolved without authorizing an endpoint", (line) => {
    const material = catalogMaterial(intent);
    material.citations[0]!.text = material.citations[0]!.text.replace("SGD 868", line);
    const snapshot = project(material);
    expect(snapshot.products[0]!.priceEvidence.state).not.toBe("applicable");
    expect(snapshot.choice).toBeNull();
    expect(snapshot.sources[0]!.text).toContain(line);
  });
  it("preserves actual native adverse assessment and conditions", () => {
    const material = catalogMaterial(intent), report = material.answer.products[0]!.price;
    report.attribution.status = "contradicted";
    report.attribution.rationale = "Fixture provider says this amount does not apply to the chosen variant.";
    report.sourceReviews[0]!.conditions[0]!.text = "Fixture provider condition: voucher required.";
    const price = project(material).products[0]!.priceEvidence;
    expect(price.state).toBe("observed");
    expect(price.report!.attribution).toMatchObject({ status: "contradicted", rationale: report.attribution.rationale });
    expect(price.report!.sourceReviews[0]!.conditions[0]!.text).toBe(report.sourceReviews[0]!.conditions[0]!.text);
  });
  it("rejects forged observations, authority, origins and spans at the current boundary", () => {
    const snapshot = project(catalogMaterial(intent));
    const mutations = [
      (value: typeof snapshot) => { Object.assign(value.products[0]!.priceEvidence, { state: "applicable", selectedOccurrenceId: value.products[0]!.priceEvidence.observations[0], usableMoney: { minorUnits: 86800, currency: "SGD" }, variant: "Silver", basis: "source-based-ai-observation", merchantVerified: false }); },
      (value: typeof snapshot) => { value.sources[0]!.moneyOccurrences[1]!.amountSpan.start++; },
      (value: typeof snapshot) => { Object.assign(value.sources[0]!.moneyOccurrences[1]!.value, { minorUnits: 99900 }); },
      (value: typeof snapshot) => { Object.assign(value.sources[0]!.moneyOccurrences[1]!.value, { currency: "USD" }); },
      (value: typeof snapshot) => { value.products[0]!.priceEvidence.observations[0] = "stale-occurrence"; },
      (value: typeof snapshot) => { value.products[0]!.priceEvidence.moneySupport!.start++; },
      (value: typeof snapshot) => { value.products[0]!.priceEvidence.reviews = []; },
      (value: typeof snapshot) => { value.products[0]!.identity.support[0]!.origin = { kind: "provider", reportedQuote: "Fixture invented quotation", match: "literal" }; },
    ];
    expect(ResearchSnapshotSchema.safeParse(snapshot).success).toBe(true);
    for (const mutate of mutations) { const value = structuredClone(snapshot); mutate(value); expect(ResearchSnapshotSchema.safeParse(value).success).toBe(false); }
  });
  it("retains source restrictions in free detail replies without changing history", async () => {
    const { reduceTurn } = await import("../../src/domain/turn-reducer");
    const { randomUUID } = await import("node:crypto");
    const material = catalogMaterial(intent);
    material.citations[0]!.text += "\n\nNew Silver colorway\n\nSGD 999\n\nFor Gold only.";
    const research = project(material);
    const state = { ...initialConversation(), intent, messages: [{ id: "fixture-v5", role: "assistant" as const, text: research.summary, research }] };
    const result = reduceTurn(state, { phase: "prepare", operationId: randomUUID(), message: "Show me more details." });
    expect(result.kind).toBe("message");
    const reply = result.state.messages.at(-1)!;
    expect(reply.text + reply.detail).toContain("SGD 868.00");
    expect(reply.text + reply.detail).toContain("For Gold only.");
    expect(result.state.messages[0]).toEqual(state.messages[0]);
    expect(result.state.messages[0]!.research!.sources[0]!.text).toContain("SGD 999");
  });
});
