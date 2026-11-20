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

const buyerRestriction = /^this price requires (?:a )?(?:membership|subscription|voucher|coupon)(?: and (?:a )?(?:membership|subscription|voucher|coupon))*$/iu;
const conditionalRestriction = /^(?:(?:only )?with (?:a )?(?:membership(?: voucher)?|voucher|coupon)|(?:membership|voucher|coupon|subscription) (?:is )?required|(?:for )?members only|only available with membership|(?:not|without) tax included|excluding (?:tax|GST|VAT)|mandatory shipping charges)$/iu;

const currencyAliases: Record<string, string> = {
  SGD: "(?:SGD|S\\$|Singapore dollars?)",
  USD: "(?:USD|US\\$|U\\.S\\. dollars?|United States dollars?)",
  EUR: "(?:EUR|€|euros?)",
  GBP: "(?:GBP|£|pounds?)",
};
function denominationPattern(currency: string) {
  return currencyAliases[currency] ?? literal(currency);
}

type MonetaryToken = "amount" | "denomination" | "condition" | "operator" | "separator";

export function isMonetaryOnlyEvidence(text: string, currencies: readonly string[]): boolean {
  if (!/[0-9]/u.test(text)) return false;
  const denominations = [...new Set([...Object.keys(currencyAliases), ...currencies])].map(denominationPattern);
  const conditions = [buyerRestriction.source.slice(1, -1), conditionalRestriction.source.slice(1, -1), "(?:for|per)\\s+(?:(?:one|[0-9]+)\\s+)?(?:units?|items?|pieces?)", "(?:incl|excl)\\.? *(?:tax|GST|VAT)", ...[...conditionKinds.keys()].map(literal), "is priced at", "has a price of", "from", "to", "between", "and", "each", monetaryContext.source];
  const rules: { kind: MonetaryToken; pattern: RegExp }[] = [
    { kind: "amount", pattern: /[0-9]+(?:[.,][0-9]+)*/y },
    { kind: "denomination", pattern: new RegExp(`(?:${[...denominations, "\\p{Sc}"].join("|")})`, "iyu") },
    { kind: "condition", pattern: new RegExp(`(?:${conditions.join("|")})`, "iyu") },
    { kind: "operator", pattern: /(?:multiplied by|divided by|plus|minus|times|x)/iy },
    { kind: "separator", pattern: /[\s\p{P}\p{Sm}]+/yu },
  ];
  const canonical = text.replace(/[\t\n\v\f\r \u00a0]+/gu, " ");
  const tokens: MonetaryToken[] = [];
  for (let position = 0; position < canonical.length;) {
    let matched: { kind: MonetaryToken; length: number } | undefined;
    for (const rule of rules) {
      rule.pattern.lastIndex = position;
      const value = rule.pattern.exec(canonical)?.[0];
      if (value && (!matched || value.length > matched.length)) matched = { kind: rule.kind, length: value.length };
    }
    if (!matched) return false;
    if (matched.kind !== "separator") tokens.push(matched.kind);
    position += matched.length;
  }
  const hasOperand = (index: number, direction: -1 | 1) => {
    let position = index + direction;
    while (tokens[position] === "denomination" || tokens[position] === "condition") position += direction;
    return tokens[position] === "amount";
  };
  return tokens.every((token, index) => token !== "operator" || hasOperand(index, -1) && hasOperand(index, 1));
}

