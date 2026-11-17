import { z } from "zod";

export const ProductIdSchema = z.string().regex(/^[a-z0-9-]+$/).brand<"ProductId">();
export const SourceIdSchema = z.string().regex(/^[a-z0-9-]+$/).brand<"SourceId">();

export const CategorySchema = z.enum(["headphones", "laptops"]);
export const CurrencySchema = z.enum(["SGD", "USD"]);
export const RegionSchema = z.enum(["SG", "US"]);
export const DetailModeSchema = z.enum(["concise", "expanded"]);
export const FeatureSchema = z.enum([
  "active-noise-cancelling",
  "wireless",
  "multipoint",
  "long-battery-life",
  "lightweight",
  "oled-display",
  "high-memory",
  "long-battery",
  "portable",
]);
export const PrioritySchema = z.enum([
  "comfort",
  "sound-quality",
  "noise-cancelling",
  "battery-life",
  "portability",
  "performance",
  "display-quality",
  "value",
]);

export const BudgetSchema = z.object({
  amount: z.number().positive().finite(),
  currency: CurrencySchema,
});

export const PreferencesSchema = z.object({
  hard: z.object({
    category: CategorySchema.nullable(),
    budget: BudgetSchema.nullable(),
    region: RegionSchema,
    excludedBrands: z.array(z.string().trim().min(1).max(80)).max(20),
    requiredFeatures: z.array(FeatureSchema).max(12),
    pendingConstraint: z.string().trim().min(1).max(400).nullable().default(null),
  }),
  soft: z.object({
    useCase: z.string().trim().max(160),
    priorities: z.array(PrioritySchema).max(8),
    responseLength: DetailModeSchema,
  }),
});

export const SourceSchema = z.object({
  id: SourceIdSchema,
  name: z.string().min(1).max(120),
  url: z.string().url(),
  kind: z.enum(["manufacturer-reference", "fixture-observation"]),
  capturedAt: z.string().datetime(),
});

const SupportedClaimSchema = z.object({
  status: z.literal("supported"),
  key: z.string().min(1).max(80),
  value: z.string().min(1).max(240),
  sources: z.array(SourceSchema).min(1).max(5),
});

const UnknownClaimSchema = z.object({
  status: z.literal("unknown"),
  key: z.string().min(1).max(80),
  note: z.string().min(1).max(240),
});

const ConflictingClaimSchema = z.object({
  status: z.literal("conflict"),
  key: z.string().min(1).max(80),
  observations: z.array(z.object({
    value: z.string().min(1).max(240),
    source: SourceSchema,
  })).min(2).max(5),
});

export const ClaimSchema = z.discriminatedUnion("status", [
  SupportedClaimSchema,
  UnknownClaimSchema,
  ConflictingClaimSchema,
]);

export const DiscoveryProductSchema = z.object({
  id: ProductIdSchema,
  category: CategorySchema,
  brand: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  summary: z.string().min(1).max(240),
  features: z.array(FeatureSchema),
  manufacturer: z.string().min(1).max(120),
  productUrl: z.string().url(),
});

export const ProductSchema = DiscoveryProductSchema.extend({ claims: z.array(ClaimSchema) });

export const OfferSchema = z.object({
  productId: ProductIdSchema,
  merchant: z.string().min(1).max(120),
  merchantHost: z.string().min(1).max(253),
  productUrl: z.string().url(),
  region: RegionSchema,
  price: z.object({ amount: z.number().positive().finite(), currency: CurrencySchema }),
  availability: z.enum(["sample-in-stock", "sample-unavailable", "unknown"]),
  observedAt: z.string().datetime(),
  dataKind: z.literal("fixture"),
});

export const CandidateSchema = z.object({
  product: ProductSchema,
  offer: OfferSchema,
  reasons: z.array(z.string().min(1).max(180)).max(5),
});

export const TurnRequestSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  preferences: PreferencesSchema,
});

export const SelectionRequestSchema = z.object({
  productId: ProductIdSchema,
  preferences: PreferencesSchema,
});

export const TurnErrorSchema = z.object({
  kind: z.literal("error"),
  code: z.enum(["provider-failed", "invalid-selection", "unsafe-link", "not-eligible"]),
  message: z.string().min(1).max(400),
  retryable: z.boolean(),
  preferences: PreferencesSchema.nullable(),
  notes: z.array(z.string().max(240)),
});

export const TurnResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("clarification"),
    reason: z.enum(["category", "constraint", "feedback", "currency"]),
    message: z.string().min(1).max(400),
    preferences: PreferencesSchema,
    notes: z.array(z.string().max(240)),
  }),
  z.object({
    kind: z.literal("recommendations"),
    answer: z.string().min(1).max(400),
    preferences: PreferencesSchema,
    notes: z.array(z.string().max(240)),
    candidates: z.array(CandidateSchema).min(1).max(5),
  }),
  z.object({
    kind: z.literal("no-match"),
    message: z.string().min(1).max(400),
    preferences: PreferencesSchema,
    notes: z.array(z.string().max(240)),
  }),
  TurnErrorSchema,
]);

export const ProviderEventSchema = z.object({
  provider: z.enum(["discovery", "research", "merchant"]),
  outcome: z.enum(["ok", "failed", "timeout"]),
});

export const TurnResponseSchema = TurnResultSchema.and(z.object({
  toolActivity: z.array(ProviderEventSchema).max(20),
}));

export const SelectionResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("handoff"), productId: ProductIdSchema, productName: z.string(), offer: OfferSchema, productUrl: z.string().url(), label: z.string() }),
  TurnErrorSchema,
]);

export type Category = z.infer<typeof CategorySchema>;
export type Currency = z.infer<typeof CurrencySchema>;
export type Region = z.infer<typeof RegionSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Priority = z.infer<typeof PrioritySchema>;
export type Preferences = z.infer<typeof PreferencesSchema>;
export type ProductId = z.infer<typeof ProductIdSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type DiscoveryProduct = z.infer<typeof DiscoveryProductSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Offer = z.infer<typeof OfferSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type TurnRequest = z.infer<typeof TurnRequestSchema>;
export type TurnResult = z.infer<typeof TurnResultSchema>;
export type ProviderEvent = z.infer<typeof ProviderEventSchema>;
export type TurnResponse = z.infer<typeof TurnResponseSchema>;
export type SelectionResult = z.infer<typeof SelectionResultSchema>;

export function defaultPreferences(): Preferences {
  return {
    hard: {
      category: null,
      budget: null,
      region: "SG",
      excludedBrands: [],
      requiredFeatures: [],
      pendingConstraint: null,
    },
    soft: {
      useCase: "",
      priorities: ["value"],
      responseLength: "concise",
    },
  };
}
