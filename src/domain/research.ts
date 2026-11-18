import { z } from "zod";
import { BudgetSchema, ShoppingIntentSchema, type ShoppingIntent, type TurnRequest } from "./contracts";
import { isSafeWebResearchUrl } from "./web-research";

const Id = z.string().regex(/^[a-z0-9-]+$/).max(80);
export const EvidenceSpanSchema = z.strictObject({ sourceId: Id, start: z.number().int().nonnegative(), end: z.number().int().positive(), quote: z.string().min(1).max(2000) });
export const AssessmentSchema = z.strictObject({
  status: z.enum(["supported", "unknown", "contradicted", "conflict"]),
  rationale: z.string().min(1).max(600),
  scope: z.enum(["exact-variant", "product-family", "unclear"]),
  support: z.array(EvidenceSpanSchema).max(2),
}).superRefine((value, context) => {
  if (value.status !== "unknown" && !value.support.length) context.addIssue({ code: "custom", message: "An assessment requires source evidence" });
  if (value.status === "conflict" && value.support.length < 2) context.addIssue({ code: "custom", message: "Conflicting assessments require both observations" });
});
export const ResearchSourceSchema = z.strictObject({
  id: Id, url: z.string().url().max(2048).refine(isSafeWebResearchUrl),
  title: z.string().max(500), titleTruncated: z.boolean(),
  text: z.string().max(24000), textTruncated: z.boolean(),
});
export const ObservedPriceSchema = z.strictObject({
  amount: BudgetSchema.shape.amount, currency: z.enum(["SGD", "USD"]),
  conditions: z.array(z.string().min(1).max(300)).max(6),
  conditionsResolved: z.boolean(), variant: z.string().min(1).max(160),
  assessment: AssessmentSchema,
});
export const ResearchProductSchema = z.strictObject({
  id: Id, name: z.string().min(1).max(160), variant: z.string().min(1).max(160).nullable(),
  identity: AssessmentSchema, requestMatch: AssessmentSchema,
  criteria: z.array(z.strictObject({ criterionId: z.string().max(40), assessment: AssessmentSchema })).max(12),
  attributes: z.array(z.strictObject({ name: z.string().min(1).max(80), assessment: AssessmentSchema })).max(4),
  price: ObservedPriceSchema.nullable(), budget: AssessmentSchema.nullable(),
  stock: z.literal("unverified"),
});
export const ConditionalChoiceSchema = z.strictObject({
  productId: Id,
  reasons: z.array(z.strictObject({ assessmentId: z.string().min(1).max(100), explanation: z.string().min(1).max(400) })).min(1).max(4),
  caveat: z.string().min(1).max(600),
});
export const ResearchSnapshotSchema = z.strictObject({
  dataKind: z.literal("web-research"), evidenceVersion: z.literal(3),
  retrievedAt: z.string().datetime(), intent: ShoppingIntentSchema,
  summary: z.string().min(1).max(1200),
  products: z.array(ResearchProductSchema).max(3), choice: ConditionalChoiceSchema.nullable(),
  sources: z.array(ResearchSourceSchema).max(10), limitations: z.array(z.string().min(1).max(600)).max(12),
  requestId: z.string().max(180), reportedCostUsd: z.number().finite().nonnegative().nullable(),
}).superRefine((snapshot, context) => {
  const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
  if (sources.size !== snapshot.sources.length || new Set(snapshot.sources.map((source) => source.url)).size !== snapshot.sources.length) context.addIssue({ code: "custom", message: "Sources must be distinct" });
  if (new Set(snapshot.products.map((product) => product.id)).size !== snapshot.products.length) context.addIssue({ code: "custom", message: "Products must be distinct" });
  for (const product of snapshot.products) {
    const assessments = [product.identity, product.requestMatch, ...product.criteria.map((item) => item.assessment), ...product.attributes.map((item) => item.assessment), ...(product.price ? [product.price.assessment] : []), ...(product.budget ? [product.budget] : [])];
    for (const assessment of assessments) for (const span of assessment.support) {
      if (sources.get(span.sourceId)?.text.slice(span.start, span.end) !== span.quote) context.addIssue({ code: "custom", message: "Evidence must be an exact retained source passage" });
    }
    if (product.criteria.length !== snapshot.intent.criteria.length || new Set(product.criteria.map((row) => row.criterionId)).size !== product.criteria.length || snapshot.intent.criteria.some((criterion) => !product.criteria.some((row) => row.criterionId === criterion.id))) context.addIssue({ code: "custom", message: "Every criterion requires an assessment" });
    if (Boolean(product.budget) !== Boolean(snapshot.intent.budget)) context.addIssue({ code: "custom", message: "Budget assessment must follow the intent" });
  }
  if (snapshot.choice) {
    const product = snapshot.products.find((item) => item.id === snapshot.choice!.productId);
    if (!product || !eligibleForChoice(product, snapshot.intent)) context.addIssue({ code: "custom", message: "Choice must satisfy all hard requirements" });
    for (const reason of snapshot.choice.reasons) if (!product || !choiceAssessment(product, reason.assessmentId) || choiceAssessment(product, reason.assessmentId)?.status !== "supported") context.addIssue({ code: "custom", message: "Choice reasons must reference supported assessments" });
  }
});
export const ResearchUnavailableReasonSchema = z.enum(["not-configured", "disabled", "quota", "busy", "duplicate", "timeout", "provider-error", "invalid-response", "empty"]);
const ResponseBase = { responseVersion: z.literal(3), preferences: ShoppingIntentSchema, notes: z.array(z.string().max(600)).max(12) };
export const ApplicationTurnResponseSchema = z.discriminatedUnion("kind", [
  z.strictObject({ ...ResponseBase, kind: z.literal("question"), question: z.literal("budget"), message: z.string().min(1).max(600) }),
  z.strictObject({ ...ResponseBase, kind: z.literal("research"), answer: z.string().min(1).max(1200), research: ResearchSnapshotSchema }),
  z.strictObject({ ...ResponseBase, kind: z.literal("research-unavailable"), message: z.string().min(1).max(600), reason: ResearchUnavailableReasonSchema }),
  z.strictObject({ ...ResponseBase, kind: z.literal("message"), message: z.string().min(1).max(600) }),
  z.strictObject({ ...ResponseBase, kind: z.literal("clarification"), message: z.string().min(1).max(600), reason: z.enum(["constraint", "feedback", "currency", "budget", "description"]) }),
]);
export type Assessment = z.infer<typeof AssessmentSchema>;
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;
export type ResearchProduct = z.infer<typeof ResearchProductSchema>;
export type ApplicationTurnResponse = z.infer<typeof ApplicationTurnResponseSchema>;
export type ResearchUnavailableReason = z.infer<typeof ResearchUnavailableReasonSchema>;
export type ResearchOperation = (request: { message: string; preferences: ShoppingIntent }, signal: AbortSignal) => Promise<{ status: "ready"; research: ResearchSnapshot } | { status: "unavailable"; reason: ResearchUnavailableReason; reportedCostUsd?: number }>;
export type ResearchTurns = { turn(request: TurnRequest, signal: AbortSignal): Promise<ApplicationTurnResponse> };
export function choiceAssessment(product: ResearchProduct, id: string): Assessment | undefined {
  if (id === "identity") return product.identity;
  if (id === "request-match") return product.requestMatch;
  if (id === "budget") return product.budget ?? undefined;
  if (id === "price") return product.price?.assessment;
  return product.criteria.find((row) => row.criterionId === id)?.assessment ?? product.attributes.find((row) => `attribute:${row.name}` === id)?.assessment;
}
export function eligibleForChoice(product: ResearchProduct, intent: ShoppingIntent): boolean {
  const supported = (assessment: Assessment | undefined | null) => assessment?.status === "supported" && assessment.scope === "exact-variant";
  return Boolean(product.variant && supported(product.identity) && supported(product.requestMatch) && intent.criteria.filter((item) => item.strength === "hard").every((criterion) => supported(product.criteria.find((row) => row.criterionId === criterion.id)?.assessment)) && (!intent.budget || (supported(product.budget) && product.price && supported(product.price.assessment) && product.price.conditionsResolved && product.price.variant === product.variant && product.price.currency === intent.budget.currency && product.price.amount <= intent.budget.amount)));
}
