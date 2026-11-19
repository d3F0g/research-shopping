import type { ResearchProduct } from "../domain/research";

type Price = NonNullable<ResearchProduct["price"]>;
type PriceContext =
  | { kind: "absent" }
  | { kind: "unbound" }
  | { kind: "unresolved" }
  | { kind: "qualified"; conditions: string[] };

function literal(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const monetaryContext =
  /\b(?:prices?|priced|costs?|amounts?|totals?|tax|GST|VAT|fees?|charges?|payments?|payable|paid|pay|surcharges?|deposits?|shipping|extra|additional|loyalty|instalments?|installments?|members?|membership|vouchers?|coupons?|subscriptions?|offers?|sales?|discounts?|rebates?|cashback|purchases?|bundles?|packs?|eligib\w*|only|unless|depending|requires?|required|minimum|register|registration|join)\b|\bsubject to\b/iu;
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

export function assessPriceContext(
  price: Price,
  productName: string,
  text: string,
): PriceContext {
  if (!price.variant.trim()) return { kind: "unbound" };
  const subjects = [price.variant, `${productName} ${price.variant}`];
  if (
    new RegExp(`(?:^|\\W)${literal(price.variant)}(?:$|\\W)`, "iu").test(
      productName,
    )
  )
    subjects.push(productName);
  const currency =
    price.currency === "SGD"
      ? "(?:SGD|S\\$|Singapore dollars?)"
      : price.currency === "USD"
        ? "(?:USD|US\\$|U\\.S\\. dollars?|United States dollars?)"
        : price.currency === "EUR"
          ? "(?:EUR|€|euros?)"
          : price.currency === "GBP"
            ? "(?:GBP|£|pounds?)"
            : price.currency;
  const number = "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?)";
  const money = `(?:${currency}\\s*${number}|${number}\\s*${currency})(?![\\w.,]\\d|\\d)`;
  const assertion = new RegExp(
    `^(?:${subjects.map(literal).join("|")})\\s+(?:costs?|is priced at|has a price of)\\s*${money}(?=$|[\\s,.])([\\s\\S]*)$`,
    "iu",
  );
  let relevant = false;
  let observed = false;
  let complete = true;
  const proven = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])|\n+/u)) {
    const clause = sentence.trim().replace(/[.!?]$/, "");
    if (
      !clause ||
      !(
        monetaryContext.test(clause) ||
        /\p{Sc}|\b[A-Z]{3}\s*\d|\b\d[\d.,]*\s*[A-Z]{3}\b/u.test(clause)
      )
    )
      continue;
    relevant = true;
    const match = assertion.exec(clause);
    if (
      !match ||
      Number((match[1] ?? match[2])!.replaceAll(",", "")) !== price.amount
    ) {
      complete = false;
      continue;
    }
    observed = true;
    const tail = match[3]!.trim();
    const parts = tail
      ? tail
          .replace(/^for (?:one|1) unit\b/iu, "one unit")
          .replace(/^[,;]\s*/u, "")
          .split(/\s*[,;]\s*|\s+and\s+/iu)
      : [];
    for (const part of parts) {
      const kind = conditionKinds.get(part.toLowerCase());
      if (!kind) complete = false;
      else proven.add(kind);
    }
  }
  if (!observed) return { kind: relevant ? "unbound" : "absent" };
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
    : { kind: "unresolved" };
}
