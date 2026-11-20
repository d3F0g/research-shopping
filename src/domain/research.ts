import type { ShoppingIntent } from "./conversation";
import type { ResearchSnapshot } from "./research-history-v5";
export { assessProduct, supportedExactly, dominates, flexibleCoverage, SupportSchema, AssessmentSchema, SourceSchema, ProductSchema, ResearchSnapshotSchema } from "./research-history-v5";
export type { Assessment, ResearchSource, ResearchProduct, ResearchSnapshot } from "./research-history-v5";
export type ResearchUnavailableReason =
  | "not-configured"
  | "disabled"
  | "quota"
  | "busy"
  | "duplicate"
  | "timeout"
  | "provider-error"
  | "invalid-response"
  | "empty"
  | "stale";
export type ResearchOperation = (
  request: { intent: ShoppingIntent },
  signal: AbortSignal,
) => Promise<
  | { status: "ready"; research: ResearchSnapshot }
  | {
      status: "unavailable";
      reason: ResearchUnavailableReason;
      reportedCostUsd?: number;
    }
>;
