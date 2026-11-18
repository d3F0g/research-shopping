import { z } from "zod";
import {
  PreferencesSchema,
  TurnResponseSchema,
  type Preferences,
  type Region,
  type Currency,
} from "./contracts";
import {
  ResearchSnapshotSchema,
  ResearchProductSchema,
  Version2ResearchResponseSchema,
} from "./research-evidence-v2";
export {
  ResearchSnapshotSchema,
  ResearchProductSchema,
} from "./research-evidence-v2";

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
  Version2ResearchResponseSchema,
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
