import { parseBudget } from "./budget";
import {
  defaultIntent,
  ShoppingIntentSchema,
  type Criterion,
  type IntentEdit,
  type ShoppingIntent,
} from "./contracts";
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

export function editIntent(
  previous: ShoppingIntent,
  edit: IntentEdit,
  origin: string,
): IntentUpdate {
  const intent = structuredClone(previous);
  const edits = edit.kind === "batch" ? edit.edits : [edit];
  for (const item of edits) {
    switch (item.kind) {
      case "set-description":
        intent.productDescription = item.value;
        break;
      case "set-budget":
        intent.budget = item.value;
        intent.budgetClarified = true;
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

export function updateIntent(
  message: string,
  previous: ShoppingIntent,
): IntentUpdate {
  const text = message.trim();
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
    /^(?:please )?(?:remove|drop|forget) (?:the )?(?:requirement (?:for )?)?(.+?)[.!]*$/i.exec(
      text,
    );
  if (removal) {
    if (/^(?:budget|budget limit)$/i.test(removal[1]!))
      return editIntent(previous, { kind: "set-budget", value: null }, text);
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
  if (budget.kind === "clarification")
    return {
      preferences: previous,
      notes: [],
      clarification: { reason: budget.reason, message: budget.message },
    };
  if (budget.kind === "updated") {
    intent.budget = budget.budget;
    intent.budgetClarified = true;
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
  const clauses = text
    .split(
      /(?:[.;\n]+|(?=\b(?:must(?: have| be)?|require|exclude|avoid|prefer|prioriti[sz]e|compare)\b))/i,
    )
    .map((part) => part.trim())
    .filter(Boolean);
  for (const clause of clauses) {
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
  const isRefresh =
    /^(?:compare(?: options)?|research(?: now)?|search(?: again)?|find options|refresh(?: research)?)[.!]*$/i.test(
      text,
    );
  if (!isRefresh)
    intent.productDescription = previous.productDescription
      ? `${previous.productDescription}\nFollow-up: ${text}`
      : text;
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

export function migrateLegacyPreferences(
  previous: LegacyPreferences,
):
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
