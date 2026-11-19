import {
  BudgetSchema,
  MoneyAmountSchema,
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
  /^\s*(?:[fpnumckMGT]?(?:m|g|s|A|K|Hz|W|V|B|l)|dB|mAh|Wh|lbs?|oz|inches|ft|feet|hours?|minutes?|litres?|liters?|grams?|kilograms?|centimetres?|centimeters?|metres?|meters?|pixels?|percent|%)(?:\b|$)/i;
type BudgetUpdate =
  | { kind: "unchanged" }
  | { kind: "retained" }
  | { kind: "updated"; budget: ShoppingIntent["budget"]; note?: string }
  | { kind: "clarification"; reason: "currency" | "budget"; message: string };

const currencyToken = String.raw`SGD|USD|US\$|S\$|\$`;
const budgetMutation = String.raw`(?:increase|raise|change|adjust|set|update|make|reduce|lower|decrease|remove|drop|clear|forget|relax|lift)`;
const budgetSubject = String.raw`(?:(?:my|the|our|current|existing)\s+)*(?:budget(?:\s+(?:range|limit|minimum|maximum))?|(?:minimum|maximum|min|max)(?:\s+(?:budget|price))?|(?:lower|upper)\s+(?:budget\s+)?(?:bound|limit)|price\s+(?:floor|cap|ceiling)|spending\s+(?:cap|limit))`;
const money = String.raw`(?:(?:${currencyToken})\s*)?${amountToken}(?:\s*(?:SGD|USD))?`;
const currencyAmount = new RegExp(
  String.raw`(?:(?:${currencyToken})\s*${amountToken}|${amountToken}\s*(?:SGD|USD)\b)`,
  "i",
);
const moneyClauseNegation =
  /\b(?:no|not|never|cannot|without|neither|nor|[a-z]+n't|avoid\w*|refus\w*)\b/i;
const clauseBoundary = /[;!?\r\n]+|(?<!\d)[,.]|[,.](?!\d)/;
const financialWording = String.raw`(?:cost(?:s|ing)?|price(?:d)?|spend(?:ing)?|budget)`;
const financialContext = new RegExp(String.raw`\b${financialWording}\b`, "i");
const negatedBudgetExplanation =
  "Confirm the budget you want to keep or state a new maximum or complete range before researching.";
const hasNegation = (clause: string) =>
  moneyClauseNegation.test(clause.replace(/\bno\s+more\s+than\b/gi, "at most"));
const negation = String.raw`(?:not|never|no\s+need\s+to|(?:don|doesn|didn|won|wouldn|shouldn|couldn|can|isn|aren)'t)`;
const negatedCommand = new RegExp(
  String.raw`^(?:please\s+)?(?:do\s+not|don't|never)\s+${budgetMutation}\s+${budgetSubject}(?:\s+(?:to|at|by)\s+(?:(?:between|from)\s+)?${money}(?:\s*(?:to|and|[-–—])\s*${money})?)?[.!]*$`,
  "i",
);
const negatedMutation = new RegExp(
  String.raw`\b${negation}\s+(?:(?:want|need|wish|intend|plan|you|us|me|to|ever|please|just|really)\s+)*${budgetMutation}\s+(?:${budgetSubject}\b|(?:it\s+)?(?:to\s+)?${money})`,
  "i",
);
const rangePattern = new RegExp(
  String.raw`(?:\b(between|from|budget(?: is| of| to)?|range(?: is| of)?|${financialWording}(?:\s+(?:is|of|at))?(?:\s+(?:around|about|approximately|roughly))?)\s*)?(${currencyToken})?\s*(${amountToken})\s*(SGD|USD)?\s*(?:to|and|[-–—])\s*(${currencyToken})?\s*(${amountToken})(?:\s*(SGD|USD))?(?!\d|[.,]\d)`,
  "gi",
);
const currencyOf = (token: string): Currency | undefined =>
  token === "$" ? undefined : /^(?:USD|US\$)$/i.test(token) ? "USD" : "SGD";
function amountOf(token: string): number | undefined {
  const thousands = /k$/i.test(token);
  const digits = thousands ? token.slice(0, -1) : token;
  const valid = thousands
    ? /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(digits)
    : numberToken.test(digits);
  if (!valid) return undefined;
  const amount = Number(digits.replaceAll(",", "")) * (thousands ? 1000 : 1);
  return MoneyAmountSchema.safeParse(amount).success ? amount : undefined;
}
type Amount = { token: string; currency?: Currency };

export function parseBudget(
  message: string,
  previous: ShoppingIntent["budget"],
  region: Region,
): BudgetUpdate {
  let remaining = message.normalize("NFKC").replace(/[’‘]/g, "'").replace(/\b(SGD|USD)\$/gi, "$1").trim();
  const clarification = (
    reason: "currency" | "budget",
    explanation: string,
  ): BudgetUpdate => ({
    kind: "clarification",
    reason,
    message: `${explanation} Your current budget has not changed.`,
  });
  if (negatedCommand.test(remaining)) return { kind: "retained" };
  const hasNegatedMoney = remaining
    .split(clauseBoundary)
    .some((clause) => currencyAmount.test(clause) && hasNegation(clause));
  if (hasNegatedMoney || negatedMutation.test(remaining))
    return clarification("budget", negatedBudgetExplanation);
  if (
    /^(?:no budget limit|no limit on (?:the |my )?budget|unlimited budget)[.!?]*$/i.test(
      remaining.trim(),
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
    return clarification(
      "currency",
      "This research supports SGD and USD budgets. Specify one of those currencies, or continue without a budget.",
    );

  const ranges: {
    lower: string;
    upper: string;
    tokens: string[];
    clause: string;
  }[] = [];
  const uncuedRangeClauses = new Set<string>();
  let measurementRange = false;
  let negatedRange = false;
  remaining = remaining.replace(
    rangePattern,
    (
      whole,
      cue: string | undefined,
      firstCurrency: string | undefined,
      lower: string,
      firstSuffix: string | undefined,
      secondCurrency: string | undefined,
      upper: string,
      secondSuffix: string | undefined,
      offset: number,
      source: string,
    ) => {
      const tokens = [
        firstCurrency,
        firstSuffix,
        secondCurrency,
        secondSuffix,
      ].filter((value): value is string => Boolean(value));
      const after = source.slice(offset + whole.length);
      if (measurementUnit.test(after)) {
        measurementRange = true;
        return whole;
      }
      if (/^[A-Za-z_]/.test(after)) return whole;
      const start = offset + whole.length - whole.trimStart().length;
      const before = source.slice(0, start);
      if (
        !cue &&
        !tokens.length &&
        (/[\p{L}\p{N}_-]$/u.test(before) || /\bmodel\s+$/i.test(before))
      )
        return whole;
      const clause =
        (source.slice(0, offset).split(clauseBoundary).at(-1) ?? "") +
        whole +
        (after.split(clauseBoundary)[0] ?? "");
      if (
        hasNegation(clause) &&
        (cue || tokens.length || financialContext.test(clause))
      )
        negatedRange = true;
      if (!cue && !tokens.length) {
        uncuedRangeClauses.add(clause);
        return whole;
      }
      ranges.push({ lower, upper, tokens, clause });
      return " ";
    },
  );
  if (negatedRange)
    return clarification("budget", negatedBudgetExplanation);
  if (
    /\b(?:more than|at least|over|minimum|not under|not below)\s*(?:SGD|USD|S\$|US\$|\$)\s*\d/i.test(
      remaining.replace(/\bno\s+more\s+than\b/gi, "at most"),
    )
  )
    return clarification(
      "budget",
      "State a maximum budget or a complete minimum-to-maximum range.",
    );
  const amounts: Amount[] = [];
  remaining = remaining.replace(
    new RegExp(
      String.raw`(?:\b(SGD|USD|US\$|S\$)|\$)\s*(${amountToken})\b`,
      "gi",
    ),
    (_whole, currency: string | undefined, token: string) => {
      amounts.push({
        token,
        ...(currency ? { currency: currencyOf(currency) } : {}),
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
  if (
    ranges.length > 1 ||
    ranges.some((range) => uncuedRangeClauses.has(range.clause)) ||
    amounts.length > 1 ||
    (ranges.length && amounts.length)
  )
    return clarification(
      "budget",
      "State one budget range or maximum amount and its currency.",
    );
  const range = ranges[0];
  const parsed = amounts[0];
  const explicitCurrencies = range
    ? [...new Set(range.tokens.flatMap((token) => currencyOf(token) ?? []))]
    : parsed?.currency
      ? [parsed.currency]
      : [];
  if (explicitCurrencies.length > 1)
    return clarification(
      "currency",
      "Use the same currency for both budget bounds.",
    );
  const explicitCurrency = explicitCurrencies[0];
  const unmatchedCurrencies = remaining.match(/\b(?:SGD|USD)\b/gi) ?? [];
  if (
    unmatchedCurrencies.some(
      (currency) =>
        currency.toUpperCase() !== (explicitCurrency ?? previous?.currency),
    )
  )
    return clarification(
      "currency",
      "State a new amount with that currency. I cannot convert or remove your existing budget without an instruction.",
    );
  if (!parsed && !range) {
    if (
      !measurementRange &&
      /\b(?:between|from)\s*(?:(?:SGD|USD|S\$|US\$|\$)\s*)?\d/i.test(message)
    )
      return clarification(
        "budget",
        "State both budget bounds, such as between SGD1000 and SGD2000.",
      );
    return { kind: "unchanged" };
  }
  if (!explicitCurrency && !previous && /\$/.test(message))
    return clarification(
      "currency",
      "Is that budget in SGD or USD? Include the currency.",
    );
  const currency =
    explicitCurrency ?? previous?.currency ?? (region === "SG" ? "SGD" : "USD");
  if (
    !range &&
    previous?.minimum !== undefined &&
    previous.currency !== currency
  )
    return clarification(
      "currency",
      "Give both bounds in the new currency, or explicitly remove the minimum first.",
    );
  const amount = amountOf(range?.upper ?? parsed!.token);
  const minimum = range ? amountOf(range.lower) : previous?.minimum;
  if (amount === undefined || (range && minimum === undefined))
    return clarification(
      "budget",
      "Use positive amounts up to 1,000,000 with at most two decimal places after expanding k as thousands. Scientific notation is unsupported.",
    );
  const budget = BudgetSchema.safeParse({
    amount,
    currency,
    ...(minimum !== undefined ? { minimum } : {}),
  });
  if (!budget.success)
    return clarification(
      "budget",
      "The maximum budget must be at least the minimum. Correct the range or explicitly remove its minimum.",
    );
  return {
    kind: "updated",
    budget: budget.data,
    ...(!explicitCurrency
      ? {
          note: `The amount without a currency uses ${currency}. State SGD or USD to change it.`,
        }
      : {}),
  };
}

const localMoney = String.raw`(?:(?:${currencyToken}|[A-Z]{3})\s*)?${amountToken}(?:\s*[A-Z]{3})?`;
const completeAmendment = new RegExp(String.raw`^(?:make it|(?:set|change|raise|lower|increase|reduce|update) (?:my |the )?budget(?: to)?|budget(?: is| of)?|under|up to|at most)\s+${localMoney}(?:\s*(?:to|and|[-–—])\s*${localMoney})?[.!?]*$`, "i");
export function isCompleteBudgetAmendment(message: string): boolean {
  return completeAmendment.test(message.trim());
}

export function hasExplicitBudgetCurrency(message: string): boolean {
  return /(?:^|[^a-z])(?:SGD|USD)(?=$|[^a-z])|(?:^|[^a-z])(?:S|US)\$/i.test(message);
}
