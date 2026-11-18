import { z } from "zod";
import { PreferencesSchema, TurnResponseSchema } from "./legacy-contracts";
import {
  HistoricalResearchPreferencesSchema,
  UnversionedResearchResponseSchema,
} from "./research-history-unversioned";
import { Version2ResearchResponseSchema } from "./research-evidence-v2";
import { ApplicationTurnResponseSchema } from "./research";
import { ApplicationTurnResponseSchema as Version3ApplicationTurnResponseSchema } from "./research-evidence-v3";

export const LegacyApplicationTurnResponseSchema = z.union([
  TurnResponseSchema,
  UnversionedResearchResponseSchema,
  Version2ResearchResponseSchema,
  z.strictObject({
    kind: z.literal("research-unavailable"),
    message: z.string().min(1).max(400),
    reason: z.enum([
      "not-configured",
      "disabled",
      "quota",
      "busy",
      "duplicate",
      "timeout",
      "provider-error",
      "invalid-response",
      "empty",
    ]),
    preferences: HistoricalResearchPreferencesSchema,
    notes: z.array(z.string().max(300)).max(12),
  }),
]);
export const HistoricalApplicationTurnResponseSchema = z
  .unknown()
  .transform((raw, context) => {
    const versioned =
      typeof raw === "object" &&
      raw !== null &&
      Object.hasOwn(raw, "responseVersion");
    const parsed = (
      versioned
        ? (raw as { responseVersion: unknown }).responseVersion === 3
          ? Version3ApplicationTurnResponseSchema
          : ApplicationTurnResponseSchema
        : LegacyApplicationTurnResponseSchema
    ).safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue });
      return z.NEVER;
    }
    return parsed.data;
  });
export const LegacySavedRequestSchema = z.object({
  message: z.string().max(2000),
  preferences: PreferencesSchema,
});
export const LegacySavedBodySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("question"),
    question: z.literal("budget"),
    preferences: PreferencesSchema,
  }),
  z.object({
    status: z.literal("complete"),
    value: HistoricalApplicationTurnResponseSchema,
  }),
  z.object({
    status: z.literal("interrupted"),
    reason: z.enum(["cancelled", "timeout", "failed", "too-large"]),
  }),
]);
export const LegacySavedTurnSchema = z.object({
  id: z.string().uuid(),
  operationId: z.string().uuid(),
  digest: z.string().length(64),
  createdAt: z.string().datetime(),
  message: z.string().max(2400),
  request: LegacySavedRequestSchema,
  body: LegacySavedBodySchema,
});
export type LegacyApplicationTurnResponse = z.infer<
  typeof LegacyApplicationTurnResponseSchema
>;
export type HistoricalApplicationTurnResponse = z.infer<
  typeof HistoricalApplicationTurnResponseSchema
>;
