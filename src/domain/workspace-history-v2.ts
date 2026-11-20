import { z } from "zod";
import { isSafeSourceUrl } from "./safe-url";
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Id = z.string().uuid();
const Stamp = z.string().datetime();
const MoneyV2 = z.number().finite().positive().max(1_000_000).refine((n) => Math.round(n * 100) / 100 === n);
const CurrencyV2 = z.string().regex(/^[A-Z]{3}$/);
const IntentV2 = z.strictObject({
  intentVersion: z.literal(2),
  originalText: z.string().max(2000),
  productDescription: z.string().max(6000),
  requirements: z.array(z.strictObject({ id: z.string().max(80), text: z.string().min(1).max(2000), strength: z.enum(["hard", "flexible"]), originMessageId: z.string().max(80), kind: z.enum(["request", "brand", "exclusion", "preference"]) })).max(24),
  budget: z.strictObject({ minimum: MoneyV2.optional(), maximum: MoneyV2.optional(), currency: CurrencyV2 }).refine((b) => (b.minimum !== undefined || b.maximum !== undefined) && (b.minimum === undefined || b.maximum === undefined || b.minimum <= b.maximum)).nullable(),
  region: z.string().regex(/^[A-Z]{2}$/).nullable(),
  responseLength: z.enum(["concise", "expanded"]),
});
const SupportV2 = z.strictObject({ originalQuote: z.string().min(1).max(4000), originalStart: z.number().int().nonnegative(), originalEnd: z.number().int().positive(), sourceId: z.string().max(80), quote: z.string().min(1).max(4000), start: z.number().int().nonnegative(), end: z.number().int().positive() });
const AssessmentV2 = z.strictObject({ status: z.enum(["supported", "unknown", "contradicted", "conflict"]), scope: z.enum(["exact-variant", "product-family", "unclear"]), rationale: z.string().min(1).max(800), support: z.array(SupportV2).max(3) });
const SafeUrlV2 = z.string().refine(isSafeSourceUrl);
export const StoredResearchV2Schema = z.strictObject({
  version: z.literal(2), evidenceVersion: z.literal(2), dataKind: z.enum(["web-research", "test-fixture"]), retrievedAt: Stamp, intent: IntentV2, summary: z.string().max(1500),
  products: z.array(z.strictObject({
    id: z.string().max(80), name: z.string().min(1).max(160), variant: z.string().max(160).nullable(), identity: AssessmentV2, requestMatch: AssessmentV2,
    requirements: z.array(z.strictObject({ requirementId: z.string().max(80), assessment: AssessmentV2 })).max(24),
    attributes: z.array(z.strictObject({ name: z.string().max(80), assessment: AssessmentV2 })).max(6),
    price: z.strictObject({ amount: MoneyV2, currency: CurrencyV2, variant: z.string().max(160), conditions: z.array(z.string().max(300)).max(8), conditionsResolved: z.boolean(), assessment: AssessmentV2 }).nullable(),
    stock: z.literal("unverified"), eligible: z.boolean(), blockers: z.array(z.string().max(800)).max(32),
  })).max(3),
  choice: z.strictObject({ productId: z.string().max(80), rationale: z.string().max(800) }).nullable(),
  sources: z.array(z.strictObject({ id: z.string().max(80), url: SafeUrlV2, title: z.string().max(500), text: z.string().max(24000), originalLength: z.number().int().nonnegative(), textTruncated: z.boolean(), imageUrl: SafeUrlV2.optional() })).max(10),
  limitations: z.array(z.string().max(800)).max(12), requestId: z.string().max(180), reportedCostUsd: z.number().finite().nonnegative().nullable(),
});
export const StoredConversationV2Schema = z.strictObject({
  version: z.literal(2), revision: Revision, intent: IntentV2,
  pending: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("currency"), id: z.string().max(80), originalRequest: z.string().max(2000), draft: IntentV2, minimum: MoneyV2.optional(), maximum: MoneyV2.optional() }),
    z.strictObject({ kind: z.literal("edit"), id: z.string().max(80), message: z.string().max(2000), explanation: z.string().max(2000) }),
  ]).nullable(),
  messages: z.array(z.strictObject({ id: z.string().max(100), role: z.enum(["user", "assistant"]), text: z.string().max(6000), detail: z.string().max(24000).optional(), research: StoredResearchV2Schema.optional() })).max(200),
});

export type StoredResearchV2 = z.infer<typeof StoredResearchV2Schema>;

const ReceiptSchema = z.strictObject({ operationId: Id, digest: z.string().length(64), status: z.enum(["prepared", "running", "complete", "interrupted"]), preparedId: Id.optional(), createdAt: Stamp });
export const StoredWorkspaceV2Schema = z.strictObject({
  schema: z.literal(2), state: StoredConversationV2Schema, acceptedAt: Stamp.nullable(),
  turns: z.array(z.strictObject({ operationId: Id, messageIds: z.array(z.string().max(100)).max(6), createdAt: Stamp })).max(50),
  receipts: z.array(ReceiptSchema).max(64),
  pending: z.strictObject({ preparedId: Id, operationId: Id, sessionId: z.string().min(1).max(256), revision: Revision, epoch: Revision, intentDigest: z.string().length(64), deadline: Stamp, status: z.enum(["prepared", "running"]) }).nullable(),
});
