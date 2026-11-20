import { z } from "zod";
import { completeContext, containsSourceInstructions, SourceSchema as BaseSourceSchema, SourceRefSchema, uniqueLiteralSpan, type Assessment, type ResearchSource as BaseSource, type SourceRef } from "./evidence-binding-v5";

const Money = z.number().finite().positive().max(1_000_000).refine((value) => toMinorUnits(value) !== null);
const Currency = z.string().regex(/^[A-Z]{3}$/);
const Quote = z.strictObject({ sourceId: z.string().max(80), quote: z.string().min(1).max(4000) });
const Judgment = z.strictObject({ status: z.enum(["supported", "unknown", "contradicted", "conflict"]), scope: z.enum(["exact-variant", "product-family", "unclear"]), rationale: z.string().min(1).max(800), support: z.array(Quote).max(3) });
const Role = z.enum(["selected", "other-product", "reference", "extra-cost", "unresolved"]);
export const PriceReportSchema = z.strictObject({
  amount: Money.nullable(), currency: Currency.nullable(), variant: z.string().max(160).nullable(), moneySupport: Quote,
  attribution: Judgment,
  priceBasis: z.strictObject({ kind: z.enum(["single-item", "range", "bundle", "installment", "unknown"]), assessment: Judgment }),
  sourceReviews: z.array(z.strictObject({
    sourceId: z.string().max(80), reviewComplete: z.boolean(), relation: z.enum(["applies", "other-product-or-topic", "unknown"]), assessment: Judgment,
    moneyMentions: z.array(z.strictObject({ quote: z.string().min(1).max(4000), role: Role, scope: z.enum(["selected-variant", "other-subjects", "reference-only", "unresolved"]), assessment: Judgment })).max(24),
    conditions: z.array(z.strictObject({ quote: z.string().min(1).max(4000), text: z.string().min(1).max(300), interpretation: z.enum(["included-in-amount", "shopper-eligibility", "extra-cost", "unknown"]), rationale: z.string().min(1).max(800) })).max(8),
  })).max(10),
}).superRefine((report, ctx) => {
  if (report.sourceReviews.reduce((count, review) => count + review.moneyMentions.length, 0) > 24 || report.sourceReviews.reduce((count, review) => count + review.conditions.length, 0) > 8) ctx.addIssue({ code: "custom", message: "Price reports exceed their aggregate evidence bounds" });
});
const MoneyValueSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("explicit"), minorUnits: z.number().int().positive().max(100_000_000), currency: Currency }),
  z.strictObject({ kind: z.literal("ambiguous"), reason: z.enum(["ambiguous-currency", "unsupported-money", "range-endpoint"]) }),
]);
const OccurrenceSchema = z.strictObject({ id: z.string().max(160), literal: SourceRefSchema, amountSpan: SourceRefSchema, currencySpan: SourceRefSchema.nullable(), value: MoneyValueSchema });
export const SourceSchema = BaseSourceSchema.safeExtend({ moneyOccurrences: z.array(OccurrenceSchema).max(12000) });
export type ResearchSource = z.infer<typeof SourceSchema>;
const AlarmSchema = z.strictObject({ policy: z.literal("price-safety-v1"), kind: z.enum(["buyer-restriction", "incomplete-total", "conditional-applicability", "purchase-basis", "variant-contradiction", "uncertain-attribution", "competing-amount", "source-instruction"]), support: SourceRefSchema });
const BlockerSchema = z.enum(["missing-price-report", "missing-literal-money", "ambiguous-currency", "amount-currency-mismatch", "variant-unresolved", "non-scalar-basis", "conditions-unresolved", "conflicting-observations", "source-review-missing", "source-review-incomplete", "unaccounted-money", "source-context-incomplete", "unbound-support", "adverse-context", "attribution-context-uncertain"]);
const ReviewSchema = z.strictObject({ sourceId: z.string().max(80), moneyMentions: z.array(z.strictObject({ occurrenceIds: z.array(z.string().max(160)).max(2000), role: Role, support: SourceRefSchema, assessmentSupport: z.array(SourceRefSchema).max(3) })).max(24), conditions: z.array(SourceRefSchema).max(8), assessmentSupport: z.array(SourceRefSchema).max(3) });
const shared = { report: PriceReportSchema.nullable(), observations: z.array(z.string().max(160)).max(2000), reviews: z.array(ReviewSchema).max(10), alarms: z.array(AlarmSchema).max(240), moneySupport: SourceRefSchema.nullable(), attributionSupport: z.array(SourceRefSchema).max(3), basisSupport: z.array(SourceRefSchema).max(3) };
export const PriceEvidenceSchema = z.discriminatedUnion("state", [
  z.strictObject({ ...shared, state: z.literal("absent"), reason: BlockerSchema }),
  z.strictObject({ ...shared, state: z.literal("observed"), blockers: z.array(BlockerSchema).min(1).max(18) }),
  z.strictObject({ ...shared, state: z.literal("applicable"), selectedOccurrenceId: z.string().max(160), usableMoney: z.strictObject({ minorUnits: z.number().int().positive().max(100_000_000), currency: Currency }), variant: z.string().max(160), basis: z.literal("source-based-ai-observation"), merchantVerified: z.literal(false) }),
]);
export type PriceReport = z.infer<typeof PriceReportSchema>;
export type PriceEvidence = z.infer<typeof PriceEvidenceSchema>;
type Occurrence = z.infer<typeof OccurrenceSchema>;
type Alarm = z.infer<typeof AlarmSchema>;
type Blocker = z.infer<typeof BlockerSchema>;
type Context = { product: { name: string; variant: string | null; identity: Assessment }; sources: ResearchSource[]; complete: boolean };

export function toMinorUnits(value: number): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const result = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(result) && result > 0 && result <= 100_000_000 ? result : null;
}
const aliases: Record<string, string> = { "S$": "SGD", "US$": "USD", "€": "EUR", "£": "GBP", "Singapore dollars": "SGD", "Singapore dollar": "SGD", "U.S. dollars": "USD", "United States dollars": "USD", euros: "EUR", euro: "EUR", pounds: "GBP", pound: "GBP" };
const denomination = "(?:Singapore dollars?|United States dollars?|U\\.S\\. dollars?|euros?|pounds?|US\\$|S\\$|[A-Z]{3}|[$€£¥₹])";
const number = "[0-9]+(?:[.,][0-9]+)*";
function moneyInventory(sources: BaseSource[]): Occurrence[] {
  const inventory: Occurrence[] = [];
  const token = new RegExp(`(?<![\\p{L}\\p{N}_])(${denomination})[ \\t]*(${number})(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])(${number})[ \\t]*(${denomination})(?![\\p{L}\\p{N}_])`, "gu");
  for (const source of sources) {
    for (const match of source.text.matchAll(token)) {
      const currencyText = (match[1] ?? match[4])!, amountText = (match[2] ?? match[3])!;
      if (/^[A-Z]{3}$/.test(currencyText) && !/\s/.test(match[0]) && !/^(?:SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR|CHF|NZD)$/.test(currencyText)) continue;
      const start = match.index, end = start + match[0].length;
      const amountStart = start + (match[2] ? match[0].lastIndexOf(amountText) : 0);
      const currencyStart = start + (match[1] ? 0 : match[0].lastIndexOf(currencyText));
      const ref = (left: number, right: number): SourceRef => ({ sourceId: source.id, start: left, end: right });
      const decimal = /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(amountText) ? Number(amountText.replaceAll(",", "")) : NaN;
      const minorUnits = toMinorUnits(decimal), currency = aliases[currencyText] ?? (/^[A-Z]{3}$/.test(currencyText) ? currencyText : null);
      inventory.push({ id: `${source.id}:${start}:${end}`, literal: ref(start, end), amountSpan: ref(amountStart, amountStart + amountText.length), currencySpan: ref(currencyStart, currencyStart + currencyText.length), value: minorUnits === null ? { kind: "ambiguous", reason: "unsupported-money" } : currency ? { kind: "explicit", minorUnits, currency } : { kind: "ambiguous", reason: "ambiguous-currency" } });
      const range = new RegExp(`^[ \\t]*(?:[-–—]|to)[ \\t]*(${number})(?![\\p{L}\\p{N}_])`, "u").exec(source.text.slice(end));
      if (range) {
        const left = end + range[0].lastIndexOf(range[1]!);
        inventory.push({ id: `${source.id}:${left}:${left + range[1]!.length}`, literal: ref(left, left + range[1]!.length), amountSpan: ref(left, left + range[1]!.length), currencySpan: null, value: { kind: "ambiguous", reason: "range-endpoint" } });
      }
    }
  }
  return inventory;
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalized = (value: string) => value.trim().replace(/^[*#\s]+|[*\s]+$/g, "").toLowerCase();
const singleUnit = (value: string) => /^(?:one|1)\s+[\p{L}][\p{L}-]*(?![\p{L}\p{N}-])/iu.test(value.trim());
function sourceAlarms(context: Context, inventory: Occurrence[], selected: Occurrence | undefined): Alarm[] {
  const alarms: Alarm[] = [];
  const add = (kind: Alarm["kind"], sourceId: string, start: number, end: number) => {
    const source = context.sources.find((entry) => entry.id === sourceId)!;
    const span = completeContext(source, { start, end: Math.min(end, source.text.length) });
    if (!alarms.some((alarm) => alarm.kind === kind && alarm.support.sourceId === sourceId && alarm.support.start === span.start && alarm.support.end === span.end)) alarms.push({ policy: "price-safety-v1", kind, support: { sourceId, ...span } });
  };
  const subjects = [...new Set([context.product.name, context.product.variant, context.product.variant ? `${context.product.name} ${context.product.variant}` : null].filter((v): v is string => !!v))];
  const isSubject = (subject: string) => subjects.some((value) => normalized(subject) === normalized(value) || normalized(subject) === normalized(`${context.product.name} ${context.product.variant}`));
  const markedScope = (value: string) => /^(?:#+\s*)?(?:model|variant)\s*[:#-]?\s+(.+)$/iu.exec(value.trim())?.[1];
  const matchesSubject = (value: string) => isSubject(value) || !!markedScope(value) && isSubject(markedScope(value)!);
  const explicitOtherScope = (value: string) => !!markedScope(value) && !matchesSubject(value);
  const assertions: Occurrence[] = [];
  const identifierAt = (source: BaseSource, start: number, end: number) => {
    const text = source.text.slice(start, end).split("");
    for (const occurrence of inventory.filter((entry) => entry.literal.sourceId === source.id)) {
      for (let index = Math.max(start, occurrence.literal.start); index < Math.min(end, occurrence.literal.end); index++) text[index - start] = " ";
    }
    return [...text.join("").matchAll(/[\p{L}\p{N}][\p{L}\p{N}._-]*/gu)].some(([token]) => /\p{L}/u.test(token) && /\p{N}/u.test(token));
  };
  const policies: [Alarm["kind"], RegExp][] = [
    ["buyer-restriction", /\b(?:(?:membership(?: voucher)?|subscription|voucher|coupon)\s+(?:is\s+)?(?:required|needed)|(?:requires?|needs?)\s+(?:a\s+)?(?:membership|subscription|voucher|coupon)|(?:only\s+available\s+with|(?:only\s+)?with)\s+(?:a\s+)?(?:membership|subscription|voucher|coupon)|(?:only\s+to\s+members|members\s+only)|only\s+after\s+joining\s+(?:the\s+)?annual\s+club)\b/giu],
    ["incomplete-total", /\b(?:(?:not|without)\s+(?:tax|GST|VAT)\s+included|(?:excludes?|excluding)\s+(?:tax|GST|VAT)|(?:tax|GST|VAT)\s+(?:is\s+)?excluded|(?:delivery|shipping)\s+(?:is\s+)?charged\s+separately|mandatory\s+(?:delivery|shipping)(?:\s+charges?)?|(?:delivery|shipping)\s+(?:costs?|charges?)|(?:delivery|shipping)\s+in\s+addition|(?:delivery|shipping)\s+(?:[A-Z]{3}\s*|[$€£])\d[^.\n]*(?:mandatory|required))\b/giu],
    ["conditional-applicability", /\b(?:unless|depending on)\b[^.\n]*/giu],
    ["purchase-basis", /\b(?:(?:minimum\s+purchase\s+of|for|box\s+of|pack\s+of)\s+(?:[2-9]\d*|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+[\p{L}-]+|per[ -]month|instalments?|installments?)\b/giu],
  ];
  for (const source of context.sources) {
    const safePositive = source.text.replace(/\bno\s+(?:membership|voucher|coupon|subscription)(?:\s+or\s+(?:membership|voucher|coupon|subscription))*\s+(?:is\s+)?(?:required|needed)\b/giu, (text) => " ".repeat(text.length));
    for (const [kind, pattern] of policies) for (const match of safePositive.matchAll(pattern)) add(kind, source.id, match.index, match.index + match[0].length);
    if (containsSourceInstructions(source.text)) add("source-instruction", source.id, 0, source.text.length);
    for (const match of source.text.matchAll(/(?:^|[.!?]\s+|\n)\s*(?:(?:price\s+applies\s+to|for)\s+([^\n.!?]+?)(?:\s+only)?|([^\n.!?]+?)\s+variant\s+only)[.!?]?(?=\n|$)/giu)) {
      const subject = (match[1] ?? match[2])!.trim();
      if (singleUnit(subject)) continue;
      if (!isSubject(subject)) add("variant-contradiction", source.id, match.index, match.index + match[0].length);
    }
    for (const item of inventory.filter((entry) => entry.literal.sourceId === source.id)) {
      const { start, end } = item.literal;
      const prefix = source.text.slice(Math.max(0, start - 300), start);
      const selectedAssertion = subjects.some((subject) => new RegExp(`(?:^|[.!?]\\s+|\\n|\\bwhile\\s+)${escape(subject)}\\s+(?:costs?|is priced at|has a price of)\\s*$`, "iu").test(prefix)) || /\bcurrent\s+(?:item\s+)?price\s*:?\s*$/iu.test(prefix);
      if (selectedAssertion) assertions.push(item);
      if (selected?.id === item.id) {
        if (/\b(?:was|previous(?:\s+item)?\s+price)\s*:?\s*$/iu.test(prefix)) add("competing-amount", source.id, start, end);
        const explicitSubject = /(?:^|[.!?\n]|\bwhile\s+)([^.!?\n]+?)\s+(?:costs?|is priced at|has a price of)\s*$/iu.exec(prefix)?.[1]?.trim();
        if (explicitSubject && !selectedAssertion && !isSubject(explicitSubject)) add("variant-contradiction", source.id, start - explicitSubject.length, end);
        const inlineVariant = /^\s+for\s+(.+?)\s+only(?:[.!?]|$)/iu.exec(source.text.slice(end))?.[1];
        if (inlineVariant && !singleUnit(inlineVariant) && !isSubject(inlineVariant)) add("variant-contradiction", source.id, start, end + inlineVariant.length + 10);
        const lineStart = source.text.lastIndexOf("\n", start) + 1;
        const line = source.text.slice(lineStart, start);
        if (/^\s*(?:price\s*:?\s*)?$/iu.test(line)) {
          const previous = source.text.slice(0, lineStart).trimEnd();
          const heading = previous.slice(previous.lastIndexOf("\n") + 1).trim();
          if (explicitOtherScope(heading)) add("variant-contradiction", source.id, previous.length - heading.length, end);
          else if (heading && !matchesSubject(heading) && identifierAt(source, previous.length - heading.length, previous.length)) add("uncertain-attribution", source.id, previous.length - heading.length, end);
        }
        const cell = /^\s*\|\s*([^|]+?)\s*\|\s*$/u.exec(line)?.[1];
        if (cell && explicitOtherScope(cell)) add("variant-contradiction", source.id, lineStart, end);
        else if (cell && !matchesSubject(cell) && identifierAt(source, lineStart, start)) add("uncertain-attribution", source.id, lineStart, end);
      }
      const suffix = source.text.slice(end, end + 100);
      if (/^\s*(?:[-–—]|to)\s*(?:[A-Z]{3}\s*)?\d/u.test(suffix) || item.value.kind === "ambiguous" && item.value.reason === "range-endpoint") add("purchase-basis", source.id, start, end);
    }
  }
  if (selected) for (const assertion of assertions) {
    if (assertion.id !== selected.id && (assertion.value.kind !== "explicit" || selected.value.kind !== "explicit" || assertion.value.minorUnits !== selected.value.minorUnits || assertion.value.currency !== selected.value.currency)) add("competing-amount", assertion.literal.sourceId, assertion.literal.start, assertion.literal.end);
  }
  return alarms;
}

export function bindPriceEvidence(report: PriceReport | null, context: Context): PriceEvidence {
  const inventory = context.sources.flatMap((source) => source.moneyOccurrences);
  const blockers = new Set<Blocker>();
  const bind = (quote: z.infer<typeof Quote>): SourceRef | null => {
    const source = context.sources.find((entry) => entry.id === quote.sourceId);
    const span = source && uniqueLiteralSpan(source.text, quote.quote);
    if (!span) { blockers.add("unbound-support"); return null; }
    return { sourceId: source!.id, ...span };
  };
  const covered = (span: SourceRef, occurrence: Occurrence) => occurrence.literal.sourceId === span.sourceId && occurrence.literal.start >= span.start && occurrence.literal.end <= span.end;
  const judgment = (value: z.infer<typeof Judgment>, exact = true) => {
    const supports = value.support.map(bind);
    return value.status === "supported" && (!exact || value.scope === "exact-variant") && supports.length > 0 && supports.every(Boolean);
  };
  const attributionSupport = report?.attribution.support.map(bind).filter((span): span is SourceRef => !!span) ?? [];
  const basisSupport = report?.priceBasis.assessment.support.map(bind).filter((span): span is SourceRef => !!span) ?? [];
  const moneySupport = report ? bind(report.moneySupport) : null;
  const matching = moneySupport ? inventory.filter((entry) => covered(moneySupport, entry)) : [];
  const selected = matching.length === 1 ? matching[0] : undefined;
  const alarms = sourceAlarms(context, inventory, selected);
  const reviews: z.infer<typeof ReviewSchema>[] = [];
  if (!context.complete || context.sources.some((source) => source.textTruncated)) blockers.add("source-context-incomplete");
  if (alarms.some((alarm) => alarm.kind !== "uncertain-attribution")) blockers.add("adverse-context");
  if (alarms.some((alarm) => alarm.kind === "uncertain-attribution")) blockers.add("attribution-context-uncertain");
  if (report) {
    if (!selected) blockers.add("missing-literal-money");
    if (selected?.value.kind === "ambiguous") blockers.add("ambiguous-currency");
    if (selected?.value.kind === "explicit" && (selected.value.minorUnits !== toMinorUnits(report.amount ?? NaN) || selected.value.currency !== report.currency)) blockers.add("amount-currency-mismatch");
    if (!context.product.variant || context.product.variant !== report.variant || context.product.identity.status !== "supported" || context.product.identity.scope !== "exact-variant" || !context.product.identity.support.length || !judgment(report.attribution)) blockers.add("variant-unresolved");
    if (report.priceBasis.kind !== "single-item" || !judgment(report.priceBasis.assessment)) blockers.add("non-scalar-basis");
    if (report.sourceReviews.length !== context.sources.length || new Set(report.sourceReviews.map((review) => review.sourceId)).size !== context.sources.length) blockers.add("source-review-missing");
    for (const source of context.sources) {
      const matches = report.sourceReviews.filter((review) => review.sourceId === source.id);
      if (matches.length !== 1) { blockers.add("source-review-missing"); continue; }
      const review = matches[0]!;
      if (!review.reviewComplete || review.relation === "unknown" || !judgment(review.assessment, false)) blockers.add("source-review-incomplete");
      if (review.assessment.support.some((support) => support.sourceId !== source.id)) blockers.add("unbound-support");
      const mentions: z.infer<typeof ReviewSchema>["moneyMentions"] = [];
      for (const mention of review.moneyMentions) {
        const span = bind({ sourceId: source.id, quote: mention.quote });
        const candidates = span ? inventory.filter((entry) => covered(span, entry)) : [];
        if (!candidates.length) { blockers.add("unaccounted-money"); continue; }
        mentions.push({ occurrenceIds: candidates.map((occurrence) => occurrence.id), role: mention.role, support: span!, assessmentSupport: mention.assessment.support.map(bind).filter((entry): entry is SourceRef => !!entry) });
        const expectedScope = { selected: "selected-variant", "other-product": "other-subjects", reference: "reference-only", "extra-cost": "selected-variant", unresolved: "unresolved" }[mention.role];
        if (mention.scope !== expectedScope || !judgment(mention.assessment, mention.role === "selected") || mention.role === "unresolved" || mention.role === "extra-cost") blockers.add("conflicting-observations");
        const semanticSupport = mention.assessment.support.map(bind);
        if (!semanticSupport.length || semanticSupport.some((support) => !support || support.sourceId !== source.id || support.start < span!.start || support.end > span!.end)) blockers.add("unbound-support");
        if (candidates.some((occurrence) => occurrence.id === selected?.id) !== (mention.role === "selected") || mention.role === "selected" && (candidates.length !== 1 || review.relation !== "applies")) blockers.add("conflicting-observations");
      }
      const sourceMoney = inventory.filter((entry) => entry.literal.sourceId === source.id);
      const coveredIds = mentions.flatMap((mention) => mention.occurrenceIds);
      if (coveredIds.length !== sourceMoney.length || new Set(coveredIds).size !== sourceMoney.length) blockers.add("unaccounted-money");
      const conditions: SourceRef[] = [];
      for (const condition of review.conditions) {
        const support = bind({ sourceId: source.id, quote: condition.quote });
        if (support) conditions.push(support);
        if (!support || condition.interpretation !== "included-in-amount") blockers.add("conditions-unresolved");
      }
      reviews.push({ sourceId: source.id, moneyMentions: mentions, conditions, assessmentSupport: review.assessment.support.map(bind).filter((entry): entry is SourceRef => !!entry) });
    }
  } else blockers.add("missing-price-report");
  const common = { report, observations: matching.map((entry) => entry.id), reviews, alarms, moneySupport, attributionSupport, basisSupport };
  if (!matching.length) return { ...common, state: "absent", reason: report ? "missing-literal-money" : "missing-price-report" };
  if (!blockers.size && selected?.value.kind === "explicit" && context.product.variant) return { ...common, state: "applicable", selectedOccurrenceId: selected.id, usableMoney: { minorUnits: selected.value.minorUnits, currency: selected.value.currency }, variant: context.product.variant, basis: "source-based-ai-observation", merchantVerified: false };
  if (!blockers.size) blockers.add("missing-literal-money");
  return { ...common, state: "observed", blockers: [...blockers] };
}

export function bindPriceSources(sources: BaseSource[]): ResearchSource[] {
  return sources.map((source) => ({ ...source, moneyOccurrences: moneyInventory([source]) }));
}
export function validPriceSources(sources: ResearchSource[]): boolean {
  return sources.every((source) => JSON.stringify(source.moneyOccurrences) === JSON.stringify(moneyInventory([source])));
}

export function validPriceEvidence(value: PriceEvidence, context: Context): boolean {
  return JSON.stringify(value) === JSON.stringify(bindPriceEvidence(value.report, context));
}
