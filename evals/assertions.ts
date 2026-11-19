import type { Check, Json, Observation, Requirement, Scenario, TurnObservation } from "./contracts";

function record(value: Json | undefined): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function list(value: Json | undefined): Json[] { return Array.isArray(value) ? value : []; }
function exact(value: Json | undefined): boolean {
  const item = record(value);
  return item.status === "supported" && item.scope === "exact-variant";
}
export function safeSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && host.includes(".") && !host.endsWith(".local") && !host.endsWith(".localhost") && !/^(?:\d+\.){3}\d+$/.test(host) && !host.includes(":") && host !== "localhost";
  } catch { return false; }
}
function normalize(value: string): string { return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function checkRequirement(requirement: Requirement, turn: TurnObservation, observation: Observation): { ok?: boolean; expected: Json; observed: Json; status?: "blocked" | "unsupported" } {
  const prefs = turn.finalPreferences;
  switch (requirement.kind) {
    case "description": return { ok: requirement.includes.every((word) => normalize(prefs.productDescription).includes(normalize(word))), expected: requirement.includes, observed: prefs.productDescription };
    case "budget": return { ok: prefs.budget?.amount === requirement.maximum && prefs.budget?.currency === requirement.currency && prefs.budget?.minimum === requirement.minimum, expected: { amount: requirement.maximum, currency: requirement.currency, ...(requirement.minimum === undefined ? {} : { minimum: requirement.minimum }) }, observed: prefs.budget ?? null };
    case "budget-null": return { ok: prefs.budget === null, expected: null, observed: prefs.budget ?? null };
    case "preserve": {
      const previous = observation.turns[requirement.from]?.finalPreferences;
      const fields = requirement.fields;
      return { ok: Boolean(previous) && fields.every((field) => JSON.stringify(prefs[field]) === JSON.stringify(previous![field])), expected: previous ? Object.fromEntries(fields.map((field) => [field, previous[field]])) as Json : null, observed: Object.fromEntries(fields.map((field) => [field, prefs[field]])) as Json };
    }
    case "criterion": return { ok: prefs.criteria.some((criterion) => criterion.strength === requirement.strength && normalize(criterion.wording).includes(normalize(requirement.includes)) && (requirement.meaning !== "exclude" || /\b(?:no|exclude|avoid|without|excluding)\b/i.test(criterion.wording) && !/\b(?:not|don.t)\s+(?:exclude|avoid)/i.test(criterion.wording)) && (requirement.meaning !== "only" || /\bonly\b/i.test(criterion.wording) && !/\bnot\s+only\b/i.test(criterion.wording))), expected: { wordingIncludes: requirement.includes, strength: requirement.strength, meaning: requirement.meaning ?? "literal-phrase-only" }, observed: prefs.criteria as Json };
    case "response": return { ok: requirement.kinds.includes(String(turn.response?.kind)) && (!requirement.reasons || requirement.reasons.includes(String(turn.response?.reason ?? turn.response?.question))), expected: { kinds: requirement.kinds, ...(requirement.reasons ? { reasons: requirement.reasons } : {}) }, observed: { kind: turn.response?.kind ?? null, reason: turn.response?.reason ?? turn.response?.question ?? null } };
    case "calls": return { ok: turn.providerCalls >= requirement.minimum && turn.providerCalls <= requirement.maximum, expected: { minimum: requirement.minimum, maximum: requirement.maximum }, observed: turn.providerCalls };
    case "clarifications": {
      const count = observation.turns.slice(0, turn.index + 1).filter((item) => ["question", "clarification"].includes(String(item.response?.kind))).length;
      return { ok: count <= requirement.maximum, expected: requirement.maximum, observed: count };
    }
    case "response-length": return { ok: prefs.responseLength === requirement.value, expected: requirement.value, observed: prefs.responseLength };
    case "region": return { ok: prefs.region === requirement.value, expected: requirement.value, observed: prefs.region };
    case "pending": return { ok: Boolean(prefs.pendingChange) === requirement.value, expected: requirement.value, observed: prefs.pendingChange as Json };
    case "no-choice": return { ok: !record(turn.response?.research).choice, expected: null, observed: record(turn.response?.research).choice ?? null };
    case "products": { const products = list(record(turn.response?.research).products); return { ok: products.length >= requirement.minimum, expected: requirement.minimum, observed: products.length }; }
    case "cancelled": return { ok: turn.cancelled && observation.events.some((event) => event.turn === turn.index && event.kind === "provider-aborted"), expected: "Cancellation reaches the actual local SDK request", observed: { cancelled: turn.cancelled, providerAbort: observation.events.some((event) => event.turn === turn.index && event.kind === "provider-aborted") } };
    case "unassessed": return { status: requirement.capability.startsWith("unsupported:") ? "unsupported" : "blocked", expected: requirement.capability, observed: requirement.reason };
  }
}
function evidence(observation: Observation, turn: number): number[] { return observation.events.filter((event) => event.turn === turn).map((event) => event.sequence); }
function checksForResearch(observation: Observation, turn: TurnObservation): Check[] {
  const snapshot = record(turn.response?.research);
  if (!Object.keys(snapshot).length) return [];
  const result: Check[] = [];
  const emit = (id: string, ok: boolean, expected: Json, observed: Json) => result.push({ id, turn: turn.index, status: ok ? "pass" : "fail", critical: true, expected, observed, evidence: evidence(observation, turn.index) });
  const upstream = record(observation.material.body);
  const upstreamProducts = list(record(upstream.answer).products).map(record);
  const upstreamSources = list(upstream.citations).map(record);
  const sources = list(snapshot.sources).map(record);
  const sourceMap = new Map(sources.map((source) => [String(source.id), source]));
  emit("safe-source-urls", sources.every((source) => typeof source.url === "string" && safeSourceUrl(source.url)), "Safe public HTTPS URLs", sources.map((source) => source.url ?? null));
  emit("source-provenance", sources.every((source) => upstreamSources.some((item) => item.url === source.url && typeof item.text === "string" && typeof source.text === "string" && item.text.includes(source.text))), "Every source URL and retained text comes from the supplied material", sources.map((source) => ({ url: source.url ?? null, text: source.text ?? null })));
  const products = list(snapshot.products).map(record);
  emit("fabricated-products", products.every((product) => upstreamProducts.some((item) => item.id === product.id && item.name === product.name && item.variant === product.variant)), "Every published identity originates in the fixed provider input", products.map((product) => ({ id: product.id ?? null, name: product.name ?? null, variant: product.variant ?? null })));
  for (const product of products) {
    const upstreamProduct = upstreamProducts.find((item) => item.id === product.id);
    const assessments = [product.identity, product.requestMatch, ...list(product.criteria).map((item) => record(item).assessment), ...list(product.attributes).map((item) => record(item).assessment), ...(product.price ? [record(product.price).assessment] : []), ...(product.budget ? [product.budget] : [])];
    const support = assessments.flatMap((item) => list(record(item).support).map(record));
    emit(`quote-containment:${product.id}`, support.every((span) => {
      const source = sourceMap.get(String(span.sourceId));
      return source && typeof source.text === "string" && typeof span.start === "number" && typeof span.end === "number" && source.text.slice(span.start, span.end) === span.quote;
    }), "Every quote is an exact contiguous retained passage", support);
    emit(`stock-honesty:${product.id}`, product.stock === "unverified", "unverified", product.stock ?? null);
    const price = record(product.price);
    if (product.price) {
      const supplied = record(upstreamProduct?.price);
      const moneySupported = list(record(price.assessment).support).map(record).some((span) => {
        if (typeof span.quote !== "string" || typeof price.amount !== "number") return false;
        const amount = price.amount.toFixed(2).replace(/\.00$/, "");
        const text = span.quote.replace(/,/g, "");
        const currency = price.currency === "SGD" ? "(?:SGD|S\\$)" : price.currency === "USD" ? "(?:USD|US\\$)" : "(?!)";
        return new RegExp(`${currency}\\s*${amount.replace(".", "\\.")}(?:\\.00)?(?![\\d.])`, "i").test(text);
      });
      emit(`price-attribution:${product.id}`, price.amount === supplied.amount && price.currency === supplied.currency && price.variant === supplied.variant && moneySupported, "Amount, explicit currency and variant match literal provider evidence", price);
      const upstreamText = list(record(supplied.assessment).support).map((span) => String(record(span).quote ?? "")).join("\n");
      emit(`price-conditions:${product.id}`, !(price.conditionsResolved === true && (supplied.conditionsResolved === false || /members? only|voucher|subscription|per month|\/month/i.test(upstreamText))), "Unresolved membership, voucher and recurring terms cannot become unconditional", { conditions: price.conditions ?? null, conditionsResolved: price.conditionsResolved ?? null });
    }
  }
  if (snapshot.choice) {
    const chosen = products.find((product) => product.id === record(snapshot.choice).productId);
    const prefs = turn.finalPreferences;
    const price = record(chosen?.price);
    const criteria = list(chosen?.criteria).map(record);
    const fits = Boolean(chosen && exact(chosen.identity) && exact(chosen.requestMatch) && chosen.variant && prefs.criteria.filter((criterion) => criterion.strength === "hard").every((criterion) => criteria.some((item) => item.criterionId === criterion.id && exact(item.assessment))) && (!prefs.budget || (typeof price.amount === "number" && price.currency === prefs.budget.currency && price.amount <= prefs.budget.amount && price.amount >= (prefs.budget.minimum ?? 0) && price.variant === chosen.variant && price.conditionsResolved === true && exact(price.assessment) && exact(chosen.budget))));
    emit("hard-choice-eligibility", fits, "Every recommendation has exact request/hard fit, applicable currency, variant and both price bounds", snapshot.choice);
  }
  return result;
}
export function grade(scenario: Scenario, observation: Observation): Check[] {
  const checks: Check[] = [];
  for (const milestone of scenario.milestones) {
    const turn = observation.turns[milestone.after];
    if (!turn) {
      checks.push({ id: `missing-turn:${milestone.after}`, turn: milestone.after, status: "blocked", critical: false, expected: "Scenario action completes", observed: observation.applicationError ?? "Earlier action did not complete", evidence: [] });
      continue;
    }
    for (const [index, requirement] of milestone.requirements.entries()) {
      const result = checkRequirement(requirement, turn, observation);
      checks.push({ id: `${requirement.kind}:${milestone.after}:${index}`, turn: milestone.after, status: result.status ?? (result.ok ? "pass" : "fail"), critical: requirement.kind === "criterion" ? requirement.strength === "hard" : requirement.kind === "preserve" ? requirement.fields.some((field) => field === "budget" ? JSON.stringify(turn.finalPreferences.budget) !== JSON.stringify(observation.turns[requirement.from]?.finalPreferences.budget) : field === "criteria" ? observation.turns[requirement.from]?.finalPreferences.criteria.some((prior) => prior.strength === "hard" && !turn.finalPreferences.criteria.some((current) => current.strength === "hard" && current.wording === prior.wording)) : false) : ["budget", "budget-null", "clarifications", "cancelled"].includes(requirement.kind), expected: result.expected, observed: result.observed, evidence: evidence(observation, milestone.after) });
    }
  }
  for (const turn of observation.turns) {
    const events = observation.events.filter((event) => event.turn === turn.index);
    const count = turn.providerCalls;
    checks.push({ id: `bounded-dispatch:${turn.index}`, turn: turn.index, status: count <= 1 ? "pass" : "fail", critical: true, expected: "At most one provider dispatch per explicit user action", observed: count, evidence: evidence(observation, turn.index) });
    const request = events.find((event) => event.kind === "provider-request");
    if (request) {
      const payload = record(record(request.body).body);
      const query = String(payload.query ?? "");
      const prompt = String(payload.systemPrompt ?? "");
      const prefs = turn.finalPreferences;
      const intentRetained = query === prefs.productDescription && prompt.includes(JSON.stringify(prefs));
      const firstResearch = events.find((event) => event.kind === "app-request" && record(event.body).phase === "research");
      checks.push({ id: `research-query-intent:${turn.index}`, turn: turn.index, status: intentRetained ? "pass" : "fail", critical: true, expected: "Actual accepted open objective and complete structured intent reach provider", observed: { query, intentIncluded: prompt.includes(JSON.stringify(prefs)) }, evidence: [request.sequence] });
      checks.push({ id: `research-after-prepare:${turn.index}`, turn: turn.index, status: firstResearch && firstResearch.sequence < request.sequence ? "pass" : "fail", critical: true, expected: "No provider call during prepare", observed: { researchEvent: firstResearch?.sequence ?? null, providerEvent: request.sequence }, evidence: [request.sequence] });
    }
    checks.push(...checksForResearch(observation, turn));
  }
  if (observation.applicationError) checks.push({ id: "application-transport", turn: null, status: "fail", critical: true, expected: "Actual app returns a valid response for supported input", observed: observation.applicationError, evidence: observation.events.map((event) => event.sequence) });
  return checks;
}
