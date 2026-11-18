import { z } from "zod";
import {
  PreferencesSchema,
  TurnResponseSchema,
  type Preferences,
  type Region,
  type Currency,
} from "./contracts";
import { WebResearchSourceSchema } from "./web-research";

const ResearchCitationSchema = z.object({
  sourceId: z.string().min(1).max(80),
  quote: z.string().min(1).max(640),
});
export const ResearchProductSchema = z.object({
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
  .object({
    dataKind: z.literal("web-research"),
    evidenceVersion: z.literal(2),
    retrievedAt: z.string().datetime(),
    products: z.array(ResearchProductSchema).max(5),
    sources: z
      .array(WebResearchSourceSchema.extend({ id: z.string().min(1).max(80) }))
      .max(5),
    limitations: z.array(z.string().min(1).max(300)).max(12),
    requestId: z.string().max(180),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
    grounding: z
      .array(
        z.object({
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
          !source.highlights.some((excerpt) =>
            excerpt.includes(citation.quote) &&
            (product.identity.kind !== "single-product-heading" || excerpt.includes(product.identity.quote)),
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
export const ResearchUnavailableReasonSchema = z.enum([
  "not-configured",
  "disabled",
  "quota",
  "busy",
  "duplicate",
  "timeout",
  "provider-error",
  "invalid-response",
  "empty",
]);
export const ResearchTurnResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("research"),
    answer: z.string().min(1).max(400),
    preferences: PreferencesSchema,
    notes: z.array(z.string().max(300)).max(12),
    research: ResearchSnapshotSchema,
  }),
  z.object({
    kind: z.literal("research-unavailable"),
    message: z.string().min(1).max(400),
    reason: ResearchUnavailableReasonSchema,
    preferences: PreferencesSchema,
    notes: z.array(z.string().max(300)).max(12),
  }),
]);
export const ApplicationTurnResponseSchema = z.union([
  ResearchTurnResponseSchema,
  TurnResponseSchema,
]);
export type ApplicationTurnResponse = z.infer<
  typeof ApplicationTurnResponseSchema
>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;
export type ResearchProduct = z.infer<typeof ResearchProductSchema>;
export type ResearchUnavailableReason = z.infer<
  typeof ResearchUnavailableReasonSchema
>;
export type ResearchOperation = (
  request: { message: string; preferences: Preferences },
  signal: AbortSignal,
) => Promise<
  | { status: "ready"; research: ResearchSnapshot }
  | {
      status: "unavailable";
      reason: ResearchUnavailableReason;
      reportedCostUsd?: number;
    }
>;
export type ResearchTurns = {
  turn(
    request: { message: string; preferences: Preferences; operationId: string },
    signal: AbortSignal,
  ): Promise<ApplicationTurnResponse>;
};

export type MerchantVerificationProvider = {
  verify(
    identity: { name: string; variant: string | null },
    market: { region: Region; currency: Currency },
    signal: AbortSignal,
  ): Promise<
    | { status: "unavailable" | "unverified"; reason: string }
    | {
        status: "verified";
        proof: {
          provider: string;
          merchant: string;
          listingId: string;
          variantId: string;
          region: Region;
          currency: Currency;
          amount: number;
          availability: "available" | "unavailable" | "backorder" | "unknown";
          observedAt: string;
          expiresAt: string;
          sourceReference: string;
          destination: string;
        };
      }
  >;
};
