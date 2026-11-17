import { z } from "zod";
import { PreferencesSchema, ProductIdSchema } from "./contracts";

const MAX_WEB_RESEARCH_RESULTS = 10;
const MAX_WEB_RESEARCH_HIGHLIGHTS = 8_192;

export const ShortlistResearchRequestSchema = z.object({
  productIds: z.array(ProductIdSchema).min(1).max(5).refine(
    (productIds) => new Set(productIds).size === productIds.length,
  ),
  preferences: PreferencesSchema,
}).strict();

export const WebResearchSourceSchema = z.object({
  title: z.string().min(1).max(180),
  url: z.string().url().max(2_048),
  highlights: z.array(z.string().max(640)).max(3),
});

const WebResearchReadySchema = z.object({
  status: z.literal("ready"),
  retrievedAt: z.string().datetime(),
  results: z.array(WebResearchSourceSchema).max(MAX_WEB_RESEARCH_RESULTS),
  truncated: z.boolean(),
}).superRefine((response, context) => {
  const encoder = new TextEncoder();
  const totalBytes = response.results.reduce(
    (total, result) => total + result.highlights.reduce(
      (highlightTotal, highlight) => highlightTotal + encoder.encode(highlight).byteLength,
      0,
    ),
    0,
  );
  if (totalBytes > MAX_WEB_RESEARCH_HIGHLIGHTS) {
    context.addIssue({ code: "custom", message: "Web research highlights exceed the response limit" });
  }
});

export const WebResearchResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("disabled") }),
  z.object({
    status: z.literal("unavailable"),
    reason: z.enum(["timeout", "provider-error", "invalid-response"]),
  }),
  WebResearchReadySchema,
]);

export type ShortlistResearchRequest = z.infer<typeof ShortlistResearchRequestSchema>;
export type WebResearchSource = z.infer<typeof WebResearchSourceSchema>;
export type WebResearchResponse = z.infer<typeof WebResearchResponseSchema>;
export type WebResearchOperation = (
  request: ShortlistResearchRequest,
  signal: AbortSignal,
) => Promise<WebResearchResponse>;
