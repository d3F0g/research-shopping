import test from "node:test";
import assert from "node:assert/strict";
import { currentScenarioMaterial } from "../materials";
import { offlineNetwork } from "../../network";
import { grade } from "../assertions";
import type { Json, Scenario } from "../../frozen-v4/contracts";

const scenario: Scenario = { id: "fixture-price-projection", revision: 1, category: "evidence-honesty", title: "Fixture V5 monetary provenance projection", provider: "supported", actions: [{ kind: "message", text: "Find a powerbank under SGD40" }], expectedBehavior: ["Preserve literal price witnesses and independent attribution"], milestones: [], review: { status: "author-drafted", reference: "Explicit current V5 adapter test only" } };
test("normalized applicable price preserves separately labeled native attribution and money-witness offsets", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const observed = await observe(scenario, currentScenarioMaterial("supported", "FN-CU-001"), guard);
    const response = observed.rawTurns[0]!.response;
    if (response?.kind !== "research") throw new Error("Expected current fixture comparison");
    const raw = response.research.products[0]!.priceEvidence;
    if (raw.state !== "applicable") throw new Error("Expected applicable observed money");
    const projected = observed.turns[0]!.response!.research as Record<string, Json>;
    const price = (projected.products as Record<string, Json>[])[0]!.price as { amount: number; currency: string; selectedOccurrenceId: string; assessment: { support: { sourceId: string; quote: string; start: number; end: number; origin: { kind: string; field: string; reportedQuote: string } }[] } };
    assert.equal(price.amount, raw.usableMoney.minorUnits / 100);
    assert.equal(price.currency, raw.usableMoney.currency);
    assert.equal(price.selectedOccurrenceId, raw.selectedOccurrenceId);
    assert.deepEqual(price.assessment.support.map((span) => span.origin.field), ["price.attribution", "price.moneySupport"]);
    for (const span of price.assessment.support) {
      const sourceText: string = response.research.sources.find((entry) => entry.id === span.sourceId)!.text;
      assert.equal(sourceText.slice(span.start, span.end), span.quote);
      assert.equal(span.origin.reportedQuote, span.quote);
      assert.equal(span.origin.kind, "provider");
    }
    assert.equal(price.assessment.support[0]!.quote, raw.report!.attribution.support[0]!.quote);
    assert.equal(price.assessment.support[1]!.quote, raw.report!.moneySupport.quote);
    const checks = grade(scenario, observed);
    for (const name of ["quote-containment", "price-attribution", "native-complete-provenance"]) assert.equal(checks.find((check) => check.id === `${name}:fixture-current-0`)!.status, "pass");
    for (const mutation of ["offset", "amount", "currency", "borrowed-quote"] as const) {
      const forged = structuredClone(observed);
      const research = forged.turns[0]!.response!.research as Record<string, Json>;
      const changed = (research.products as Record<string, Json>[])[0]!.price as typeof price;
      if (mutation === "offset") changed.assessment.support[1]!.start++;
      if (mutation === "amount") changed.amount = 1;
      if (mutation === "currency") changed.currency = "USD";
      if (mutation === "borrowed-quote") changed.assessment.support[1] = { ...changed.assessment.support[0]! };
      const expected = mutation === "offset" ? "quote-containment" : "price-attribution";
      assert.equal(grade(scenario, forged).find((check) => check.id === `${expected}:fixture-current-0`)!.status, "fail", mutation);
    }
  } finally { guard.close(); }
});
test("native money whitespace remains explicit and cannot hide forged projected offsets", async () => {
  const { materialPayloadHash } = await import("../../hash");
  const input = currentScenarioMaterial("supported", "FN-CU-001");
  const native = input.body as { answer: { products: { price: { moneySupport: { quote: string } } }[] } };
  native.answer.products[0]!.price.moneySupport.quote = "SGD   35.00";
  input.sha256 = materialPayloadHash(input);
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const observed = await observe(scenario, input, guard);
    const response = observed.rawTurns[0]!.response;
    if (response?.kind !== "research") throw new Error("Expected current fixture comparison");
    const raw = response.research.products[0]!.priceEvidence;
    assert.equal(raw.state, "applicable");
    assert.equal(raw.report!.moneySupport.quote, "SGD   35.00");
    const checks = grade(scenario, observed);
    assert.equal(checks.find((check) => check.id === "quote-containment:fixture-current-0")!.status, "blocked");
    assert.equal(checks.find((check) => check.id === "native-complete-provenance:fixture-current-0")!.status, "pass");
    const forged = structuredClone(observed);
    const research = forged.turns[0]!.response!.research as Record<string, Json>;
    const price = (research.products as Record<string, Json>[])[0]!.price as { assessment: { support: { start: number }[] } };
    price.assessment.support[1]!.start++;
    assert.equal(grade(scenario, forged).find((check) => check.id === "quote-containment:fixture-current-0")!.status, "fail");
  } finally { guard.close(); }
});
