import { createHash } from "node:crypto";
import { z } from "zod";
import type { PublicScenario } from "./contracts";
import { hash } from "../hash";

export const MoneyAmountSchema = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7);
export const MoneyDraftSchema = z.strictObject({
  amount: MoneyAmountSchema.nullable(),
  minimum: MoneyAmountSchema.nullable(),
  currency: z.enum(["SGD", "USD"]).nullable(),
}).refine((draft) => draft.amount === null || draft.minimum === null || draft.minimum <= draft.amount, { message: "Draft minimum cannot exceed maximum" });

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

export type PrepareTurnRequest = { message: string; preferences: { criteria: { id: string; wording: string; origin: { text: string } }[] } };

export const INTENT_TAPE_SHA256 = "ba136b479052387d0ab913a7bb4d802eebe4f7e17be79846d908e5fd87c4044a";
const Turn = z.strictObject({
  turnIndex: z.number().int().nonnegative(), message: z.string(), proposal: IntentActionsSchema,
  symbolicTargets: z.array(z.strictObject({ actionIndex: z.number().int().nonnegative(), targetWording: z.string().min(1) })).optional(),
  limitations: z.array(z.string()).optional(),
});
const Tape = z.strictObject({
  format: z.literal("fieldnote-independent-synthetic-intent-proposals-v1"),
  provenance: z.record(z.string(), z.unknown()),
  conversations: z.array(z.strictObject({ id: z.string(), turns: z.array(Turn) })),
});
export type IntentTurn = z.infer<typeof Turn>;
export type Binding = { actionIndex: number; targetWording: string; criterionId: string };
export type IntentInput = {
  hash: string;
  label: string;
  turns: IntentTurn[];
  propose(turn: number, request: PrepareTurnRequest): { interpretation: IntentActions; bindings: Binding[]; limitations: string[] };
};
export class InputCoverageError extends Error {}
function validateTurns(turns: IntentTurn[]) {
  if (new Set(turns.map((turn) => turn.turnIndex)).size !== turns.length) throw new Error("Duplicate interpretation turn");
  for (const turn of turns) {
    for (const [index, action] of turn.proposal.actions.entries()) {
      const span = action.source;
      if (span.end <= span.start || span.end > turn.message.length || turn.message.slice(span.start, span.end) !== span.text) throw new Error(`Malformed fixed interpretation span at turn ${turn.turnIndex}, action ${index}`);
      const targets = turn.symbolicTargets?.filter((target) => target.actionIndex === index) ?? [];
      if (action.kind === "remove-criterion" && action.id.startsWith("@symbolic-")) {
        if (targets.length !== 1) throw new Error("Symbolic removal must declare exactly one target");
      } else if (targets.length) throw new Error("Symbolic target requires a symbolic removal action");
    }
    if (turn.symbolicTargets?.some((target) => !turn.proposal.actions[target.actionIndex])) throw new Error("Symbolic target references absent action");
  }
}
export function fixedIntentInput(raw: IntentTurn[], label: string, inputHash = hash(raw)): IntentInput {
  const turns = z.array(Turn).parse(raw);
  validateTurns(turns);
  const consumed = new Set<number>();
  return {
    hash: inputHash, label, turns: structuredClone(turns),
    propose(index, request) {
      const row = turns.find((turn) => turn.turnIndex === index);
      if (!row || row.message !== request.message || hash(row.message) !== hash(request.message)) throw new InputCoverageError(`Fixed interpretation does not cover exact turn ${index} and message`);
      if (consumed.has(index)) throw new InputCoverageError(`Fixed interpretation turn ${index} was already consumed`);
      consumed.add(index);
      const interpretation = structuredClone(row.proposal);
      const bindings: Binding[] = [];
      for (const target of row.symbolicTargets ?? []) {
        const matches = request.preferences.criteria.filter((criterion) => criterion.wording === target.targetWording || criterion.origin.text === target.targetWording);
        if (matches.length !== 1) throw new InputCoverageError(`Symbolic removal at turn ${index} has ${matches.length} prior literal matches for ${JSON.stringify(target.targetWording)}`);
        const action = interpretation.actions[target.actionIndex]!;
        if (action.kind !== "remove-criterion") throw new Error("Invalid validated symbolic removal");
        action.id = matches[0]!.id;
        bindings.push({ ...target, criterionId: action.id });
      }
      return { interpretation, bindings, limitations: [...row.limitations ?? []] };
    },
  };
}
export function validateTape(raw: string, scenarios: PublicScenario[], expectedHash = INTENT_TAPE_SHA256) {
  if (createHash("sha256").update(raw).digest("hex") !== expectedHash) throw new Error("Fixed intent tape byte hash mismatch");
  const tape = Tape.parse(JSON.parse(raw));
  if (tape.conversations.length !== scenarios.length || new Set(tape.conversations.map((item) => item.id)).size !== scenarios.length) throw new Error("Intent tape scenario coverage mismatch");
  for (const scenario of scenarios) {
    const rows = tape.conversations.find((item) => item.id === scenario.id)?.turns;
    if (!rows || rows.length !== scenario.actions.length) throw new Error(`Intent tape action coverage mismatch for ${scenario.id}`);
    validateTurns(rows);
    for (const [index, action] of scenario.actions.entries()) {
      if (action.kind !== "message" || rows[index]?.turnIndex !== index || rows[index]?.message !== action.text || hash(rows[index]?.message) !== hash(action.text)) throw new Error(`Intent tape public action mismatch for ${scenario.id} turn ${index}`);
    }
  }
  return tape;
}
