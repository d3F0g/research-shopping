import { z } from "zod";
import { isSafeSourceUrl } from "./safe-url";
import { validEvidenceSupport, catalogRowMoney, uniqueLiteralSpan } from "./evidence-binding-v4";
const MoneySchema = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine((n) => Math.round(n * 100) / 100 === n);
const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
const BudgetSchema = z
  .strictObject({
    minimum: MoneySchema.optional(),
    maximum: MoneySchema.optional(),
    currency: CurrencySchema,
  })
  .refine(
    (b) =>
      (b.minimum !== undefined || b.maximum !== undefined) &&
      (b.minimum === undefined ||
        b.maximum === undefined ||
        b.minimum <= b.maximum),
  );
const RequirementSchema = z.strictObject({
  id: z.string().max(80),
  text: z.string().min(1).max(2000),
  strength: z.enum(["hard", "flexible"]),
  originMessageId: z.string().max(80),
  kind: z.enum(["request", "brand", "exclusion", "preference"]),
});
export const ShoppingIntentSchema = z.strictObject({
  intentVersion: z.literal(2),
  originalText: z.string().max(2000),
  productDescription: z.string().max(6000),
  requirements: z
    .array(RequirementSchema)
    .max(24)
    .refine((r) => new Set(r.map((v) => v.id)).size === r.length),
  budget: BudgetSchema.nullable(),
  region: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  responseLength: z.enum(["concise", "expanded"]),
});
const LiteralSpanSchema = z.strictObject({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  text: z.string().min(1).max(4000),
});
export const SupportSchema = z.strictObject({
  sourceId: z.string().max(80),
  origin: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("provider"), reportedQuote: z.string().min(1).max(4000), match: z.enum(["literal", "whitespace"]) }),
    z.strictObject({ kind: z.literal("source-context") }),
  ]),
  literal: LiteralSpanSchema,
  context: LiteralSpanSchema,
});
export const AssessmentSchema = z.strictObject({
  status: z.enum(["supported", "unknown", "contradicted", "conflict"]),
  scope: z.enum(["exact-variant", "product-family", "unclear"]),
  rationale: z.string().min(1).max(800),
  support: z.array(SupportSchema).max(3),
});
export const SourceSchema = z
  .strictObject({
    id: z.string().max(80),
    url: z.string().refine(isSafeSourceUrl),
    title: z.string().max(500),
    text: z.string().max(24000),
    originalLength: z.number().int().nonnegative(),
    textTruncated: z.boolean(),
    imageUrl: z.string().refine(isSafeSourceUrl).optional(),
  })
  .refine(
    (s) =>
      s.originalLength >= s.text.length &&
      s.textTruncated === s.originalLength > s.text.length,
  );
export const CatalogPriceObservationSchema = z.strictObject({
  kind: z.literal("catalog-row"),
  amount: MoneySchema,
  currency: CurrencySchema,
  row: SupportSchema,
  reportedAssessment: AssessmentSchema,
  reportedConditions: z.array(z.string().max(300)).max(8),
  reportedConditionsResolved: z.boolean(),
  attribution: z.strictObject({ status: z.literal("unknown"), rationale: z.string().min(1).max(4400) }),
});
export const ProductSchema = z.strictObject({
  id: z.string().max(80),
  name: z.string().min(1).max(160),
  variant: z.string().max(160).nullable(),
  identity: AssessmentSchema,
  requestMatch: AssessmentSchema,
  requirements: z
    .array(
      z.strictObject({
        requirementId: z.string().max(80),
        assessment: AssessmentSchema,
      }),
    )
    .max(24),
  attributes: z
    .array(
      z.strictObject({
        name: z.string().max(80),
        assessment: AssessmentSchema,
      }),
    )
    .max(6),
  price: z
    .strictObject({
      amount: MoneySchema,
      currency: CurrencySchema,
      variant: z.string().max(160),
      conditions: z.array(z.string().max(331)).max(16),
      conditionsResolved: z.boolean(),
      assessment: AssessmentSchema,
    })
    .nullable(),
  priceObservation: CatalogPriceObservationSchema.nullable(),
  stock: z.literal("unverified"),
  eligible: z.boolean(),
  blockers: z.array(z.string().max(800)).max(32),
});
export const ResearchSnapshotSchema = z
  .strictObject({
    version: z.literal(2),
    evidenceVersion: z.literal(4),
    dataKind: z.enum(["web-research", "test-fixture"]),
    retrievedAt: z.iso.datetime(),
    intent: ShoppingIntentSchema,
    summary: z.string().max(1500),
    products: z.array(ProductSchema).max(3),
    choice: z
      .strictObject({
        productId: z.string().max(80),
        rationale: z.string().max(800),
      })
      .nullable(),
    sources: z.array(SourceSchema).max(10),
    limitations: z.array(z.string().max(800)).max(12),
    requestId: z.string().max(180),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
  })
  .superRefine((snapshot, ctx) => {
    const sources = new Map(snapshot.sources.map((s) => [s.id, s]));
    if (
      sources.size !== snapshot.sources.length ||
      new Set(snapshot.sources.map((s) => s.url)).size !==
        snapshot.sources.length ||
      new Set(snapshot.products.map((p) => p.id)).size !==
        snapshot.products.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Source and product identities must be unique",
      });
    for (const p of snapshot.products)
      for (const a of [
        p.identity,
        p.requestMatch,
        ...p.requirements.map((r) => r.assessment),
        ...p.attributes.map((r) => r.assessment),
        ...(p.price ? [p.price.assessment] : []),
        ...(p.priceObservation ? [p.priceObservation.reportedAssessment] : []),
      ])
        for (const span of a.support) {
          const source = sources.get(span.sourceId);
          if (!source || !validEvidenceSupport(source, span))
            ctx.addIssue({
              code: "custom",
              message:
                "Evidence must bind the unique reported quotation, literal source span and complete uncut context",
            });
        }
    for (const product of snapshot.products) {
      const observation = product.priceObservation;
      if (!observation) continue;
      const { row } = observation;
      const source = sources.get(row.sourceId);
      const money = catalogRowMoney(row.literal.text);
      const heading = money && uniqueLiteralSpan(money.heading, product.name);
      const nameStart = row.literal.start + (heading?.start ?? 0);
      const nameEnd = row.literal.start + (heading?.end ?? 0);
      const identityBound = product.identity.support.some((span) => span.sourceId === row.sourceId && span.literal.start <= nameStart && span.literal.end >= nameEnd);
      const nativeBound = observation.reportedAssessment.support.some((span) => span.sourceId === row.sourceId && span.origin.kind === "provider" && span.literal.start >= nameStart && span.literal.start <= row.literal.start + (money?.moneyStart ?? 0) && span.literal.end >= row.literal.start + (money?.moneyEnd ?? 0) && span.literal.end <= row.literal.end);
      if (product.price || !source || source.textTruncated || source.text.length > 4000 || row.origin.kind !== "source-context" || !validEvidenceSupport(source, row) || row.context.start !== 0 || row.context.end !== source.text.length || row.context.text !== source.text || !money || money.amount !== observation.amount || money.currency !== observation.currency || !heading || !identityBound || !nativeBound || observation.reportedAssessment.support.some((span) => span.origin.kind !== "provider")) ctx.addIssue({ code: "custom", message: "Catalog money must remain a complete source row with unknown attribution and actual reported support" });
    }
  });
export type Assessment = z.infer<typeof AssessmentSchema>;
export type ResearchSource = z.infer<typeof SourceSchema>;
export type ResearchProduct = z.infer<typeof ProductSchema>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;

export type CatalogPriceObservation = z.infer<typeof CatalogPriceObservationSchema>;
