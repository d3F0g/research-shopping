import { z } from "zod";
import { defaultIntent, ShoppingIntentSchema, type PrepareTurnRequest, type ShoppingIntent } from "./contracts";
import { parseBudget } from "./budget";
import { editIntent, unresolvedMoneyDraft, type IntentUpdate } from "./preferences";

const Span = z.strictObject({ start: z.number().int().nonnegative(), end: z.number().int().positive(), text: z.string().min(1).max(2000) });
export const IntentActionsSchema = z.strictObject({
  disposition: z.enum(["research", "acknowledge", "feedback", "clarify-description"]),
  actions: z.array(z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("start-request"), source: Span }),
    z.strictObject({ kind: z.literal("refine-description"), source: Span }),
    z.strictObject({ kind: z.literal("budget"), source: Span }),
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

export function applyIntentActions(previous: ShoppingIntent, message: string, raw: unknown): IntentUpdate | null {
  const parsed = IntentActionsSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { actions, disposition } = parsed.data;
  if (actions.some(({ source }) => source.end <= source.start || message.slice(source.start, source.end) !== source.text)) return null;
  const starts = actions.filter((action) => action.kind === "start-request");
  if (starts.length > 1 || (starts.length && actions[0]?.kind !== "start-request")) return null;
  if (previous.productDescription && starts.length && !/\b(?:new (?:request|search)|start (?:over|again)|instead|switch (?:to|from)|now (?:I |i )?(?:want|need|looking))\b/i.test(message)) return null;
  let intent = starts.length ? { ...defaultIntent(), region: previous.region, responseLength: previous.responseLength, revision: previous.revision } : structuredClone(previous);
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
        if (!target || !removalCue.test(source)) return null;
        const wording = normalize(target.wording).replace(/^(?:must have|must be|must|only|avoid|exclude|prefer) /, "");
        if (!normalize(source).includes(wording) && !source.includes(target.id)) return null;
        intent.criteria = intent.criteria.filter((item) => item.id !== target.id);
        break;
      }
      case "remove-budget":
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
  const budget = parseBudget(message, intent.budget, intent.region);
  const notes: string[] = [];
  if (budget.kind === "updated" && !actions.some((action) => action.kind === "remove-budget")) {
    intent.budget = budget.budget;
    intent.budgetClarified = true;
    if (intent.pendingChange?.reason !== "constraint") intent.pendingChange = null;
    if (budget.note) notes.push(budget.note);
  }
  if (budget.kind === "clarification") {
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
