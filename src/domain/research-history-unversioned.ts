import { z } from "zod";

// Stored research emitted by 657e883 must not inherit later evidence contracts.
export const HistoricalResearchPreferencesSchema = z.strictObject({
  hard: z.strictObject({
    category: z.enum(["headphones", "laptops"]).nullable(),
    budget: z
      .strictObject({
        amount: z.number().positive().finite(),
        currency: z.enum(["SGD", "USD"]),
      })
      .nullable(),
    region: z.enum(["SG", "US"]),
    excludedBrands: z.array(z.string().min(1).max(80)).max(20),
    requiredFeatures: z
      .array(
        z.enum([
          "active-noise-cancelling",
          "wireless",
          "multipoint",
          "long-battery-life",
          "lightweight",
          "oled-display",
          "high-memory",
          "long-battery",
          "portable",
        ]),
      )
      .max(12),
    pendingConstraint: z.string().min(1).max(400).nullable(),
  }),
  soft: z.strictObject({
    useCase: z.string().max(160),
    priorities: z
      .array(
        z.enum([
          "comfort",
          "sound-quality",
          "noise-cancelling",
          "battery-life",
          "portability",
          "performance",
          "display-quality",
          "value",
        ]),
      )
      .max(8),
    responseLength: z.enum(["concise", "expanded"]),
  }),
});

function isHistoricalSourceUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const hostname = url.hostname.toLowerCase();
    const labels = hostname.split(".");
    const ipLiteral =
      hostname.startsWith("[") ||
      hostname.includes(":") ||
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const reservedHost =
      hostname === "localhost" ||
      [
        ".localhost",
        ".local",
        ".internal",
        ".test",
        ".example",
        ".invalid",
        ".onion",
      ].some((suffix) => hostname.endsWith(suffix));
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !ipLiteral &&
      !reservedHost &&
      hostname.length <= 253 &&
      labels.length > 1 &&
      labels.every((label) =>
        /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
      ) &&
      /^(?:[a-z]{2,}|xn--[a-z0-9-]+)$/.test(labels.at(-1) ?? "")
    );
  } catch {
    return false;
  }
}

const Citation = z.strictObject({
  sourceId: z.string().min(1).max(80),
  quote: z.string().min(1).max(640),
});
const Product = z.strictObject({
  id: z.string().min(1).max(80),
  name: z.string().min(2).max(160),
  facts: z.array(Citation).max(3),
  price: Citation.extend({
    kind: z.literal("page-observed-unverified"),
  }).nullable(),
  stock: z.literal("unverified"),
  unresolvedConstraints: z.array(z.string().min(1).max(180)).max(16),
});
export const HistoricalResearchSourceSchema = z.strictObject({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(180),
  url: z.string().url().max(2_048).refine(isHistoricalSourceUrl),
  highlights: z.array(z.string().max(640)).max(3),
});

export const UnversionedResearchSnapshotSchema = z
  .strictObject({
    dataKind: z.literal("web-research"),
    retrievedAt: z.string().datetime(),
    products: z.array(Product).max(5),
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
      if (!product.facts.length && !product.price)
        context.addIssue({
          code: "custom",
          message: "A product requires source evidence",
        });
      for (const citation of [
        ...product.facts,
        ...(product.price ? [product.price] : []),
      ]) {
        const source = sources.get(citation.sourceId);
        if (
          !source ||
          !source.highlights.some((excerpt) => excerpt.includes(citation.quote))
        )
          context.addIssue({
            code: "custom",
            message: "Product evidence must be visible in its source",
          });
      }
    }
  });

export const UnversionedResearchResponseSchema = z.strictObject({
  kind: z.literal("research"),
  answer: z.string().min(1).max(400),
  preferences: HistoricalResearchPreferencesSchema,
  notes: z.array(z.string().max(300)).max(12),
  research: UnversionedResearchSnapshotSchema,
});
export type UnversionedResearchSnapshot = z.infer<
  typeof UnversionedResearchSnapshotSchema
>;
