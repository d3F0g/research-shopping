import { uniqueLiteralSpan } from "../domain/evidence-binding-v3";
import type { Assessment, ResearchProduct, ResearchSource } from "../domain/research";

type Price = NonNullable<ResearchProduct["price"]>;
export type PriceContext =
  | { kind: "absent" }
  | { kind: "unbound" }
  | { kind: "unresolved"; conditions: string[] }
  | { kind: "qualified"; conditions: string[] };

function literal(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const monetaryContext =
  /\b(?:prices?|priced|costs?|amounts?|totals?|tax|GST|VAT|fees?|charges?|payments?|payable|paid|pay|surcharges?|deposits?|shipping|extra|additional|loyalty|instalments?|installments?|members?|membership|vouchers?|coupons?|subscriptions?|offers?|sales?|discounts?|rebates?|cashback|purchases?|bundles?|packs?|quantit(?:y|ies)|units?|eligib\w*|only|unless|depending|requires?|required|minimum|register|registration|join)\b|\bsubject to\b|^for\b/iu;
const conditionKinds = new Map([
  ["one unit", "unit"],
  ["per unit", "unit"],
  ["tax included", "tax"],
  ["including tax", "tax"],
  ["gst included", "gst"],
  ["including gst", "gst"],
  ["vat included", "vat"],
  ["including vat", "vat"],
]);

function conditionParts(tail: string) {
  const parts = tail.trim()
    ? tail
        .trim()
        .replace(/^for (?:one|1) unit\b/iu, "one unit")
        .replace(/^[,;]\s*/u, "")
        .split(/\s*[,;\n]\s*|\s+and\s+/iu)
    : [];
  return parts;
}
function conditionProof(tail: string): Set<string> | null {
  const proven = new Set<string>();
  for (const part of conditionParts(tail)) {
    const kind = conditionKinds.get(part.toLowerCase());
    if (!kind) return null;
    proven.add(kind);
  }
  return proven;
}

const buyerRestriction = /^this price requires (?:a )?(?:membership|subscription|voucher|coupon)(?: and (?:a )?(?:membership|subscription|voucher|coupon))*$/iu;
const conditionalRestriction = /^(?:(?:only )?with (?:a )?(?:membership(?: voucher)?|voucher|coupon)|(?:membership|voucher|coupon|subscription) (?:is )?required|(?:for )?members only|only available with membership|(?:not|without) tax included|excluding (?:tax|GST|VAT)|mandatory shipping charges)$/iu;

function conditionalProof(tail: string): string[] | null {
  const conditions: string[] = [];
  for (const chunk of tail.trim().replace(/^[,;]\s*/u, "").split(/\s*[,;]\s*/u)) {
    if (buyerRestriction.test(chunk)) {
      conditions.push(chunk);
      continue;
    }
    for (const part of conditionParts(chunk)) {
      if (conditionKinds.has(part.toLowerCase())) continue;
      if (!conditionalRestriction.test(part)) return null;
      conditions.push(part);
    }
  }
  return conditions.length ? conditions : null;
}

function priceClauses(text: string, subjects: string[], money: string) {
  const headings = new Set(subjects.map((subject) => subject.toLowerCase()));
  const amountLine = new RegExp(`^(?:price\\s*:\\s*)?${money}(?=$|[\\s,.])([\\s\\S]*)$`, "iu");
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/gu)].filter((line) => line[0]);
  const clauses: string[] = [];
  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index]![0].trim();
    let amountIndex = index + 1;
    while (amountIndex < lines.length && !lines[amountIndex]![0].trim()) amountIndex++;
    const amount = lines[amountIndex]?.[0].trim();
    if (!headings.has(heading.toLowerCase()) || !amount || !amountLine.test(amount)) {
      clauses.push(lines[index]![0]);
      continue;
    }
    let next = amountIndex + 1;
    while (next < lines.length && lines[next]![0].trim() && !headings.has(lines[next]![0].trim().toLowerCase())) next++;
    const end = next < lines.length ? lines[next]!.index : text.length;
    clauses.push(text.slice(lines[index]!.index, end));
    index = next - 1;
  }
  return clauses.flatMap((clause) => clause.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u));
}
const currencyAliases: Record<string, string> = {
  SGD: "(?:SGD|S\\$|Singapore dollars?)",
  USD: "(?:USD|US\\$|U\\.S\\. dollars?|United States dollars?)",
  EUR: "(?:EUR|€|euros?)",
  GBP: "(?:GBP|£|pounds?)",
};
function denominationPattern(currency: string) {
  return currencyAliases[currency] ?? literal(currency);
}
function moneyPattern(currency: string) {
  const denomination = denominationPattern(currency);
  const number = "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)";
  return `(?:${denomination}\\s*${number}|${number}\\s*${denomination})(?![\\w.,]\\d|\\d)`;
}

export function isMonetaryOnlyEvidence(text: string, currencies: readonly string[]): boolean {
  if (!/[0-9]/u.test(text)) return false;
  const denominations = [...new Set([...Object.keys(currencyAliases), ...currencies])].map(denominationPattern);
  const conditions = [buyerRestriction.source.slice(1, -1), conditionalRestriction.source.slice(1, -1), "(?:for|per)\\s+(?:one|[0-9]+)\\s+units?", ...[...conditionKinds.keys()].map(literal)];
  const phrase = (parts: string[]) => new RegExp(`(?<!\\p{L})(?:${parts.join("|")})(?!\\p{L})`, "giu");
  const remainder = text
    .replace(phrase(conditions), " ")
    .replace(phrase([...denominations, "\\p{Sc}"]), " ")
    .replace(/[0-9]+(?:[.,][0-9]+)*/gu, " ")
    .replace(phrase(["is priced at", "has a price of", "from", "to", "between", "and"]), " ")
    .replace(new RegExp(monetaryContext.source, "giu"), " ");
  return /^[\s\p{P}+−]*$/u.test(remainder);
}

export function assessPriceContext(
  price: Price,
  productName: string,
  text: string,
  otherProducts: Pick<ResearchProduct, "name" | "variant">[] = [],
): PriceContext {
  if (!price.variant.trim()) return { kind: "unbound" };
  const subjects = [price.variant, `${productName} ${price.variant}`];
  if (
    new RegExp(`(?:^|\\W)${literal(price.variant)}(?:$|\\W)`, "iu").test(
      productName,
    )
  )
    subjects.push(productName);
  const money = moneyPattern(price.currency);
  const assertion = new RegExp(
    `^(?:${subjects.map(literal).join("|")})(?:\\s+(?:costs?|is priced at|has a price of)\\s*|[ \t]*\\r?\\n\\s*(?:price\\s*:\\s*)?)${money}(?=$|[\\s,.])([\\s\\S]*)$`,
    "iu",
  );
  const otherSubjects = otherProducts.flatMap((product) => {
    if (!product.variant) return [];
    const namedVariant = new RegExp(
      `(?:^|\\W)${literal(product.variant)}(?:$|\\W)`,
      "iu",
    ).test(product.name);
    const subjects = [
      namedVariant ? product.name : `${product.name} ${product.variant}`,
    ];
    if (
      product.variant.toLowerCase() !== price.variant.toLowerCase() &&
      otherProducts.filter(
        (other) =>
          other.variant?.toLowerCase() === product.variant!.toLowerCase(),
      ).length === 1 &&
      text.toLowerCase().includes(product.name.toLowerCase())
    )
      subjects.push(product.variant);
    return subjects;
  });
  const otherAssertion = otherSubjects.length
    ? new RegExp(
        `^(?:${otherSubjects.map(literal).join("|")})(?:\\s+(?:costs?|is priced at|has a price of)\\s*|[ \t]*\\r?\\n\\s*(?:price\\s*:\\s*)?)${money}(?=$|[\\s,.])([\\s\\S]*)$`,
        "iu",
      )
    : null;
  const ordinaryPrice = new RegExp(`^the ordinary (?:${subjects.map(literal).join("|")}) price is ${money}$`, "iu");
  let observed = false;
  let complete = true;
  const proven = new Set<string>();
  const unresolved: string[] = [];
  for (const sentence of priceClauses(text, [...subjects, ...otherSubjects], money)) {
    const clause = sentence.trim().replace(/[.!?]$/, "");
    if (
      !clause ||
      !(
        monetaryContext.test(clause) ||
        /\p{Sc}|\b[A-Z]{3}\s*\d|\b\d[\d.,]*\s*[A-Z]{3}\b/u.test(clause)
      )
    )
      continue;
    const match = assertion.exec(clause);
    if (!match) {
      const other = otherAssertion?.exec(clause);
      if (other && conditionProof(other[3]!) !== null) continue;
      const conditional = observed ? conditionalProof(clause) : null;
      if (conditional) {
        unresolved.push(...conditional);
        complete = false;
        continue;
      }
      if (observed && unresolved.length && ordinaryPrice.test(clause)) {
        unresolved.push(clause);
        complete = false;
        continue;
      }
    }
    if (
      !match ||
      Number((match[1] ?? match[2])!.replaceAll(",", "")) !== price.amount
    ) {
      return { kind: "unbound" };
    }
    observed = true;
    const conditions = conditionProof(match[3]!);
    if (!conditions) {
      const conditional = conditionalProof(match[3]!);
      if (!conditional) return { kind: "unbound" };
      unresolved.push(...conditional);
      complete = false;
    } else for (const condition of conditions) proven.add(condition);
  }
  if (!observed) return { kind: "absent" };
  const conditions = price.conditions.filter((condition) => {
    const kind = conditionKinds.get(
      condition.trim().replace(/[.!]$/, "").toLowerCase(),
    );
    return kind !== undefined && proven.has(kind);
  });
  return complete &&
    price.conditionsResolved &&
    conditions.length === price.conditions.length
    ? { kind: "qualified", conditions }
    : { kind: "unresolved", conditions: [...new Set(unresolved)].slice(0, 8) };
}

export type PriceObservation =
  | { kind: "absent" }
  | { kind: "observed"; applicability: { kind: "qualified" | "unresolved"; conditions: string[] } };

function namedCatalogObservation(price: Price, productName: string, identity: Assessment, source: ResearchSource): PriceObservation {
  if (source.textTruncated || source.text.length > 4000 || identity.status !== "supported" || identity.scope !== "exact-variant") return { kind: "absent" };
  if (!new RegExp(`(?:^|[^\\p{L}\\p{N}])${literal(price.variant)}(?=$|[^\\p{L}\\p{N}])`, "u").test(productName)) return { kind: "absent" };
  const rows = [...source.text.matchAll(/^([^\r\n]+)\r?\n[\t \r\n]*([A-Z]{3}[\t ]*[0-9][^\r\n]*)(?=\r?$)/gmu)];
  const trimHeading = (text: string) => text.replace(/^[\t \u00a0]+|[\t \u00a0]+$/gu, "");
  const headingKey = (text: string) => trimHeading(text).replace(/[\u0009-\u000d\u0020\u00a0]+/gu, " ").toLowerCase();
  const selectedKey = headingKey(productName);
  const selectedWords = new Set(selectedKey.match(/[\p{L}\p{N}]+/gu));
  const selected = rows.filter((row) => headingKey(row[1]!) === selectedKey);
  if (selected.length !== 1) return { kind: "absent" };
  const row = selected[0]!;
  const heading = uniqueLiteralSpan(row[1]!, productName);
  if (!heading) return { kind: "absent" };
  const rowEnd = row.index + row[0].length;
  const nameStart = row.index + heading.start, nameEnd = row.index + heading.end;
  const moneyStart = row.index + row[0].lastIndexOf(row[2]!), moneyEnd = moneyStart + row[2]!.replace(/[ \t]+$/u, "").length;
  const selectedMoney = new RegExp(`^${moneyPattern(price.currency)}[ \t]*$`, "u").exec(row[2]!);
  if (!selectedMoney || Number((selectedMoney[1] ?? selectedMoney[2])!.replaceAll(",", "")) !== price.amount) return { kind: "absent" };
  const identityBound = identity.support.some((span) => span.sourceId === source.id && span.literal.start <= nameStart && span.literal.end >= nameEnd);
  const priceBound = price.assessment.support.some((span) => span.sourceId === source.id && span.literal.start >= nameStart && span.literal.start <= moneyStart && span.literal.end >= moneyEnd && span.literal.end <= rowEnd);
  if (!identityBound || !priceBound) return { kind: "absent" };
  const opaqueMoneyLine = (text: string) => /^[ \t]*$/u.test(text
    .replace(/\b[A-Z]{3}[ \t]*[0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?/gu, "")
    .replace(/\([0-9]+(?:\.[0-9]+)?%[ \t]*off\)/gu, ""));
  const independent = rows.filter((other) => {
    const heading = headingKey(other[1]!);
    const words = heading.match(/[\p{L}\p{N}]+/gu) ?? [];
    return other !== row && !heading.includes(selectedKey) && words.length > 1 && !words.every((word) => selectedWords.has(word)) && !monetaryContext.test(heading) && !/\b(?:variant|configuration|range)\b/iu.test(heading) && opaqueMoneyLine(other[2]!);
  });
  const removed = [row, ...independent].sort((a, b) => b.index - a.index);
  let remainder = source.text;
  for (const entry of removed) remainder = remainder.slice(0, entry.index) + "\n" + remainder.slice(entry.index + entry[0].length);
  const conditions: string[] = [];
  for (const clause of remainder.split(/\r?\n|(?<=[.!?])\s+/u).map((part) => part.trim().replace(/[.!?]$/u, ""))) {
    if (!clause) continue;
    if (/\p{Sc}|\b[A-Z]{3}\s*\d|\b\d[\d.,]*\s*[A-Z]{3}\b/u.test(clause)) return { kind: "absent" };
    if (!monetaryContext.test(clause) && !/\b(?:variant|configuration|range)\b/iu.test(clause)) continue;
    const conditional = conditionalProof(clause);
    if (conditional) conditions.push(...conditional);
    else if (conditionProof(clause) === null) return { kind: "absent" };
  }
  return { kind: "observed", applicability: { kind: "unresolved", conditions: [...new Set(conditions)] } };
}

export function observePrice(price: Price, productName: string, identity: Assessment, source: ResearchSource, otherProducts: Pick<ResearchProduct, "name" | "variant">[], contextText = source.text): PriceObservation {
  const context = assessPriceContext(price, productName, contextText, otherProducts);
  if (context.kind === "qualified" || context.kind === "unresolved") return { kind: "observed", applicability: context };
  return namedCatalogObservation(price, productName, identity, source);
}

export function unresolvedConditions(sourceConditions: string[], reported: string[]): string[] {
  const unproven = reported.filter((condition) => !conditionKinds.has(condition.trim().replace(/[.!]$/, "").toLowerCase()) && !sourceConditions.some((literal) => literal.toLowerCase() === condition.trim().replace(/[.!]$/, "").toLowerCase()));
  return [...new Set([...sourceConditions, ...unproven.map((condition) => `Provider-reported, unverified: ${condition}`)])];
}
