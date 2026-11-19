import type { ConversationState, TurnResponse } from "../../src/domain/conversation";
import type { Assessment } from "../../src/domain/research";
import type { Intent, Json } from "../frozen-v4/contracts";

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

export function projectResponse(response: TurnResponse | null): Record<string, Json> | null {
  if (!response) return null;
  const projected = JSON.parse(JSON.stringify(response)) as Record<string, Json>;
  if (response.kind === "research") {
    const research = response.research;
    const assessment = (value: Assessment): Json => ({ ...value, support: value.support.map((span) => ({ ...span, quote: span.originalQuote, start: span.originalStart, end: span.originalEnd })) });
    projected.research = { ...JSON.parse(JSON.stringify(research)) as Record<string, Json>, products: research.products.map((product) => ({ ...JSON.parse(JSON.stringify(product)) as Record<string, Json>, identity: assessment(product.identity), requestMatch: assessment(product.requestMatch), criteria: product.requirements.map(({ requirementId, assessment: value }) => ({ criterionId: requirementId, assessment: assessment(value) })), attributes: product.attributes.map((row) => ({ name: row.name, assessment: assessment(row.assessment) })), price: product.price ? { ...product.price, assessment: assessment(product.price.assessment) } : null })) };
  }
  return projected;
}
