import { createHash } from "node:crypto";
import type { Feature, Preferences } from "../domain/contracts";
import type { ResearchProduct, ResearchSnapshot } from "../domain/research";

type Source = { sourceIndex: number; url: string; title: string; highlights: string[] };
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
type Scope = { name: string; identity: string; text: string; highlight: number; start: number; identityEnd: number; end: number; boundary: string };

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

const featureTerms: Record<Feature, string> = {
  "active-noise-cancelling": "active[- ]noise[- ]cancell?(?:ing|ation)|ANC",
  wireless: "wireless|bluetooth",
  multipoint: "multi[- ]?point",
  "long-battery-life": "long[- ]battery(?:[- ]life)?",
  lightweight: "light[- ]?weight",
  "oled-display": "OLED",
  "high-memory": "32 ?GB|high[- ]memory",
  "long-battery": "long[- ]battery(?:[- ]life)?",
  portable: "portable|portability",
};
const wiredMedium = "wired(?: (?:audio|connections?|connectivity))?";
const connectionVerb = "(?:supports?|uses?|offers?|provides?|has|have|can (?:support|use))";
const headphoneDescriptor = `(?:${headphoneDesign}|lightweight|portable|gaming|stereo)`;
const exclusiveWiredHeadphones = `(?:an? |the )?(?:pair of )?(?:${headphoneDescriptor} )*wired[- ]only (?:${headphoneDescriptor} )*${headphoneClass}`;
const exclusiveWired = new RegExp(`^(?:(?:is|are) (?:wired[- ]only|${exclusiveWiredHeadphones})|(?:only ${connectionVerb}|${connectionVerb} only|can only (?:support|use)) ${wiredMedium}|${connectionVerb} ${wiredMedium} only|${connectionVerb} wired-only(?: (?:audio|connections?|connectivity))?)[.!]?$`, "i");

function contradictsRequiredFeature(quotes: string[], preferences: Preferences, name: string): boolean {
  const subject = new RegExp(`^(?:The )?${escapeRegex(name)}\\s+`, "i");
  const descriptions = quotes.map((quote) => quote.replace(subject, "").replace(/[‘’]/g, "'"));
  return preferences.hard.requiredFeatures.some((feature) => {
    const negative = new RegExp(`\\b(?:is not|isn't|are not|aren't|does not|doesn't|do not|don't|cannot|can't|no|without|lacks?|not equipped with)\\s+(?:(?:support|have|include|offer|provide|use)\\s+)?(?:an?\\s+|any\\s+)?(?:${featureTerms[feature]})\\b`, "i");
    return descriptions.some((description) => negative.test(description) || (feature === "wireless" && exclusiveWired.test(description)));
  });
}


const forbiddenIdentity = /\b(?:not|replacement|accessor(?:y|ies)|cables?|cases?|covers?|pads?|stands?|best|guide|comparison|versus|for)\b|[?/:]/i;
const classPhrases: Record<NonNullable<Preferences["hard"]["category"]>, string> = {
  headphones: `(?:Premium )?(?:(?:wireless|wired|Bluetooth|over-ear|on-ear|in-ear|open-back|closed-back|noise cancell?ing|noise-cancell?ing) )*${headphoneClass}`,
  laptops: "(?:(?:gaming|business|ultraportable|convertible|thin and light|Windows|\\d{1,2}(?:\\.\\d)?-inch) )*(?:laptop|notebook)(?: computer)?",
};
const boundaryPattern = /\.{3}|…|\b(?:variations?|related products?|recommended products?|you may also like|accessories|compare(?: products)?|comparison|choose (?:a |your )?(?:colou?r|variant)|select (?:a |your )?(?:colou?r|variant))\b/ig;

function headingScope(input: Source, preferences: Preferences, decisions: EvidenceDecision[]): Scope | null {
  const category = preferences.hard.category;
  if (!category) return null;
  const record = (code: string, detail: Partial<EvidenceDecision> = {}) => decisions.push({ sourceIndex: input.sourceIndex, path: "source-identity", code, ...detail });
  const titleName = input.title.split(" | ")[0].trim();
  for (const [highlight, original] of input.highlights.entries()) {
    const raw = original.replace(/\r/g, " ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ");
    const heading = /(?:^|\s)(#{1,6})[ \t]+/g;
    for (const match of raw.matchAll(heading)) {
      const start = match.index! + match[0].indexOf("#");
      const contentStart = match.index! + match[0].length;
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
      const boundary = new RegExp(boundaryPattern).exec(tail);
      let end = boundary ? identityEnd + boundary.index : raw.length;
      let boundaryCode = boundary ? /\.{3}|…/.test(boundary[0]) ? "scope-gap" : "competing-product" : "highlight-boundary";
      for (const next of tail.matchAll(/(?:^|\s)(#{1,6})[ \t]+/g)) {
        const label = cleanText(tail.slice(next.index! + next[0].length));
        if (/^(?:Description|Specifications|Key Features|Features|Highlights)(?=\s|$)/i.test(label)) continue;
        const nextStart = identityEnd + next.index! + next[0].indexOf("#");
        if (nextStart < end) { end = nextStart; boundaryCode = "competing-product"; }
        break;
      }
      const text = cleanText(raw.slice(start, end));
      const identity = cleanText(raw.slice(start, identityEnd));
      if (identity.length > 640 || name.length > 160) { record("packing-failure", { highlight, start, end: identityEnd }); continue; }
      if (/\bearbuds?\b/i.test(text) && /\b(?:over-ear|on-ear)\b/i.test(text)) { record("contradiction", { highlight, start, end }); continue; }
      record("admitted", { highlight, start, end: identityEnd });
      return { name, identity, text, highlight, start, identityEnd, end, boundary: boundaryCode };
    }
  }
  if (!decisions.some((decision) => decision.sourceIndex === input.sourceIndex)) record("missing-identity");
  return null;
}

type Passage = { text: string; start: number; end: number; kind: "content" | "section" };
const sectionLabels = "Description|Specifications|Key Features|Features|Highlights";
const scalarAmount = "(?:0|[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d*)(?:\\.\\d{2})?";
const money = `(?:SGD|USD|EUR|GBP|AUD|JPY|(?:S|US)\\$|[€£¥])\\s*${scalarAmount}`;
const contextPrice = new RegExp(`^(?:Sale price:?\\s*)?${money}\\s+(?:was|regular price:?|list price:?)\\s+${money}(?:\\s+(?:SGD|USD|EUR|GBP|AUD|JPY))?(?:\\s+(?:You Save|Save|Savings:?)\\s+${money})?$`, "i");
const singlePrice = new RegExp(`^(?:Price:?\\s*)?${money}$`, "i");

function passages(raw: string, start = 0, end = raw.length): Passage[] {
  const result: Passage[] = [];
  const separator = new RegExp(`\\n+|(?<=[.!?])\\s+(?=[A-Z0-9])|(?<!\\S)#{1,6}[ \\t]+(?:${sectionLabels})(?=\\s|$)`, "gi");
  let cursor = start;
  const append = (from: number, to: number, kind: Passage["kind"]) => {
    const text = cleanText(raw.slice(from, to)).replace(/^[-*]\s+/, "");
    if (text) result.push({ text, start: from, end: to, kind });
  };
  for (const match of raw.slice(start, end).matchAll(separator)) {
    const position = start + match.index!;
    append(cursor, position, "content");
    if (match[0].includes("#")) append(position, position + match[0].length, "section");
    cursor = position + match[0].length;
  }
  append(cursor, end, "content");
  return result;
}

const featurePhrase = `(?:${Object.values(featureTerms).join("|")})(?: (?:audio|support|display|memory))?`;
const booleanFeature = new RegExp(`^(?:${Object.values(featureTerms).join("|")}|Connectivity):\\s*(?:yes|no|true|false|supported|not supported|available|unavailable|wired[- ]only|wireless)$`, "i");
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

function scopedFact(text: string, name: string): boolean {
  const subject = new RegExp(`^(?:(?:The )?${escapeRegex(name)}|These (?:headphones|earbuds|laptops)|The (?:headphones|earbuds|laptop))\\s+`, "i");
  const predicate = text.replace(subject, "").replace(/[‘’]/g, "'").replace(/[.!]$/, "");
  return booleanFeature.test(predicate) || scopedPredicates.some((pattern) => pattern.test(predicate)) || exclusiveWired.test(predicate);
}

function scopedProduct(scope: Scope, input: Source, sourceId: string, observations: NativeObservation[], preferences: Preferences, decisions: EvidenceDecision[]): ResearchProduct | null {
  const record = (code: string, field: string) => decisions.push({ sourceIndex: input.sourceIndex, path: "native-field", code, field, highlight: scope.highlight, start: scope.start, end: scope.end });
  const raw = input.highlights[scope.highlight].replace(/\r/g, " ");
  const sections = passages(raw, scope.identityEnd, scope.end);
  const pricePart = new RegExp(`^(?:(?:Price|Sale price|Regular price|List price|Savings):?\\s*|was\\s+|You Save\\s+|Save\\s+)?${money}(?:\\s+(?:SGD|USD|EUR|GBP|AUD|JPY))?$`, "i");
  let attributable = true;
  const factsInScope: string[] = [];
  const priceBlocks: string[] = [];
  let priceStart: number | null = null;
  let priceEnd = 0;
  const finishPrice = () => {
    if (priceStart !== null) priceBlocks.push(cleanText(raw.slice(priceStart, priceEnd)));
    priceStart = null;
  };
  for (const passage of sections) {
    if (passage.kind === "section") { finishPrice(); continue; }
    if (attributable && scopedFact(passage.text, scope.name)) {
      finishPrice();
      factsInScope.push(passage.text);
    } else if (attributable && (singlePrice.test(passage.text) || contextPrice.test(passage.text) || pricePart.test(passage.text))) {
      priceStart ??= passage.start;
      priceEnd = passage.end;
    } else {
      attributable = false;
      finishPrice();
      record("ambiguous-scope", "section");
    }
  }
  finishPrice();
  const exactSubject = new RegExp(`^(?:The )?${escapeRegex(scope.name)}\\s+`, "i");
  const conditionedPrice = new RegExp(`^costs ${money} without ${featurePhrase}[.!]?$`, "i");
  const adverse = input.highlights.flatMap((highlight, index) => passages(highlight).map((passage) => ({ ...passage, highlight: index })))
    .find((passage) => passage.kind === "content" && exactSubject.test(passage.text)
      && (scopedFact(passage.text, scope.name) || conditionedPrice.test(passage.text.replace(exactSubject, "")))
      && contradictsRequiredFeature([passage.text], preferences, scope.name));
  if (adverse) {
    decisions.push({ sourceIndex: input.sourceIndex, path: "source-identity", code: "contradiction", field: "constraints", highlight: adverse.highlight, start: adverse.start, end: adverse.end });
    return null;
  }
  const excluded = preferences.hard.excludedBrands.some((brand) => new RegExp(`^(?:The )?${escapeRegex(brand)}\\b`, "i").test(scope.name));
  const labelNegative = preferences.hard.requiredFeatures.some((feature) => factsInScope.some((description) => new RegExp(`^(?:${featureTerms[feature]})\\s*:\\s*(?:no|false|not supported|unavailable)\\b`, "i").test(description)));
  if (excluded || labelNegative || (preferences.hard.requiredFeatures.includes("wireless") && factsInScope.some((text) => /^Connectivity:\s*wired[- ]only[.!]?$/i.test(text))) || contradictsRequiredFeature(factsInScope, preferences, scope.name)) {
    record("contradiction", "constraints");
    return null;
  }
  const facts: ResearchProduct["facts"] = [];
  let price: ResearchProduct["price"] = null;
  for (const observation of observations) {
    if (cleanText(observation.name) !== scope.name) { record("variant-mismatch", "name"); continue; }
    const identityQuote = observation.identityQuote && cleanText(observation.identityQuote);
    if (!identityQuote || !scope.identity.includes(identityQuote) || !identityQuote.includes(scope.name)) { record("missing-identity", "identityQuote"); continue; }
    for (const rawQuote of observation.quotedFacts) {
      const quote = cleanText(rawQuote);
      const offset = scope.text.indexOf(quote);
      if (offset < 0) { record(input.highlights.some((text) => cleanText(text).includes(quote)) ? scope.boundary : "quote-absence", "quotedFacts"); continue; }
      if (offset + quote.length > 640) { record("packing-failure", "quotedFacts"); continue; }
      if (!factsInScope.includes(quote)) { record("ambiguous-scope", "quotedFacts"); continue; }
      if (facts.length < 3 && !facts.some((fact) => fact.quote === quote)) facts.push({ sourceId, quote });
      record("admitted", "quotedFacts");
    }
    if (observation.priceQuote) {
      const quote = cleanText(observation.priceQuote);
      const offset = scope.text.indexOf(quote);
      if (!attributable || priceBlocks.length !== 1 || priceBlocks[0] !== quote || !(contextPrice.test(quote) || singlePrice.test(quote))) { record("price-rejection", "priceQuote"); continue; }
      if (offset < 0 || offset + quote.length > 640) { record("packing-failure", "priceQuote"); continue; }
      price = { sourceId, quote, kind: contextPrice.test(quote) ? "page-price-context-unverified" : "page-observed-unverified" };
      record("admitted", "priceQuote");
    }
  }
  return {
    id: `research-${createHash("sha256").update(`${input.url}\n${scope.name}`).digest("hex").slice(0, 24)}`,
    name: scope.name, identity: { sourceId, quote: scope.identity, kind: "single-product-heading" }, facts, price,
    stock: "unverified", unresolvedConstraints: unresolvedConstraints(preferences),
  };
}


export function projectPageEvidence(inputs: Source[], observations: NativeObservation[], preferences: Preferences) {
  const sources: ResearchSnapshot["sources"] = [];
  const products: ResearchSnapshot["products"] = [];
  const decisions: EvidenceDecision[] = [];
  const acceptedNames = observations.map((observation) => cleanText(observation.name));
  for (const input of inputs) {
    const { url } = input;
    const id = `source-${sources.length + 1}`;
    const rawHighlights = input.highlights.map(cleanText);
    const statements = rawHighlights.flatMap((highlight) => highlight.split(/(?<=[.!?])\s+(?=[A-Z0-9])/));
    const source = { id, url, title: input.title, highlights: [] as string[] };
    const scope = headingScope(input, preferences, decisions);
    const candidates = observations.filter((observation) => observation.url === url);
    if (scope && products.length < 5) {
      const product = scopedProduct(scope, input, id, candidates, preferences, decisions);
      if (product && !products.some((other) => other.name.toLowerCase() === product.name.toLowerCase())) {
        products.push(product);
        const quotes = [product.identity.quote, ...product.facts.map((fact) => fact.quote), ...(product.price ? [product.price.quote] : [])];
        const last = Math.max(...quotes.map((quote) => scope.text.indexOf(quote) + quote.length));
        source.highlights.push(scope.text.slice(0, last));
      }
    }
    for (const observation of scope ? [] : candidates) {
      const name = cleanText(observation.name);
      const escapedName = escapeRegex(name);
      const productId = `research-${createHash("sha256").update(`${url}\n${name}`).digest("hex").slice(0, 24)}`;
      if (products.length === 5 || products.some((product) => product.name.toLowerCase() === name.toLowerCase())) continue;
      const record = (code: string, field: string) => decisions.push({ sourceIndex: input.sourceIndex, path: "native-field", code, field });
      const directSubject = new RegExp(`^(?:The )?${escapedName}\\s+(?:only\\s+)?(?:(?:is|are|has|have|supports?|uses?|offers?|features?|provides?|weighs?|costs?|includes?|does|do|was|were)(?:n['’]t)?|can|can't|can’t|cannot|comes|retails|lacks?)\\b`, "i");
      const attributableQuote = (rawQuote: string) => {
        const quote = cleanText(rawQuote);
        const lower = quote.toLowerCase();
        if (!directSubject.test(quote) || /[.!?]\s+[A-Z0-9]|[;]\s*|[,;]\s+[A-Z][a-z]+\s+[A-Z0-9]|\b(?:and|while|but|whereas|or)\s+[A-Z][a-z]+\s+[A-Z0-9]/.test(quote)) return null;
        if (/\b(?:versus|compared (?:with|to)|unlike)\b|\bvs\.?\s/i.test(quote)) return null;
        const description = lower.slice(lower.indexOf(name.toLowerCase()) + name.length);
        if (acceptedNames.some((other) => other !== name && description.includes(other.toLowerCase()))) return null;
        if (!statements.includes(quote) || quote.length > 640) return null;
        return { sourceId: id, quote };
      };
      const attributedFacts = observation.quotedFacts.flatMap((quote) => {
        const evidence = attributableQuote(quote);
        record(evidence ? "admitted" : "quote-absence", "quotedFacts");
        return evidence ? [evidence] : [];
      });
      const category = preferences.hard.category;
      if (!category) continue;
      const categoryStatement = new RegExp(`^(?:The )?${escapedName} (?:is|are) ${categoryStatements[category]}(?: with [^.!?]+)?[.!]?$`, "i");
      const priceEvidence = observation.priceQuote ? attributableQuote(observation.priceQuote) : null;
      const scalarAmount = "(?:0|[1-9]\\d{0,2}(?:,\\d{3})+|[1-9]\\d*)(?:\\.\\d{2})?";
      const directPrice = new RegExp(`^(?:The )?${escapedName}\\s+(?:costs|retails for|(?:is|was) (?:listed|priced) at)\\s+(?:SGD|USD|EUR|GBP|AUD|JPY|(?:S|US)\\$|[€£¥])\\s*${scalarAmount}(?: on this page| when reviewed)?\\.?$`, "i");
      const completePriceContext = priceEvidence && input.highlights.some((highlight) => {
        const parts = passages(highlight).filter((part) => part.kind === "content");
        return parts.some((part, index) => part.text === priceEvidence.quote && [parts[index - 1], parts[index + 1]].every((adjacent) =>
          !adjacent || (attributableQuote(adjacent.text) !== null && (scopedFact(adjacent.text, name) || categoryStatement.test(adjacent.text))),
        ));
      });
      const price = priceEvidence && completePriceContext && directPrice.test(priceEvidence.quote)
        ? { ...priceEvidence, kind: "page-observed-unverified" as const } : null;
      if (observation.priceQuote) record(price ? "admitted" : "price-rejection", "priceQuote");
      const categoryEvidence = attributedFacts.find((fact) => categoryStatement.test(fact.quote));
      if (!categoryEvidence) { record("missing-class", "identity"); continue; }
      const supportingFacts = attributedFacts.filter((fact) => fact !== categoryEvidence).slice(0, price ? 1 : 2);
      const facts = attributedFacts.filter((fact) => fact === categoryEvidence || supportingFacts.includes(fact));
      const modelStatements = statements.filter((statement) => attributableQuote(statement) !== null);
      if (contradictsRequiredFeature(modelStatements, preferences, name)) { record("contradiction", "constraints"); continue; }
      if (preferences.hard.excludedBrands.some((brand) => {
        const escapedBrand = escapeRegex(brand);
        const namedBrand = new RegExp(`^(?:The )?${escapedBrand}\\b`, "i");
        const titledBrand = new RegExp(`^(?:The )?${escapedBrand} ${escapedName}(?:\\W|$)`, "i");
        const manufacturedBy = new RegExp(`\\b(?:made|manufactured) by ${escapedBrand}\\b`, "i");
        return namedBrand.test(name) || titledBrand.test(source.title) || modelStatements.some((statement) => manufacturedBy.test(statement));
      })) { record("contradiction", "constraints"); continue; }
      const evidence = [...facts, ...(price ? [price] : [])];
      const extraQuotes = evidence.map((citation) => citation.quote).filter((quote) => !source.highlights.includes(quote));
      if (source.highlights.length + extraQuotes.length > 3) { record("packing-failure", "identity"); continue; }
      record("admitted", "identity");
      source.highlights.push(...extraQuotes);
      products.push({
        id: productId,
        name, identity: { ...categoryEvidence, kind: "direct-model-statement" }, facts, price, stock: "unverified", unresolvedConstraints: unresolvedConstraints(preferences),
      });

    }
    for (const excerpt of rawHighlights) {
      if (source.highlights.length === 3) break;
      const bounded = excerpt.slice(0, 640);
      if (bounded && !source.highlights.some((window) => window.includes(bounded))) source.highlights.push(bounded);
    }
    sources.push(source);
  }
  return { sources, products, decisions };
}
