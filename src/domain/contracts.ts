import { z } from "zod";

export const CurrencySchema = z.enum(["SGD", "USD"]);
export const RegionSchema = z.enum(["SG", "US"]);
export const DetailModeSchema = z.enum(["concise", "expanded"]);
export const BudgetSchema = z.strictObject({
  amount: z.number().finite().positive().max(1_000_000).refine((amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-7),
  currency: CurrencySchema,
});
export const CriterionSchema = z.strictObject({
  id: z.string().regex(/^criterion-[1-9][0-9]*$/).max(40),
  wording: z.string().min(1).max(400),
  strength: z.enum(["hard", "flexible"]),
  origin: z.strictObject({ kind: z.enum(["message", "edit", "migration"]), text: z.string().min(1).max(2000) }),
});
export const ShoppingIntentSchema = z.strictObject({
  version: z.literal(3),
  productDescription: z.string().max(4000),
  criteria: z.array(CriterionSchema).max(12).refine((items) => new Set(items.map((item) => item.id)).size === items.length),
  budget: BudgetSchema.nullable(),
  budgetClarified: z.boolean(),
  region: RegionSchema,
  responseLength: DetailModeSchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
const SingleIntentEditSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("set-description"), value: z.string().min(1).max(4000) }),
  z.strictObject({ kind: z.literal("set-budget"), value: BudgetSchema.nullable() }),
  z.strictObject({ kind: z.literal("set-region"), value: RegionSchema }),
  z.strictObject({ kind: z.literal("set-response-length"), value: DetailModeSchema }),
  z.strictObject({ kind: z.literal("add-criterion"), wording: z.string().min(1).max(400), strength: z.enum(["hard", "flexible"]) }),
  z.strictObject({ kind: z.literal("replace-criterion"), id: CriterionSchema.shape.id, wording: z.string().min(1).max(400), strength: z.enum(["hard", "flexible"]) }),
  z.strictObject({ kind: z.literal("remove-criterion"), id: CriterionSchema.shape.id }),
]);
export const IntentEditSchema = z.union([SingleIntentEditSchema, z.strictObject({ kind: z.literal("batch"), edits: z.array(SingleIntentEditSchema).min(1).max(20) })]);
export const TurnRequestSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  preferences: ShoppingIntentSchema,
  operationId: z.string().uuid(),
  edit: IntentEditSchema.optional(),
  skipBudget: z.boolean().optional(),
});
export type Currency = z.infer<typeof CurrencySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type ShoppingIntent = z.infer<typeof ShoppingIntentSchema>;
export type IntentEdit = z.infer<typeof IntentEditSchema>;
export type Criterion = z.infer<typeof CriterionSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export function defaultIntent(): ShoppingIntent {
  return { version: 3, productDescription: "", criteria: [], budget: null, budgetClarified: false, region: "SG", responseLength: "concise", revision: 0 };
}
