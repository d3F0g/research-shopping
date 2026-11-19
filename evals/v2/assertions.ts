import { grade as historicalGrade } from "../frozen-v4/assertions";
import type { Check, Json, Scenario } from "../frozen-v4/contracts";
import { hash } from "../hash";
import type { Observation } from "./contracts";

const object = (value: Json) => value as Record<string, Json>;
export function grade(scenario: Scenario, observation: Observation): Check[] {
  const checks = historicalGrade(scenario, observation);
  checks.push({ id: "offline-no-external-dispatch", turn: null, status: observation.network.externalRequests === 0 && observation.network.denied.length === 0 ? "pass" : "fail", critical: true, expected: "Only owned loopback HTTP destinations, with no external dispatch or attempted escape", observed: observation.network, evidence: [] });
  checks.push({ id: "owned-resource-cleanup", turn: null, status: observation.cleanup ? "pass" : "fail", critical: true, expected: true, observed: observation.cleanup, evidence: [] });
  for (const turn of observation.turns) {
    const raw = observation.rawTurns.find((item) => item.index === turn.index);
    if (!raw) continue;
    if (raw.response?.kind === "research") {
      const snapshot = raw.response.research;
      const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
      for (const product of snapshot.products) {
        const assessments = [product.identity, product.requestMatch, ...product.requirements.map((item) => item.assessment), ...product.attributes.map((item) => item.assessment), ...(product.price ? [product.price.assessment] : [])];
        const valid = assessments.every((assessment) => (assessment.status === "unknown" || assessment.support.length > 0) && assessment.support.every((span) => {
          const source = sources.get(span.sourceId);
          return source && [span.start, span.end, span.originalStart, span.originalEnd].every(Number.isInteger) && span.start >= 0 && span.end > span.start && span.originalStart >= span.start && span.originalEnd <= span.end && span.originalEnd > span.originalStart && source.text.slice(span.start, span.end) === span.quote && source.text.slice(span.originalStart, span.originalEnd) === span.originalQuote && !(source.textTruncated && span.end === source.text.length);
        }));
        checks.push({ id: `native-complete-provenance:${product.id}`, turn: turn.index, status: valid ? "pass" : "fail", critical: true, expected: "Actual native quotation and complete context each bind to retained source offsets; native span stays inside complete uncut context", observed: JSON.parse(JSON.stringify(assessments)) as Json, evidence: observation.events.filter((item) => item.turn === turn.index).map((item) => item.sequence) });
      }
    }
    const event = observation.events.find((item) => item.turn === turn.index && item.kind === "provider-request");
    if (event) {
      const payload = object(object(event.body).body!);
      const intentIncluded = String(payload.systemPrompt ?? "").split("\n").some((line) => {
        const start = line.indexOf("{");
        if (start < 0) return false;
        try { return hash(JSON.parse(line.slice(start))) === hash(raw.after.intent); } catch { return false; }
      });
      const check = checks.find((item) => item.id === `research-query-intent:${turn.index}`)!;
      check.status = payload.query === raw.after.intent.productDescription && intentIncluded ? "pass" : "fail";
      check.observed = { query: payload.query ?? null, intentIncluded };
    }
    if (raw.response?.kind === "research" && raw.response.research.choice) {
      const { research } = raw.response;
      const chosen = research.products.find((item) => item.id === research.choice!.productId);
      const exact = (value: { status: string; scope: string; support: unknown[] } | undefined) => value?.status === "supported" && value.scope === "exact-variant" && value.support.length > 0;
      const intent = raw.after.intent;
      const price = chosen?.price;
      const fits = Boolean(chosen?.variant && exact(chosen.identity) && exact(chosen.requestMatch) && intent.requirements.filter((item) => item.strength === "hard").every((item) => exact(chosen.requirements.find((row) => row.requirementId === item.id)?.assessment)) && (!intent.budget || price && exact(price.assessment) && price.variant === chosen.variant && price.conditionsResolved && price.currency === intent.budget.currency && (intent.budget.minimum === undefined || price.amount >= intent.budget.minimum) && (intent.budget.maximum === undefined || price.amount <= intent.budget.maximum)));
      const check = checks.find((item) => item.id === "hard-choice-eligibility" && item.turn === turn.index)!;
      check.status = fits ? "pass" : "fail";
      check.expected = "Exact supported identity, full request, every hard requirement and qualifying explicit-currency price within both optional bounds";
    }
    if (event) checks.push({ id: `sdk-answer-path:${turn.index}`, turn: turn.index, status: object(event.body).path === "/answer" ? "pass" : "fail", critical: true, expected: "/answer", observed: object(event.body).path ?? null, evidence: [event.sequence] });
  }
  return checks;
}
