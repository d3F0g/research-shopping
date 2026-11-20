import type { ConversationState, RenderableResearch, TurnResponse } from "../../src/domain/conversation";
import type { Intent, Json } from "../frozen-v4/contracts";

type CurrentProduct = Extract<RenderableResearch, { evidenceVersion: 5 }>["products"][number];
function projectCurrentPrice(price: CurrentProduct["priceEvidence"]): Json {
  if (price.state !== "applicable") return null;
  if (!price.report || !price.moneySupport) throw new Error("Applicable V5 money requires its native report and bound monetary witness");
  const report = price.report;
  const attribution = report.attribution.support.map((claim, index) => {
    const bound = price.attributionSupport[index];
    if (!bound || bound.sourceId !== claim.sourceId) throw new Error("V5 attribution has no matching bound native quotation");
    return { ...bound, quote: claim.quote, origin: { kind: "provider", field: "price.attribution", reportedQuote: claim.quote } };
  });
  const money = { ...price.moneySupport, quote: report.moneySupport.quote, origin: { kind: "provider", field: "price.moneySupport", reportedQuote: report.moneySupport.quote } };
  return { amount: price.usableMoney.minorUnits / 100, currency: price.usableMoney.currency, variant: price.variant, selectedOccurrenceId: price.selectedOccurrenceId, conditionsResolved: true, conditions: report.sourceReviews.flatMap((review) => review.conditions.map((condition) => condition.text)), assessment: { ...report.attribution, support: [...attribution, money] } };
}

export function projectIntent(state: ConversationState): Intent {
  const { intent, pending } = state;
  const budget = intent.budget ? { ...(intent.budget.maximum === undefined ? {} : { amount: intent.budget.maximum }), ...(intent.budget.minimum === undefined ? {} : { minimum: intent.budget.minimum }), currency: intent.budget.currency } : null;
  const pendingChange = pending ? pending.kind === "currency"
    ? { kind: "money", id: pending.id, originalRequest: pending.originalRequest, reason: "currency", message: pending.originalRequest, explanation: "Currency is unresolved", missingSlot: "currency", draft: { amount: pending.maximum ?? null, minimum: pending.minimum ?? null, currency: null } }
    : { kind: "edit", id: pending.id, originalRequest: pending.message, reason: "unsupported", message: pending.message, explanation: pending.explanation }
    : null;
  // Historical grading has no representation for a lower-only budget or an unset region.
  // Their missing values remain missing instead of receiving fabricated defaults.
  return { productDescription: intent.productDescription, criteria: intent.requirements.map(({ id, text, strength }) => ({ id, wording: text, strength })), budget, budgetClarified: intent.budget !== null && pending?.kind !== "currency", pendingChange, region: intent.region, responseLength: intent.responseLength, revision: state.revision, version: state.version } as Intent;
}

export function projectResponse(response: TurnResponse | { kind: "research"; research: RenderableResearch; state: ConversationState } | null): Record<string, Json> | null {
  if (!response) return null;
  const projected = JSON.parse(JSON.stringify(response)) as Record<string, Json>;
  if (response.kind === "research") {
    const research = response.research;
    const assessment = (value: RenderableResearch["products"][number]["identity"]): Json => ({ ...value, support: value.support.map((span) => "origin" in span
      ? { ...span, quote: span.origin.kind === "provider" ? span.origin.reportedQuote : ("text" in span.literal ? span.literal.text : research.sources.find((source) => source.id === span.sourceId)!.text.slice(span.literal.start, span.literal.end)), start: span.literal.start, end: span.literal.end }
      : { ...span, quote: span.originalQuote, start: span.originalStart, end: span.originalEnd }) });
    projected.research = { ...JSON.parse(JSON.stringify(research)) as Record<string, Json>, products: research.products.map((product) => ({ ...JSON.parse(JSON.stringify(product)) as Record<string, Json>, identity: assessment(product.identity), requestMatch: assessment(product.requestMatch), criteria: product.requirements.map(({ requirementId, assessment: value }) => ({ criterionId: requirementId, assessment: assessment(value) })), attributes: product.attributes.map((row) => ({ name: row.name, assessment: assessment(row.assessment) })), price: "priceEvidence" in product
      ? projectCurrentPrice(product.priceEvidence)
      : product.price ? { ...product.price, conditions: [...product.price.conditions], assessment: assessment(product.price.assessment) } : null })) };
  }
  return projected;
}
