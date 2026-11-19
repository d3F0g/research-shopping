import { useEffect, useRef, useState } from "react";
import {
  BudgetSchema,
  defaultIntent,
  type Currency,
  type IntentEdit,
  type ShoppingIntent,
  type PrepareTurnRequest,
} from "../domain/contracts";
import type {
  ApplicationTurnResponse,
  PreparedTurnResponse,
} from "../domain/research";
import { runTurn } from "./api";

type TurnBody =
  | { status: "cancelled" }
  | { status: "pending"; key: number; phase: "prepare" | "research" }
  | { status: "complete"; value: ApplicationTurnResponse }
  | { status: "failed"; message: string };
export type RequestSnapshot = Omit<PrepareTurnRequest, "phase" | "operationId">;
export type ConversationTurn = {
  id: string;
  operationId: string;
  request: RequestSnapshot;
  message: string;
  body: TurnBody;
  prepared: PreparedTurnResponse | null;
};
export type CriterionDraft = {
  id: string | null;
  wording: string;
  strength: "hard" | "flexible";
};
export type PreferenceDraft = {
  turnId: string;
  original: ShoppingIntent;
  description: string;
  criteria: CriterionDraft[];
  budget: string;
  minimumBudget: string;
  currency: Currency;
  region: ShoppingIntent["region"];
  responseLength: ShoppingIntent["responseLength"];
  error: string | null;
};
type ConversationState = {
  turns: ConversationTurn[];
  preferences: ShoppingIntent;
  draft: string;
  activeTurnId: string | null;
  retryTurnId: string | null;
  editor: PreferenceDraft | null;
};
export type ConversationCommand =
  | { type: "draft"; value: string }
  | { type: "submit"; message?: string }
  | { type: "reply"; origin: string; message: string; questionId?: string }
  | { type: "stop" | "reset" | "resolve-pending" | "discard-pending" }
  | {
      type: "retry" | "skip-budget" | "open-editor" | "compare";
      origin: string;
    }
  | { type: "close-editor" | "apply-editor" }
  | {
      type: "edit";
      patch: Partial<
        Pick<
          PreferenceDraft,
          | "description"
          | "criteria"
          | "budget"
          | "minimumBudget"
          | "currency"
          | "region"
          | "responseLength"
        >
      >;
    };

function initialState(): ConversationState {
  return {
    turns: [],
    preferences: defaultIntent(),
    draft: "",
    activeTurnId: null,
    retryTurnId: null,
    editor: null,
  };
}

export function useConversation() {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const sequence = useRef(0);
  const task = useRef<{ key: number; controller: AbortController } | null>(
    null,
  );
  const turnSequence = useRef(0);
  function commit(next: ConversationState) {
    current.current = next;
    setState(next);
  }
  function cancel() {
    sequence.current++;
    task.current?.controller.abort();
    task.current = null;
    commit({
      ...current.current,
      activeTurnId: null,
      turns: current.current.turns.map((turn) =>
        turn.body.status === "pending"
          ? { ...turn, body: { status: "cancelled" } }
          : turn,
      ),
    });
  }
  useEffect(
    () => () => {
      task.current?.controller.abort();
      task.current = null;
    },
    [],
  );
  async function performTurn(id: string, request: RequestSnapshot) {
    const turn = current.current.turns.find((item) => item.id === id)!;
    const pending = {
      key: ++sequence.current,
      controller: new AbortController(),
    };
    task.current = pending;
    commit({
      ...current.current,
      turns: current.current.turns.map((turn) =>
        turn.id === id
          ? {
              ...turn,
              body: {
                status: "pending",
                key: pending.key,
                phase: turn.prepared ? "research" : "prepare",
              },
            }
          : turn,
      ),
    });
    try {
      let prepared = turn.prepared;
      let value =
        prepared ??
        (await runTurn(
          { phase: "prepare", ...request, operationId: turn.operationId },
          pending.controller.signal,
        ));
      if (task.current?.key !== pending.key) return;
      if (value.kind === "prepared") {
        prepared = value;
        commit({
          ...current.current,
          preferences: prepared.preferences,
          turns: current.current.turns.map((turn) =>
            turn.id === id
              ? {
                  ...turn,
                  prepared,
                  body: { status: "pending", key: pending.key, phase: "research" },
                }
              : turn,
          ),
        });
        value = await runTurn(
          {
            phase: "research",
            preferences: prepared.preferences,
            operationId: crypto.randomUUID(),
          },
          pending.controller.signal,
        );
        if (task.current?.key !== pending.key) return;
        if (value.kind === "prepared")
          throw new Error(
            "The research service returned an unreadable result.",
          );
      }
      task.current = null;
      commit({
        ...current.current,
        preferences: value.preferences,
        activeTurnId: id,
        retryTurnId: value.kind === "research-unavailable" && prepared ? id : null,
        turns: current.current.turns.map((turn) =>
          turn.id === id
            ? { ...turn, body: { status: "complete", value } }
            : turn,
        ),
      });
    } catch (error) {
      if (task.current?.key !== pending.key) return;
      task.current = null;
      commit({
        ...current.current,
        retryTurnId: id,
        turns: current.current.turns.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                body: {
                  status: "failed",
                  message:
                    error instanceof Error
                      ? error.message
                      : "Research could not finish. Try again.",
                },
              }
            : turn,
        ),
      });
    }
  }
  function submit(
    message: string,
    extra: Pick<RequestSnapshot, "edit" | "skipBudget"> = {},
  ) {
    if (!message.trim()) return;
    cancel();
    const request: RequestSnapshot = {
      message: message.trim(),
      preferences: structuredClone(current.current.preferences),
      ...(current.current.preferences.pendingChange
        ? { questionId: current.current.preferences.pendingChange.id }
        : {}),
      ...extra,
    };
    const id = `turn-${++turnSequence.current}`;
    commit({
      ...current.current,
      turns: [
        ...current.current.turns,
        {
          id,
          operationId: crypto.randomUUID(),
          request,
          message: message.trim(),
          body: { status: "cancelled" },
          prepared: null,
        },
      ],
      draft: "",
      editor: null,
      retryTurnId: id,
    });
    void performTurn(id, request);
  }
  function send(command: ConversationCommand) {
    const snapshot = current.current;
    switch (command.type) {
      case "draft":
        cancel();
        commit({ ...current.current, draft: command.value, retryTurnId: null });
        return;
      case "submit":
        return submit(command.message ?? snapshot.draft);
      case "reply":
        if (
          snapshot.activeTurnId === command.origin &&
          (!command.questionId ||
            command.questionId === snapshot.preferences.pendingChange?.id)
        )
          submit(command.message);
        return;
      case "compare":
        if (snapshot.activeTurnId === command.origin) submit("Compare options");
        return;
      case "skip-budget":
        if (snapshot.activeTurnId === command.origin)
          submit("Skip the budget for now", { skipBudget: true });
        return;
      case "resolve-pending":
        if (!snapshot.preferences.pendingChange) return;
        cancel();
        commit({
          ...current.current,
          draft: snapshot.preferences.pendingChange.message,
          editor: null,
          retryTurnId: null,
        });
        return;
      case "discard-pending":
        if (snapshot.preferences.pendingChange)
          submit("Discard the pending change", {
            edit: { kind: "discard-pending" },
          });
        return;
      case "stop":
        cancel();
        return;
      case "reset":
        cancel();
        commit(initialState());
        return;
      case "retry": {
        const turn = snapshot.turns.find((item) => item.id === command.origin);
        if (snapshot.retryTurnId !== command.origin || !turn || task.current)
          return;
        cancel();
        void performTurn(turn.id, turn.request);
        return;
      }
      case "open-editor": {
        if (snapshot.activeTurnId !== command.origin) return;
        cancel();
        const intent = snapshot.preferences;
        commit({
          ...current.current,
          activeTurnId: command.origin,
          editor: {
            turnId: command.origin,
            original: structuredClone(intent),
            description: intent.productDescription,
            criteria: intent.criteria.map(({ id, wording, strength }) => ({
              id,
              wording,
              strength,
            })),
            budget: intent.budget?.amount.toString() ?? "",
            minimumBudget: intent.budget?.minimum?.toString() ?? "",
            currency:
              intent.budget?.currency ??
              (intent.region === "SG" ? "SGD" : "USD"),
            region: intent.region,
            responseLength: intent.responseLength,
            error: null,
          },
        });
        return;
      }
      case "close-editor":
        commit({ ...snapshot, editor: null });
        return;
      case "edit": {
        if (!snapshot.editor) return;
        cancel();
        commit({
          ...current.current,
          retryTurnId: null,
          editor: { ...snapshot.editor, ...command.patch, error: null },
        });
        return;
      }
      case "apply-editor": {
        const editor = snapshot.editor;
        if (!editor) return;
        const budget = editor.budget.trim()
          ? BudgetSchema.safeParse({
              amount: Number(editor.budget),
              currency: editor.currency,
              ...(editor.minimumBudget.trim()
                ? { minimum: Number(editor.minimumBudget) }
                : {}),
            })
          : { success: true as const, data: null };
        if (
          !budget.success ||
          (!editor.budget.trim() && Boolean(editor.minimumBudget.trim())) ||
          !editor.description.trim() ||
          editor.criteria.some((item) => !item.wording.trim())
        ) {
          commit({
            ...snapshot,
            editor: {
              ...editor,
              error:
                !budget.success ||
                (!editor.budget.trim() && Boolean(editor.minimumBudget.trim()))
                  ? "Use positive budget amounts up to 1,000,000 with at most two decimal places. The minimum cannot exceed the maximum. Clear both fields to remove the budget."
                  : "Give the product description and each criterion some wording.",
            },
          });
          return;
        }
        const edits: Exclude<IntentEdit, { kind: "batch" }>[] = [];
        if (editor.description !== editor.original.productDescription)
          edits.push({ kind: "set-description", value: editor.description });
        if (
          JSON.stringify(budget.data) !== JSON.stringify(editor.original.budget)
        )
          edits.push({ kind: "set-budget", value: budget.data });
        if (editor.region !== editor.original.region)
          edits.push({ kind: "set-region", value: editor.region });
        if (editor.responseLength !== editor.original.responseLength)
          edits.push({
            kind: "set-response-length",
            value: editor.responseLength,
          });
        for (const original of editor.original.criteria)
          if (!editor.criteria.some((item) => item.id === original.id))
            edits.push({ kind: "remove-criterion", id: original.id });
        for (const criterion of editor.criteria) {
          if (!criterion.id)
            edits.push({
              kind: "add-criterion",
              wording: criterion.wording,
              strength: criterion.strength,
            });
          else {
            const original = editor.original.criteria.find(
              (item) => item.id === criterion.id,
            )!;
            if (
              original.wording !== criterion.wording ||
              original.strength !== criterion.strength
            )
              edits.push({
                kind: "replace-criterion",
                id: criterion.id,
                wording: criterion.wording,
                strength: criterion.strength,
              });
          }
        }
        if (!edits.length) {
          commit({ ...snapshot, editor: null });
          return;
        }
        submit("Update preferences", { edit: { kind: "batch", edits } });
      }
    }
  }
  return {
    ...state,
    send,
    pending: state.turns.some((turn) => turn.body.status === "pending"),
  };
}
