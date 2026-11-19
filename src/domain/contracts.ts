import { z } from "zod";

export const CurrencySchema = z.enum(["SGD", "USD"]);
export const RegionSchema = z.enum(["SG", "US"]);
export const DetailModeSchema = z.enum(["concise", "expanded"]);
export const MoneyAmountSchema = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7);
export const BudgetSchema = z
  .strictObject({
    amount: MoneyAmountSchema,
    currency: CurrencySchema,
    minimum: MoneyAmountSchema.optional(),
  })
  .refine(
    (budget) => budget.minimum === undefined || budget.minimum <= budget.amount,
    {
      message: "Minimum budget cannot exceed maximum budget",
    },
  );
export type Budget = z.infer<typeof BudgetSchema>;
export function isWithinBudget(amount: number, budget: Budget): boolean {
  return (
    amount <= budget.amount &&
    (budget.minimum === undefined || amount >= budget.minimum)
  );
}
export const CriterionSchema = z.strictObject({
  id: z
    .string()
    .regex(/^criterion-[1-9][0-9]*$/)
    .max(40)
    .refine((id) => Number.isSafeInteger(Number(id.slice(10)))),
  wording: z.string().min(1).max(400),
  strength: z.enum(["hard", "flexible"]),
  origin: z.strictObject({
    kind: z.enum(["message", "edit", "migration"]),
    text: z.string().min(1).max(2000),
  }),
});
export const MoneyDraftSchema = z.strictObject({
  amount: MoneyAmountSchema.nullable(),
  minimum: MoneyAmountSchema.nullable(),
  currency: CurrencySchema.nullable(),
}).refine((draft) => draft.amount === null || draft.minimum === null || draft.minimum <= draft.amount, { message: "Draft minimum cannot exceed maximum" });
const QuestionBase = {
  id: z.string().min(1).max(80),
  message: z.string().min(1).max(2000),
  originalRequest: z.string().min(1).max(4000),
  explanation: z.string().min(1).max(600),
};
export const PendingChangeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...QuestionBase,
    kind: z.literal("money"),
    reason: z.enum(["currency", "budget"]),
    missingSlot: z.enum(["currency", "amount", "range"]),
    draft: MoneyDraftSchema,
  }),
  z.strictObject({
    ...QuestionBase,
    kind: z.literal("constraint"),
    reason: z.literal("constraint"),
  }),
  z.strictObject({
    ...QuestionBase,
    kind: z.literal("legacy"),
    reason: z.enum(["currency", "budget", "constraint"]),
  }),
]);
export type MoneyDraft = z.infer<typeof MoneyDraftSchema>;
export type PendingQuestion = z.infer<typeof PendingChangeSchema>;
export const ShoppingIntentSchema = z.strictObject({
  version: z.literal(5),
  productDescription: z.string().max(4000),
  criteria: z
    .array(CriterionSchema)
    .max(12)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
    ),
  budget: BudgetSchema.nullable(),
  budgetClarified: z.boolean(),
  pendingChange: PendingChangeSchema.nullable(),
  region: RegionSchema,
  responseLength: DetailModeSchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
const SingleIntentEditSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("discard-pending") }),
  z.strictObject({
    kind: z.literal("set-description"),
    value: z.string().min(1).max(4000),
  }),
  z.strictObject({
    kind: z.literal("set-budget"),
    value: BudgetSchema.nullable(),
  }),
  z.strictObject({ kind: z.literal("set-region"), value: RegionSchema }),
  z.strictObject({
    kind: z.literal("set-response-length"),
    value: DetailModeSchema,
  }),
  z.strictObject({
    kind: z.literal("add-criterion"),
    wording: z.string().min(1).max(400),
    strength: z.enum(["hard", "flexible"]),
  }),
  z.strictObject({
    kind: z.literal("replace-criterion"),
    id: CriterionSchema.shape.id,
    wording: z.string().min(1).max(400),
    strength: z.enum(["hard", "flexible"]),
  }),
  z.strictObject({
    kind: z.literal("remove-criterion"),
    id: CriterionSchema.shape.id,
  }),
]);
export const IntentEditSchema = z.union([
  SingleIntentEditSchema,
  z.strictObject({
    kind: z.literal("batch"),
    edits: z.array(SingleIntentEditSchema).min(1).max(20),
  }),
]);
export const PrepareTurnRequestSchema = z.strictObject({
  phase: z.literal("prepare"),
  message: z.string().trim().min(1).max(2000),
  preferences: ShoppingIntentSchema,
  operationId: z.string().uuid(),
  edit: IntentEditSchema.optional(),
  skipBudget: z.boolean().optional(),
  questionId: z.string().min(1).max(80).optional(),
});
export const ResearchTurnRequestSchema = z.strictObject({
  phase: z.literal("research"),
  preferences: ShoppingIntentSchema,
  operationId: z.string().uuid(),
});
export const TurnRequestSchema = z.discriminatedUnion("phase", [
  PrepareTurnRequestSchema,
  ResearchTurnRequestSchema,
]);
export type PrepareTurnRequest = z.infer<typeof PrepareTurnRequestSchema>;
export type ResearchTurnRequest = z.infer<typeof ResearchTurnRequestSchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type ShoppingIntent = z.infer<typeof ShoppingIntentSchema>;
export type IntentEdit = z.infer<typeof IntentEditSchema>;
export type Criterion = z.infer<typeof CriterionSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export function defaultIntent(): ShoppingIntent {
  return {
    version: 5,
    productDescription: "",
    criteria: [],
    budget: null,
    budgetClarified: false,
    pendingChange: null,
    region: "SG",
    responseLength: "concise",
    revision: 0,
  };
}
