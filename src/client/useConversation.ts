import type {
  AccountState,
  WorkspaceAction,
  WorkspaceSnapshot,
} from "../domain/workspace";
import { useEffect, useRef, useState } from "react";
import {
  defaultPreferences,
  type Category,
  type Currency,
  type Preferences,
  type ProductId,
  type SelectionResult,
} from "../domain/contracts";
import { validBudgetAmount } from "../domain/preferences";
import {
  conversationPolicy,
  preferenceDisplay,
} from "../domain/conversation-policy";
import type { ApplicationTurnResponse as TurnResponse } from "../domain/research";
import type { WebResearchResponse } from "../domain/web-research";
import {
  accountAction,
  loadAccount,
  workspaceCommand,
  researchShortlist,
  runTurn,
  selectProduct,
} from "./api";
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
type BudgetContext = string;
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
  const [account, setAccount] = useState<AccountState | { status: "loading" }>({
    status: "loading",
  });
  const accountRef = useRef(account);
  const accountGeneration = useRef(0);
  const hydration = useRef<AbortController | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const savedOperation = useRef<string | null>(null);
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

  function setIdentity(value: AccountState | { status: "loading" }) {
    accountRef.current = value;
    setAccount(value);
  }
  function invalidateAccount() {
    accountGeneration.current++;
    hydration.current?.abort();
    hydration.current = null;
    savedOperation.current = null;
    cancel();
  }
  function restore(workspace: WorkspaceSnapshot, active = false) {
    const turns: ConversationTurn[] = workspace.turns.map((turn) => ({
      id: turn.id,
      request: turn.request,
      message: turn.message,
      body:
        turn.body.status === "pending"
          ? { status: "cancelled" }
          : turn.body.status === "interrupted"
            ? {
                status: "failed",
                message:
                  turn.body.reason === "too-large"
                    ? "This response exceeded the saved-history limit. Ask for a narrower result."
                    : "This response was interrupted. Send a new message to continue.",
              }
            : turn.body,
      selection: { status: "idle" },
      selectingId: null,
      sources: { status: "idle" },
    }));
    commit({
      ...initialState(),
      preferences: workspace.preferences,
      budgetQuestions: workspace.budgetQuestions,
      turns,
      activeTurnId: active ? (turns.at(-1)?.id ?? null) : null,
    });
    const identity = accountRef.current;
    if (identity.status === "signed-in")
      setIdentity({ ...identity, workspace });
  }
  async function refreshAccount(clear = false) {
    const previous = accountRef.current;
    if (clear) {
      invalidateAccount();
      commit(initialState());
    }
    const generation = accountGeneration.current;
    hydration.current?.abort();
    const controller = new AbortController();
    hydration.current = controller;
    try {
      const value = await loadAccount(controller.signal);
      if (controller.signal.aborted || generation !== accountGeneration.current)
        return;
      if (value.status === "signed-in") {
        if (
          previous.status !== "signed-in" ||
          previous.user.id !== value.user.id ||
          previous.workspace.revision !== value.workspace.revision ||
          clear
        ) {
          cancel();
          setIdentity(value);
          restore(value.workspace);
        } else setIdentity(value);
      } else {
        if (previous.status === "signed-in" || previous.status === "loading") {
          cancel();
          commit(initialState());
        }
        if (previous.status === "signed-in" && value.status === "guest")
          setAccountError(
            "Your session ended. Sign in to save future messages. New messages stay only in this guest tab.",
          );
        if (value.status === "unavailable")
          setAccountError(
            "Account persistence is unavailable. Reload before continuing.",
          );
        setIdentity(value);
      }
    } catch {
      if (
        !controller.signal.aborted &&
        generation === accountGeneration.current
      ) {
        setIdentity({ status: "unavailable" });
        setAccountError(
          "Account connection is unavailable. Reload before continuing.",
        );
      }
    }
  }
  function notifyAccountChange() {
    try {
      localStorage.setItem("fieldnote-account-change", crypto.randomUUID());
    } catch {}
  }
  useEffect(() => {
    void refreshAccount();
    const focus = () => {
      if (!savedOperation.current) void refreshAccount();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "fieldnote-account-change") void refreshAccount(true);
    };
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    return () => {
      hydration.current?.abort();
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, []);

  async function authenticate(
    action: "sign-in/email" | "sign-up/email" | "sign-out",
    body: Record<string, string> = {},
  ) {
    const previous = accountRef.current;
    invalidateAccount();
    commit(initialState());
    setAccountError(null);
    setIdentity({ status: "loading" });
    const generation = accountGeneration.current;
    const controller = new AbortController();
    hydration.current = controller;
    try {
      await accountAction(action, body, controller.signal);
      if (generation !== accountGeneration.current) return false;
      notifyAccountChange();
      await refreshAccount(true);
      return true;
    } catch (error) {
      if (generation !== accountGeneration.current) return false;
      setIdentity(previous);
      setAccountError(
        error instanceof Error
          ? error.message
          : "Account request did not complete.",
      );
      return false;
    }
  }
  async function savedCommand(command: WorkspaceAction) {
    const identity = accountRef.current;
    if (identity.status !== "signed-in") return;
    invalidateAccount();
    const generation = accountGeneration.current;
    const operationId = crypto.randomUUID();
    savedOperation.current =
      command.kind === "cancel" ||
      command.kind === "new-chat" ||
      command.kind === "delete-saved-data"
        ? null
        : operationId;
    const pending = begin();
    setAccountError(null);
    if (command.kind === "new-chat" || command.kind === "delete-saved-data")
      commit(initialState());
    else if (command.kind !== "cancel") {
      const message =
        command.kind === "message"
          ? command.text
          : command.kind === "skip-budget"
            ? "Skip the budget for now"
            : preferenceDisplay(command.preferences);
      commit({
        ...current.current,
        draft: "",
        editor: null,
        activeTurnId: null,
        turns: [
          ...current.current.turns,
          {
            id: operationId,
            message,
            request: { message, preferences: current.current.preferences },
            body: { status: "pending", key: pending.key },
            selection: { status: "idle" },
            selectingId: null,
            sources: { status: "idle" },
          },
        ],
      });
    }
    try {
      let revision = identity.workspace.revision;
      if (
        command.kind === "new-chat" ||
        command.kind === "delete-saved-data" ||
        command.kind === "cancel" ||
        command.kind === "apply-preferences"
      ) {
        const latest = await loadAccount(pending.controller.signal);
        if (generation !== accountGeneration.current) return;
        if (
          latest.status !== "signed-in" ||
          latest.user.id !== identity.user.id
        )
          throw new Error("Your account changed. Reload before continuing.");
        revision = latest.workspace.revision;
        if (
          command.kind === "cancel" &&
          latest.workspace.pendingOperationId !== command.target
        ) {
          restore(latest.workspace);
          return;
        }
      }
      const result = await workspaceCommand(
        { revision, operationId, command },
        pending.controller.signal,
      );
      if (!accepts(pending.key) || generation !== accountGeneration.current)
        return;
      task.current = null;
      restore(result.workspace, true);
      notifyAccountChange();
    } catch (error) {
      if (!accepts(pending.key) || generation !== accountGeneration.current)
        return;
      task.current = null;
      cancel();
      setAccountError(
        error instanceof Error
          ? error.message
          : "Saved conversation could not be updated.",
      );
      await refreshAccount();
    } finally {
      if (generation === accountGeneration.current) {
        savedOperation.current = null;
        task.current = null;
      }
    }
  }
  function stopSaved() {
    const target =
      savedOperation.current ??
      (accountRef.current.status === "signed-in"
        ? accountRef.current.workspace.pendingOperationId
        : null);
    if (target) void savedCommand({ kind: "cancel", target });
    else cancel();
  }

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
    if (accountRef.current.status === "signed-in") {
      void savedCommand({ kind: "message", text: message.trim() });
      return;
    }
    if (
      accountRef.current.status === "loading" ||
      accountRef.current.status === "unavailable"
    )
      return;
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
    const parsed = conversationPolicy(request.message, request.preferences);
    const context = parsed.budgetContext;
    if (
      askBudget &&
      context &&
      !current.current.budgetQuestions.includes(context)
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
        if (savedOperation.current) stopSaved();
        else if (accountRef.current.status !== "signed-in") cancel();
        commit({ ...current.current, draft: command.value, retryTurnId: null });
        return;
      case "submit":
        return submit(command.message ?? snapshot.draft);
      case "reply":
        if (snapshot.activeTurnId === command.origin) submit(command.message);
        return;
      case "stop":
        if (accountRef.current.status === "signed-in") {
          stopSaved();
          return;
        }
        cancel();
        return;
      case "reset":
        if (accountRef.current.status === "signed-in") {
          void savedCommand({ kind: "new-chat" });
          return;
        }
        if (
          accountRef.current.status === "loading" ||
          accountRef.current.status === "unavailable"
        )
          return;
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
        if (accountRef.current.status === "signed-in") {
          if (snapshot.activeTurnId === command.origin)
            void savedCommand({ kind: "skip-budget" });
          return;
        }
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
        if (accountRef.current.status === "signed-in") {
          void savedCommand({ kind: "apply-preferences", preferences });
          return;
        }
        submit(
          "Show options",
          preferences,
          preferenceDisplay(preferences),
          false,
        );
      }
    }
  }

  return {
    ...state,
    account,
    accountError,
    authenticate,
    reloadAccount: () => {
      setAccountError(null);
      return refreshAccount(true);
    },
    deleteSaved: () => savedCommand({ kind: "delete-saved-data" }),
    accountBlocked:
      account.status === "loading" || account.status === "unavailable",
    send,
    pending: state.turns.some((turn) => turn.body.status === "pending"),
  };
}
