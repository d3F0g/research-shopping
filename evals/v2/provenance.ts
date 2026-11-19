import type { ResearchProduct, ResearchSnapshot } from "../../src/domain/research";
import type { Json } from "../frozen-v4/contracts";

const record = (value: Json | undefined) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const list = (value: Json | undefined) => Array.isArray(value) ? value : [];
const collapse = (text: string) => text.replace(/[\u0009-\u000d\u0020\u00a0]+/gu, " ");
export function validCurrentProvenance(snapshot: ResearchSnapshot, product: ResearchProduct, material: Json): boolean {
  const upstream = record(material);
  const native = list(record(upstream.answer).products).map(record).find((item) => item.id === product.id);
  if (!native || snapshot.evidenceVersion !== 3) return false;
  const citations = list(upstream.citations).map(record);
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  const assessments = [
    { field: "identity", current: product.identity, native: native.identity },
    { field: "requestMatch", current: product.requestMatch, native: native.requestMatch },
    ...product.requirements.map((entry) => ({ field: "requirement", current: entry.assessment, native: record(list(native.criteria).map(record).find((row) => row.criterionId === entry.requirementId)).assessment })),
    ...product.attributes.map((entry, index) => ({ field: "attribute", current: entry.assessment, native: record(list(native.attributes)[index]).assessment })),
    ...(product.price ? [{ field: "price", current: product.price.assessment, native: record(native.price).assessment }] : []),
  ];
  const originals = new Map(snapshot.sources.map((source) => [source.id, citations.find((citation) => {
    try { return typeof citation.url === "string" && new URL(citation.url).href === source.url && typeof citation.text === "string" && citation.text.slice(0, 24000) === source.text; } catch { return false; }
  })]));
  if (snapshot.sources.some((source) => {
    const text = originals.get(source.id)?.text;
    return typeof text !== "string" || text.length !== source.originalLength || source.textTruncated !== (text.length > source.text.length);
  })) return false;
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
