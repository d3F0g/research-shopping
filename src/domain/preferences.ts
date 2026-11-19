import { parseBudget } from "./budget";
import {
  defaultIntent,
  ShoppingIntentSchema,
  type Criterion,
  type IntentEdit,
  type ShoppingIntent,
  type MoneyDraft,
} from "./contracts";
import {
  ShoppingIntentSchema as Version3ShoppingIntentSchema,
  type ShoppingIntent as Version3ShoppingIntent,
} from "./research-intent-v3";
import { ShoppingIntentSchema as Version4ShoppingIntentSchema, type ShoppingIntent as Version4ShoppingIntent } from "./research-intent-v4";
import type { Preferences as LegacyPreferences } from "./legacy-contracts";

export type IntentUpdate = {
  preferences: ShoppingIntent;
  notes: string[];
  reply?: string;
  clarification?: {
    reason: "constraint" | "feedback" | "currency" | "budget" | "description";
    message: string;
  };
};
const normalized = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
const nextId = (intent: ShoppingIntent) =>
  `criterion-${Math.max(intent.revision, ...intent.criteria.map((item) => Number(item.id.slice(10))), 0) + 1}`;
const detailOnly =
  /^(?:please )?(shorter|concise|brief|briefly|less detail|keep it short|more details?|detailed|expanded|explain more|in depth)[.!?]*$/i;

function applyIntentEdit(
  previous: ShoppingIntent,
  edit: IntentEdit,
  origin: string,
): IntentUpdate {
  const intent = structuredClone(previous);
  const edits = edit.kind === "batch" ? edit.edits : [edit];
  for (const item of edits) {
    switch (item.kind) {
      case "discard-pending":
        intent.pendingChange = null;
        break;
      case "set-description":
        intent.productDescription = item.value;
        break;
      case "set-budget":
        intent.budget = item.value;
        intent.budgetClarified = true;
        if (
          intent.pendingChange?.reason === "budget" ||
          intent.pendingChange?.reason === "currency"
        )
          intent.pendingChange = null;
        break;
      case "set-region":
        intent.region = item.value;
        break;
      case "set-response-length":
        intent.responseLength = item.value;
        break;
      case "add-criterion":
        intent.criteria.push({
          id: nextId(intent),
          wording: item.wording,
          strength: item.strength,
          origin: { kind: "edit", text: origin },
        });
        break;
      case "replace-criterion": {
        const criterion = intent.criteria.find(
          (criterion) => criterion.id === item.id,
        );
        if (!criterion)
          return {
            preferences: previous,
            notes: [],
            clarification: {
              reason: "constraint",
              message:
                "That requirement is no longer active. Choose one of the current requirements to edit.",
            },
          };
        Object.assign(criterion, {
          wording: item.wording,
          strength: item.strength,
          origin: { kind: "edit", text: origin },
        });
        break;
      }
      case "remove-criterion": {
        if (!intent.criteria.some((criterion) => criterion.id === item.id))
          return {
            preferences: previous,
            notes: [],
            clarification: {
              reason: "constraint",
              message:
                "That requirement is no longer active. Choose one of the current requirements to remove.",
            },
          };
        if (
          intent.pendingChange?.reason === "constraint" &&
          /^(?:please )?(?:remove|drop|forget)\b/i.test(
            intent.pendingChange.message,
          )
        )
          intent.pendingChange = null;
        intent.criteria = intent.criteria.filter(
          (criterion) => criterion.id !== item.id,
        );
        break;
      }
    }
  }
  intent.revision =
    Math.max(
      previous.revision,
      ...intent.criteria.map((item) => Number(item.id.slice(10))),
    ) + 1;
  const parsed = ShoppingIntentSchema.safeParse(intent);
  if (!parsed.success)
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "constraint",
        message:
          "Keep the description within 4,000 characters and use at most 12 requirements of 400 characters each. Your previous preferences are unchanged.",
      },
    };
  return {
    preferences: parsed.data,
    notes: [],
    reply: "Preferences updated. Compare options when you are ready.",
  };
}

function interpretMessage(
  message: string,
  previous: ShoppingIntent,
): IntentUpdate {
  const text = message.trim();
  const help = normalized(text);
  if (
    /^(?:how (?:does (?:this|it|fieldnote|this app) work|do i use (?:this|fieldnote|this app))|what can (?:you|fieldnote|this app) do|help(?: me use (?:this|fieldnote|this app))?|can you (?:place an order|buy (?:it|something) for me))$/.test(
      help,
    )
  )
    return {
      preferences: previous,
      notes: [],
      reply:
        "Describe what you are shopping for, your hard requirements and any flexible preferences. I compare source-based product evidence and explain unresolved tradeoffs. You can edit preferences or ask for a shorter reply. I provide source links; I do not place orders or verify merchant stock.",
    };
  if (
    /^(?:(?:what(?: is|'s)|show me|remind me of) my (?:(?:current|accepted|saved) )?(?:budget(?: range| limit)?|price range|(?:minimum|maximum) budget)|what (?:budget(?: range)?|price range) (?:did i set|have i set))$/.test(
      help,
    )
  ) {
    const budget = previous.budget;
    const money = (value: number) =>
      `${budget!.currency} ${value.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;
    const reply = budget
      ? budget.minimum === undefined
        ? `Your accepted budget is up to ${money(budget.amount)}.`
        : `Your accepted budget is ${money(budget.minimum)} to ${money(budget.amount)}.`
      : "You do not have an accepted budget limit.";
    return {
      preferences: previous,
      notes: [],
      reply: `${reply}${previous.pendingChange ? " Your pending change has not been applied." : ""}`,
    };
  }
  if (
    /^(?:does (?:this|fieldnote|this app|a search|research) cost (?:money|anything)|is (?:this|fieldnote|this app|a search|research) free|how much does (?:this|fieldnote|this app|a search|research) cost|(?:do i|will i) (?:pay|be charged)(?: for (?:this|a search|research))?)$/.test(
      help,
    )
  )
    return {
      preferences: previous,
      notes: [],
      reply:
        "Shopping requests may use one paid Exa call, charged to the configured research account. I cannot quote a fixed cost here. App help, viewing saved evidence and changing display preferences do not start another search.",
    };
  if (
    /^(?:(?:no )?thanks?(?: you)?|thank you(?: very much)?|ok(?:ay)?|great|got it|hello|hi|hey)[.!]*$/i.test(
      text,
    )
  )
    return {
      preferences: previous,
      notes: [],
      reply: /^(hi|hello|hey)/i.test(text)
        ? "Tell me what you are shopping for and what matters to you."
        : "You're welcome. Your preferences and earlier research are still here.",
    };
  if (detailOnly.test(text))
    return editIntent(
      previous,
      {
        kind: "set-response-length",
        value: /more|detailed|expanded|depth/i.test(text)
          ? "expanded"
          : "concise",
      },
      text,
    );
  if (
    /^(?:i (?:don't|do not) like (?:these|them)|not (?:happy|satisfied)|none of these|try again|these (?:don't|do not) work)[.!]*$/i.test(
      text,
    )
  )
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "feedback",
        message:
          "What should change in the next comparison? Tell me the tradeoff that missed the mark, or edit a requirement.",
      },
    };
  const removal =
    /^(?:please )?(?:remove|drop|forget|clear) (?:the |my )?(?:requirement (?:for )?)?(.+?)[.!]*$/i.exec(
      text,
    );
  if (removal) {
    if (/^(?:budget|budget limit)$/i.test(removal[1]!))
      return editIntent(previous, { kind: "set-budget", value: null }, text);
    if (
      /^(?:minimum(?: budget| price)?|lower (?:budget )?(?:bound|limit)|price floor)$/i.test(
        removal[1]!,
      )
    ) {
      const budget = previous.budget
        ? { amount: previous.budget.amount, currency: previous.budget.currency }
        : null;
      return editIntent(previous, { kind: "set-budget", value: budget }, text);
    }
    const matches = previous.criteria.filter(
      (item) =>
        normalized(item.wording) === normalized(removal[1]!) ||
        item.id === removal[1],
    );
    if (matches.length === 1)
      return editIntent(
        previous,
        { kind: "remove-criterion", id: matches[0]!.id },
        text,
      );
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "constraint",
        message:
          "Choose the requirement to remove in preferences. I have kept every existing hard requirement.",
      },
    };
  }
  const intent = structuredClone(previous);
  const budget = parseBudget(text, previous.budget, previous.region);
  if (budget.kind === "retained")
    return {
      preferences: previous,
      notes: [],
      reply:
        "Your budget has not changed. Your preferences and earlier research are still here.",
    };
  if (budget.kind === "updated") {
    intent.budget = budget.budget;
    intent.budgetClarified = true;
    if (
      intent.pendingChange?.reason === "currency" ||
      intent.pendingChange?.reason === "budget"
    )
      intent.pendingChange = null;
  }
  if (
    /\b(?:in|market|region|shopping in|deliver to)\s+(?:Singapore|SG)\b/i.test(
      text,
    )
  )
    intent.region = "SG";
  if (
    /\b(?:in|market|region|shopping in|deliver to)\s+(?:the )?(?:United States|USA|US)\b/i.test(
      text,
    )
  )
    intent.region = "US";
  const explicitMarket =
    /\b(?:market|region)\s*(?:is|to|:)\s*([a-z]{2})\b/i.exec(text);
  if (
    explicitMarket &&
    !["SG", "US"].includes(explicitMarket[1]!.toUpperCase())
  )
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "constraint",
        message:
          "This research currently supports Singapore and US markets. Choose one in preferences; your requirements are unchanged.",
      },
    };
  const isRefresh =
    /^(?:compare(?: options)?|research(?: now)?|search(?: again)?|find options|refresh(?: research)?)[.!]*$/i.test(
      text,
    );
  const clauses = text
    .split(
      /(?:[.;\n]+|(?=\b(?:must(?: have| be)?|require|exclude|avoid|prefer|prioriti[sz]e|compare)\b))/i,
    )
    .map((part) => part.trim())
    .filter(Boolean);
  for (const clause of isRefresh ? [] : clauses) {
    const cue =
      /^(must(?: have| be)?|required?|need(?:s)? to|exclude|avoid|only|prefer|prioriti[sz]e|compare)\s+(.+)$/i.exec(
        clause,
      );
    if (!cue) continue;
    const strength = /^(prefer|prioriti[sz]e|compare)$/i.test(cue[1]!)
      ? "flexible"
      : "hard";
    const wording = /^(exclude|avoid|only)$/i.test(cue[1]!)
      ? clause
      : cue[2]!.trim();
    if (
      !intent.criteria.some(
        (item) => normalized(item.wording) === normalized(wording),
      )
    )
      intent.criteria.push({
        id: nextId(intent),
        wording,
        strength,
        origin: { kind: "message", text },
      });
  }
  if (!isRefresh && !previous.productDescription)
    intent.productDescription = text;
  intent.revision =
    Math.max(
      previous.revision,
      ...intent.criteria.map((item) => Number(item.id.slice(10))),
    ) + 1;
  const parsed = ShoppingIntentSchema.safeParse(intent);
  if (!parsed.success)
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "constraint",
        message:
          "That would exceed the saved request limit. Shorten the description or remove a requirement in preferences before continuing. Nothing was dropped.",
      },
    };
  if (budget.kind === "clarification")
    return {
      preferences: parsed.data,
      notes: [],
      clarification: { reason: budget.reason, message: budget.message },
    };
  if (!intent.productDescription)
    return {
      preferences: previous,
      notes: [],
      clarification: {
        reason: "description",
        message:
          "What are you shopping for? Describe the product and what matters to you.",
      },
    };
  return {
    preferences: parsed.data,
    notes: budget.kind === "updated" && budget.note ? [budget.note] : [],
  };
}

export function editIntent(
  previous: ShoppingIntent,
  edit: IntentEdit,
  message: string,
): IntentUpdate {
  return retainPendingUpdate(applyIntentEdit(previous, edit, message), message);
}
function retainPendingUpdate(
  result: IntentUpdate,
  message: string,
): IntentUpdate {
  const issue = result.clarification;
  if (
    issue &&
    (issue.reason === "currency" ||
      issue.reason === "budget" ||
      issue.reason === "constraint")
  )
    result.preferences = {
      ...result.preferences,
      pendingChange: issue.reason === "constraint" ? {
        kind: "constraint",
        id: `question-${result.preferences.revision + 1}`,
        originalRequest: result.preferences.productDescription || message,
        message,
        reason: "constraint",
        explanation: issue.message,
      } : {
        kind: "money",
        id: `question-${result.preferences.revision + 1}`,
        originalRequest: result.preferences.productDescription || message,
        message,
        reason: issue.reason,
        explanation: issue.message,
        missingSlot: issue.reason === "currency" ? "currency" : "range",
        draft: unresolvedMoneyDraft(message, result.preferences),
      },
      revision: result.preferences.revision + 1,
    };
  const pending = result.preferences.pendingChange;
  if (pending && !result.reply)
    return {
      ...result,
      clarification: { reason: pending.reason, message: pending.explanation },
    };
  return result;
}
export function updateIntent(
  message: string,
  previous: ShoppingIntent,
): IntentUpdate {
  return resolvePendingAnswer(message, previous) ?? retainPendingUpdate(interpretMessage(message, previous), message);
}

export function migrateLegacyPreferences(previous: LegacyPreferences):
  | { status: "ready"; intent: ShoppingIntent }
  | {
      status: "needs-review";
      preferences: LegacyPreferences;
      message: string;
    } {
  const intent = defaultIntent();
  intent.productDescription = [previous.hard.category, previous.soft.useCase]
    .filter(Boolean)
    .join(" for ");
  intent.budget = previous.hard.budget;
  intent.budgetClarified = previous.hard.budget !== null;
  intent.region = previous.hard.region;
  intent.responseLength = previous.soft.responseLength;
  const values: { wording: string; strength: Criterion["strength"] }[] = [
    ...previous.hard.requiredFeatures.map((wording) => ({
      wording,
      strength: "hard" as const,
    })),
    ...previous.hard.excludedBrands.map((brand) => ({
      wording: `Exclude ${brand}`,
      strength: "hard" as const,
    })),
    ...previous.soft.priorities.map((wording) => ({
      wording,
      strength: "flexible" as const,
    })),
    ...(previous.hard.pendingConstraint
      ? [
          {
            wording: previous.hard.pendingConstraint,
            strength: "hard" as const,
          },
        ]
      : []),
  ];
  intent.criteria = values.map((value, index) => ({
    ...value,
    id: `criterion-${index + 1}`,
    origin: { kind: "migration", text: value.wording },
  }));
  const parsed = ShoppingIntentSchema.safeParse(intent);
  return parsed.success
    ? { status: "ready", intent: parsed.data }
    : {
        status: "needs-review",
        preferences: structuredClone(previous),
        message:
          "The saved preferences exceed the current request limits. Review them before starting new research. No historical requirement was removed.",
      };
}

export function migrateVersion3Intent(
  previous: Version3ShoppingIntent,
): ShoppingIntent {
  return migrateVersion4Intent({ ...Version3ShoppingIntentSchema.parse(previous), version: 4 });
}

export function migrateVersion4Intent(
  previous: Version4ShoppingIntent,
  originalRequest?: string,
): ShoppingIntent {
  const parsed = Version4ShoppingIntentSchema.parse(previous);
  const pending = parsed.pendingChange;
  let pendingChange: ShoppingIntent["pendingChange"] = pending ? {
    ...pending,
    kind: "legacy",
    id: `question-${parsed.revision}`,
    originalRequest: originalRequest ?? pending.message,
  } : null;
  const original = originalRequest ?? pending?.message;
  if (pending?.reason === "currency" && original && /\$/.test(original)) {
    const known = parseBudget(original.replace(/(?<![A-Z])\$/g, "SGD"), null, parsed.region);
    if (known.kind === "updated" && known.budget) {
      pendingChange = {
        ...pending,
        reason: "currency",
        kind: "money",
        id: `question-${parsed.revision}`,
        originalRequest: original,
        missingSlot: "currency",
        draft: { amount: known.budget.amount, minimum: known.budget.minimum ?? null, currency: null },
      };
    }
  }
  return ShoppingIntentSchema.parse({ ...parsed, version: 5, pendingChange });
}

export function unresolvedMoneyDraft(message: string, previous: ShoppingIntent): MoneyDraft {
  const candidate = parseBudget(message.replace(/(?:SGD\$|S\$|(?<![A-Z])\$)/gi, "SGD"), null, previous.region);
  return candidate.kind === "updated" && candidate.budget
    ? { amount: candidate.budget.amount, minimum: candidate.budget.minimum ?? null, currency: /\b(?:SGD|USD)\b|S\$|US\$/i.test(message) ? candidate.budget.currency : null }
    : { amount: null, minimum: null, currency: null };
}

export function resolvePendingAnswer(message: string, previous: ShoppingIntent): IntentUpdate | null {
  const question = previous.pendingChange;
  if (!question || question.kind !== "money" || question.missingSlot !== "currency" || question.draft.amount === null) return null;
  if (/^make it\s/i.test(message.trim()) && !/\b(?:SGD|USD)\b|S\$|US\$/i.test(message)) {
    const amended = parseBudget(message, { amount: question.draft.amount, currency: "SGD", ...(question.draft.minimum === null ? {} : { minimum: question.draft.minimum }) }, previous.region);
    if (amended.kind === "updated" && amended.budget) {
      const pendingChange = { ...question, message, id: `question-${previous.revision + 1}`, draft: { ...question.draft, amount: amended.budget.amount } };
      return { preferences: { ...previous, pendingChange, revision: previous.revision + 1 }, notes: [], clarification: { reason: pendingChange.reason, message: pendingChange.explanation } };
    }
    return { preferences: previous, notes: [], clarification: { reason: question.reason, message: amended.kind === "clarification" ? amended.message : question.explanation } };
  }
  const match = /^(?:it(?:'s| is) |in )?(SGD|USD|S\$|US\$)(?:\s*\$?\s*\d+(?:\.\d{1,2})?)?[.!?]*$/i.exec(message.trim());
  if (!match) return null;
  const currency = /^(?:USD|US\$)$/i.test(match[1]!) ? "USD" : "SGD";
  const preferences = ShoppingIntentSchema.parse({
    ...previous,
    budget: { amount: question.draft.amount, currency, ...(question.draft.minimum === null ? {} : { minimum: question.draft.minimum }) },
    budgetClarified: true,
    pendingChange: null,
    revision: previous.revision + 1,
  });
  return { preferences, notes: [] };
}

export function resolveLocalIntent(message: string, previous: ShoppingIntent): IntentUpdate | null {
  const pending = resolvePendingAnswer(message, previous);
  if (pending) return pending;
  const text = message.trim();
  if (/^(?:cancel|discard|never mind|nevermind)(?: (?:that|the pending change))?[.!?]*$/i.test(text))
    return editIntent(previous, { kind: "discard-pending" }, text);
  const interpreted = updateIntent(text, previous);
  if (interpreted.reply && JSON.stringify(interpreted.preferences) === JSON.stringify(previous)) return interpreted;
  if (detailOnly.test(text)) return interpreted;
  if (/^(?:please )?(?:remove|drop|forget|clear)\s/i.test(text)) return interpreted;
  if (/^(?:compare(?: options)?|research(?: now)?|search(?: again)?|find options|refresh(?: research)?)[.!?]*$/i.test(text)) return interpreted;
  if (/^(?:make it|(?:set|change|raise|lower|increase|reduce|update) (?:my |the )?budget(?: to)?|budget(?: is| of)?|under|up to|at most)\s+/i.test(text) && previous.productDescription) return interpreted;
  if (/^(?:SGD|USD|S\$|US\$)(?:\s*\$?\s*[0-9,.]+)?[.!?]*$/i.test(text) && previous.productDescription) return interpreted;
  return null;
}
