import type { ShoppingIntent } from "../domain/conversation";
import type { ResearchOperation, ResearchUnavailableReason } from "../domain/research";
import type { ResearchQuota } from "./research-quota";
import { createHash } from "node:crypto";

export function createResearchExecutor(dependencies: { research?: ResearchOperation; quota?: ResearchQuota; unavailableReason?: "not-configured" | "disabled" }) {
  return async (intent: ShoppingIntent, operationId: string, signal: AbortSignal): ReturnType<ResearchOperation> => {
    const unavailable = (reason: ResearchUnavailableReason) => ({ status: "unavailable" as const, reason });
    if (!dependencies.research || !dependencies.quota) return unavailable(dependencies.unavailableReason ?? "not-configured");
    signal.throwIfAborted();
    const digest = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
    const admission = await dependencies.quota.reserve(operationId, digest);
    if (admission !== "admitted") return unavailable(admission);
    let settled = false;
    try {
      signal.throwIfAborted();
      const result = await dependencies.research({ intent }, signal);
      const cost = result.status === "ready" ? result.research.reportedCostUsd : result.reportedCostUsd ?? null;
      await dependencies.quota.settle(operationId, cost, !signal.aborted && (result.status === "ready" || result.reason === "empty" || result.reason === "invalid-response"));
      settled = true;
      signal.throwIfAborted();
      return result;
    } catch (error) {
      if (!settled) await dependencies.quota.settle(operationId, null, false);
      if (signal.aborted) throw error;
      return unavailable("provider-error");
    }
  };
}
