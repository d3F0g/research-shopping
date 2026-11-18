import { createHash } from "node:crypto";
import { FeatureSchema, type Feature, type Preferences } from "../domain/contracts";
import type { ResearchProduct, ResearchSnapshot } from "../domain/research";

type Highlight = Readonly<{ text: string; clipped: boolean }>;
type Source = { sourceIndex: number; url: string; title: string; titleClipped: boolean; highlights: Highlight[] };
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
type Scope = { name: string; highlight: number; start: number; identityEnd: number; end: number; directClass: boolean };

function cleanText(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}
const headphoneClass = "(?:headphones?|earbuds|headset)";
const headphoneDesign = "(?:over-ear|on-ear|in-ear|open-back|closed-back|noise-cancell?ing)";
const categoryStatements: Record<NonNullable<Preferences["hard"]["category"]>, string> = {
  headphones: `(?:a |a pair of )?(?:(?:wireless|wired|Bluetooth|${headphoneDesign}) )*${headphoneClass}(?: designed for neutral listening)?`,
  laptops: "(?:a |an )?(?:(?:gaming|business|ultraportable|convertible|thin and light|Windows|\\d{1,2}(?:\\.\\d)?-inch) )*(?:laptop|notebook)(?: computer)?",
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unresolvedConstraints(preferences: Preferences, retainedFacts: readonly RetainedFact[]): string[] {
  const batteryRequested = (preferences.hard.category === "headphones" || preferences.hard.category === "laptops")
    && (preferences.soft.priorities.includes("battery-life") || preferences.hard.requiredFeatures.some((feature) => feature === "long-battery-life" || feature === "long-battery"));
  return [
    ...preferences.hard.requiredFeatures.map((feature) => `${feature.replaceAll("-", " ")} needs independent verification`),
    ...(preferences.hard.excludedBrands.length ? ["Manufacturer identity and brand exclusions need independent verification"] : []),
    ...(preferences.hard.budget ? [`Current affordability within ${preferences.hard.budget.currency} ${preferences.hard.budget.amount} is unverified`] : []),
    `Stock and delivery to ${preferences.hard.region} are unverified`,
    ...(batteryRequested && !retainedFacts.some((fact) => fact.meaning === "battery-runtime")
      ? ["Battery life for this model or edition is unknown from the retained comparison evidence."] : []),
  ];
}

type Span = Readonly<{ highlight: number; start: number; end: number }>;
type Anchor =
  | Readonly<{ kind: "heading"; identity: CompletePassage; scope: Scope }>
  | Readonly<{ kind: "direct"; identity: CompletePassage }>;
type SubjectProof = Readonly<{ name: string; selected: Anchor; anchors: readonly [Anchor, ...Anchor[]] }>;
type Completion = { completion: "complete" } | { completion: "open" };
type SourcePassage = Span & Completion & { text: string; kind: "content" | "price" | "section" | "context-heading" | "identity" | "boundary"; region: number; scope: Scope | null; support: Readonly<{ name: string; span: Span }> | null };
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
    const labelEnd = /^[ \t]*(?:$|\r?\n|#)/.test(suffix);
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
  const title = input.title.split(" | ")[0].trim();
  const titleName = input.titleClipped ? title : title.replace(/ – [\p{L}][\p{L} .&'-]+ (?:Pte\.? Ltd\.?|Ltd\.?|Limited|Inc\.?|LLC|GmbH|Corporation)$/u, "");
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
      if (/^(?:Premium|New|Wireless|Wired|Bluetooth|Over-ear|On-ear|In-ear|Gaming|Business)(?:\s+(?:wireless|wired|Bluetooth|over-ear|on-ear|in-ear|noise cancell?ing|gaming|business))*\s+(?:headphones?|earbuds|headset|laptop|notebook)$/i.test(name)) { record("missing-identity", { highlight, start }); continue; }
      if (name.length < 3 || !/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d-]+$/.test(name) && name.split(/\s+/).length < 2 || forbiddenIdentity.test(name)) { record("ambiguous-scope", { highlight, start }); continue; }
      const designationEnd = contentStart + (intactName === name ? rest.indexOf("\n") : name.length);
      const headingClass = new RegExp(`^.+?\\s+${classPhrases[category]}(?:\\s+-\\s+[\\p{L}\\p{N} +().-]+|\\s+\\([\\p{L}\\p{N} +.-]+\\))?$`, "iu");
      let identityEnd = designationEnd;
      let directClass = false;
      if (!headingClass.test(name)) {
        const suffix = raw.slice(designationEnd);
        const subtitle = new RegExp(`^\\s+(${classPhrases[category]})(?=\\s|[.!]|$)`, "i").exec(suffix);
        if (subtitle) identityEnd += subtitle[0].length;
        else {
          const definition = new RegExp(`(?:^|[.!?]\\s+|\\n)(?:The )?${escapeRegex(name)} (?:is|are) [^.!?]+[.!](?=\\s|$)`, "gi");
          directClass = [...raw.matchAll(definition)].some((match) => categoryStatement(name, cleanText(match[0]), category));
          if (!directClass) { record("missing-class", { highlight, start }); continue; }
        }
      }
      const tail = raw.slice(identityEnd);
      if (/^[ \t]+(?:Pro|Plus|Max|Ultra|Special Edition|cases?|covers?|cables?|pads?|stands?|for)\b/i.test(tail)) { record("variant-mismatch", { highlight, start }); continue; }
      const terminator = /^[ \t]*[.!](?=\s|$)/.exec(tail);
      if (terminator) identityEnd += terminator[0].length;
      const boundary = context.boundaries.find((candidate) => candidate.start >= identityEnd && candidate.kind !== "heading");
      let end = boundary?.start ?? raw.length;
      for (const next of context.boundaries.filter((candidate) => candidate.start >= identityEnd && candidate.kind === "heading")) {
        const label = cleanText(raw.slice(next.end));
        if (/^(?:Description|Specifications|Key Features|Features|Highlights)(?=\s|$)/i.test(label)) continue;
        const nextStart = next.start;
        if (nextStart < end) end = nextStart;
        break;
      }
      const lineEnd = /\r?\n|[.!?](?=\s|$)/.exec(raw.slice(identityEnd));
      const recordEnd = Math.min(end, lineEnd ? identityEnd + lineEnd.index + (lineEnd[0].endsWith("\n") ? 0 : 1) : raw.length);
      const identityRecordEnd = terminator || priceRecordStart.test(raw.slice(identityEnd).trimStart()) ? identityEnd : recordEnd;
      if (completion(context, start, identityRecordEnd, "identity", name).completion !== "complete") { record("ambiguous-scope", { highlight, start, end: identityRecordEnd }); continue; }
      const text = cleanText(raw.slice(start, end));
      if (/\bearbuds?\b/i.test(text) && /\b(?:over-ear|on-ear)\b/i.test(text)) { record("contradiction", { highlight, start, end }); continue; }
      record("admitted", { highlight, start, end: identityEnd });
      scopes.push({ name, highlight, start, identityEnd, end, directClass });
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

function categoryStatement(name: string, text: string, category: NonNullable<Preferences["hard"]["category"]>): boolean {
  const generation = "(?:the (?:first|second|third|[0-9]+(?:st|nd|rd|th)) generation of (?:our )?(?:critically acclaimed )?[A-Za-z0-9-]+ )?";
  return new RegExp(`^(?:The )?${escapeRegex(name)} (?:is|are) ${generation}${categoryStatements[category]}(?: with [^.!?]+)?[.!]?$`, "i").test(text);
}

const runtime = "(?:up to )?\\d+(?:\\.\\d+)? (?:hours?|hrs?)(?: of (?:playback|music|battery life))?(?: on a full charge| per charge)?(?: with (?:ANC|noise cancelling) (?:on|off))?";
const batteryPatterns = {
  device: /^(?:has|have) a battery life of up to \d+(?:\.\d+)? hours on a continuous full charge, with up to \d+(?:\.\d+)? hours of use on a \d+-minute rapid charge via the USB-C connection(?:, making them some of the longest-lasting wireless headphones available)?$/i,
  scoped: [
    new RegExp(`^(?:Battery(?: life| runtime)?|Runtime):\\s*${runtime}$`, "i"),
    new RegExp(`^(?:Has|Have|You get) ${runtime}$`, "i"),
  ],
};
type DeviceRecord = "driver" | "microphone" | "control" | "battery" | "class-function";
function deviceRecord(predicate: string): DeviceRecord | null {
  if (/\?|\b(?:not|no|without|if|might|may|perhaps|hypothetically|would|another|other|different|replacement|accessories)\b/i.test(predicate)) return null;
  const terminal = predicate.replace(/[.!]$/, "");
  if (/^(?:features?|has|have) \d+(?:\.\d+)?\s*mm (?:large aperture )?drivers in a wireless design(?:, so listeners will enjoy the same sonic signature of (?:the )?(?:legendary )?[A-Za-z0-9-]+(?: [A-Za-z0-9-]+)* headphones)?$/i.test(terminal)
    || /^(?:[A-Za-z]+-coated )?\d+(?:\.\d+)?\s*mm drivers deliver [a-z]+(?:,? [a-z]+){0,4} sound$/i.test(terminal)) return "driver";
  if (/^features? (?:dual|\d+) microphones and beamforming technology, which provide [a-z -]+ vocal pickup ensuring [a-z -]+ audio call quality$/i.test(terminal)) return "microphone";
  if (/^(?:Additionally, )?users can (?:conveniently )?mute with the press of a button or access the built-in [A-Za-z ]+ voice assistant, as well as [A-Za-z ]+ and [A-Za-z ]+$/i.test(terminal)) return "control";
  if (batteryPatterns.device.test(terminal)) return "battery";
  if (new RegExp(`^${classPhrases.headphones} (?:Hybrid )?noise cancellation with \\d+-mic blocks (?:ambient|wind|ambient and wind) noise$`, "i").test(terminal)) return "class-function";
  return null;
}

function completion(context: HighlightContext, start: number, end: number, role: "identity" | "heading" | "section" | "price" | "content", name: string | null): Completion {
  const text = cleanText(context.item.text.slice(start, end));
  if (/[.!?]$/.test(text)) return { completion: "complete" };
  const rest = context.item.text.slice(end);
  const next = rest.trimStart();
  if (!next) return { completion: context.item.clipped ? "open" : "complete" };
  const nextStart = end + rest.length - next.length;
  const lineEnd = context.item.text.indexOf("\n", nextStart);
  const nextLine = context.item.text.slice(nextStart, lineEnd < 0 ? context.item.text.length : lineEnd).replace(/\r$/, "");
  const boundary = context.boundaries.find((candidate) => candidate.start === nextStart);
  if (boundary?.kind === "gap") return { completion: role === "section" || contextPrice.test(text) ? "complete" : "open" };
  const newline = /^[ \t]*\r?\n/.test(rest);
  const namedRecord = name !== null && (namedPredicate(name, nextLine) !== null
    || new RegExp(`^(?:The )?${escapeRegex(name)}\\s+.+[.!?]$`, "i").test(nextLine));
  const scopedRecord = scopedSubject.test(nextLine) && /[.!?]$/.test(nextLine)
    && new RegExp(`^${clauseVerb}`, "i").test(nextLine.replace(scopedSubject, ""));
  const nextStatement = /^(.*?[.!?])(?:\s|$)/.exec(nextLine)?.[1] ?? nextLine;
  const nextRecord = deviceRecord(nextStatement) !== null || fieldRecord.test(nextLine) || pricePart.test(nextLine) || namedRecord || scopedRecord;
  if (role !== "content") {
    if (boundary?.kind === "selector" || priceRecordStart.test(nextLine)) return { completion: "complete" };
    if (boundary?.kind === "heading" || newline && (role === "heading" || role === "section" || boundary || nextRecord)) return { completion: "complete" };
  }
  const structured = role === "price" || attributeLabel.test(text) || pricePart.test(text) || contextPrice.test(text);
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
  if (passage.kind !== "content" && passage.kind !== "price" && passage.kind !== "context-heading") return { kind: "unresolved" };
  const text = passage.text.replace(/^#{1,6}\s+/, "").replace(/[‘’]/g, "'");
  const exact = namedPredicate(subject.name, text);
  const predicate = exact ?? text.replace(scopedSubject, "");
  const compound = /[.!?]\s+[A-Z0-9]|;|[,;]\s+[A-Z][a-z]+\s+[A-Z0-9]|\b(?:and|while|but|whereas|or)\s+[A-Z][a-z]+\s+[A-Z0-9]/.test(text);
  const comparison = /\b(?:versus|compared (?:with|to)|unlike)\b|\bvs\.?\s/i.test(text);
  const foreignTarget = /\b(?:for|on|with|to)\s+(?:(?:the|a|an)\s+)?(?:[A-Z][a-z]+\s+[A-Z0-9][\p{L}\p{N}-]*|(?:Pro|Plus|Max|Ultra|Black|Teal|White)\s+variant)\b/u.test(predicate)
    || /\b(?:for|on|with|to)\s+(?:the\s+)?(?:another|other|different|pro|plus|max|ultra|black|teal|white)\s+(?:model|variant|edition)\b/i.test(predicate)
    || context.subjects.some((other) => other.name !== subject.name && predicate.toLowerCase().includes(other.name.toLowerCase()));
  if ((compound || comparison || foreignTarget) && deviceRecord(predicate) !== "driver") return { kind: "foreign" };
  if (/\?|\b(?:if|might|may|perhaps|hypothetically|would)\b/i.test(text)) return { kind: "unresolved" };
  if (exact) return { kind: "own", basis: "exact-statement", predicate };
  if (new RegExp(`^(?:The )?${escapeRegex(subject.name)}\\b`, "i").test(text)) return { kind: "foreign" };
  if (passage.kind !== "price" && predicate === text && !new RegExp(`^${clauseVerb}`, "i").test(text) && new RegExp(`^(?:The )?[A-Z][\\p{L}\\p{N} -]+?\\s+${clauseVerb}`, "u").test(text)) return { kind: "foreign" };
  if (passage.support?.name !== subject.name && (!passage.scope || passage.scope.name !== subject.name)) return { kind: "unresolved" };
  const inherited = new RegExp(`^(?:${clauseVerb}|(?:without|no|not equipped with|you get)\\b)`, "i").test(predicate)
    || attributeLabel.test(predicate)
    || passage.kind === "price" || pricePart.test(predicate) || contextPrice.test(predicate) || deviceRecord(predicate) !== null;
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
    const separator = /(?:\r?\n)+|(?<=[.!?])\s+(?=[A-Z0-9])/g;
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
      const state: Completion = identity ? { completion: "complete" } : completion(highlightContext, start, end, heading === "section" ? "section" : heading || model ? "heading" : "content", scope?.name ?? null);
      const marker = boundaries.find((boundary) => boundary.start === start && boundary.kind !== "heading");
      const isBoundary = marker && (marker.kind === "gap" || marker.kind === "selector" || state.completion === "complete")
        || !identity && state.completion === "complete" && (model || heading === "boundary");
      const kind = identity ? "identity" : isBoundary ? "boundary" : heading === "boundary" ? "context-heading" : heading ?? "content";
      if (isBoundary || identity && entries.some((entry) => entry.highlight === highlight && entry.kind === "identity")) region++;
      entries.push({ highlight, start, end, text, kind, ...state, region, scope, support: null });
      if (isBoundary) region++;
    }
  }
  for (let index = 0; index < entries.length; index++) {
    const first = entries[index];
    if (first.kind !== "content" || !(pricePart.test(first.text) || contextPrice.test(first.text) || /^From(?:: SALE)?$/i.test(first.text) || new RegExp(`^From: SALE ${money}$`, "i").test(first.text))) continue;
    let last = index;
    while (last + 1 < entries.length) {
      const next = entries[last + 1];
      if (next.kind !== "content" || next.highlight !== first.highlight || next.region !== first.region || next.scope !== first.scope
        || cleanText(source.highlights[first.highlight].text.slice(entries[last].end, next.start))
        || !(pricePart.test(next.text) || contextPrice.test(next.text) || /^(?:SGD|USD|EUR|GBP|AUD|JPY|From)$/i.test(next.text))) break;
      last++;
    }
    const end = entries[last].end;
    const text = cleanText(source.highlights[first.highlight].text.slice(first.start, end));
    const state = completion(highlights[first.highlight], first.start, end, "price", first.scope?.name ?? null);
    entries.splice(index, last - index + 1, { ...first, end, text, kind: "price", ...state });
  }
  for (const scope of scopes) {
    const identity = entries.filter(isComplete).find((passage) => passage.kind === "identity" && passage.highlight === scope.highlight && passage.start === scope.start);
    if (!identity) continue;
    const anchor: Anchor = { kind: "heading", identity, scope };
    const category = preferences.hard.category;
    const definition = scope.directClass && category ? entries.filter(isComplete).find((passage) => categoryStatement(scope.name, passage.text, category)) : null;
    if (scope.directClass && !definition) continue;
    const selected: Anchor = definition ? { kind: "direct", identity: definition } : anchor;
    const prior = subjects.findIndex((subject) => subject.name === scope.name);
    if (prior < 0) subjects.push({ name: scope.name, selected, anchors: definition ? [selected, anchor] : [anchor] });
    else subjects[prior] = { ...subjects[prior], anchors: [...subjects[prior].anchors, anchor] };
  }
  const context: SourceContext = { source, sourceId, passages: entries, subjects };
  const category = preferences.hard.category;
  if (!scopes.length && category) {
    for (const observation of native) {
      const name = cleanText(observation.name);
      const matches = entries.filter(isComplete).filter((passage) => categoryStatement(name, passage.text, category) && observation.quotedFacts.some((quote) => cleanText(quote) === passage.text));
      const first = matches[0];
      if (!first) continue;
      const selected: Anchor = { kind: "direct", identity: first };
      const proof: SubjectProof = { name, selected, anchors: [selected, ...matches.slice(1).map((passage): Anchor => ({ kind: "direct", identity: passage }))] };
      if (ownership(context, proof, first).kind === "own" && !subjects.some((subject) => subject.name === name)) subjects.push(proof);
    }
  }
  let active: { name: string; span: Span; scope: Scope | null; device: DeviceRecord | null } | null = null;
  let activeHighlight = -1;
  for (const passage of entries) {
    if (passage.highlight !== activeHighlight) { active = null; activeHighlight = passage.highlight; }
    if (passage.kind === "identity") {
      const scope = scopes.find((item) => item.highlight === passage.highlight && item.start === passage.start);
      active = scope ? { name: scope.name, span: sourceSpan(passage), scope, device: null } : null;
      continue;
    }
    if (passage.kind === "section") {
      if (active?.device === "microphone" || active?.device === "control") active = null;
      continue;
    }
    if (passage.kind === "boundary" || !isComplete(passage)) { active = null; passage.scope = null; continue; }
    passage.scope = active?.scope === passage.scope ? passage.scope : null;
    const exact = subjects.find((subject) => namedPredicate(subject.name, passage.text) !== null);
    const subject = exact ?? subjects.find((item) => item.name === active?.name);
    if (!subject) { active = null; passage.scope = null; continue; }
    const predicate = namedPredicate(subject.name, passage.text) ?? passage.text.replace(scopedSubject, "");
    const device = deviceRecord(predicate);
    const definition = category !== null && categoryStatement(subject.name, passage.text, category);
    if (exact && (definition && passage.scope !== null && active?.name === subject.name || device === "microphone")) {
      active = { name: subject.name, span: definition && active?.name === subject.name ? active.span : sourceSpan(passage), scope: passage.scope, device };
    }
    if (device === "control" && (!active || active.device !== "microphone")) { active = null; passage.scope = null; continue; }
    if (active?.name === subject.name) passage.support = { name: subject.name, span: { highlight: passage.highlight, start: active.span.start, end: passage.end } };
    const owner = ownership(context, subject, passage);
    if (owner.kind !== "own") { active = null; passage.scope = null; passage.support = null; continue; }
    if (active) active = { ...active, device };
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
    if (passage.kind !== "content" && passage.kind !== "price" && passage.kind !== "context-heading" && isComplete(passage)) continue;
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

type OwnedClaim = Readonly<{ passage: CompletePassage; support: Span }>;
type FactMeaning = "battery-runtime" | "other";
type OwnedFact = OwnedClaim & Readonly<{ meaning: FactMeaning }>;
type RetainedFact = Readonly<{ citation: ResearchProduct["facts"][number]; meaning: FactMeaning }>;
type ResolvedProposal = Readonly<{ identity: EligibleSubject; facts: readonly OwnedFact[]; price: (OwnedClaim & { kind: NonNullable<ResearchProduct["price"]>["kind"] }) | null }>;

function resolveProposal(context: SourceContext, subject: EligibleSubject, observation: NativeObservation, decisions: EvidenceDecision[]): ResolvedProposal | null {
  const { proof } = subject;
  const { selected } = proof;
  const record = (code: string, field: string) => decisions.push({ sourceIndex: context.source.sourceIndex, path: "native-field", code, field, ...sourceSpan(selected.identity) });
  const designation = cleanText(observation.name);
  if (designation !== proof.name && (context.source.titleClipped || designation !== context.source.title)) { record("variant-mismatch", "name"); return null; }
  const normalizeHint = (text: string) => cleanText(text).replace(/^#{1,6}\s+/, "").toLowerCase();
  const identityHint = observation.identityQuote && normalizeHint(observation.identityQuote);
  const identity = identityHint ? proof.anchors.find((anchor) => {
    if (anchor.kind === "direct") return anchor === selected && normalizeHint(anchor.identity.text) === identityHint;
    const heading = normalizeHint(anchor.identity.text);
    if (!identityHint.includes(proof.name.toLowerCase())) return false;
    if (heading.includes(identityHint)) return true;
    const next = context.passages.find((passage) => passage.highlight === anchor.scope.highlight && passage.start >= anchor.scope.identityEnd && passage.kind === "price" && passage.scope === anchor.scope);
    return next !== undefined && isComplete(next) && normalizeHint(`${heading} ${next.text}`) === identityHint;
  }) : selected.kind === "direct" && observation.quotedFacts.some((quote) => cleanText(quote) === selected.identity.text) ? selected : null;
  if (!identity) { record("missing-identity", "identityQuote"); return null; }
  const featurePhrase = `(?:${Object.values(featureDescriptors).map((descriptor) => descriptor.terms).join("|")})(?: (?:audio|support|display|memory))?`;
  const booleanFeature = new RegExp(`^(?:${Object.values(featureDescriptors).map((descriptor) => descriptor.terms).join("|")}|Connectivity):\\s*(?:yes|no|true|false|supported|not supported|available|unavailable|wired[- ]only|wireless)$`, "i");
  const scopedPredicates = [
    /^(?:Driver(?: size)?|Transducer(?: size)?):\s*\d+(?:\.\d+)?\s*mm$/i,
    /^(?:Weight:\s*|Weighs?\s+)\d+(?:\.\d+)?\s*(?:g|kg|grams?|kilograms?)$/i,
    /^(?:Memory:\s*)\d+\s*GB(?: RAM)?$/i,
    new RegExp(`^(?:supports?|offers?|features?|provides?|includes?|has|have) (?:an? )?${featurePhrase}(?: and ${featurePhrase})*$`, "i"),
    new RegExp(`^(?:does not|doesn't|do not|don't|cannot|can't|can) (?:support|have|include|offer|provide|use) (?:an? )?${featurePhrase}$`, "i"),
    new RegExp(`^(?:is|are) (?:not |no longer )?${featurePhrase}$`, "i"),
    new RegExp(`^(?:isn't|aren't) ${featurePhrase}$`, "i"),
    new RegExp(`^(?:lacks?|without|no) (?:an? )?${featurePhrase}$`, "i"),
  ];

  function interpretFact(predicate: string): FactMeaning | null {
    const text = predicate.replace(/[.!]$/, "");
    const device = deviceRecord(predicate);
    if (device === "battery" || batteryPatterns.scoped.some((pattern) => pattern.test(text))) return "battery-runtime";
    return booleanFeature.test(text) || scopedPredicates.some((pattern) => pattern.test(text)) || exclusiveWired.test(text)
      || device !== null && device !== "control" ? "other" : null;
  }

  const candidates = context.passages.filter(isComplete).flatMap((passage): Array<OwnedClaim & { predicate: string; exact: boolean; meaning: FactMeaning | null }> => {
    const owner = ownership(context, proof, passage);
    if (owner.kind !== "own" || selected.kind === "heading" && passage.scope !== selected.scope) return [];
    const support = owner.basis === "exact-statement" ? sourceSpan(passage) : passage.support?.name === proof.name ? passage.support.span : null;
    return support ? [{ passage, support, predicate: owner.predicate, exact: owner.basis === "exact-statement", meaning: interpretFact(owner.predicate) }] : [];
  });
  const facts: OwnedFact[] = [];
  for (const rawHint of observation.quotedFacts) {
    const hint = normalizeHint(rawHint).replace(/[.!]$/, "");
    const matches = candidates.filter((candidate) => {
      const text = normalizeHint(candidate.passage.text);
      const position = text.indexOf(hint);
      if (!hint || position < 0 || /[\p{L}\p{N}]/u.test(text.charAt(position - 1)) || /[\p{L}\p{N}]/u.test(text.charAt(position + hint.length))) return false;
      const full = normalizeHint(rawHint) === text;
      if (!full && /\b(?:not|no|without|lacks?|cannot|can't|doesn't|don't|isn't|aren't)\b/i.test(candidate.predicate)) return false;
      return candidate.meaning !== null || selected.kind === "direct" && candidate.exact && full;
    });
    if (!matches.length || new Set(matches.map((match) => match.passage.text)).size !== 1) { record("ambiguous-scope", "quotedFacts"); continue; }
    const match = matches[0];
    if (!facts.some((fact) => fact.passage === match.passage)) facts.push({ passage: match.passage, support: match.support, meaning: match.meaning ?? "other" });
  }
  let price: ResolvedProposal["price"] = null;
  if (observation.priceQuote && subject.price.kind === "unobstructed") {
    const hint = normalizeHint(observation.priceQuote);
    const directPrice = new RegExp(`^(?:The )?${escapeRegex(proof.name)}\\s+(?:costs|retails for|(?:is|was) (?:listed|priced) at)\\s+${money}(?: on this page| when reviewed)?\\.?$`, "i");
    const prices = candidates.filter(({ passage, exact }) => passage.kind === "price" || exact && directPrice.test(passage.text));
    if (prices.length === 1) {
      const candidate = prices[0];
      const text = normalizeHint(candidate.passage.text);
      const qualified = contextPrice.test(text);
      const matches = qualified ? contextPrice.test(hint) && text.startsWith(hint) : text === hint;
      if (matches && (qualified || singlePrice.test(text) || directPrice.test(candidate.passage.text))) price = { ...candidate, kind: qualified ? "page-price-context-unverified" : "page-observed-unverified" };
    }
  }
  if (observation.priceQuote) record(price ? "admitted" : "price-rejection", "priceQuote");
  return { identity: subject, facts, price };
}

function projectPositive(context: SourceContext, selected: Anchor, proposals: readonly ResolvedProposal[], capacity: number, decisions: EvidenceDecision[]) {
  let spans: Span[] = [sourceSpan(selected.identity)];
  const quote = (span: Span) => cleanText(context.source.highlights[span.highlight].text.slice(span.start, span.end));
  const pack = (claim: OwnedClaim, identity: EligibleSubject): boolean => {
    const anchor = identity.proof.selected;
    const support = anchor.kind === "heading" ? { highlight: claim.support.highlight, start: anchor.scope.start, end: claim.support.end } : claim.support;
    if (quote(support).length > 640) return false;
    const next = [...spans];
    const merged = next.findIndex((span) => span.highlight === support.highlight && span.start <= support.end && span.end >= support.start
      && quote({ ...span, start: Math.min(span.start, support.start), end: Math.max(span.end, support.end) }).length <= 640);
    if (merged >= 0) next[merged] = { highlight: support.highlight, start: Math.min(next[merged].start, support.start), end: Math.max(next[merged].end, support.end) };
    else next.push(support);
    if (next.length > capacity) return false;
    spans = next;
    return true;
  };
  const citation = (claim: OwnedClaim) => ({ sourceId: context.sourceId, quote: claim.passage.text });
  const retainedFacts: RetainedFact[] = [];
  let price: ResearchProduct["price"] = null;
  for (const proposal of proposals) {
    if (!price && proposal.price && pack(proposal.price, proposal.identity)) price = { ...citation(proposal.price), kind: proposal.price.kind };
    for (const claim of proposal.facts) {
      if (retainedFacts.length === 3 || retainedFacts.some((fact) => fact.citation.quote === claim.passage.text)) continue;
      if (!pack(claim, proposal.identity)) { decisions.push({ sourceIndex: context.source.sourceIndex, path: "native-field", field: "quotedFacts", code: "packing-failure", ...claim.support }); continue; }
      retainedFacts.push({ citation: citation(claim), meaning: claim.meaning });
      decisions.push({ sourceIndex: context.source.sourceIndex, path: "native-field", field: "quotedFacts", code: "admitted", ...sourceSpan(claim.passage) });
    }
  }
  const quotations = [...retainedFacts.map((fact) => fact.citation.quote), ...(price ? [price.quote] : []), selected.identity.text];
  const windows = spans.map(quote).sort((left, right) => quotations.findIndex((citation) => left.includes(citation)) - quotations.findIndex((citation) => right.includes(citation)));
  return { retainedFacts, price, windows };
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
      const proposals = native.flatMap((observation) => {
        const resolved = resolveProposal(context, subject, observation, decisions);
        return resolved ? [resolved] : [];
      });
      const { retainedFacts, price, windows } = projectPositive(context, selected, proposals, 3 - source.highlights.length, decisions);
      if (source.highlights.length + windows.length > 3) {
        decisions.push({ sourceIndex: input.sourceIndex, path: "native-field", field: "identity", code: "packing-failure", ...sourceSpan(selected.identity) });
        continue;
      }
      source.highlights.push(...windows);
      products.push({
        id: `research-${createHash("sha256").update(`${input.url}\n${proof.name}`).digest("hex").slice(0, 24)}`,
        name: proof.name,
        identity: { sourceId: source.id, quote: identityQuote, kind: selected.kind === "heading" ? "single-product-heading" : "direct-model-statement" },
        facts: retainedFacts.map((fact) => fact.citation), price, stock: "unverified", unresolvedConstraints: unresolvedConstraints(preferences, retainedFacts),
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
