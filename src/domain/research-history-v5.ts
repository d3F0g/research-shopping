import { z } from "zod";
import { AssessmentSchema, SupportSchema, validEvidenceSupport, type Assessment } from "./evidence-binding-v5";
import { PriceEvidenceSchema, SourceSchema, toMinorUnits, validPriceEvidence, validPriceSources } from "./price-evidence-v5";
export { AssessmentSchema, SupportSchema, SourceSchema };
export type { Assessment } from "./evidence-binding-v5";
export type { ResearchSource } from "./price-evidence-v5";
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
  priceEvidence: PriceEvidenceSchema,
  stock: z.literal("unverified"),
  eligible: z.boolean(),
  blockers: z.array(z.string().max(800)).max(32),
});
export const ResearchSnapshotSchema = z
  .strictObject({
    version: z.literal(2),
    evidenceVersion: z.literal(5),
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
    sourceRetention: z.strictObject({ discardedSources: z.number().int().nonnegative().max(100), conflictingUrls: z.array(z.string().max(2048)).max(100) }),
    limitations: z.array(z.string().max(800)).max(12),
    requestId: z.string().max(180),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
  })
  .superRefine((snapshot, ctx) => {
    const sources = new Map(snapshot.sources.map((source) => [source.id, source]));
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (sources.size !== snapshot.sources.length || new Set(snapshot.sources.map((source) => source.url)).size !== snapshot.sources.length || new Set(snapshot.products.map((product) => product.id)).size !== snapshot.products.length) fail("Source and product identities must be unique");
    if (!validPriceSources(snapshot.sources)) fail("Money occurrences must match the complete retained source text");
    const complete = snapshot.sourceRetention.discardedSources === 0 && snapshot.sourceRetention.conflictingUrls.length === 0 && snapshot.sources.every((source) => !source.textTruncated);
    for (const product of snapshot.products) {
      for (const assessment of [product.identity, product.requestMatch, ...product.requirements.map((row) => row.assessment), ...product.attributes.map((row) => row.assessment)]) {
        for (const support of assessment.support) {
          const source = sources.get(support.sourceId);
          if (!source || !validEvidenceSupport(source, support)) fail("Evidence must bind its unique original quotation and source offsets");
        }
        if (assessment.status === "supported" && (!complete || !assessment.support.length || assessment.support.some((support) => support.origin.kind !== "provider"))) fail("Incomplete evidence cannot establish positive compliance");
      }
      if (!validPriceEvidence(product.priceEvidence, { product, sources: snapshot.sources, complete })) fail("Price state must match the versioned source inventory, reviews and alarms");
      const assessed = assessProduct(product, snapshot.intent);
      if (product.eligible !== assessed.eligible || JSON.stringify(product.blockers) !== JSON.stringify(assessed.blockers)) fail("Eligibility and blockers must follow the accepted intent and price evidence");
    }
    if (snapshot.choice) {
      const chosen = snapshot.products.find((product) => product.id === snapshot.choice!.productId);
      if (!chosen?.eligible || snapshot.choice.rationale !== chosen.requestMatch.rationale || snapshot.products.some((product) => product.eligible && dominates(product, chosen, snapshot.intent))) fail("Choice must reference an eligible non-dominated product and its actual request-fit explanation");
    }
  });
export type ResearchProduct = z.infer<typeof ProductSchema>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;
type ReadonlyDeep<T> = T extends object ? { readonly [Key in keyof T]: ReadonlyDeep<T[Key]> } : T;
type Intent = ReadonlyDeep<z.infer<typeof ShoppingIntentSchema>>;

export function supportedExactly(value: ReadonlyDeep<Assessment>): boolean {
  return value.status === "supported" && value.scope === "exact-variant" && value.support.length > 0;
}
export function assessProduct<Product extends ReadonlyDeep<ResearchProduct>>(product: Product, intent: Intent): Product & { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!product.variant || !supportedExactly(product.identity)) blockers.push("Exact product identity and variant remain unproven.");
  if (!supportedExactly(product.requestMatch)) blockers.push("Fit to the complete shopping objective remains unresolved.");
  for (const requirement of intent.requirements.filter((row) => row.strength === "hard")) {
    const assessment = product.requirements.find((row) => row.requirementId === requirement.id)?.assessment;
    if (!assessment || !supportedExactly(assessment)) blockers.push(`${requirement.text} (${assessment?.status ?? "unknown"})`);
  }
  if (intent.budget) {
    const price = product.priceEvidence;
    if (price.state !== "applicable") blockers.push("An applicable exact-variant price is unverified.");
    else if (price.usableMoney.currency !== intent.budget.currency || intent.budget.minimum !== undefined && price.usableMoney.minorUnits < toMinorUnits(intent.budget.minimum)! || intent.budget.maximum !== undefined && price.usableMoney.minorUnits > toMinorUnits(intent.budget.maximum)!) blockers.push("Observed price does not meet both budget bounds and explicit currency.");
  }
  return { ...product, eligible: blockers.length === 0, blockers };
}
export function flexibleCoverage(product: ReadonlyDeep<ResearchProduct>, intent: Intent): Set<string> {
  return new Set(intent.requirements.filter((requirement) => requirement.strength === "flexible" && product.requirements.some((row) => row.requirementId === requirement.id && supportedExactly(row.assessment))).map((requirement) => requirement.id));
}
export function dominates(first: ReadonlyDeep<ResearchProduct>, second: ReadonlyDeep<ResearchProduct>, intent: Intent): boolean {
  const a = flexibleCoverage(first, intent), b = flexibleCoverage(second, intent);
  return a.size > b.size && [...b].every((id) => a.has(id));
}
