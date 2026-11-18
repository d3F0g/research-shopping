import { createHash } from "node:crypto";
import { conversationPolicy } from "../domain/conversation-policy";
import type {
  ResearchOperation,
  ResearchTurns,
  ResearchUnavailableReason,
} from "../domain/research";
import type { ResearchQuota } from "./research-quota";

const unavailableMessages: Record<ResearchUnavailableReason, string> = {
  "not-configured":
    "Live research is not configured. No product results are available.",
  disabled:
    "Live research is disabled in this environment. No product results are available.",
  quota:
    "Research is paused by the local usage limit. Your preferences are retained.",
  busy: "Another research request is still active or needs review. No additional search was started.",
  duplicate:
    "This research request was already submitted. No additional search was started.",
  timeout:
    "The research provider did not finish in time. Your preferences are retained.",
  "provider-error":
    "The research provider could not complete this request. Your preferences are retained.",
  "invalid-response":
    "The research provider returned evidence that could not be validated.",
  empty:
    "No safe source evidence was returned for this request. Your preferences are retained.",
};

export function createResearchTurns(dependencies: {
  research?: ResearchOperation;
  quota?: ResearchQuota;
  unavailableReason?: "not-configured" | "disabled";
}): ResearchTurns {
  return {
    async turn(request, signal) {
      signal.throwIfAborted();
      const { reply, preferences, notes } = conversationPolicy(request.message, request.preferences);
      if (reply) return reply;
      const unavailable = (reason: ResearchUnavailableReason) => ({
        kind: "research-unavailable" as const,
        reason,
        message: unavailableMessages[reason],
        preferences,
        notes,
      });
      if (!dependencies.research || !dependencies.quota)
        return unavailable(dependencies.unavailableReason ?? "not-configured");
      signal.throwIfAborted();
      const digest = createHash("sha256")
        .update(JSON.stringify({ message: request.message, preferences }))
        .digest("hex");
      const reservation = await dependencies.quota.reserve(
        request.operationId,
        digest,
      );
      if (reservation !== "admitted") return unavailable(reservation);
      try {
        signal.throwIfAborted();
        const result = await dependencies.research(
          { message: request.message, preferences },
          signal,
        );
        signal.throwIfAborted();
        const cost =
          result.status === "ready"
            ? result.research.reportedCostUsd
            : (result.reportedCostUsd ?? null);
        await dependencies.quota.settle(
          request.operationId,
          cost,
          result.status === "ready" ||
            result.reason === "empty" ||
            result.reason === "invalid-response",
        );
        signal.throwIfAborted();
        if (result.status !== "ready") return unavailable(result.reason);
        return {
          kind: "research",
          preferences,
          notes,
          research: result.research,
          answer: result.research.products.length
            ? result.research.products.some((product) => product.facts.length)
              ? "I found source-backed research leads. Compare the quoted specifications and their limits. Page prices, current affordability, stock and delivery remain unverified."
              : "I found product identities, but useful specifications were not established. Page price excerpts, current affordability, stock and delivery remain unverified."
            : "I found source pages, but could not attribute product-specific details reliably. Review the excerpts below.",
        };
      } catch (error) {
        try {
          await dependencies.quota.settle(request.operationId, null, false);
        } catch {
          return signal.aborted ? Promise.reject(error) : unavailable("quota");
        }
        if (signal.aborted) throw error;
        return unavailable("provider-error");
      }
    },
  };
}
