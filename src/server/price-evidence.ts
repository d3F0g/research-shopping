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

function conditionProof(tail: string): Set<string> | null {
  const parts = tail.trim()
    ? tail
        .trim()
        .replace(/^for (?:one|1) unit\b/iu, "one unit")
        .replace(/^[,;]\s*/u, "")
        .split(/\s*[,;]\s*|\s+and\s+/iu)
    : [];
  const proven = new Set<string>();
  for (const part of parts) {
    const kind = conditionKinds.get(part.toLowerCase());
    if (!kind) return null;
    proven.add(kind);
  }
  return proven;
}

function priceClauses(text: string, subjects: string[], money: string) {
  const headings = new Set(subjects.map((subject) => subject.toLowerCase()));
  const amountLine = new RegExp(`^(?:price\\s*:\\s*)?${money}(?=$|[\\s,.])([\\s\\S]*)$`, "iu");
  const lines = text.split(/\r?\n/u);
  const clauses: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const heading = lines[i]!.trim();
    const amount = lines[i + 1]?.trim();
    if (!headings.has(heading.toLowerCase()) || !amount || !amountLine.test(amount)) {
      clauses.push(lines[i]!);
      continue;
    }
    const tail: string[] = [];
    let next = i + 2;
    while (next < lines.length && lines[next]!.trim() && !headings.has(lines[next]!.trim().toLowerCase())) {
      tail.push(lines[next]!.trim().replace(/^for (?:one|1) unit\b/iu, "one unit").replace(/[.!?]$/u, ""));
      next++;
    }
    const observed = amount.replace(/^price\s*:\s*/iu, "").replace(/[.!?]$/u, "");
    clauses.push(`${heading} costs ${observed}${tail.length ? `, ${tail.join(", ")}` : ""}`);
    i = next - 1;
  }
  return clauses.flatMap((clause) => clause.split(/(?<=[.!?])\s+(?=[\p{Lu}\d])/u));
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
        `^(?:${otherSubjects.map(literal).join("|")})\\s+(?:costs?|is priced at|has a price of)\\s*${money}(?=$|[\\s,.])([\\s\\S]*)$`,
        "iu",
      )
    : null;
  let relevant = false;
  let observed = false;
  let complete = true;
  const proven = new Set<string>();
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
    }
    relevant = true;
    if (
      !match ||
      Number((match[1] ?? match[2])!.replaceAll(",", "")) !== price.amount
    ) {
      complete = false;
      continue;
    }
    observed = true;
    const conditions = conditionProof(match[3]!);
    if (!conditions) complete = false;
    else for (const condition of conditions) proven.add(condition);
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
