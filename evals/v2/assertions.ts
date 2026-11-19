import { grade as historicalGrade } from "../frozen-v4/assertions";
import type { Check, Json, Scenario } from "../frozen-v4/contracts";
import { validCurrentProvenance } from "./provenance";
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
      for (const product of snapshot.products) {
        const assessments = [product.identity, product.requestMatch, ...product.requirements.map((item) => item.assessment), ...product.attributes.map((item) => item.assessment), ...(product.price ? [product.price.assessment] : [])];
        const valid = validCurrentProvenance(snapshot, product, observation.material.body);
        const aligned = assessments.some((assessment) => assessment.support.some((span) => span.origin.kind === "provider" && span.origin.match === "whitespace"));
        const historical = checks.find((check) => check.id === `quote-containment:${product.id}` && check.turn === turn.index);
        if (valid && aligned && historical) {
          historical.status = "blocked";
          historical.expected = "Historical quote containment cannot represent provider wording with whitespace alignment. Current evidence-3 provenance is checked separately; the actual provider report is preserved unchanged.";
        }
        checks.push({ id: `native-complete-provenance:${product.id}`, turn: turn.index, status: valid ? "pass" : "fail", critical: true, expected: "Evidence-3 reports match actual provider wording; unique whitespace equivalence, literal UTF-16 offsets, complete context and actual source cut metadata are independently checked", observed: JSON.parse(JSON.stringify(assessments)) as Json, evidence: observation.events.filter((item) => item.turn === turn.index).map((item) => item.sequence) });
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
      const expectedQuery = {
        productDescription: raw.after.intent.productDescription,
        budget: raw.after.intent.budget,
        requirements: raw.after.intent.requirements.map(({ text, strength }) => ({ text, strength })),
        region: raw.after.intent.region,
      };
      let queryIncluded = false;
      try { queryIncluded = typeof payload.query === "string" && hash(JSON.parse(payload.query)) === hash(expectedQuery); } catch {}
      check.status = queryIncluded && intentIncluded ? "pass" : "fail";
      check.expected = "Actual retrieval query contains exactly the accepted product description, both optional budget bounds, explicit currency, every requirement text and strength, and region; the system prompt contains the complete authoritative intent";
      check.observed = { query: payload.query ?? null, queryIncluded, intentIncluded };
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
