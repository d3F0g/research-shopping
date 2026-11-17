import { categoryFeatures } from "./catalog";
import type { Category, Currency, Feature, Preferences, Priority, TurnResult } from "./contracts";

type Clarification = Extract<TurnResult, { kind: "clarification" }>;
export type PreferenceUpdate = {
  preferences: Preferences;
  notes: string[];
  clarification?: Pick<Clarification, "reason" | "message">;
};

const featureRules: { pattern: RegExp; headphones?: Feature; laptops?: Feature; priority?: Priority }[] = [
  { pattern: /\b(?:active[- ]?)?noise[- ]cancell?ing\b|\banc\b/gi, headphones: "active-noise-cancelling", priority: "noise-cancelling" },
  { pattern: /\bwireless\b|\bbluetooth\b/gi, headphones: "wireless" },
  { pattern: /\bmultipoint\b|\bmulti[- ]point\b/gi, headphones: "multipoint" },
  { pattern: /\b(?:long|longer|better) battery(?: life)?\b/gi, headphones: "long-battery-life", laptops: "long-battery", priority: "battery-life" },
  { pattern: /\blight(?:weight)?\b|\bportable\b|\blighter\b/gi, headphones: "lightweight", laptops: "portable", priority: "portability" },
  { pattern: /\boled(?: display| screen)?\b/gi, laptops: "oled-display", priority: "display-quality" },
  { pattern: /\bhigh[- ]memory\b|\b(?:at least )?32\s*gb(?: (?:of )?(?:ram|memory))?\b/gi, laptops: "high-memory", priority: "performance" },
];

const priorityRules: [RegExp, Priority][] = [
  [/\bcomfort(?:able)?\b/gi, "comfort"], [/\bsound(?: quality)?\b|\baudio quality\b/gi, "sound-quality"],
  [/\bbattery(?: life)?\b/gi, "battery-life"], [/\bportability\b/gi, "portability"],
  [/\bperformance\b|\bfaster\b/gi, "performance"], [/\bdisplay quality\b/gi, "display-quality"],
  [/\bvalue\b|\bcheaper\b|\baffordable\b|\bless expensive\b/gi, "value"],
];

const brands = new Map(["Sony", "Bose", "Sennheiser", "Audio-Technica", "ASUS", "Dell", "Apple", "Lenovo", "HP", "Acer", "Samsung"].map((brand) => [brand.toLowerCase(), brand]));
const numberPattern = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;

export function validBudgetAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 1_000_000
    && Number(amount.toFixed(2)) === amount;
}

export function updatePreferences(message: string, previous: Preferences): PreferenceUpdate {
  const preferences = structuredClone(previous);
  const notes: string[] = [];
  let remaining = message.normalize("NFKC").replace(/[\u2018\u2019]/g, "'").replace(/[\u2010-\u2014]/g, "-").trim();
  let actionable = false;
  let issue: PreferenceUpdate["clarification"];
  const fail = (reason: Clarification["reason"], explanation: string) => {
    issue ??= { reason, message: explanation };
    preferences.hard.pendingConstraint ??= message.trim().slice(0, 400);
  };
  const consume = (pattern: RegExp, action?: (match: RegExpExecArray) => void) => {
    remaining = remaining.replace(pattern, (...args: unknown[]) => {
      const captures = args.slice(0, -2) as string[];
      const match = captures as RegExpExecArray;
      match.index = args.at(-2) as number;
      match.input = remaining;
      action?.(match);
      return " ";
    });
  };
  const prioritize = (priority: Priority) => {
    preferences.soft.priorities = [priority, ...preferences.soft.priorities.filter((item) => item !== priority)].slice(0, 8);
    actionable = true;
  };

  consume(/\b(?:clear|drop|remove|discard) (?:the |all )?(?:pending|unsupported|unresolved) (?:constraints?|requirements?)\b/gi, () => {
    preferences.hard.pendingConstraint = null;
    notes.push("You explicitly removed the unresolved requirement.");
    actionable = true;
  });
  if (/\b(?:not|no|without|don't want|do not want)\s+(?:headphones?|headsets?|laptops?|notebooks?)\b/i.test(remaining)) fail("category", "Name the category you want instead. I cannot apply a negative category requirement.");
  const categories: Category[] = [];
  consume(/\b(headphones?|headsets?|laptops?|notebooks?)\b/gi, (match) => {
    categories.push(/^head/i.test(match[1]) ? "headphones" : "laptops");
  });
  if (new Set(categories).size > 1) fail("category", "Choose one category for this comparison. Do you want headphones or laptops?");
  else if (categories[0]) {
    if (preferences.hard.category !== categories[0]) {
      if (preferences.hard.category) notes.push("The category changed. Category-specific features and priorities were cleared; budget and brand exclusions remain.");
      preferences.hard.requiredFeatures = [];
      preferences.soft.priorities = ["value"];
      preferences.soft.useCase = "";
      preferences.hard.category = categories[0];
    }
    actionable = true;
  }

  consume(/\b(?:in |to |region |market |based in )?(singapore|sg|usa|united states)\b|\b(?:in|to|region|market) (?:the )?us\b|\bUS\b/g, (match) => {
    preferences.hard.region = /singapore|\bsg\b/i.test(match[0]) ? "SG" : "US";
    actionable = true;
  });
  consume(/\b(?:in |to |region |market |based in )?(Singapore|SG)\b/g, () => { preferences.hard.region = "SG"; actionable = true; });
  consume(/\b(?:no budget limit|no limit on (?:the |my )?budget|unlimited budget|remove (?:the |my )?budget(?: limit)?|drop (?:the |my )?budget(?: limit)?|clear (?:the |my )?budget(?: limit)?)\b/gi, () => {
    preferences.hard.budget = null;
    notes.push("The budget limit was removed.");
    actionable = true;
  });

  if (/\b(?:eur|gbp|aud|cad|jpy|myr|inr|euros?|pounds?|yen|ringgit)\b|[€£¥]/i.test(remaining)) {
    fail("currency", "This fixture supports SGD and USD budgets only. Specify the currency and a positive amount, or explicitly remove the unsupported requirement.");
  }
  if (/\b(?:more than|at least|over|minimum|not under|not below)\s*(?:SGD|USD|S\$|US\$|\$)?\s*\d/i.test(remaining)
    && !/\b(?:at least|minimum)\s*32\s*gb/i.test(remaining)) {
    fail("constraint", "Budgets in this fixture are maximum spending limits. State a maximum amount and currency; minimum or negated budgets are unsupported.");
  }
  const amounts: { token: string; currency?: Currency; dollar: boolean }[] = [];
  consume(/(?:\b(SGD|USD|US\$|S\$)|\$)\s*([+-]?(?:\d[\d,._]*(?:e[+-]?\d+)?[km]?|infinity|nan))\b/gi, (match) => {
    amounts.push({ token: match[2], currency: match[1] ? (/^(?:USD|US\$)$/i.test(match[1]) ? "USD" : "SGD") : undefined, dollar: !match[1] });
  });
  consume(/\b([+-]?(?:\d[\d,._]*(?:e[+-]?\d+)?[km]?|infinity|nan))\s*(SGD|USD)\b/gi, (match) => {
    amounts.push({ token: match[1], currency: match[2].toUpperCase() as Currency, dollar: false });
  });
  consume(/\b(?:under|below|up to|at most|less than|no more than|budget(?: is| of| to)?|limit(?: is| of| to)?|maximum(?: of)?|max(?: of)?|make it)\s*([+-]?(?:\d[\d,._]*(?:e[+-]?\d+)?[km]?|infinity|nan))\b/gi, (match) => {
    amounts.push({ token: match[1], dollar: false });
  });
  if (amounts.length > 1) fail("currency", "I found more than one budget amount. State one maximum amount and its currency.");
  if (amounts.length === 1) {
    const { token, currency, dollar } = amounts[0];
    const amount = Number(token.replaceAll(",", ""));
    if (!numberPattern.test(token) || !validBudgetAmount(amount)) {
      fail("constraint", "Use a budget greater than zero and no more than 1,000,000, with at most two decimal places. Scientific notation and abbreviated amounts are unsupported.");
    } else {
      const chosenCurrency = currency ?? (preferences.hard.region === "SG" ? "SGD" : "USD");
      preferences.hard.budget = { amount, currency: chosenCurrency };
      actionable = true;
      if (!currency) notes.push(`${dollar ? "The $ sign" : "The amount without a currency"} means ${chosenCurrency} in the ${preferences.hard.region} region. State SGD or USD to change it.`);
    }
  }
  consume(/\b(SGD|USD)\b/gi, (match) => {
    const currency = match[1].toUpperCase() as Currency;
    if (preferences.hard.budget?.currency !== currency) fail("currency", "State a new budget amount with that currency. I cannot convert or remove an existing budget without your instruction.");
  });
  if (previous.hard.region !== preferences.hard.region && preferences.hard.budget
    && preferences.hard.budget.currency !== (preferences.hard.region === "SG" ? "SGD" : "USD")) {
    notes.push("The previous budget currency does not match this region. No currency conversion or cross-currency comparison will be made.");
  }

  consume(/\b(?:exclude|avoid|not|no|don't want|do not want|don't like|do not like)\s+((?:sony|bose|sennheiser|audio[- ]technica|asus|dell|apple|lenovo|hp|acer|samsung)(?:\s*(?:,|and|or)\s*(?:sony|bose|sennheiser|audio[- ]technica|asus|dell|apple|lenovo|hp|acer|samsung))*)\b/gi, (match) => {
    const excluded = match[1].split(/\s*(?:,|\band\b|\bor\b)\s*/i).map((brand) => brands.get(brand.toLowerCase().replace("audio technica", "audio-technica"))!);
    preferences.hard.excludedBrands = [...new Set([...preferences.hard.excludedBrands, ...excluded])];
    actionable = true;
  });
  consume(/\b(?:clear|remove|drop) (?:all |the )?brand exclusions\b/gi, () => { preferences.hard.excludedBrands = []; actionable = true; });
  consume(/\b(?:shorter|concise|brief|briefly|less detail|keep it short)\b/gi, () => { preferences.soft.responseLength = "concise"; actionable = true; });
  consume(/\b(?:more detail(?:s)?|detailed|expanded|explain more|in depth)\b/gi, () => { preferences.soft.responseLength = "expanded"; actionable = true; });

  for (const rule of featureRules) {
    consume(rule.pattern, (match) => {
      const before = match.input.slice(Math.max(0, match.index - 35), match.index);
      const feature = preferences.hard.category ? rule[preferences.hard.category] : undefined;
      if (!feature) {
        fail("constraint", "That feature needs a compatible category. Headphones support wireless, ANC and multipoint; laptops support OLED, 32 GB memory and portability.");
        return;
      }
      if (/\b(?:remove|drop|don't need|do not need|no need for)\s*(?:the |a |any )?$/i.test(before)) {
        preferences.hard.requiredFeatures = preferences.hard.requiredFeatures.filter((item) => item !== feature);
      } else if (/\b(?:without|not|no|non-|don't want|do not want|avoid|exclude)\s*(?:a |any )?$/i.test(before)) {
        fail("constraint", "This parser cannot enforce a negative feature requirement. Rephrase it as a supported positive requirement, or explicitly drop it.");
      } else if (rule.priority && !/\b(?:must|require|requires|required|only)\b/i.test(before) && (/\b(?:prefer|prioriti[sz]e|better|more|focus on|care about)\s*(?:the |a )?$/i.test(before) || /^(?:better|longer|lighter)/i.test(match[0]))) {
        prioritize(rule.priority);
      } else {
        preferences.hard.requiredFeatures = [...new Set([...preferences.hard.requiredFeatures, feature])];
      }
      actionable = true;
    });
  }
  for (const [pattern, priority] of priorityRules) consume(pattern, (match) => {
    const before = match.input.slice(Math.max(0, match.index - 30), match.index);
    if (/\b(?:must|require|requires|required|only)\b/i.test(before)) fail("constraint", "That requirement needs evidence this fixture does not provide. Use it as a flexible preference or explicitly remove the pending constraint.");
    else prioritize(priority);
  });
  consume(/\b(?:for )?(commut(?:ing|e)|(?:long )?flights?|travel(?:ling|ing)?|work|office|calls|music|school|university|study|studying|writing|coding|programming|gaming|video editing|meetings)\b/gi, (match) => {
    const useCase = match[1].toLowerCase();
    preferences.soft.useCase = useCase;
    if (/commut|travel|flight/.test(useCase)) prioritize("portability");
    if (/music/.test(useCase)) prioritize("sound-quality");
    actionable = true;
  });

  const rejected = /\b(?:not happy|don'?t like (?:these|those|them|it)|not good|none of these|something else|dissatisfied|bad recommendations?)\b/i.test(remaining);
  consume(/\b(?:not happy|don'?t like (?:these|those|them|it)|not good|none of these|something else|dissatisfied|bad recommendations?)\b/gi);
  consume(/\b(?:i'm|i|we|me|my|our|something|anything|choose|after|a|an|the|some|please|can|could|would|you|want|need|find|recommend|recommendations?|options?|products?|show|compare|comparison|looking|look|buy|shopping|shop|help|good|nice|best|great|suitable|for|with|and|or|but|to|of|in|on|at|is|it|these|those|them|instead|actually|now|also|then|still|just|only|must|have|be|required?|requires|prefer|prioriti[sz]e|better|more|less|focus|care|about|under|below|up|most|budget|limit|maximum|max|make|change|set|lower|raise|reduce|increase|keep|give|get|new|available|any|all|remove|drop|don't|do|not|no|without|than)\b/gi);
  const unrecognized = remaining.replace(/[\s.,!?;:'"()\-]/g, "");
  if (unrecognized) fail("constraint", "I cannot reliably apply part of that request. Supported constraints are category, budget, region, brand exclusions and the listed features. Rephrase it, or explicitly clear the pending constraint.");

  if (preferences.hard.pendingConstraint && !issue) {
    issue = { reason: "constraint", message: "An unresolved requirement is still active. I will not recommend products until you explicitly clear the pending constraint or reset this session." };
  }
  if (issue) return { preferences, notes, clarification: issue };
  if (!preferences.hard.category) return { preferences, notes, clarification: { reason: "category", message: "Are you looking for headphones or a laptop? Those are the two categories in this sample catalog." } };
  if (preferences.hard.requiredFeatures.some((feature) => !categoryFeatures[preferences.hard.category!].includes(feature))) {
    return { preferences, notes, clarification: { reason: "constraint", message: "A required feature does not apply to this category. Remove it or change the category before comparing products." } };
  }
  if (rejected && !actionable) return { preferences, notes, clarification: { reason: "feedback", message: "What should improve first: price, battery life, or portability?" } };
  return { preferences, notes };
}
