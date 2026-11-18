import {
  BudgetSchema,
  type Currency,
  type Region,
  type ShoppingIntent,
} from "./contracts";

const amountToken = String.raw`[+-]?(?:\d[\d,._]*(?:e[+-]?\d+)?[km]?|infinity|nan)`;
const numberToken = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
const unsupportedCodes = Intl.supportedValuesOf("currency")
  .filter((currency) => currency !== "SGD" && currency !== "USD")
  .join("|");
const unsupportedNames = String.raw`euros?|pounds?|yen|ringgit|rupees?|francs?|yuan`;
const unsupportedAmount = new RegExp(
  String.raw`\b(?:${unsupportedCodes}|${unsupportedNames})\s*${amountToken}\b|\b${amountToken}\s*(?:${unsupportedCodes}|${unsupportedNames})\b`,
  "gi",
);
const measurementUnit =
  /^\s*(?:[fpnumckMGT]?(?:m|g|s|A|K|Hz|W|V|B|l)|dB|mAh|Wh|lbs?|oz|inches|ft|feet|hours?|minutes?|litres?|liters?|grams?|kilograms?|percent|%)(?:\b|$)/i;
type BudgetUpdate =
  | { kind: "unchanged" }
  | { kind: "updated"; budget: ShoppingIntent["budget"]; note?: string }
  | { kind: "clarification"; reason: "currency" | "budget"; message: string };

export function parseBudget(
  message: string,
  previous: ShoppingIntent["budget"],
  region: Region,
): BudgetUpdate {
  let remaining = message.normalize("NFKC");
  if (
    /\b(?:no budget limit|no limit on (?:the |my )?budget|unlimited budget|(?:remove|drop|clear) (?:the |my )?budget(?: limit)?)\b/i.test(
      remaining,
    )
  )
    return { kind: "updated", budget: null };
  if (
    [...remaining.matchAll(unsupportedAmount)].some(
      (match) =>
        !measurementUnit.test(remaining.slice(match.index + match[0].length)),
    ) ||
    /\p{Sc}/u.test(remaining.replaceAll("$", ""))
  )
    return {
      kind: "clarification",
      reason: "currency",
      message:
        "This research supports SGD and USD budgets. Specify one of those currencies, or continue without a budget. Your current budget has not changed.",
    };
  if (
    /\b(?:more than|at least|over|minimum|not under|not below)\s*(?:SGD|USD|S\$|US\$|\$)\s*\d/i.test(
      remaining,
    )
  )
    return {
      kind: "clarification",
      reason: "budget",
      message:
        "Budgets are maximum spending limits. State a maximum amount and currency.",
    };
  const amounts: { token: string; currency?: Currency }[] = [];
  remaining = remaining.replace(
    new RegExp(
      String.raw`(?:\b(SGD|USD|US\$|S\$)|\$)\s*(${amountToken})\b`,
      "gi",
    ),
    (_whole, currency: string | undefined, token: string) => {
      amounts.push({
        token,
        ...(currency
          ? {
              currency: /^(?:USD|US\$)$/i.test(currency)
                ? ("USD" as const)
                : ("SGD" as const),
            }
          : {}),
      });
      return " ";
    },
  );
  remaining = remaining.replace(
    new RegExp(String.raw`\b(${amountToken})\s*(SGD|USD)\b`, "gi"),
    (_whole, token: string, currency: string) => {
      amounts.push({ token, currency: currency.toUpperCase() as Currency });
      return " ";
    },
  );
  remaining = remaining.replace(
    new RegExp(
      String.raw`\b(?:under|below|up to|at most|less than|no more than|budget(?: is| of| to)?|limit(?: is| of| to)?|maximum(?: of)?|max(?: of)?|make it)\s*(${amountToken})\b`,
      "gi",
    ),
    (whole, token: string, offset: number, source: string) => {
      if (measurementUnit.test(source.slice(offset + whole.length)))
        return whole;
      amounts.push({ token });
      return " ";
    },
  );
  if (amounts.length > 1)
    return {
      kind: "clarification",
      reason: "budget",
      message:
        "Which amount is your maximum budget? State one maximum and its currency. Your current budget has not changed.",
    };
  const parsed = amounts[0];
  const unmatchedCurrencies = remaining.match(/\b(?:SGD|USD)\b/gi) ?? [];
  if (
    unmatchedCurrencies.some(
      (currency) =>
        currency.toUpperCase() !== (parsed?.currency ?? previous?.currency),
    )
  )
    return {
      kind: "clarification",
      reason: "currency",
      message:
        "State a new amount with that currency. I cannot convert or remove your existing budget without an instruction.",
    };
  if (!parsed) return { kind: "unchanged" };
  if (!parsed.currency && !previous && /\$/.test(message))
    return {
      kind: "clarification",
      reason: "currency",
      message: "Is that budget in SGD or USD? Include the currency.",
    };
  const currency =
    parsed.currency ?? previous?.currency ?? (region === "SG" ? "SGD" : "USD");
  const budget = BudgetSchema.safeParse({
    amount: Number(parsed.token.replaceAll(",", "")),
    currency,
  });
  if (!numberToken.test(parsed.token) || !budget.success)
    return {
      kind: "clarification",
      reason: "budget",
      message:
        "Use a positive budget up to 1,000,000 with at most two decimal places. Scientific notation and abbreviated amounts are unsupported. Your current budget has not changed.",
    };
  return {
    kind: "updated",
    budget: budget.data,
    ...(!parsed.currency
      ? {
          note: `The amount without a currency uses ${currency}. State SGD or USD to change it.`,
        }
      : {}),
  };
}
