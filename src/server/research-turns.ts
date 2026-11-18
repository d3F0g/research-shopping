import { createHash } from "node:crypto";
import { editIntent, updateIntent } from "../domain/preferences";
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
      const update = request.edit
        ? editIntent(request.preferences, request.edit, request.message)
        : request.skipBudget
          ? {
              preferences: {
                ...structuredClone(request.preferences),
                budgetClarified: true,
              },
              notes: [],
            }
          : updateIntent(request.message, request.preferences);
      const preferences = update.preferences;
      const notes = update.notes;
      const base = { responseVersion: 3 as const, preferences, notes };
      if ("clarification" in update && update.clarification)
        return { ...base, kind: "clarification", ...update.clarification };
      if ("reply" in update && update.reply)
        return { ...base, kind: "message", message: update.reply };
      if (!preferences.budget && !preferences.budgetClarified)
        return {
          ...base,
          kind: "question",
          question: "budget",
          message:
            "What is your maximum budget in SGD or USD? You can skip this and compare without a price limit.",
        };
      const unavailable = (reason: ResearchUnavailableReason) => ({
        ...base,
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
          ...base,
          kind: "research",
          preferences,
          notes,
          research: result.research,
          answer: result.research.summary,
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
