import { z } from "zod";
import { CurrencySchema, MoneySchema } from "../domain/conversation";

const NativeQuote = z.strictObject({ url: z.string().max(2048), quote: z.string().min(1).max(4000) });
export const NativeAssessment = z.strictObject({
  status: z.enum(["supported", "unknown", "contradicted", "conflict"]), scope: z.enum(["exact-variant", "product-family", "unclear"]), rationale: z.string().min(1).max(800), support: z.array(NativeQuote).max(3),
});
export const NativePrice = z.strictObject({
  amount: MoneySchema.nullable(), currency: CurrencySchema.nullable(), variant: z.string().max(160).nullable(), moneySupport: NativeQuote,
  attribution: NativeAssessment,
  priceBasis: z.strictObject({ kind: z.enum(["single-item", "range", "bundle", "installment", "unknown"]), assessment: NativeAssessment }),
  sourceReviews: z.array(z.strictObject({
    url: z.string().max(2048), reviewComplete: z.boolean(), relation: z.enum(["applies", "other-product-or-topic", "unknown"]), assessment: NativeAssessment,
    moneyMentions: z.array(z.strictObject({ quote: z.string().min(1).max(4000), role: z.enum(["selected", "other-product", "reference", "extra-cost", "unresolved"]), scope: z.enum(["selected-variant", "other-subjects", "reference-only", "unresolved"]), assessment: NativeAssessment })).max(24),
    conditions: z.array(z.strictObject({ quote: z.string().min(1).max(4000), text: z.string().min(1).max(300), interpretation: z.enum(["included-in-amount", "shopper-eligibility", "extra-cost", "unknown"]), rationale: z.string().min(1).max(800) })).max(8),
  })).max(10),
}).superRefine((report, ctx) => {
  if (report.sourceReviews.reduce((sum, review) => sum + review.moneyMentions.length, 0) > 24 || report.sourceReviews.reduce((sum, review) => sum + review.conditions.length, 0) > 8) ctx.addIssue({ code: "custom", message: "Aggregate price report bounds exceeded" });
});
const NativeProduct = z.strictObject({
  id: z.string().min(1).max(80), name: z.string().min(1).max(160), variant: z.string().min(1).max(160).nullable(), identity: NativeAssessment, requestMatch: NativeAssessment,
  criteria: z.array(z.strictObject({ criterionId: z.string().max(80), assessment: NativeAssessment })).max(24),
  attributes: z.array(z.strictObject({ name: z.string().max(80), assessment: NativeAssessment })).max(6), price: NativePrice.nullable(),
});
export const NativeAnswerSchema = z.strictObject({ answerVersion: z.literal(2), products: z.array(NativeProduct).max(3), choice: z.strictObject({ productId: z.string().max(80) }).nullable(), limitations: z.array(z.string().max(800)).max(8) });
