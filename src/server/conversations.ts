import { createHash, randomUUID } from "node:crypto";
import {
  initialConversation,
  type ConversationState,
  type PrepareInput,
  type TurnResponse,
} from "../domain/conversation";
import { reduceTurn } from "../domain/turn-reducer";
import type {
  ResearchOperation,
  ResearchUnavailableReason,
} from "../domain/research";
import type { ResearchQuota } from "./research-quota";
import { createResearchExecutor } from "./research-executor";

type Prepared = {
  id: string;
  operationId: string;
  digest: string;
  epoch: number;
  intent: ConversationState["intent"];
  status: "prepared" | "running" | "complete" | "abandoned";
  controller?: AbortController;
  promise?: Promise<TurnResponse>;
  response?: TurnResponse;
};
type Session = {
  state: ConversationState;
  epoch: number;
  prepared: Map<string, Prepared>;
  submissions: Map<string, { message: string; response: TurnResponse }>;
  active?: Prepared;
  touchedAt: number;
};
const messages: Record<ResearchUnavailableReason, string> = {
  "not-configured":
    "Exa research is not configured. Your request is saved; no products or prices were invented.",
  disabled:
    "Exa research is disabled in this environment. Your request is saved.",
  quota:
    "Research is paused by the local usage safeguard. Your request is retained. This limit is not the Exa account balance.",
  busy: "Another research operation is active or needs billing review. No additional research started.",
  duplicate:
    "This operation was already submitted. No additional research started.",
  timeout:
    "Exa did not finish in time. Your request is retained. The charge may be unknown; no automatic retry was sent.",
  "provider-error":
    "Exa could not complete this request. Your preferences are retained. No automatic retry was sent.",
  "invalid-response":
    "Exa returned evidence that could not be validated. Your request is retained.",
  empty:
    "No usable source evidence was returned. Your requirements remain active.",
  stale:
    "This research belongs to an abandoned request and cannot publish results.",
};
const digestIntent = (intent: ConversationState["intent"]) =>
  createHash("sha256")
    .update(JSON.stringify({ ...intent, responseLength: undefined }))
    .digest("hex");

export function createConversationService(
  dependencies: {
    research?: ResearchOperation;
    quota?: ResearchQuota;
    unavailableReason?: "not-configured" | "disabled";
    now?: () => number;
  } = {},
) {
  const sessions = new Map<string, Session>();
  const execute = createResearchExecutor(dependencies);
  const now = dependencies.now ?? Date.now;
  function session(id: string) {
    const value = sessions.get(id);
    if (!value) throw new Error("Unknown session");
    value.touchedAt = now();
    return value;
  }
  function abandon(value: Session) {
    value.epoch++;
    if (value.active) {
      value.active.status = "abandoned";
      value.active.controller?.abort();
      value.active = undefined;
    }
  }
  const snapshot = (value: Session) => structuredClone(value.state);
  function unavailable(
    value: Session,
    reason: ResearchUnavailableReason,
    append = true,
  ): TurnResponse {
    const message = messages[reason];
    if (append)
      value.state.messages.push({
        id: randomUUID(),
        role: "assistant",
        text: message,
      });
    return {
      kind: "research-unavailable",
      reason,
      message,
      state: snapshot(value),
    };
  }
  return {
    create() {
      for (const [id, value] of sessions)
        if (now() - value.touchedAt > 86_400_000 && !value.active)
          sessions.delete(id);
      if (sessions.size >= 500) throw new Error("Session capacity reached");
      const id = randomUUID();
      sessions.set(id, {
        state: initialConversation(),
        epoch: 0,
        prepared: new Map(),
        submissions: new Map(),
        touchedAt: now(),
      });
      return id;
    },
    has(id: string) {
      return sessions.has(id);
    },
    state(id: string) {
      return snapshot(session(id));
    },
    reset(id: string) {
      const value = session(id);
      abandon(value);
      value.state = initialConversation();
      value.prepared.clear();
      value.submissions.clear();
      return snapshot(value);
    },
    cancel(id: string) {
      const value = session(id);
      abandon(value);
      return snapshot(value);
    },
    prepare(id: string, input: PrepareInput): TurnResponse {
      const value = session(id);
      const prior = value.submissions.get(input.operationId);
      if (prior)
        return prior.message === JSON.stringify(input)
          ? structuredClone(prior.response)
          : unavailable(value, "duplicate", false);
      if (value.state.messages.length >= 200)
        return {
          kind: "message",
          message: "This conversation is full. Start a new chat to continue.",
          state: snapshot(value),
        };
      const before = digestIntent(value.state.intent);
      const decision = reduceTurn(value.state, input);
      if (
        decision.kind === "research" || decision.kind === "cancel" ||
        before !== digestIntent(decision.state.intent) ||
        decision.state.pending
      )
        abandon(value);
      value.state = decision.state;
      let response: TurnResponse;
      if (decision.kind === "research") {
        const prepared: Prepared = {
          id: randomUUID(),
          operationId: input.operationId,
          digest: digestIntent(value.state.intent),
          epoch: value.epoch,
          intent: structuredClone(value.state.intent),
          status: "prepared",
        };
        value.prepared.set(prepared.id, prepared);
        value.active = prepared;
        response = {
          kind: "prepared",
          preparedId: prepared.id,
          state: snapshot(value),
        };
      } else
        response = {
          kind: decision.kind === "cancel" ? "message" : decision.kind,
          message: decision.message,
          state: snapshot(value),
        };
      value.submissions.set(input.operationId, {
        message: JSON.stringify(input),
        response: structuredClone(response),
      });
      return response;
    },
    async research(
      id: string,
      preparedId: string,
      signal: AbortSignal,
    ): Promise<TurnResponse> {
      const value = session(id);
      const prepared = value.prepared.get(preparedId);
      if (
        !prepared ||
        prepared.epoch !== value.epoch ||
        prepared.digest !== digestIntent(value.state.intent) ||
        prepared.status === "abandoned"
      )
        return unavailable(value, "stale", false);
      if (prepared.response)
        return {
          ...structuredClone(prepared.response),
          state: snapshot(value),
        };
      if (prepared.promise) return prepared.promise;
      const controller = new AbortController();
      const onAbort = () => {
        controller.abort();
        prepared.status = "abandoned";
      };
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
      prepared.controller = controller;
      prepared.status = "running";
      const current = () =>
        !controller.signal.aborted &&
        prepared.status !== "abandoned" &&
        value.epoch === prepared.epoch &&
        value.active === prepared &&
        prepared.digest === digestIntent(value.state.intent);
      prepared.promise = (async () => {
        if (!current()) return unavailable(value, "stale", false);
        try {
          controller.signal.throwIfAborted();
          const result = await execute(
            prepared.intent,
            prepared.operationId,
            controller.signal,
          );
          if (!current()) return unavailable(value, "stale", false);
          if (result.status !== "ready")
            return unavailable(value, result.reason);
          value.state.messages.push({
            id: `${prepared.operationId}-research`,
            role: "assistant",
            text: result.research.summary,
            research: result.research,
          });
          return {
            kind: "research" as const,
            research: result.research,
            state: snapshot(value),
          };
        } catch {
          return unavailable(
            value,
            current() ? "provider-error" : "stale",
            current(),
          );
        }
      })()
        .then((response) => {
          prepared.response = response;
          if (prepared.status !== "abandoned") prepared.status = "complete";
          if (value.active === prepared) value.active = undefined;
          return response;
        })
        .finally(() => signal.removeEventListener("abort", onAbort));
      return prepared.promise;
    },
  };
}
export type ConversationService = ReturnType<typeof createConversationService>;
