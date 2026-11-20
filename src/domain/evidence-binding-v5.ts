import { z } from "zod";
import { isSafeSourceUrl } from "./safe-url";

export const SourceRefSchema = z.strictObject({ sourceId: z.string().max(80), start: z.number().int().nonnegative(), end: z.number().int().positive() });
export const SupportSchema = z.strictObject({
  sourceId: z.string().max(80),
  origin: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("provider"), reportedQuote: z.string().min(1).max(4000), match: z.enum(["literal", "whitespace"]) }),
    z.strictObject({ kind: z.literal("source-context") }),
  ]),
  literal: z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive() }),
  context: z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive() }),
});
export const AssessmentSchema = z.strictObject({ status: z.enum(["supported", "unknown", "contradicted", "conflict"]), scope: z.enum(["exact-variant", "product-family", "unclear"]), rationale: z.string().min(1).max(800), support: z.array(SupportSchema).max(3) });
export const SourceSchema = z.strictObject({ id: z.string().max(80), url: z.string().refine(isSafeSourceUrl), title: z.string().max(500), text: z.string().max(24000), originalLength: z.number().int().nonnegative(), textTruncated: z.boolean(), imageUrl: z.string().refine(isSafeSourceUrl).optional() }).refine((s) => s.originalLength >= s.text.length && s.textTruncated === (s.originalLength > s.text.length));
export type SourceRef = z.infer<typeof SourceRefSchema>;
export type Support = z.infer<typeof SupportSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type ResearchSource = z.infer<typeof SourceSchema>;
type Source = Readonly<Pick<ResearchSource, "id" | "text" | "textTruncated">>;
const whitespace = /[\u0009-\u000d\u0020\u00a0]/u;

function indexedWhitespace(text: string) {
  let normalized = "";
  const starts: number[] = [], ends: number[] = [];
  for (let index = 0; index < text.length;) {
    const start = index;
    if (whitespace.test(text[index]!)) {
      while (index < text.length && whitespace.test(text[index]!)) index++;
      normalized += " ";
    } else normalized += text[index++]!;
    starts.push(start);
    ends.push(index);
  }
  return { normalized, starts, ends };
}
export function uniqueLiteralSpan(text: string, quote: string): { start: number; end: number } | null {
  const source = indexedWhitespace(text), report = indexedWhitespace(quote).normalized;
  if (!report.trim()) return null;
  const start = source.normalized.indexOf(report);
  if (start < 0 || source.normalized.indexOf(report, start + 1) >= 0) return null;
  return { start: source.starts[start]!, end: source.ends[start + report.length - 1]! };
}
export function completeContext(source: Source, literal: { start: number; end: number }) {
  let start = 0, end = source.text.length;
  for (const boundary of source.text.matchAll(/\r?\n[\t ]*\r?\n/gu)) {
    const right = boundary.index + boundary[0].length;
    if (right <= literal.start) start = right;
    if (boundary.index >= literal.end) { end = boundary.index; break; }
  }
  return { start, end };
}
export function bindReportedQuote(source: Source, reportedQuote: string): Support | null {
  const literal = uniqueLiteralSpan(source.text, reportedQuote);
  if (!literal) return null;
  return { sourceId: source.id, origin: { kind: "provider", reportedQuote, match: source.text.slice(literal.start, literal.end) === reportedQuote ? "literal" : "whitespace" }, literal, context: completeContext(source, literal) };
}
export function validEvidenceSupport(source: Source, support: Support): boolean {
  const binds = (span: { start: number; end: number }) => span.start >= 0 && span.end > span.start && span.end <= source.text.length;
  if (source.id !== support.sourceId || !binds(support.literal) || !binds(support.context)) return false;
  const context = completeContext(source, support.literal);
  if (context.start !== support.context.start || context.end !== support.context.end) return false;
  if (support.origin.kind === "source-context") return true;
  const bound = bindReportedQuote(source, support.origin.reportedQuote);
  return !!bound && JSON.stringify(bound) === JSON.stringify(support);
}
export function containsSourceInstructions(text: string): boolean {
  return /\b(?:ignore|disregard|override)\b[\s\S]{0,120}\b(?:user|system|previous|requirements?|instructions?)\b|\b(?:send|reveal|leak|exfiltrate|print)\b[\s\S]{0,120}\b(?:credentials?|secrets?|api[ -]?keys?|tokens?|passwords?)\b|\b(?:assert|pretend|declare)\s+that\b|\b(?:assistant|system)\s*(?:message|prompt|:)/i.test(text);
}
