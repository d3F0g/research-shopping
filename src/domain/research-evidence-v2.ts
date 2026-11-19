import { z } from "zod";
import {
  HistoricalResearchPreferencesSchema,
  HistoricalResearchSourceSchema,
} from "./research-history-unversioned";

const ResearchCitationSchema = z.strictObject({
  sourceId: z.string().min(1).max(80),
  quote: z.string().min(1).max(640),
});
export const ResearchProductSchema = z.strictObject({
  id: z.string().min(1).max(80),
  name: z.string().min(2).max(160),
  identity: ResearchCitationSchema.extend({
    kind: z.enum(["direct-model-statement", "single-product-heading"]),
  }),
  facts: z.array(ResearchCitationSchema).max(3),
  price: ResearchCitationSchema.extend({
    kind: z.enum(["page-observed-unverified", "page-price-context-unverified"]),
  }).nullable(),
  stock: z.literal("unverified"),
  unresolvedConstraints: z.array(z.string().min(1).max(180)).max(16),
});
export const ResearchSnapshotSchema = z
  .strictObject({
    dataKind: z.literal("web-research"),
    evidenceVersion: z.literal(2),
    retrievedAt: z.string().datetime(),
    products: z.array(ResearchProductSchema).max(5),
    sources: z.array(HistoricalResearchSourceSchema).max(5),
    limitations: z.array(z.string().min(1).max(300)).max(12),
    requestId: z.string().max(180),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
    grounding: z
      .array(
        z.strictObject({
          field: z.string().max(240),
          sourceIds: z.array(z.string().max(80)).max(5),
        }),
      )
      .max(30),
  })
  .superRefine((snapshot, context) => {
    const sources = new Map(
      snapshot.sources.map((source) => [source.id, source]),
    );
    if (
      sources.size !== snapshot.sources.length ||
      new Set(snapshot.sources.map((source) => source.url)).size !==
        snapshot.sources.length
    )
      context.addIssue({
        code: "custom",
        message: "Research sources must be distinct",
      });
    for (const product of snapshot.products) {
      for (const citation of [
        product.identity,
        ...product.facts,
        ...(product.price ? [product.price] : []),
      ]) {
        const source = sources.get(citation.sourceId);
        if (
          !source ||
          !source.highlights.some(
            (excerpt) =>
              excerpt.includes(citation.quote) &&
              (product.identity.kind !== "single-product-heading" ||
                excerpt.includes(product.identity.quote)),
          ) ||
          citation.sourceId !== product.identity.sourceId
        ) {
          context.addIssue({
            code: "custom",
            message: "Product evidence must be visible in its source",
          });
        }
      }
    }
  });

export const Version2ResearchResponseSchema = z.strictObject({
  kind: z.literal("research"),
  answer: z.string().min(1).max(400),
  preferences: HistoricalResearchPreferencesSchema,
  notes: z.array(z.string().max(300)).max(12),
  research: ResearchSnapshotSchema,
});
