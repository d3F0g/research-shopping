import type { ResearchProduct, ResearchSnapshot } from "../../src/domain/research";
import type { Json } from "../frozen-v4/contracts";

const record = (value: Json | undefined) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const list = (value: Json | undefined) => Array.isArray(value) ? value : [];
const collapse = (text: string) => text.replace(/[\u0009-\u000d\u0020\u00a0]+/gu, " ");
export function validCurrentProvenance(snapshot: ResearchSnapshot, product: ResearchProduct, material: Json): boolean {
  const upstream = record(material);
  let answer = upstream.answer;
  if (typeof answer === "string") {
    if (answer.length > 128000) return false;
    try { answer = JSON.parse(answer) as Json; } catch { return false; }
  }
  const native = list(record(answer).products).map(record).find((item) => item.id === product.id);
  if (!native || snapshot.evidenceVersion !== 4) return false;
  const citations = list(upstream.citations).map(record);
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  const assessments = [
    { field: "identity", current: product.identity, native: native.identity },
    { field: "requestMatch", current: product.requestMatch, native: native.requestMatch },
    ...product.requirements.map((entry) => ({ field: "requirement", current: entry.assessment, native: record(list(native.criteria).map(record).find((row) => row.criterionId === entry.requirementId)).assessment })),
    ...product.attributes.map((entry, index) => ({ field: "attribute", current: entry.assessment, native: record(list(native.attributes)[index]).assessment })),
    ...(product.price ? [{ field: "price", current: product.price.assessment, native: record(native.price).assessment }] : []),
    ...(product.priceObservation ? [{ field: "catalog-price-report", current: product.priceObservation.reportedAssessment, native: record(native.price).assessment }] : []),
  ];
  const originals = new Map(snapshot.sources.map((source) => [source.id, citations.find((citation) => {
    try { return typeof citation.url === "string" && new URL(citation.url).href === source.url && typeof citation.text === "string" && citation.text.slice(0, 24000) === source.text; } catch { return false; }
  })]));
  if (snapshot.sources.some((source) => {
    const text = originals.get(source.id)?.text;
    return typeof text !== "string" || text.length !== source.originalLength || source.textTruncated !== (text.length > source.text.length);
  })) return false;
  const observation = product.priceObservation;
  if (observation) {
    const { row } = observation;
    const source = sources.get(row.sourceId);
    const reported = record(native.price), assessment = record(reported.assessment);
    const line = /^([^\r\n]+)\r?\n[\t \r\n]*([^\r\n]+)$/u.exec(row.literal.text);
    const amount = line && /^[\t ]*(?:([A-Z]{3})[\t ]*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)|([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)[\t ]*([A-Z]{3}))[\t ]*$/u.exec(line[2]!);
    if (product.price !== null || "variant" in observation || observation.attribution.status !== "unknown" || !source || source.textTruncated || source.text.length > 4000 || row.origin.kind !== "source-context" || !Number.isInteger(row.literal.start) || !Number.isInteger(row.literal.end) || row.literal.start < 0 || row.literal.end <= row.literal.start || row.literal.end > source.text.length || source.text.slice(row.literal.start, row.literal.end) !== row.literal.text || row.context.start !== 0 || row.context.end !== source.text.length || row.context.text !== source.text || !amount || Number((amount[2] ?? amount[3])!.replaceAll(",", "")) !== observation.amount || (amount[1] ?? amount[4]) !== observation.currency || reported.amount !== observation.amount || reported.currency !== observation.currency || JSON.stringify(reported.conditions) !== JSON.stringify(observation.reportedConditions) || reported.conditionsResolved !== observation.reportedConditionsResolved || assessment.status !== observation.reportedAssessment.status || assessment.scope !== observation.reportedAssessment.scope || assessment.rationale !== observation.reportedAssessment.rationale) return false;
    const namePattern = product.name.split(/[\u0009-\u000d\u0020\u00a0]+/u).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\u0009-\\u000d\\u0020\\u00a0]+");
    const names = [...line![1]!.matchAll(new RegExp(namePattern, "gu"))];
    if (names.length !== 1) return false;
    const nameStart = row.literal.start + names[0]!.index, nameEnd = nameStart + names[0]![0].length;
    if (!product.identity.support.some((span) => span.sourceId === row.sourceId && span.literal.start <= nameStart && span.literal.end >= nameEnd)) return false;
    const moneyStart = row.literal.start + row.literal.text.lastIndexOf(line![2]!) + line![2]!.match(/^[\t ]*/u)![0].length;
    const moneyEnd = row.literal.end - line![2]!.match(/[\t ]*$/u)![0].length;
    if (!observation.reportedAssessment.support.some((span) => span.sourceId === row.sourceId && span.origin.kind === "provider" && span.literal.start >= row.literal.start && span.literal.start <= moneyStart && span.literal.end >= moneyEnd && span.literal.end <= row.literal.end)) return false;
  }
  return assessments.every(({ field, current: assessment, native: nativeAssessment }) => (assessment.status === "unknown" || assessment.support.length > 0) && assessment.support.every((span) => {
    const reports = list(record(nativeAssessment).support).map(record);
    const source = sources.get(span.sourceId);
    if (!source) return false;
    const { context, literal, origin } = span;
    const slice = (value: typeof literal) => Number.isInteger(value.start) && Number.isInteger(value.end) && value.start >= 0 && value.end <= source.text.length && value.end > value.start && value.end - value.start <= 4000 && source.text.slice(value.start, value.end) === value.text;
    if (!slice(literal) || !slice(context) || context.start > literal.start || context.end < literal.end || source.textTruncated && context.end === source.text.length) return false;
    const breaks = [...source.text.matchAll(/\r?\n[\t ]*\r?\n/gu)];
    const left = breaks.filter((entry) => entry.index + entry[0].length <= literal.start).at(-1);
    const right = breaks.find((entry) => entry.index >= literal.end);
    if (context.start > (left ? left.index + left[0].length : 0) || context.end < (right?.index ?? source.text.length)) return false;
    if (origin.kind === "source-context") return field === "requestMatch" && /\b(?:is|are|does|do|has|have|can|will)\s+not\b|\b(?:without wireless|wired (?:audio )?only|not wireless|incompatible|cannot)\b/i.test(literal.text);
    if (!reports.some((report) => {
      try { return typeof report.url === "string" && new URL(report.url).href === source.url && report.quote === origin.reportedQuote; } catch { return false; }
    })) return false;
    const normalized = collapse(source.text), quote = collapse(origin.reportedQuote);
    const start = normalized.indexOf(quote);
    if (!quote.trim() || start < 0 || normalized.indexOf(quote, start + 1) !== -1 || collapse(literal.text) !== quote) return false;
    if (collapse(source.text.slice(0, literal.start)).length !== start) return false;
    const space = /[\u0009-\u000d\u0020\u00a0]/u;
    if (space.test(source.text[literal.start] ?? "") && space.test(source.text[literal.start - 1] ?? "") || space.test(source.text[literal.end - 1] ?? "") && space.test(source.text[literal.end] ?? "")) return false;
    return origin.match === "literal" ? origin.reportedQuote === literal.text : origin.reportedQuote !== literal.text;
  }));
}
