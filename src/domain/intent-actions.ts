import { z } from "zod";
import { MoneyDraftSchema, ShoppingIntentSchema, type PrepareTurnRequest, type ShoppingIntent } from "./contracts";
import { parseBudget } from "./budget";
import { editIntent, unresolvedMoneyDraft, type IntentUpdate } from "./preferences";

const Span = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(2000) });
export const IntentActionsSchema = z.strictObject({
  disposition: z.enum(["research", "acknowledge", "feedback", "clarify-description"]),
  actions: z.array(z.union([
    z.strictObject({ kind: z.literal("start-request"), source: Span }),
    z.strictObject({ kind: z.literal("refine-description"), source: Span }),
    z.strictObject({ kind: z.literal("budget"), source: Span, operation: z.enum(["replace-range", "set-maximum", "clarify"]), draft: MoneyDraftSchema }),
    z.strictObject({ kind: z.literal("add-criterion"), source: Span, strength: z.enum(["hard", "flexible"]) }),
    z.strictObject({ kind: z.literal("remove-criterion"), source: Span, id: z.string().max(40) }),
    z.strictObject({ kind: z.literal("remove-budget"), source: Span, bound: z.enum(["all", "minimum"]) }),
    z.strictObject({ kind: z.literal("set-region"), source: Span, value: z.enum(["SG", "US"]) }),
  ])).max(16),
});
export type IntentActions = z.infer<typeof IntentActionsSchema>;
export type IntentInterpreter = (request: PrepareTurnRequest, signal: AbortSignal) => Promise<
  { status: "ready"; interpretation: IntentActions } | { status: "unavailable" }
>;

const hardCue = /\b(?:must|required?|only|need(?:s)? to|without|avoid|exclude|cannot|can't|no)\b/i;
const removalCue = /\b(?:remove|drop|forget|clear|relax|lift)\b/i;
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const hasNegativeContext = (message: string, source: { start: number; end: number; text: string }) => {
  const before = message.slice(0, source.start).split(/[;.!?\n]/).at(-1) ?? "";
  const after = message.slice(source.end).split(/[;.!?\n]/)[0] ?? "";
  return /\b(?:no|not|never|cannot|without|neither|nor|[a-z]+n't|refus\w*)\b/i.test(`${before}${source.text}${after}`.replace(/[’‘]/g, "'"));
};


export function applyIntentActions(previous: ShoppingIntent, message: string, raw: unknown): IntentUpdate | null {
  const parsed = IntentActionsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { actions, disposition } = parsed.data;
  if (actions.some(({ source }) => source.end <= source.start || message.slice(source.start, source.end) !== source.text)) return null;
  const starts = actions.filter((action) => action.kind === "start-request");
  if (starts.length > 1 || (starts.length && actions[0]?.kind !== "start-request")) return null;
  if (previous.productDescription && starts.length && !/\b(?:new (?:request|search)|start (?:over|again)|instead|switch (?:to|from)|now (?:I |i )?(?:want|need|looking))\b/i.test(message)) return null;
  if (starts.length && previous.productDescription && hasNegativeContext(message, starts[0]!.source)) return null;
  const budgetActions = actions.filter((action) => action.kind === "budget");
  if (budgetActions.length > 1 || (budgetActions.length && actions.some((action) => action.kind === "remove-budget"))) return null;
  const budgetAction = budgetActions[0];
  const moneyContext = starts.length ? null : previous.budget;
  const parsedMoney = budgetAction ? parseBudget(message, moneyContext, previous.region) : null;
  if (budgetAction) {
    const parsedSource = parseBudget(budgetAction.source.text, moneyContext, previous.region);
    if (JSON.stringify(parsedSource) !== JSON.stringify(parsedMoney)) return null;
    const proposed = budgetAction.draft;
    const known = parsedMoney?.kind === "updated" && parsedMoney.budget
      ? { amount: parsedMoney.budget.amount, minimum: parsedMoney.budget.minimum ?? null, currency: parsedMoney.budget.currency }
      : unresolvedMoneyDraft(message, previous);
    if (proposed.amount !== known.amount || (budgetAction.operation === "replace-range" && proposed.minimum !== known.minimum)) return null;
    if (budgetAction.operation === "set-maximum" && proposed.minimum !== null) return null;
    if (proposed.currency !== null && proposed.currency !== known.currency) return null;
    if (budgetAction.operation === "clarify" && parsedMoney?.kind !== "clarification") return null;
    if (parsedMoney?.kind === "unchanged" || parsedMoney?.kind === "retained") return null;
    if (parsedMoney?.kind === "updated" && parsedMoney.budget && budgetAction.operation === "replace-range" && proposed.minimum === null) return null;
  }
  if (!budgetAction && !actions.some((action) => action.kind === "remove-budget") && disposition === "research") {
    const unrepresented = parseBudget(message, moneyContext, previous.region);
    if (unrepresented.kind === "updated" || unrepresented.kind === "clarification") return null;
  }
  let intent = structuredClone(previous);
  for (const action of actions) {
    const source = action.source.text;
    switch (action.kind) {
      case "start-request":
        intent.productDescription = source;
        break;
      case "refine-description":
        if (!intent.productDescription || /^\s*(?:SGD|USD|S\$|US\$|[\d$,.\s-]+)\s*$/i.test(source)) return null;
        intent.productDescription += `\n${source}`;
        break;
      case "budget":
        break;
      case "add-criterion": {
        if (action.strength === "hard" && !hardCue.test(source)) return null;
        if (action.strength === "flexible" && hardCue.test(source)) return null;
        if (intent.criteria.some((item) => normalize(item.wording) === normalize(source))) break;
        const wording = source.replace(/^(?:must(?: have| be)?|required?|need(?:s)? to|prefer|prioriti[sz]e|compare)\s+/i, "");
        const update = editIntent(intent, { kind: "add-criterion", wording, strength: action.strength }, message);
        if (update.clarification) return null;
        intent = update.preferences;
        intent.criteria.at(-1)!.origin = { kind: "message", text: source };
        break;
      }
      case "remove-criterion": {
        const target = intent.criteria.find((item) => item.id === action.id);
        if (!target || !removalCue.test(source) || hasNegativeContext(message, action.source)) return null;
        const wording = normalize(target.wording).replace(/^(?:must have|must be|must|only|avoid|exclude|prefer) /, "");
        if (!normalize(source).includes(wording) && !source.includes(target.id)) return null;
        intent.criteria = intent.criteria.filter((item) => item.id !== target.id);
        break;
      }
      case "remove-budget":
        if (hasNegativeContext(message, action.source) || parseBudget(message, previous.budget, previous.region).kind === "retained") return null;
        if (!removalCue.test(source) || !/\b(?:budget|minimum|lower bound|floor|price limit)\b/i.test(source)) return null;
        if (action.bound === "minimum" && !/\b(?:minimum|lower bound|floor)\b/i.test(source)) return null;
        if (action.bound === "all" && /\b(?:minimum|lower bound|floor)\b/i.test(source)) return null;
        intent.budget = action.bound === "minimum" && intent.budget ? { amount: intent.budget.amount, currency: intent.budget.currency } : null;
        intent.budgetClarified = true;
        intent.pendingChange = null;
        break;
      case "set-region":
        if (!(action.value === "SG" ? /\b(?:SG|Singapore)\b/i : /\b(?:US|USA|United States)\b/i).test(source)) return null;
        intent.region = action.value;
        break;
    }
  }
  const budget = parsedMoney;
  const notes: string[] = [];
  if (budget?.kind === "updated" && !actions.some((action) => action.kind === "remove-budget")) {
    intent.budget = budget.budget;
    intent.budgetClarified = true;
    if (intent.pendingChange?.reason !== "constraint") intent.pendingChange = null;
    if (budget.note) notes.push(budget.note);
  }
  if (budget?.kind === "clarification") {
    intent.pendingChange = {
      kind: "money", id: `question-${previous.revision + 1}`, originalRequest: message,
      message, reason: budget.reason, explanation: budget.message,
      missingSlot: budget.reason === "currency" ? "currency" : "range",
      draft: unresolvedMoneyDraft(message, intent),
    };
  }
  intent.revision = Math.max(intent.revision, previous.revision) + 1;
  const validated = ShoppingIntentSchema.safeParse(intent);
  if (!validated.success) return null;
  intent = validated.data;
  if (intent.pendingChange) return { preferences: intent, notes, clarification: { reason: intent.pendingChange.reason, message: intent.pendingChange.explanation } };
  if (disposition === "acknowledge") return { preferences: intent, notes, reply: "Your preferences and earlier research are still here." };
  if (disposition === "feedback") return { preferences: intent, notes, clarification: { reason: "feedback", message: "What should change in the next comparison? Tell me the tradeoff that missed the mark." } };
  if (disposition === "clarify-description" || !intent.productDescription) return { preferences: intent, notes, clarification: { reason: "description", message: "What are you shopping for? Describe the product and what matters to you." } };
  return { preferences: intent, notes };
}
