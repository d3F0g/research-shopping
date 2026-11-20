export type LiteralSpan = { start: number; end: number; text: string };
export type BindingSource = { id: string; text: string; textTruncated: boolean };
export type EvidenceSupport = {
  sourceId: string;
  origin: { kind: "provider"; reportedQuote: string; match: "literal" | "whitespace" } | { kind: "source-context" };
  literal: LiteralSpan;
  context: LiteralSpan;
};
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

export function uniqueLiteralSpan(text: string, reportedQuote: string): LiteralSpan | null {
  const source = indexedWhitespace(text);
  const report = indexedWhitespace(reportedQuote).normalized;
  if (!report || report === " ") return null;
  const start = source.normalized.indexOf(report);
  if (start < 0 || source.normalized.indexOf(report, start + 1) >= 0) return null;
  const left = source.starts[start]!, right = source.ends[start + report.length - 1]!;
  return { start: left, end: right, text: text.slice(left, right) };
}

export function completeContext(source: BindingSource, literal: LiteralSpan): LiteralSpan | null {
  let start = 0, end = source.text.length;
  for (const boundary of source.text.matchAll(/\r?\n[\t ]*\r?\n/gu)) {
    const right = boundary.index + boundary[0].length;
    if (right <= literal.start) start = right;
    if (boundary.index >= literal.end) { end = boundary.index; break; }
  }
  if (end - start > 4000 || (source.textTruncated && end === source.text.length)) return null;
  return { start, end, text: source.text.slice(start, end) };
}

export function bindReportedQuote(source: BindingSource, reportedQuote: string): EvidenceSupport | null {
  const literal = uniqueLiteralSpan(source.text, reportedQuote);
  const context = literal && completeContext(source, literal);
  if (!literal || !context) return null;
  return { sourceId: source.id, origin: { kind: "provider", reportedQuote, match: literal.text === reportedQuote ? "literal" : "whitespace" }, literal, context };
}

export function validEvidenceSupport(source: BindingSource, support: EvidenceSupport): boolean {
  const { literal, context, origin } = support;
  const binds = (span: LiteralSpan) => Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end > span.start && span.end <= source.text.length && source.text.slice(span.start, span.end) === span.text;
  if (source.id !== support.sourceId || !binds(literal) || !binds(context) || literal.start < context.start || literal.end > context.end || (source.textTruncated && context.end === source.text.length)) return false;
  const minimum = completeContext(source, literal);
  if (!minimum || context.start > minimum.start || context.end < minimum.end) return false;
  if (origin.kind === "source-context") return true;
  const found = uniqueLiteralSpan(source.text, origin.reportedQuote);
  return !!found && found.start === literal.start && found.end === literal.end && (origin.match === "literal" ? literal.text === origin.reportedQuote : literal.text !== origin.reportedQuote);
}

export function catalogRowMoney(text: string): { heading: string; amount: number; currency: string; moneyStart: number; moneyEnd: number } | null {
  const row = /^([^\r\n]+)\r?\n[\t \r\n]*([^\r\n]+)$/u.exec(text);
  if (!row) return null;
  const number = "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)";
  const match = new RegExp(`^[\\t ]*(?:([A-Z]{3})[\\t ]*${number}|${number}[\\t ]*([A-Z]{3}))[\\t ]*$`, "u").exec(row[2]!);
  return match ? { heading: row[1]!, moneyStart: text.lastIndexOf(row[2]!) + row[2]!.match(/^[\t ]*/u)![0].length, moneyEnd: text.length - row[2]!.match(/[\t ]*$/u)![0].length, amount: Number((match[2] ?? match[3])!.replaceAll(",", "")), currency: (match[1] ?? match[4])! } : null;
}
