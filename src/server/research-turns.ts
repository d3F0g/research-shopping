import { createHash } from "node:crypto";
import { editIntent, resolveLocalIntent, type IntentUpdate } from "../domain/preferences";
import type {
  ResearchOperation,
  ResearchTurns,
  ResearchUnavailableReason,
} from "../domain/research";
import { applyIntentActions, type IntentInterpreter } from "../domain/intent-actions";
import type { ResearchQuota } from "./research-quota";

const unavailableMessages: Record<ResearchUnavailableReason, string> = {
  "intent-unavailable": "I could not interpret that request right now. Your accepted preferences and any pending answer are retained. Try again after intent interpretation is available.",
  "not-configured":
    "Live research is not configured. No product results are available.",
  disabled:
    "Live research is disabled in this environment. No product results are available.",
  quota:
    "Research is paused by the app's local usage safeguard. Your request and preferences are retained.",
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
  interpretIntent?: IntentInterpreter;
  quota?: ResearchQuota;
  unavailableReason?: "not-configured" | "disabled";
}): ResearchTurns {
  return {
    async turn(request, signal) {
      signal.throwIfAborted();
      if (request.phase === "prepare" && request.questionId && request.questionId !== request.preferences.pendingChange?.id)
        return { responseVersion: 5, kind: "message", preferences: request.preferences, notes: [], message: "That question is no longer active. Your current preferences are unchanged." };
      let update: IntentUpdate | null =
        request.phase === "prepare"
          ? request.edit
            ? editIntent(request.preferences, request.edit, request.message)
            : request.skipBudget
              ? {
                  preferences: {
                    ...structuredClone(request.preferences),
                    budget: null,
                    budgetClarified: true,
                    pendingChange:
                      request.preferences.pendingChange?.reason === "constraint"
                        ? request.preferences.pendingChange
                        : null,
                    revision: request.preferences.revision + 1,
                  },
                  notes: [],
                }
              : resolveLocalIntent(request.message, request.preferences)
          : { preferences: request.preferences, notes: [] };
      if (!update && request.phase === "prepare") {
        try {
          const result = await dependencies.interpretIntent?.(request, signal);
          signal.throwIfAborted();
          if (result?.status === "ready") update = applyIntentActions(request.preferences, request.message, result.interpretation);
        } catch (error) {
          if (signal.aborted) throw error;
        }
        if (!update) return { responseVersion: 5, kind: "research-unavailable", reason: "intent-unavailable", message: unavailableMessages["intent-unavailable"], preferences: request.preferences, notes: [] };
      }
      if (!update) throw new Error("Missing intent update");
      const preferences = update.preferences;
      const notes = update.notes;
      const base = { responseVersion: 5 as const, preferences, notes };
      if ("clarification" in update && update.clarification)
        return { ...base, kind: "clarification", ...update.clarification };
      if ("reply" in update && update.reply)
        return { ...base, kind: "message", message: update.reply };
      if (preferences.pendingChange)
        return {
          ...base,
          kind: "clarification",
          reason: preferences.pendingChange.reason,
          message: preferences.pendingChange.explanation,
        };
      if (!preferences.productDescription)
        return {
          ...base,
          kind: "clarification",
          reason: "description",
          message:
            "Describe what you are shopping for before starting research.",
        };
      if (request.phase === "prepare")
        return { kind: "prepared", preferences, notes };
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
        .update(JSON.stringify(preferences))
        .digest("hex");
      const reservation = await dependencies.quota.reserve(
        request.operationId,
        digest,
      );
      if (reservation !== "admitted") return unavailable(reservation);
      try {
        signal.throwIfAborted();
        const result = await dependencies.research({ preferences }, signal);
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
