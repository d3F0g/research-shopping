import { useEffect, useRef, useState } from "react";
import {
  defaultPreferences,
  type Category,
  type Currency,
  type Preferences,
  type ProductId,
  type SelectionResult,
  type TurnResponse,
} from "../domain/contracts";
import {
  conversationalReply,
  updatePreferences,
  validBudgetAmount,
} from "../domain/preferences";
import type { WebResearchResponse } from "../domain/web-research";
import { researchShortlist, runTurn, selectProduct } from "./api";
import { featureOptions, priorityOptions } from "./preference-options";

export type TaskState<T> =
  | { status: "idle" }
  | { status: "cancelled" }
  | { status: "pending"; key: number }
  | { status: "complete"; value: T }
  | { status: "failed"; message: string };

type RequestSnapshot = { message: string; preferences: Preferences };
export type ConversationTurn = {
  id: string;
  request: RequestSnapshot;
  message: string;
  body:
    | Exclude<TaskState<TurnResponse>, { status: "idle" }>
    | { status: "question"; question: "budget"; preferences: Preferences };
  selection: TaskState<SelectionResult>;
  selectingId: ProductId | null;
  sources: TaskState<WebResearchResponse>;
};

type PreferenceDraft = {
  turnId: string;
  preferences: Preferences;
  budget: string;
  currency: Currency;
  brands: string;
  error: string | null;
  note: string | null;
};
type BudgetContext = `${Category}:${Preferences["hard"]["region"]}`;
type ConversationState = {
  turns: ConversationTurn[];
  preferences: Preferences;
  draft: string;
  activeTurnId: string | null;
  retryTurnId: string | null;
  editor: PreferenceDraft | null;
  budgetQuestions: BudgetContext[];
};
export type ConversationCommand =
  | { type: "draft"; value: string }
  | { type: "submit"; message?: string }
  | { type: "reply"; origin: string; message: string }
  | { type: "stop" | "reset" }
  | { type: "retry"; origin: string }
  | { type: "select"; origin: string; productId: ProductId }
  | { type: "sources"; origin: string }
  | { type: "skip-budget"; origin: string }
  | { type: "open-editor"; origin: string }
  | { type: "close-editor" | "apply-editor" }
  | { type: "edit-preferences"; preferences: Preferences }
  | { type: "edit-category"; category: Category | null }
  | { type: "edit-budget"; value: string; currency: Currency }
  | { type: "edit-currency"; currency: Currency }
  | { type: "edit-brands"; value: string };

function initialState(): ConversationState {
  return {
    turns: [],
    preferences: defaultPreferences(),
    draft: "",
    activeTurnId: null,
    retryTurnId: null,
    editor: null,
    budgetQuestions: [],
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
  function updateTurn(
    id: string,
    update: (turn: ConversationTurn) => ConversationTurn,
  ) {
    commit({
      ...current.current,
      turns: current.current.turns.map((turn) =>
        turn.id === id ? update(turn) : turn,
      ),
    });
  }
  function cancel(revoke = true) {
    sequence.current += 1;
    task.current?.controller.abort();
    task.current = null;
    commit({
      ...current.current,
      activeTurnId: revoke ? null : current.current.activeTurnId,
      turns: current.current.turns.map((turn) => ({
        ...turn,
        body:
          turn.body.status === "pending" ? { status: "cancelled" } : turn.body,
        selection:
          turn.selection.status === "pending"
            ? { status: "cancelled" }
            : turn.selection,
        selectingId: null,
        sources:
          turn.sources.status === "pending"
            ? { status: "cancelled" }
            : turn.sources,
      })),
    });
  }
  function begin() {
    const request = {
      key: ++sequence.current,
      controller: new AbortController(),
    };
    task.current = request;
    return request;
  }
  function accepts(key: number) {
    return task.current?.key === key;
  }

  useEffect(
    () => () => {
      task.current?.controller.abort();
      task.current = null;
    },
    [],
  );

  async function performTurn(id: string, request: RequestSnapshot) {
    const pending = begin();
    updateTurn(id, (turn) => ({
      ...turn,
      body: { status: "pending", key: pending.key },
    }));
    try {
      const value = await runTurn(
        request.message,
        request.preferences,
        pending.controller.signal,
      );
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(id, (turn) => ({
        ...turn,
        body: { status: "complete", value },
      }));
      commit({
        ...current.current,
        preferences: value.preferences ?? current.current.preferences,
        activeTurnId: id,
        retryTurnId: value.kind === "error" && value.retryable ? id : null,
      });
    } catch (error) {
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(id, (turn) => ({
        ...turn,
        body: {
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Research could not finish. Try again.",
        },
      }));
    }
  }

  function submit(
    message: string,
    preferences = current.current.preferences,
    displayMessage = message,
    askBudget = true,
  ) {
    if (!message.trim() || current.current.editor?.error) return;
    cancel();
    const request = {
      message: message.trim(),
      preferences: structuredClone(preferences),
    };
    const id = `turn-${++turnSequence.current}`;
    const turn: ConversationTurn = {
      id,
      request,
      message: displayMessage.trim(),
      body: { status: "cancelled" },
      selection: { status: "idle" },
      selectingId: null,
      sources: { status: "idle" },
    };
    commit({
      ...current.current,
      turns: [...current.current.turns, turn],
      draft: "",
      editor: null,
      retryTurnId: id,
    });
    const parsed = updatePreferences(request.message, request.preferences);
    const category = parsed.preferences.hard.category;
    const context: BudgetContext | null = category
      ? `${category}:${parsed.preferences.hard.region}`
      : null;
    if (
      askBudget &&
      !conversationalReply(request.message, request.preferences) &&
      !parsed.clarification &&
      context &&
      !parsed.preferences.hard.budget &&
      !current.current.budgetQuestions.includes(context) &&
      !parsed.budgetRemoved
    ) {
      updateTurn(id, (item) => ({
        ...item,
        body: {
          status: "question",
          question: "budget",
          preferences: parsed.preferences,
        },
      }));
      commit({
        ...current.current,
        preferences: parsed.preferences,
        activeTurnId: id,
        retryTurnId: null,
        budgetQuestions: [...current.current.budgetQuestions, context],
      });
      return;
    }
    void performTurn(id, request);
  }

  async function select(origin: string, productId: ProductId) {
    const turn = current.current.turns.find((item) => item.id === origin);
    if (
      current.current.activeTurnId !== origin ||
      turn?.body.status !== "complete" ||
      turn.body.value.kind !== "recommendations" ||
      !turn.body.value.candidates.some(
        (candidate) => candidate.product.id === productId,
      ) ||
      turn.selection.status === "pending"
    )
      return;
    cancel(false);
    const pending = begin();
    const preferences = structuredClone(current.current.preferences);
    updateTurn(origin, (item) => ({
      ...item,
      selection: { status: "pending", key: pending.key },
      selectingId: productId,
    }));
    try {
      const value = await selectProduct(
        productId,
        preferences,
        pending.controller.signal,
      );
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(origin, (item) => ({
        ...item,
        selection: { status: "complete", value },
        selectingId: null,
      }));
    } catch (error) {
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(origin, (item) => ({
        ...item,
        selection: {
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "The sample handoff is unavailable.",
        },
        selectingId: null,
      }));
    }
  }

  async function sources(origin: string) {
    const turn = current.current.turns.find((item) => item.id === origin);
    if (
      current.current.activeTurnId !== origin ||
      turn?.body.status !== "complete" ||
      turn.body.value.kind !== "recommendations" ||
      task.current
    )
      return;
    const pending = begin();
    updateTurn(origin, (item) => ({
      ...item,
      sources: { status: "pending", key: pending.key },
    }));
    try {
      const value = await researchShortlist(
        {
          productIds: turn.body.value.candidates.map(
            ({ product }) => product.id,
          ),
          preferences: current.current.preferences,
        },
        pending.controller.signal,
      );
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(origin, (item) => ({
        ...item,
        sources: { status: "complete", value },
      }));
    } catch (error) {
      if (!accepts(pending.key)) return;
      task.current = null;
      updateTurn(origin, (item) => ({
        ...item,
        sources: {
          status: "failed",
          message:
            error instanceof Error
              ? error.message
              : "Web research could not finish. Try again.",
        },
      }));
    }
  }

  function edit(patch: Partial<PreferenceDraft>) {
    if (!current.current.editor) return;
    cancel();
    commit({
      ...current.current,
      retryTurnId: null,
      editor: { ...current.current.editor!, ...patch },
    });
  }
  function editBudget(value: string, currency: Currency) {
    const editor = current.current.editor;
    if (!editor) return;
    const amount = Number(value);
    const valid = !value.trim() || validBudgetAmount(amount);
    edit({
      budget: value,
      currency,
      error: valid
        ? null
        : "Enter a positive amount up to 1,000,000 with at most two decimal places, or clear the budget cap.",
      preferences: valid
        ? {
            ...editor.preferences,
            hard: {
              ...editor.preferences.hard,
              budget: value.trim() ? { amount, currency } : null,
            },
          }
        : editor.preferences,
    });
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
        if (snapshot.activeTurnId === command.origin) submit(command.message);
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
      case "select":
        void select(command.origin, command.productId);
        return;
      case "sources":
        void sources(command.origin);
        return;
      case "skip-budget":
        if (snapshot.activeTurnId === command.origin)
          submit(
            "Show options",
            snapshot.preferences,
            "Skip the budget for now",
          );
        return;
      case "open-editor":
        if (snapshot.activeTurnId !== command.origin) return;
        commit({
          ...snapshot,
          editor: {
            turnId: command.origin,
            preferences: structuredClone(snapshot.preferences),
            budget: snapshot.preferences.hard.budget?.amount.toString() ?? "",
            currency:
              snapshot.preferences.hard.budget?.currency ??
              (snapshot.preferences.hard.region === "SG" ? "SGD" : "USD"),
            brands: snapshot.preferences.hard.excludedBrands.join(", "),
            error: null,
            note: null,
          },
        });
        return;
      case "close-editor":
        commit({ ...snapshot, editor: null });
        return;
      case "edit-preferences":
        edit({ preferences: command.preferences });
        return;
      case "edit-brands":
        edit({ brands: command.value });
        return;
      case "edit-budget":
        editBudget(command.value, command.currency);
        return;
      case "edit-currency":
        if (snapshot.editor)
          editBudget(snapshot.editor.budget, command.currency);
        return;
      case "edit-category": {
        if (!snapshot.editor) return;
        const preferences = snapshot.editor.preferences;
        const features = featureOptions[command.category ?? "headphones"].map(
          ({ value }) => value,
        );
        const priorities = priorityOptions[
          command.category ?? "headphones"
        ].map(({ value }) => value);
        const requiredFeatures = preferences.hard.requiredFeatures.filter(
          (feature) => command.category && features.includes(feature),
        );
        const keptPriorities = preferences.soft.priorities.filter(
          (priority) => command.category && priorities.includes(priority),
        );
        const removed = [
          ...preferences.hard.requiredFeatures
            .filter((feature) => !requiredFeatures.includes(feature))
            .map((feature) => feature.replaceAll("-", " ")),
          ...preferences.soft.priorities
            .filter((priority) => !keptPriorities.includes(priority))
            .map((priority) => `${priority.replaceAll("-", " ")} priority`),
        ];
        edit({
          preferences: {
            hard: {
              ...preferences.hard,
              category: command.category,
              requiredFeatures,
            },
            soft: { ...preferences.soft, priorities: keptPriorities },
          },
          note: removed.length
            ? `Cleared ${removed.join(", ")} because they do not apply to ${command.category ?? "an unspecified category"}.`
            : null,
        });
        return;
      }
      case "apply-editor": {
        const editor = snapshot.editor;
        if (!editor || editor.error) return;
        const preferences = {
          ...editor.preferences,
          hard: {
            ...editor.preferences.hard,
            excludedBrands: editor.brands
              .split(",")
              .map((brand) => brand.trim())
              .filter(Boolean),
          },
        };
        const budget = preferences.hard.budget;
        submit(
          "Show options",
          preferences,
          `Update preferences. ${preferences.hard.category ?? "Choose a category"}${budget ? `, under ${budget.currency} ${budget.amount}` : ", no budget cap"}.`,
          false,
        );
      }
    }
  }

  return {
    ...state,
    send,
    pending: state.turns.some((turn) => turn.body.status === "pending"),
  };
}
