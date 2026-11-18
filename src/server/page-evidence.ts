import { createHash } from "node:crypto";
import { FeatureSchema, type Feature, type Preferences } from "../domain/contracts";
import type { ResearchProduct, ResearchSnapshot } from "../domain/research";

type Highlight = Readonly<{ text: string; clipped: boolean }>;
type Source = { sourceIndex: number; url: string; title: string; highlights: Highlight[] };
export type NativeObservation = { name: string; url: string; identityQuote: string | null; quotedFacts: string[]; priceQuote: string | null };
export type EvidenceDecision = {
  sourceIndex: number;
  path: "source-identity" | "native-field";
  code: string;
  field?: string;
  highlight?: number;
  start?: number;
  end?: number;
};
type Scope = { name: string; identity: string; text: string; highlight: number; start: number; identityEnd: number; end: number };

function cleanText(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}
const headphoneClass = "(?:headphones|earbuds|headset)";
const headphoneDesign = "(?:over-ear|on-ear|in-ear|open-back|closed-back|noise-cancell?ing)";
const categoryStatements: Record<NonNullable<Preferences["hard"]["category"]>, string> = {
  headphones: `(?:a |a pair of )?(?:(?:wireless|wired|Bluetooth|${headphoneDesign}) )*${headphoneClass}(?: designed for neutral listening)?`,
  laptops: "(?:a |an )?(?:(?:gaming|business|ultraportable|convertible|thin and light|Windows|\\d{1,2}(?:\\.\\d)?-inch) )*(?:laptop|notebook)(?: computer)?",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unresolvedConstraints(preferences: Preferences): string[] {
  return [
    ...preferences.hard.requiredFeatures.map((feature) => `${feature.replaceAll("-", " ")} needs independent verification`),
    ...(preferences.hard.excludedBrands.length ? ["Manufacturer identity and brand exclusions need independent verification"] : []),
    ...(preferences.hard.budget ? [`Current affordability within ${preferences.hard.budget.currency} ${preferences.hard.budget.amount} is unverified`] : []),
    `Stock and delivery to ${preferences.hard.region} are unverified`,
  ];
}

type Span = Readonly<{ highlight: number; start: number; end: number }>;
type Anchor =
  | Readonly<{ kind: "heading"; identity: CompletePassage; scope: Scope }>
  | Readonly<{ kind: "direct"; identity: CompletePassage }>;
type SubjectProof = Readonly<{ name: string; selected: Anchor; anchors: readonly [Anchor, ...Anchor[]] }>;
type Completion = { completion: "complete" } | { completion: "open" };
type SourcePassage = Span & Completion & { text: string; kind: "content" | "section" | "context-heading" | "identity" | "boundary"; region: number; scope: Scope | null };
type CompletePassage = Extract<SourcePassage, { completion: "complete" }>;
type Boundary = Readonly<{ start: number; end: number; kind: "gap" | "selector" | "section" | "heading" }>;
type HighlightContext = Readonly<{ item: Highlight; boundaries: readonly Boundary[] }>;
type SourceContext = Readonly<{ source: Source; sourceId: string; passages: readonly SourcePassage[]; subjects: readonly SubjectProof[] }>;
type Ownership =
  | Readonly<{ kind: "own"; basis: "exact-statement" | "valid-scope"; predicate: string }>
  | Readonly<{ kind: "foreign" | "unresolved" }>;
type PriceGate =
  | Readonly<{ kind: "unobstructed" }>
  | Readonly<{ kind: "withheld"; reason: "owned-condition" | "unresolved-context"; witness: Span }>;
type AdverseLedger = Readonly<{ absentFeatures: Record<Feature, Span | null>; excludedManufacturer: Span | null }>;
const eligibleSubject = Symbol("eligible-subject");
type EligibleSubject = Readonly<{ [eligibleSubject]: true; proof: SubjectProof; price: PriceGate }>;
type SubjectDecision =
  | Readonly<{ kind: "excluded"; proof: SubjectProof; ledger: AdverseLedger }>
  | Readonly<{ kind: "eligible"; subject: EligibleSubject; ledger: AdverseLedger }>;

function sourceSpan({ highlight, start, end }: Span): Span {
  return { highlight, start, end };
}

const wiredMedium = "wired(?: (?:audio|connections?|connectivity))?";
const connectionVerb = "(?:supports?|uses?|offers?|provides?|has|have|can (?:support|use))";
const headphoneDescriptor = `(?:${headphoneDesign}|lightweight|portable|gaming|stereo)`;
const exclusiveWiredHeadphones = `(?:an? |the )?(?:pair of )?(?:${headphoneDescriptor} )*wired[- ]only (?:${headphoneDescriptor} )*${headphoneClass}`;
const exclusiveWired = new RegExp(`^(?:(?:is|are) (?:wired[- ]only|${exclusiveWiredHeadphones})|(?:only ${connectionVerb}|${connectionVerb} only|can only (?:support|use)) ${wiredMedium}|${connectionVerb} ${wiredMedium} only|${connectionVerb} wired-only(?: (?:audio|connections?|connectivity))?)[.!]?$`, "i");
type FeatureDescriptor = Readonly<{ terms: string; wholeProperty: RegExp; labelNegative: RegExp; exclusive: RegExp | null }>;
function featureDescriptor(terms: string, neutralNouns: string | null = null, exclusive: RegExp | null = null): FeatureDescriptor {
  return {
    terms,
    wholeProperty: new RegExp(`^(?:an? |any )?(?:${terms})${neutralNouns ? `(?: (?:${neutralNouns}))?` : ""}$`, "i"),
    labelNegative: new RegExp(`^(?:${terms})\\s*:\\s*(?:no|false|not supported|unavailable)[.!]?$`, "i"),
    exclusive,
  };
}
const featureDescriptors: Record<Feature, FeatureDescriptor> = {
  "active-noise-cancelling": featureDescriptor("active[- ]noise[- ]cancell?(?:ing|ation)|ANC", "support"),
  wireless: featureDescriptor("wireless|bluetooth", "audio|support|connectivity|connections?", new RegExp(`${exclusiveWired.source}|^Connectivity:\\s*wired[- ]only[.!]?$`, "i")),
  multipoint: featureDescriptor("multi[- ]?point", "support|connectivity|connections?"),
  "long-battery-life": featureDescriptor("long[- ]battery(?:[- ]life)?"),
  lightweight: featureDescriptor("light[- ]?weight"),
  "oled-display": featureDescriptor("OLED", "display|screen|panel|support"),
  "high-memory": featureDescriptor("32 ?GB|high[- ]memory", "(?:of )?memory|RAM"),
  "long-battery": featureDescriptor("long[- ]battery(?:[- ]life)?"),
  portable: featureDescriptor("portable|portability"),
};
const attributeLabel = new RegExp(`^(?:${Object.values(featureDescriptors).map((descriptor) => descriptor.terms).join("|")}|Connectivity|Battery(?: life| runtime)?|Runtime|Driver(?: size)?|Transducer(?: size)?|Weight|Memory|Price|Sale price|Regular price|List price|Savings):\\s*\\S`, "i");
const fieldRecord = /^[\p{L}\p{N}][\p{L}\p{N} ()/-]*:[ \t]*\S/u;
const scopedSubject = /^(?:These (?:headphones|earbuds|laptops)|The (?:headphones|earbuds|laptop)|It|They)\s+/i;

const forbiddenIdentity = /\b(?:not|replacement|accessor(?:y|ies)|cables?|cases?|covers?|pads?|stands?|best|guide|comparison|versus|for)\b|[?/:]/i;
const classPhrases: Record<NonNullable<Preferences["hard"]["category"]>, string> = {
  headphones: `(?:Premium )?(?:(?:wireless|wired|Bluetooth|over-ear|on-ear|in-ear|open-back|closed-back|noise cancell?ing|noise-cancell?ing) )*${headphoneClass}`,
  laptops: "(?:(?:gaming|business|ultraportable|convertible|thin and light|Windows|\\d{1,2}(?:\\.\\d)?-inch) )*(?:laptop|notebook)(?: computer)?",
};
const boundaryPattern = /\.{3}|…|\b(?:variations?|related products?|recommended products?|you may also like|accessories|compare(?: products)?|comparison|choose (?:a |your )?(?:colou?r|variant)|select (?:a |your )?(?:colou?r|variant))\b/ig;
function sourceBoundaries(raw: string): Boundary[] {
  const headings: Boundary[] = [...raw.matchAll(/(?:^|\s)(#{1,6})[ \t]+/g)].map((match) => ({
    start: match.index + match[0].indexOf("#"), end: match.index + match[0].length, kind: "heading",
  }));
  const markers = [...raw.matchAll(new RegExp(boundaryPattern))].flatMap((match): Boundary[] => {
    const end = match.index + match[0].length;
    if (/\.{3}|…/.test(match[0])) return [{ start: match.index, end, kind: "gap" }];
    const prefix = raw.slice(0, match.index);
    const linePrefix = prefix.slice(prefix.lastIndexOf("\n") + 1);
    const suffix = raw.slice(end);
    const heading = headings.find((candidate) => candidate.end === match.index);
    const labelStart = /^\s*$/.test(linePrefix) || heading !== undefined;
    const labelEnd = /^[ \t]*(?:$|\n|#)/.test(suffix);
    const selector = /^variations?$/i.test(match[0]) && /^[ \t]+\*(?:[ \t]+\*)?[ \t]*\[/.test(suffix);
    return labelStart && labelEnd || selector
      ? [{ start: heading?.start ?? match.index, end, kind: selector ? "selector" : "section" }] : [];
  });
  return [...headings.filter((heading) => !markers.some((marker) => marker.start === heading.start)), ...markers].sort((a, b) => a.start - b.start);
}

function headingScopes(input: Source, highlights: readonly HighlightContext[], preferences: Preferences, decisions: EvidenceDecision[]): Scope[] {
  const category = preferences.hard.category;
  if (!category) return [];
  const scopes: Scope[] = [];
  const record = (code: string, detail: Partial<EvidenceDecision> = {}) => decisions.push({ sourceIndex: input.sourceIndex, path: "source-identity", code, ...detail });
  const titleName = input.title.split(" | ")[0].trim();
  for (const [highlight, context] of highlights.entries()) {
    const raw = context.item.text;
    for (const marker of context.boundaries.filter((boundary) => boundary.kind === "heading")) {
      const start = marker.start;
      const contentStart = marker.end;
      const rest = raw.slice(contentStart);
      const newline = rest.indexOf("\n");
      const intactName = newline >= 0 ? cleanText(rest.slice(0, newline).replace(/\s+#+$/, "")) : null;
      const flattened = rest.startsWith(titleName) && /\s|$/.test(rest.charAt(titleName.length));
      const name = intactName && intactName.length <= 160 && !intactName.includes(" #") ? intactName : flattened ? titleName : null;
      if (!name || titleName !== name) { record("variant-mismatch", { highlight, start }); continue; }
      if (/^(?:Premium|New|Wireless|Wired|Bluetooth|Over-ear|On-ear|In-ear|Gaming|Business)(?:\s+(?:wireless|wired|Bluetooth|over-ear|on-ear|in-ear|noise cancell?ing|gaming|business))*\s+(?:headphones|earbuds|headset|laptop|notebook)$/i.test(name)) { record("missing-identity", { highlight, start }); continue; }
      if (name.length < 3 || name.split(/\s+/).length < 2 || forbiddenIdentity.test(name)) { record("ambiguous-scope", { highlight, start }); continue; }
      const designationEnd = contentStart + (intactName === name ? rest.indexOf("\n") : name.length);
      const headingClass = new RegExp(`^.+?\\s+${classPhrases[category]}(?:\\s+-\\s+[\\p{L}\\p{N} +().-]+|\\s+\\([\\p{L}\\p{N} +.-]+\\))?$`, "iu");
      let identityEnd = designationEnd;
      if (!headingClass.test(name)) {
        const suffix = raw.slice(designationEnd);
        const subtitle = new RegExp(`^\\s+(${classPhrases[category]})(?=\\s|[.!]|$)`, "i").exec(suffix);
        if (!subtitle) { record("missing-class", { highlight, start }); continue; }
        identityEnd += subtitle[0].length;
      }
      const tail = raw.slice(identityEnd);
      if (/^[ \t]+(?:Pro|Plus|Max|Ultra|Special Edition|cases?|covers?|cables?|pads?|stands?|for)\b/i.test(tail)) { record("variant-mismatch", { highlight, start }); continue; }
      const boundary = context.boundaries.find((candidate) => candidate.start >= identityEnd && candidate.kind !== "heading");
      let end = boundary?.start ?? raw.length;
      for (const next of context.boundaries.filter((candidate) => candidate.start >= identityEnd && candidate.kind === "heading")) {
        const label = cleanText(raw.slice(next.end));
        if (/^(?:Description|Specifications|Key Features|Features|Highlights)(?=\s|$)/i.test(label)) continue;
        const nextStart = next.start;
        if (nextStart < end) end = nextStart;
        break;
      }
      const lineEnd = /\n|[.!?](?=\s|$)/.exec(raw.slice(identityEnd));
      const recordEnd = Math.min(end, lineEnd ? identityEnd + lineEnd.index + (lineEnd[0] === "\n" ? 0 : 1) : raw.length);
      const identityRecordEnd = priceRecordStart.test(raw.slice(identityEnd).trimStart()) ? identityEnd : recordEnd;
      if (completion(context, start, identityRecordEnd, "identity", name).completion !== "complete") { record("ambiguous-scope", { highlight, start, end: identityRecordEnd }); continue; }
      const text = cleanText(raw.slice(start, end));
      const identity = cleanText(raw.slice(start, identityEnd));

      if (/\bearbuds?\b/i.test(text) && /\b(?:over-ear|on-ear)\b/i.test(text)) { record("contradiction", { highlight, start, end }); continue; }
      record("admitted", { highlight, start, end: identityEnd });
      scopes.push({ name, identity, text, highlight, start, identityEnd, end });
    }
  }
  if (!decisions.some((decision) => decision.sourceIndex === input.sourceIndex)) record("missing-identity");
  return scopes;
}

const sectionLabels = "Description|Specifications|Key Features|Features|Highlights";
const scalarAmount = "(?:0|[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d*)(?:\\.\\d{2})?";
const money = `(?:SGD|USD|EUR|GBP|AUD|JPY|(?:S|US)\\$|[€£¥])\\s*${scalarAmount}`;
const priceRecordStart = /^(?:[A-Z]{3}\s*|[A-Z]{0,2}\$\s*|[€£¥]\s*)\d/;
const contextPrice = new RegExp(`^(?:Sale price:?\\s*)?${money}\\s+(?:was|regular price:?|list price:?)\\s+${money}(?:\\s+(?:SGD|USD|EUR|GBP|AUD|JPY))?(?:\\s+(?:You Save|Save|Savings:?)\\s+${money})?$`, "i");
const singlePrice = new RegExp(`^(?:Price:?\\s*)?${money}$`, "i");
const pricePart = new RegExp(`^(?:(?:Price|Sale price|Regular price|List price|Savings):?\\s*|was\\s+|You Save\\s+|Save\\s+)?${money}(?:\\s+(?:SGD|USD|EUR|GBP|AUD|JPY))?$`, "i");
const clauseVerb = "(?:only\\s+)?(?:(?:is|are|has|have|supports?|uses?|offers?|features?|provides?|weighs?|costs?|includes?|does|do|was|were)(?:n['’]t)?|can|can't|can’t|cannot|comes|retails|lacks?|requires?)\\b";
const priceCondition = /\b(?:trade[- ]?in|qualifying|subscription|members?(?:hip)?|deposit|cashback|rebate|installments?|instalments?|per (?:month|week|day|year)|replacement|accessor(?:y|ies)|checkout|conditions?|terms|coupon|voucher)\b/i;
type FeatureProposition = Readonly<{ kind: "absence"; property: string }> | Readonly<{ kind: "unknown" }>;
function featureProposition(predicate: string): FeatureProposition {
  const text = predicate.replace(/[.!]$/, "");
  const operator = /^(?:(?:is|are) not equipped with|(?:does not|doesn't|do not|don't|cannot|can't) (?:support|have|include|offer|provide|use)|(?:has|have) no|(?:is|are) (?:without|not|no longer)|isn't|aren't|no longer|no|without|lacks?|not equipped with) (.+)$/i;
  const absence = operator.exec(text) ?? new RegExp(`^costs ${money} without (.+)$`, "i").exec(text);
  return absence ? { kind: "absence", property: absence[1] } : { kind: "unknown" };
}

const modelLabel = /^[A-Z][\p{L}\p{N}.-]*(?:\s+(?:[A-Z\d][\p{L}\p{N}.-]*|[-+]|\([\p{L}\p{N} .+-]+\)))+$/u;
function isModelLabel(text: string): boolean {
  return modelLabel.test(text) && !/[.!?]$/.test(text)
    && !new RegExp(`^(?:${clauseVerb}|no\\b|without\\b|not equipped with\\b|you get\\b)`, "i").test(text);
}
function headingKind(text: string): "section" | "context-heading" | "boundary" | null {
  if (!/^#{1,6}\s/.test(text)) return null;
  const label = text.replace(/^#{1,6}\s+/, "").replace(/\s+#+$/, "");
  if (new RegExp(`^(?:${sectionLabels})$`, "i").test(label)) return "section";
  if (priceCondition.test(label) || /\b(?:payment|pricing|price|offer|purchase|details|information|notes|disclaimer)\b/i.test(label)) return "context-heading";
  return isModelLabel(label) ? "boundary" : "context-heading";
}

function completion(context: HighlightContext, start: number, end: number, role: "identity" | "heading" | "content", name: string | null): Completion {
  const text = cleanText(context.item.text.slice(start, end));
  if (/[.!?]$/.test(text)) return { completion: "complete" };
  const rest = context.item.text.slice(end);
  const next = rest.trimStart();
  if (!next) return { completion: context.item.clipped ? "open" : "complete" };
  const nextStart = end + rest.length - next.length;
  const lineEnd = context.item.text.indexOf("\n", nextStart);
  const nextLine = context.item.text.slice(nextStart, lineEnd < 0 ? context.item.text.length : lineEnd);
  const boundary = context.boundaries.find((candidate) => candidate.start === nextStart);
  const newline = /^[ \t]*\n/.test(rest);
  const namedRecord = name !== null && (namedPredicate(name, nextLine) !== null
    || new RegExp(`^(?:The )?${escapeRegex(name)}\\s+.+[.!?]$`, "i").test(nextLine));
  const scopedRecord = scopedSubject.test(nextLine) && /[.!?]$/.test(nextLine)
    && new RegExp(`^${clauseVerb}`, "i").test(nextLine.replace(scopedSubject, ""));
  const nextRecord = fieldRecord.test(nextLine) || pricePart.test(nextLine) || namedRecord || scopedRecord;
  if (role !== "content") {
    if (boundary?.kind === "selector" || priceRecordStart.test(nextLine)) return { completion: "complete" };
    if (boundary?.kind === "heading" || newline && (role === "heading" || boundary || nextRecord)) return { completion: "complete" };
  }
  if (contextPrice.test(text) && boundary?.kind === "gap") return { completion: "complete" };
  const structured = attributeLabel.test(text) || pricePart.test(text) || contextPrice.test(text);
  if (structured && newline && (boundary || nextRecord)) return { completion: "complete" };
  return { completion: "open" };
}

function isComplete(passage: SourcePassage): passage is CompletePassage {
  return passage.completion === "complete";
}

function namedPredicate(name: string, text: string): string | null {
  return new RegExp(`^(?:The )?${escapeRegex(name)}\\s+(${clauseVerb}.*)$`, "i").exec(text)?.[1] ?? null;
}

function ownership(context: SourceContext, subject: SubjectProof, passage: CompletePassage): Ownership {
  if (passage.kind !== "content" && passage.kind !== "context-heading") return { kind: "unresolved" };
  const text = passage.text.replace(/^#{1,6}\s+/, "").replace(/[‘’]/g, "'");
  const exact = namedPredicate(subject.name, text);
  const predicate = exact ?? text.replace(scopedSubject, "");
  const compound = /[.!?]\s+[A-Z0-9]|;|[,;]\s+[A-Z][a-z]+\s+[A-Z0-9]|\b(?:and|while|but|whereas|or)\s+[A-Z][a-z]+\s+[A-Z0-9]/.test(text);
  const comparison = /\b(?:versus|compared (?:with|to)|unlike)\b|\bvs\.?\s/i.test(text);
  const foreignTarget = /\b(?:for|on|with|to)\s+(?:(?:the|a|an)\s+)?(?:[A-Z][a-z]+\s+[A-Z0-9][\p{L}\p{N}-]*|(?:Pro|Plus|Max|Ultra|Black|Teal|White)\s+variant)\b/u.test(predicate)
    || /\b(?:for|on|with|to)\s+(?:the\s+)?(?:another|other|different|pro|plus|max|ultra|black|teal|white)\s+(?:model|variant|edition)\b/i.test(predicate)
    || context.subjects.some((other) => other.name !== subject.name && predicate.toLowerCase().includes(other.name.toLowerCase()));
  if (compound || comparison || foreignTarget) return { kind: "foreign" };
  if (/\?|\b(?:if|might|may|perhaps|hypothetically|would)\b/i.test(text)) return { kind: "unresolved" };
  if (exact) return { kind: "own", basis: "exact-statement", predicate };
  if (new RegExp(`^(?:The )?${escapeRegex(subject.name)}\\b`, "i").test(text)) return { kind: "foreign" };
  if (predicate === text && !new RegExp(`^${clauseVerb}`, "i").test(text) && new RegExp(`^(?:The )?[A-Z][\\p{L}\\p{N} -]+?\\s+${clauseVerb}`, "u").test(text)) return { kind: "foreign" };
  if (!passage.scope || passage.scope.name !== subject.name) return { kind: "unresolved" };
  const inherited = new RegExp(`^(?:${clauseVerb}|(?:without|no|not equipped with|you get)\\b)`, "i").test(predicate)
    || attributeLabel.test(predicate)
    || pricePart.test(predicate) || contextPrice.test(predicate);
  return inherited ? { kind: "own", basis: "valid-scope", predicate } : { kind: "unresolved" };
}

function sourceContext(source: Source, sourceId: string, native: readonly NativeObservation[], preferences: Preferences, decisions: EvidenceDecision[]): SourceContext {
  const highlights = source.highlights.map((item): HighlightContext => ({ item, boundaries: sourceBoundaries(item.text) }));
  const scopes = headingScopes(source, highlights, preferences, decisions);
  const subjects: SubjectProof[] = [];
  const entries: SourcePassage[] = [];
  let region = 0;
  for (const [highlight, highlightContext] of highlights.entries()) {
    const raw = highlightContext.item.text;
    region++;
    const local = scopes.filter((scope) => scope.highlight === highlight);
    const cuts = new Set([0, raw.length]);
    const boundaries = highlightContext.boundaries;
    for (const scope of local) for (const position of [scope.start, scope.identityEnd, scope.end]) cuts.add(position);
    for (const boundary of boundaries) {
      if (local.some((scope) => boundary.start >= scope.start && boundary.start < scope.identityEnd)) continue;
      cuts.add(boundary.start);
      if (boundary.kind !== "heading") cuts.add(boundary.end);
      else {
        const section = new RegExp(`^(?:${sectionLabels})(?=\\s|$)`, "i").exec(raw.slice(boundary.end));
        if (section) cuts.add(boundary.end + section[0].length);
      }
    }
    const separator = /\n+|(?<=[.!?])\s+(?=[A-Z0-9])/g;
    const sections = [...raw.matchAll(separator)];
    for (const match of sections) {
      if (local.some((scope) => match.index >= scope.start && match.index < scope.identityEnd)) continue;
      cuts.add(match.index); cuts.add(match.index + match[0].length);
    }
    const ordered = [...cuts].sort((a, b) => a - b);
    for (let index = 0; index < ordered.length - 1; index++) {
      const start = ordered[index], end = ordered[index + 1];
      const text = cleanText(raw.slice(start, end)).replace(/^[-*]\s+/, "");
      if (!text) continue;
      const identity = local.find((scope) => start === scope.start && end === scope.identityEnd);
      const scope = local.find((scope) => start >= scope.identityEnd && end <= scope.end) ?? null;
      const heading = headingKind(text);
      const model = !heading && !pricePart.test(text) && !priceCondition.test(text) && isModelLabel(text);
      const state: Completion = identity ? { completion: "complete" } : completion(highlightContext, start, end, heading || model ? "heading" : "content", scope?.name ?? null);
      const marker = boundaries.find((boundary) => boundary.start === start && boundary.kind !== "heading");
      const isBoundary = marker && (marker.kind === "gap" || marker.kind === "selector" || state.completion === "complete")
        || !identity && state.completion === "complete" && (model || heading === "boundary");
      const kind = identity ? "identity" : isBoundary ? "boundary" : heading === "boundary" ? "context-heading" : heading ?? "content";
      if (isBoundary || identity && entries.some((entry) => entry.highlight === highlight && entry.kind === "identity")) region++;
      entries.push({ highlight, start, end, text, kind, ...state, region, scope });
      if (isBoundary) region++;
    }
  }
  for (const scope of scopes) {
    const identity = entries.filter(isComplete).find((passage) => passage.kind === "identity" && passage.highlight === scope.highlight && passage.start === scope.start);
    if (!identity) continue;
    const anchor: Anchor = { kind: "heading", identity, scope };
    const prior = subjects.findIndex((subject) => subject.name === scope.name);
    if (prior < 0) subjects.push({ name: scope.name, selected: anchor, anchors: [anchor] });
    else subjects[prior] = { ...subjects[prior], anchors: [...subjects[prior].anchors, anchor] };
  }
  const context: SourceContext = { source, sourceId, passages: entries, subjects };
  for (const scope of scopes) {
    const subject = subjects.find((candidate) => candidate.name === scope.name)!;
    let intact = true;
    for (const passage of entries) {
      if (passage.scope !== scope) continue;
      if (!intact) passage.scope = null;
      else if (passage.kind === "boundary" || passage.kind === "content" && (!isComplete(passage) || ownership(context, subject, passage).kind !== "own")) {
        intact = false;
        passage.scope = null;
      }
    }
  }
  if (!scopes.length && preferences.hard.category) {
    for (const observation of native) {
      const name = cleanText(observation.name);
      const category = new RegExp(`^(?:The )?${escapeRegex(name)} (?:is|are) ${categoryStatements[preferences.hard.category]}(?: with [^.!?]+)?[.!]?$`, "i");
      const matches = entries.filter(isComplete).filter((passage) => category.test(passage.text) && observation.quotedFacts.some((quote) => cleanText(quote) === passage.text));
      const first = matches[0];
      if (!first) continue;
      const selected: Anchor = { kind: "direct", identity: first };
      const proof: SubjectProof = { name, selected, anchors: [selected, ...matches.slice(1).map((passage): Anchor => ({ kind: "direct", identity: passage }))] };
      if (ownership(context, proof, first).kind === "own" && !subjects.some((subject) => subject.name === name)) subjects.push(proof);
    }
  }
  for (const [index, subject] of subjects.entries()) {
    const anchors: [Anchor, ...Anchor[]] = [...subject.anchors];
    for (const passage of entries.filter(isComplete)) {
      const owner = ownership(context, subject, passage);
      if (owner.kind !== "own" || owner.basis !== "exact-statement" || anchors.some((anchor) => anchor.identity.highlight === passage.highlight && anchor.identity.start === passage.start)) continue;
      anchors.push({ kind: "direct", identity: passage });
    }
    subjects[index] = { ...subject, anchors };
  }
  return context;
}

function assessSubject(context: SourceContext, proof: SubjectProof, preferences: Preferences): SubjectDecision {
  const absentFeatures: Record<Feature, Span | null> = {
    "active-noise-cancelling": null, wireless: null, multipoint: null, "long-battery-life": null,
    lightweight: null, "oled-display": null, "high-memory": null, "long-battery": null, portable: null,
  };
  let excludedManufacturer: Span | null = preferences.hard.excludedBrands.some((brand) =>
    new RegExp(`^(?:The )?${escapeRegex(brand)}\\b`, "i").test(proof.name)
    || new RegExp(`^(?:The )?${escapeRegex(brand)} ${escapeRegex(proof.name)}(?:\\W|$)`, "i").test(context.source.title),
  ) ? sourceSpan(proof.selected.identity) : null;
  let price: PriceGate = { kind: "unobstructed" };
  let directPriceWitness: Span | null = null;
  const regions = new Set(proof.anchors.map((anchor) => anchor.identity.region));
  for (const passage of context.passages) {
    if (passage.kind !== "content" && passage.kind !== "context-heading" && isComplete(passage)) continue;
    const owner: Ownership = isComplete(passage) ? ownership(context, proof, passage) : { kind: "unresolved" };
    if (owner.kind === "own") {
      const proposition = featureProposition(owner.predicate);
      for (const feature of FeatureSchema.options) {
        const descriptor = featureDescriptors[feature];
        if (proposition.kind === "absence" && descriptor.wholeProperty.test(proposition.property) || descriptor.labelNegative.test(owner.predicate) || descriptor.exclusive?.test(owner.predicate)) absentFeatures[feature] ??= sourceSpan(passage);
      }
      if (preferences.hard.excludedBrands.some((brand) => new RegExp(`^(?:is|are|was|were) (?:made|manufactured) by ${escapeRegex(brand)}[.!]?$`, "i").test(owner.predicate))) excludedManufacturer ??= sourceSpan(passage);
    }
    if (price.kind === "withheld" || owner.kind === "foreign") continue;
    if (owner.kind === "own" && priceCondition.test(owner.predicate)) price = { kind: "withheld", reason: "owned-condition", witness: sourceSpan(passage) };
    else if (owner.kind === "own" && new RegExp(`\\b(?:costs?|retails|priced|listed)\\b.*${money}`, "i").test(owner.predicate)) {
      if (directPriceWitness || proof.selected.kind === "heading" && passage.scope !== proof.selected.scope) price = { kind: "withheld", reason: "unresolved-context", witness: sourceSpan(passage) };
      directPriceWitness ??= sourceSpan(passage);
    }
    else if (proof.selected.kind === "heading" && passage.scope && passage.scope !== proof.selected.scope && (pricePart.test(passage.text) || contextPrice.test(passage.text))) price = { kind: "withheld", reason: "unresolved-context", witness: sourceSpan(passage) };
    else if (owner.kind === "unresolved" && (regions.has(passage.region) || !isComplete(passage) && namedPredicate(proof.name, passage.text) !== null)) {
      const beforeHeading = proof.selected.kind === "heading" && passage.highlight === proof.selected.identity.highlight && passage.end <= proof.selected.identity.start;
      if (!beforeHeading || priceCondition.test(passage.text)) price = { kind: "withheld", reason: "unresolved-context", witness: sourceSpan(passage) };
    }
  }
  const ledger = { absentFeatures, excludedManufacturer };
  return excludedManufacturer || preferences.hard.requiredFeatures.some((feature) => absentFeatures[feature])
    ? { kind: "excluded", proof, ledger }
    : { kind: "eligible", subject: { [eligibleSubject]: true, proof, price }, ledger };
}

function projectPositive(context: SourceContext, subject: EligibleSubject, native: readonly NativeObservation[], decisions: EvidenceDecision[]): Pick<ResearchProduct, "facts" | "price"> {
  const { proof } = subject;
  const { selected } = proof;
  const { sourceId } = context;
  const record = (code: string, field: string) => decisions.push({ sourceIndex: context.source.sourceIndex, path: "native-field", code, field, ...sourceSpan(selected.identity) });
  const facts: ResearchProduct["facts"] = [];
  let price: ResearchProduct["price"] = null;

  const featurePhrase = `(?:${Object.values(featureDescriptors).map((descriptor) => descriptor.terms).join("|")})(?: (?:audio|support|display|memory))?`;
  const booleanFeature = new RegExp(`^(?:${Object.values(featureDescriptors).map((descriptor) => descriptor.terms).join("|")}|Connectivity):\\s*(?:yes|no|true|false|supported|not supported|available|unavailable|wired[- ]only|wireless)$`, "i");
  const runtime = "(?:up to )?\\d+(?:\\.\\d+)? (?:hours?|hrs?)(?: of (?:playback|music|battery life))?(?: on a full charge| per charge)?(?: with (?:ANC|noise cancelling) (?:on|off))?";
  const scopedPredicates = [
    new RegExp(`^(?:Battery(?: life| runtime)?|Runtime):\\s*${runtime}$`, "i"),
    /^(?:Driver(?: size)?|Transducer(?: size)?):\s*\d+(?:\.\d+)?\s*mm$/i,
    /^(?:Weight:\s*|Weighs?\s+)\d+(?:\.\d+)?\s*(?:g|kg|grams?|kilograms?)$/i,
    /^(?:Memory:\s*)\d+\s*GB(?: RAM)?$/i,
    new RegExp(`^(?:supports?|offers?|features?|provides?|includes?|has|have) (?:an? )?${featurePhrase}(?: and ${featurePhrase})*$`, "i"),
    new RegExp(`^(?:does not|doesn't|do not|don't|cannot|can't|can) (?:support|have|include|offer|provide|use) (?:an? )?${featurePhrase}$`, "i"),
    new RegExp(`^(?:is|are) (?:not |no longer )?${featurePhrase}$`, "i"),
    new RegExp(`^(?:isn't|aren't) ${featurePhrase}$`, "i"),
    new RegExp(`^(?:lacks?|without|no) (?:an? )?${featurePhrase}$`, "i"),
    new RegExp(`^(?:Has|Have|You get) ${runtime}$`, "i"),
  ];

  function admissibleFact(predicate: string): boolean {
    const text = predicate.replace(/[.!]$/, "");
    return booleanFeature.test(text) || scopedPredicates.some((pattern) => pattern.test(text)) || exclusiveWired.test(text);
  }
  if (selected.kind === "heading") {
    const scope = selected.scope;
    const entries = context.passages.filter((passage) => passage.highlight === scope.highlight && passage.start >= scope.identityEnd && passage.end <= scope.end);
    const priceBlocks: string[] = [];
    let priceStart: number | null = null;
    let priceEnd = 0;
    const finishPrice = () => {
      if (priceStart !== null) priceBlocks.push(cleanText(context.source.highlights[scope.highlight].text.slice(priceStart, priceEnd)));
      priceStart = null;
    };
    for (const passage of entries) {
      if (isComplete(passage) && passage.scope === scope && (pricePart.test(passage.text) || contextPrice.test(passage.text))) {
        priceStart ??= passage.start;
        priceEnd = passage.end;
      } else finishPrice();
    }
    finishPrice();
    for (const observation of native) {
      if (cleanText(observation.name) !== proof.name) { record("variant-mismatch", "name"); continue; }
      const identityQuote = observation.identityQuote && cleanText(observation.identityQuote);
      if (!identityQuote || !scope.identity.includes(identityQuote) || !identityQuote.includes(proof.name)) { record("missing-identity", "identityQuote"); continue; }
      for (const rawQuote of observation.quotedFacts) {
        const quote = cleanText(rawQuote);
        const passage = entries.filter(isComplete).find((entry) => entry.text === quote && entry.scope === scope);
        const owner = passage && ownership(context, proof, passage);
        const offset = scope.text.indexOf(quote);
        if (!owner || owner.kind !== "own" || !admissibleFact(owner.predicate)) { record("ambiguous-scope", "quotedFacts"); continue; }
        if (offset < 0 || offset + quote.length > 640) { record("packing-failure", "quotedFacts"); continue; }
        if (facts.length < 3 && !facts.some((fact) => fact.quote === quote)) facts.push({ sourceId, quote });
        record("admitted", "quotedFacts");
      }
      if (observation.priceQuote) {
        const quote = cleanText(observation.priceQuote);
        const offset = scope.text.indexOf(quote);
        if (subject.price.kind === "withheld" || priceBlocks.length !== 1 || priceBlocks[0] !== quote || !(contextPrice.test(quote) || singlePrice.test(quote))) { record("price-rejection", "priceQuote"); continue; }
        if (offset < 0 || offset + quote.length > 640) { record("packing-failure", "priceQuote"); continue; }
        price = { sourceId, quote, kind: contextPrice.test(quote) ? "page-price-context-unverified" : "page-observed-unverified" };
        record("admitted", "priceQuote");
      }
    }
  } else {
    const citation = (rawQuote: string) => {
      const quote = cleanText(rawQuote);
      const passage = context.passages.filter(isComplete).find((entry) => entry.kind === "content" && entry.text === quote);
      if (!passage || quote.length > 640) return null;
      const owner = ownership(context, proof, passage);
      return owner.kind === "own" && owner.basis === "exact-statement" ? { sourceId, quote } : null;
    };
    const identity = cleanText(context.source.highlights[selected.identity.highlight].text.slice(selected.identity.start, selected.identity.end));
    const directPrice = new RegExp(`^(?:The )?${escapeRegex(proof.name)}\\s+(?:costs|retails for|(?:is|was) (?:listed|priced) at)\\s+${money}(?: on this page| when reviewed)?\\.?$`, "i");
    for (const observation of native.filter((item) => cleanText(item.name) === proof.name)) {
      if (!observation.quotedFacts.some((quote) => cleanText(quote) === identity)) continue;
      const attributed = observation.quotedFacts.flatMap((quote) => {
        const evidence = citation(quote);
        record(evidence ? "admitted" : "quote-absence", "quotedFacts");
        return evidence ? [evidence] : [];
      });
      const priceEvidence = observation.priceQuote && citation(observation.priceQuote);
      if (priceEvidence && subject.price.kind === "unobstructed" && directPrice.test(priceEvidence.quote)) price = { ...priceEvidence, kind: "page-observed-unverified" };
      if (observation.priceQuote) record(price ? "admitted" : "price-rejection", "priceQuote");
      const categoryEvidence = attributed.find((fact) => fact.quote === identity);
      const supporting = attributed.filter((fact) => fact !== categoryEvidence).slice(0, price ? 1 : 2);
      if (categoryEvidence) facts.push(...attributed.filter((fact) => fact === categoryEvidence || supporting.includes(fact)));
      break;
    }
  }
  return { facts, price };
}

export function projectPageEvidence(inputs: Source[], observations: NativeObservation[], preferences: Preferences) {
  const sources: ResearchSnapshot["sources"] = [];
  const products: ResearchSnapshot["products"] = [];
  const decisions: EvidenceDecision[] = [];
  const assessed = inputs.map((input, index) => {
    const native = observations.filter((observation) => observation.url === input.url);
    const context = sourceContext(input, `source-${index + 1}`, native, preferences, decisions);
    return { context, native, subjects: context.subjects.map((proof) => assessSubject(context, proof, preferences)) };
  });
  for (const { context, native, subjects } of assessed) {
    const input = context.source;
    const source = { id: context.sourceId, url: input.url, title: input.title, highlights: [] as string[] };
    for (const decision of subjects) {
      if (decision.kind === "excluded") {
        const witness = decision.ledger.excludedManufacturer ?? preferences.hard.requiredFeatures.map((feature) => decision.ledger.absentFeatures[feature]).find((span) => span !== null);
        decisions.push({ sourceIndex: input.sourceIndex, path: "source-identity", code: "contradiction", field: "constraints", ...witness });
        continue;
      }
      const { subject } = decision;
      const { proof } = subject;
      if (subject.price.kind === "withheld") decisions.push({ sourceIndex: input.sourceIndex, path: "native-field", field: "priceQuote", code: subject.price.reason, ...subject.price.witness });
      if (products.length === 5 || products.some((product) => product.name.toLowerCase() === proof.name.toLowerCase())) continue;
      const { selected } = proof;
      const identityQuote = cleanText(input.highlights[selected.identity.highlight].text.slice(selected.identity.start, selected.identity.end));
      if (identityQuote.length > 640) continue;
      const { facts, price } = projectPositive(context, subject, native, decisions);
      const quotes = [identityQuote, ...facts.map((fact) => fact.quote), ...(price ? [price.quote] : [])];
      const windows = selected.kind === "heading"
        ? [selected.scope.text.slice(0, Math.max(...quotes.map((quote) => selected.scope.text.indexOf(quote) + quote.length)))]
        : [...new Set([...facts.map((fact) => fact.quote), ...(price ? [price.quote] : []), identityQuote])];
      if (source.highlights.length + windows.length > 3) {
        decisions.push({ sourceIndex: input.sourceIndex, path: "native-field", field: "identity", code: "packing-failure", ...sourceSpan(selected.identity) });
        continue;
      }
      source.highlights.push(...windows);
      products.push({
        id: `research-${createHash("sha256").update(`${input.url}\n${proof.name}`).digest("hex").slice(0, 24)}`,
        name: proof.name,
        identity: { sourceId: source.id, quote: identityQuote, kind: selected.kind === "heading" ? "single-product-heading" : "direct-model-statement" },
        facts, price, stock: "unverified", unresolvedConstraints: unresolvedConstraints(preferences),
      });
    }
    for (const excerpt of input.highlights.map((item) => cleanText(item.text))) {
      if (source.highlights.length === 3) break;
      const bounded = excerpt.slice(0, 640);
      if (bounded && !source.highlights.some((window) => window.includes(bounded))) source.highlights.push(bounded);
    }
    sources.push(source);
  }
  return { sources, products, decisions };
}
