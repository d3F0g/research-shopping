import { ResearchSnapshotSchema, type ResearchProduct, type ResearchSnapshot } from "../../src/domain/research-history-v5";
import { NativeAnswerSchema } from "../../src/server/exa-answer-v2";
import type { Json } from "../frozen-v4/contracts";
export { validV4Provenance } from "./provenance-v4";

const record = (value: Json | undefined) => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const list = (value: Json | undefined) => Array.isArray(value) ? value : [];
const url = (value: unknown) => { try { return typeof value === "string" ? new URL(value).href : null; } catch { return null; } };
const same = (first: unknown, second: unknown): boolean => {
  if (first === second) return true;
  if (!first || !second || typeof first !== "object" || typeof second !== "object") return false;
  const a = Object.entries(first), b = Object.entries(second);
  return a.length === b.length && a.every(([key, value]) => Object.hasOwn(second, key) && same(value, Reflect.get(second, key)));
};

export function validCurrentProvenance(snapshot: ResearchSnapshot, product: ResearchProduct, material: Json): boolean {
  const upstream = record(material);
  let answer = upstream.answer;
  if (typeof answer === "string") {
    if (answer.length > 128000) return false;
    try { answer = JSON.parse(answer) as Json; } catch { return false; }
  }
  if (JSON.stringify(answer)?.length > 128000) return false;
  const parsed = NativeAnswerSchema.safeParse(answer);
  if (!parsed.success || !ResearchSnapshotSchema.safeParse({ ...snapshot, products: snapshot.products.map((item) => item.id === product.id ? product : item) }).success) return false;
  const native = parsed.data.products.find((item) => item.id === product.id);
  if (!native || native.name !== product.name || native.variant !== product.variant) return false;
  const citations = list(upstream.citations).map(record);
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  for (const source of snapshot.sources) {
    const original = citations.find((citation) => url(citation.url) === source.url && typeof citation.text === "string" && citation.text.slice(0, 24000) === source.text);
    if (typeof original?.text !== "string" || original.text.length !== source.originalLength || source.textTruncated !== (original.text.length > source.text.length)) return false;
  }
  const sourceId = (value: string) => snapshot.sources.find((source) => source.url === url(value))?.id ?? "";
  const support = (value: { url: string; quote: string }) => ({ sourceId: sourceId(value.url), quote: value.quote });
  const assessment = (value: NonNullable<typeof native.price>["attribution"]) => ({ ...value, support: value.support.map(support) });
  const report = native.price ? { ...native.price, moneySupport: support(native.price.moneySupport), attribution: assessment(native.price.attribution), priceBasis: { ...native.price.priceBasis, assessment: assessment(native.price.priceBasis.assessment) }, sourceReviews: native.price.sourceReviews.map(({ url: sourceUrl, ...review }) => ({ ...review, sourceId: sourceId(sourceUrl), assessment: assessment(review.assessment), moneyMentions: review.moneyMentions.map((group) => ({ ...group, assessment: assessment(group.assessment) })) })) } : null;
  if (!same(product.priceEvidence.report, report)) return false;
  const assessments = [
    { field: "identity", current: product.identity, native: native.identity },
    { field: "requestMatch", current: product.requestMatch, native: native.requestMatch },
    ...product.requirements.map((entry) => ({ field: "requirement", current: entry.assessment, native: native.criteria.find((row) => row.criterionId === entry.requirementId)?.assessment })),
    ...product.attributes.map((entry, index) => ({ field: "attribute", current: entry.assessment, native: native.attributes[index]?.assessment })),
  ];
  return assessments.every(({ field, current, native: reported }) => current.support.every((span) => {
    const source = sources.get(span.sourceId);
    if (!source) return false;
    if (span.origin.kind === "source-context") return field === "requestMatch" && current.status !== "supported";
    const quote = span.origin.reportedQuote;
    return reported?.support.some((item) => url(item.url) === source.url && item.quote === quote);
  }));
}
