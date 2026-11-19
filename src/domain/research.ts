import { z } from "zod";
import { CurrencySchema, MoneySchema, ShoppingIntentSchema, type ShoppingIntent } from "./conversation";
import { isSafeSourceUrl } from "./safe-url";

export const SupportSchema = z.strictObject({ sourceId: z.string().max(80), quote: z.string().min(1).max(4000), start: z.number().int().nonnegative(), end: z.number().int().positive() });
export const AssessmentSchema = z.strictObject({ status: z.enum(["supported", "unknown", "contradicted", "conflict"]), scope: z.enum(["exact-variant", "product-family", "unclear"]), rationale: z.string().min(1).max(800), support: z.array(SupportSchema).max(3) });
export const SourceSchema = z.strictObject({ id: z.string().max(80), url: z.string().refine(isSafeSourceUrl), title: z.string().max(500), text: z.string().max(24000), originalLength: z.number().int().nonnegative(), textTruncated: z.boolean(), imageUrl: z.string().refine(isSafeSourceUrl).optional() });
export const ProductSchema = z.strictObject({ id: z.string().max(80), name: z.string().min(1).max(160), variant: z.string().max(160).nullable(), identity: AssessmentSchema, requestMatch: AssessmentSchema, requirements: z.array(z.strictObject({ requirementId: z.string().max(80), assessment: AssessmentSchema })).max(24), attributes: z.array(z.strictObject({ name: z.string().max(80), assessment: AssessmentSchema })).max(6), price: z.strictObject({ amount: MoneySchema, currency: CurrencySchema, variant: z.string().max(160), conditions: z.array(z.string().max(300)).max(8), conditionsResolved: z.boolean(), assessment: AssessmentSchema }).nullable(), stock: z.literal("unverified"), eligible: z.boolean(), blockers: z.array(z.string().max(800)).max(32) });
export const ResearchSnapshotSchema = z.strictObject({ version: z.literal(2), dataKind: z.enum(["web-research", "test-fixture"]), retrievedAt: z.string(), intent: ShoppingIntentSchema, summary: z.string().max(1500), products: z.array(ProductSchema).max(3), choice: z.strictObject({ productId: z.string().max(80), rationale: z.string().max(800) }).nullable(), sources: z.array(SourceSchema).max(10), limitations: z.array(z.string().max(800)).max(12), requestId: z.string().max(180), reportedCostUsd: z.number().finite().nonnegative().nullable() });
export type Assessment = z.infer<typeof AssessmentSchema>;
export type ResearchSource = z.infer<typeof SourceSchema>;
export type ResearchProduct = z.infer<typeof ProductSchema>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;
export type ResearchUnavailableReason = "not-configured" | "disabled" | "quota" | "busy" | "duplicate" | "timeout" | "provider-error" | "invalid-response" | "empty" | "stale";
export type ResearchOperation = (request: { intent: ShoppingIntent }, signal: AbortSignal) => Promise<{ status: "ready"; research: ResearchSnapshot } | { status: "unavailable"; reason: ResearchUnavailableReason; reportedCostUsd?: number }>;

export function supportedExactly(value: Assessment): boolean { return value.status === "supported" && value.scope === "exact-variant" && value.support.length > 0; }

export function assessProduct(product: ResearchProduct, intent: ShoppingIntent): ResearchProduct {
  const blockers: string[] = [];
  if (!product.variant || !supportedExactly(product.identity)) blockers.push("Exact product identity and variant remain unproven.");
  if (!supportedExactly(product.requestMatch)) blockers.push("Fit to the complete shopping objective remains unresolved.");
  for (const requirement of intent.requirements.filter((r) => r.strength === "hard")) {
    const assessment = product.requirements.find((row) => row.requirementId === requirement.id)?.assessment;
    if (!assessment || !supportedExactly(assessment)) blockers.push(`${requirement.text} (${assessment?.status ?? "unknown"})`);
  }
  if (intent.budget) {
    const p = product.price;
    if (!p || !supportedExactly(p.assessment) || p.variant !== product.variant || !p.conditionsResolved) blockers.push("An applicable exact-variant price is unverified.");
    else if (p.currency !== intent.budget.currency || (intent.budget.minimum !== undefined && p.amount < intent.budget.minimum) || (intent.budget.maximum !== undefined && p.amount > intent.budget.maximum)) blockers.push("Observed price does not meet both budget bounds and explicit currency.");
  }
  return { ...product, eligible: blockers.length === 0, blockers };
}
