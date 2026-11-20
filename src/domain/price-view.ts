import type { DeepReadonly } from "./conversation";
import type { PriceEvidence, ResearchSource } from "./price-evidence-v5";

const blockers = {
  "missing-price-report": "No source price interpretation was returned.",
  "missing-literal-money": "The reported monetary witness does not identify one literal amount.",
  "ambiguous-currency": "The monetary witness does not establish an explicit currency.",
  "amount-currency-mismatch": "The reported amount or currency differs from its actual monetary witness.",
  "variant-unresolved": "Applicability to the selected variant remains unresolved.",
  "non-scalar-basis": "A complete single-item price remains unresolved.",
  "conditions-unresolved": "Purchase conditions remain unresolved.",
  "conflicting-observations": "Other monetary observations need resolution.",
  "source-review-missing": "A retained source is missing its complete price review.",
  "source-review-incomplete": "The source price review is incomplete or uncertain.",
  "unaccounted-money": "Some source amounts are unreviewed or ambiguously grouped.",
  "source-context-incomplete": "Source context was cut, discarded or conflicting.",
  "unbound-support": "A reported quotation has no unique literal source binding.",
  "adverse-context": "Source context contains a restriction or conflicting price information.",
};
export function priceView(price: DeepReadonly<PriceEvidence>, sources: readonly DeepReadonly<ResearchSource>[]) {
  const inventory = sources.flatMap((source) => source.moneyOccurrences);
  const observation = price.observations.length === 1 ? inventory.find((item) => item.id === price.observations[0]) : undefined;
  const source = observation && sources.find((entry) => entry.id === observation.literal.sourceId);
  const label = observation?.value.kind === "explicit"
    ? `${observation.value.currency} ${(observation.value.minorUnits / 100).toFixed(2)}`
    : observation && source ? `${source.text.slice(observation.literal.start, observation.literal.end)} (currency or amount unresolved)`
    : price.observations.length > 1 ? "Multiple source amounts" : "No qualifying observed price";
  const unresolved = price.state === "observed" ? price.blockers.map((code) => blockers[code]) : price.state === "absent" ? [blockers[price.reason]] : [];
  const qualification = price.state === "applicable"
    ? "Source-based AI price interpretation. Merchant price, stock and delivery remain unverified."
    : unresolved.join(" ");
  const reviewed = new Set(price.reviews.flatMap((review) => review.moneyMentions.flatMap((group) => group.occurrenceIds)));
  const details = [
    ...price.alarms.map((alarm) => ({ label: `Source-context restriction (${alarm.kind}). This is derived context, not a provider quotation.`, ...alarm.support })),
    ...price.reviews.flatMap((review) => review.conditions.map((support, index) => ({ label: `Provider-reported condition, unverified. ${price.report?.sourceReviews.find((entry) => entry.sourceId === review.sourceId)?.conditions[index]?.text ?? ""}`, ...support }))),
    ...inventory.filter((entry) => !reviewed.has(entry.id)).map((entry) => ({ label: "Unreviewed source amount. Applicability remains unknown.", ...entry.literal })),
    ...price.attributionSupport.map((support) => ({ label: `Provider price attribution ${price.report!.attribution.status}, unverified: ${price.report!.attribution.rationale}`, ...support })),
    ...price.basisSupport.map((support) => ({ label: `Provider purchase-basis assessment ${price.report!.priceBasis.assessment.status}, unverified: ${price.report!.priceBasis.assessment.rationale}`, ...support })),
    ...(price.moneySupport ? [{ label: "Provider monetary witness. Literal provenance does not prove applicability.", ...price.moneySupport }] : []),
    ...price.reviews.flatMap((review) => review.moneyMentions.map((mention) => ({ label: `Source-based AI money interpretation (${mention.role}). ${mention.occurrenceIds.length} identified occurrence${mention.occurrenceIds.length === 1 ? "" : "s"}.`, ...mention.support }))),
  ];
  const description = `${observation ? ", observed and unverified." : "."} ${qualification}`;
  return { label, description, qualification, unresolved, details, text: label + description };
}
