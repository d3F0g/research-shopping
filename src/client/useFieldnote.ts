import { useEffect, useRef, useState } from "react";
import {
  initialConversation,
  type ConversationState,
  type PrepareInput,
} from "../domain/conversation";
import type {
  AccountState,
  WorkspaceCommand,
  WorkspaceResult,
} from "../domain/workspace";
import { api, getSession, prepare, research } from "./api";

type VisibleAccount = AccountState | { status: "loading" };
export function useFieldnote() {
  const [state, setState] = useState(initialConversation);
  const [account, setAccount] = useState<VisibleAccount>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState<"preparing" | "researching" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [focusMessage, setFocusMessage] = useState<string | null>(null);
  const accountRef = useRef(account);
  const generation = useRef(0);
  const submission = useRef(0);
  const active = useRef<AbortController | null>(null);
  const preparing = useRef<AbortController | null>(null);
  function updateAccount(next: VisibleAccount) {
    accountRef.current = next;
    setAccount(next);
  }
  function accept(next: ConversationState, focus = false) {
    setState((before) => (next.revision >= before.revision ? next : before));
    if (focus) setFocusMessage(next.messages.at(-1)?.id ?? null);
  }
  function acceptWorkspace(result: WorkspaceResult, focus = false) {
    const before = accountRef.current;
    if (before.status !== "signed-in") return;
    if (result.workspace.revision < before.workspace.revision) return;
    updateAccount({ ...before, workspace: result.workspace });
    setState(result.workspace.state);
    if (focus)
      setFocusMessage(result.workspace.state.messages.at(-1)?.id ?? null);
  }
  async function reload() {
    setReady(false);
    try {
      const next = await api<AccountState>("/api/account");
      updateAccount(next);
      if (next.status === "unavailable") {
        setError(
          "Account persistence is unavailable. Reload your account before continuing.",
        );
        return;
      }
      if (next.status === "signed-in") setState(next.workspace.state);
      else setState((await getSession()).state);
      setError("");
      setReady(true);
    } catch {
      updateAccount({ status: "unavailable" });
      setError(
        "The server is unavailable. Your draft is retained. Reload your account when it returns.",
      );
    }
  }
  useEffect(() => {
    void reload();
    return () => {
      preparing.current?.abort();
    };
  }, []);
  async function workspace(command: WorkspaceCommand, signal?: AbortSignal) {
    return api<WorkspaceResult>("/api/workspace", command, signal);
  }
  async function send(
    text: string,
    questionId?: string,
    edit?: PrepareInput["edit"],
    expectedRevision?: number,
  ) {
    if (!text.trim() || !ready || resetting) return;
    preparing.current?.abort();
    const prepareController = new AbortController();
    preparing.current = prepareController;
    const ownSubmission = ++submission.current;
    const input: PrepareInput = {
      phase: "prepare",
      operationId: crypto.randomUUID(),
      message: text,
      ...(questionId ? { questionId } : {}),
      ...(edit ? { edit, expectedRevision } : {}),
    };
    setError("");
    if (!active.current) setActivity("preparing");
    setDraft("");
    try {
      const owner = accountRef.current;
      let preparedId: string | null = null;
      if (owner.status === "signed-in") {
        const result = await workspace(
          { ...input, revision: owner.workspace.revision },
          prepareController.signal,
        );
        if (ownSubmission !== submission.current) return;
        acceptWorkspace(result, true);
        if (result.response?.kind === "prepared")
          preparedId = result.response.preparedId;
      } else if (owner.status === "guest" || owner.status === "guest-only") {
        const result = await prepare(input, prepareController.signal);
        if (ownSubmission !== submission.current) return;
        accept(result.state, true);
        if (result.kind === "prepared") preparedId = result.preparedId;
      } else throw new Error("Account is unavailable");
      if (!preparedId) {
        if (!active.current) setActivity(null);
        return;
      }
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const ownGeneration = ++generation.current;
      setActivity("researching");
      try {
        const current = accountRef.current;
        if (current.status === "signed-in") {
          const result = await workspace(
            {
              phase: "research",
              revision: current.workspace.revision,
              preparedId,
            },
            controller.signal,
          );
          if (ownGeneration === generation.current)
            acceptWorkspace(result, true);
        } else {
          const result = await research(preparedId, controller.signal);
          if (ownGeneration === generation.current) {
            const fresh = await getSession();
            if (ownGeneration === generation.current)
              accept(
                fresh.state.revision >= result.state.revision
                  ? fresh.state
                  : result.state,
                true,
              );
          }
        }
      } finally {
        if (ownGeneration === generation.current) {
          active.current = null;
          setActivity(null);
        }
      }
    } catch {
      if (
        !prepareController.signal.aborted &&
        ownSubmission === submission.current
      ) {
        setError(
          "The request could not finish. Your accepted preferences are retained. No automatic retry was sent. Reload saved conversation if another tab changed it.",
        );
        setDraft(text);
      }
      if (!active.current) setActivity(null);
    } finally {
      if (preparing.current === prepareController) preparing.current = null;
    }
  }
  function interrupt() {
    generation.current++;
    submission.current++;
    preparing.current?.abort();
    active.current?.abort();
    preparing.current = null;
    active.current = null;
    setActivity(null);
    setResetting(false);
  }
  async function stop() {
    interrupt();
    const current = accountRef.current;
    try {
      if (current.status === "signed-in") {
        if (current.workspace.pendingOperationId)
          acceptWorkspace(
            await workspace({
              phase: "cancel",
              revision: current.workspace.revision,
              operationId: crypto.randomUUID(),
              target: current.workspace.pendingOperationId,
            }),
          );
      } else
        accept(
          (await api<{ state: ConversationState }>("/api/cancel", {})).state,
        );
    } catch {
      setError(
        "The server could not confirm cancellation. No automatic retry was sent.",
      );
    }
  }
  async function reset() {
    if (!ready || resetting) return;
    interrupt();
    const ownGeneration = generation.current;
    setResetting(true);
    setDraft("");
    setFocusMessage(null);
    setError("");
    try {
      const current = accountRef.current;
      if (current.status === "signed-in") {
        const result = await workspace({
          phase: "new-chat",
          revision: current.workspace.revision,
          operationId: crypto.randomUUID(),
        });
        if (ownGeneration === generation.current) acceptWorkspace(result);
      } else {
        const result = await api<{ state: ConversationState }>(
          "/api/new-chat",
          {},
        );
        if (ownGeneration === generation.current) setState(result.state);
      }
    } catch {
      if (ownGeneration === generation.current)
        setError(
          "The server could not start a new chat. Your history stays visible.",
        );
    } finally {
      if (ownGeneration === generation.current) setResetting(false);
    }
  }
  async function authenticated() {
    interrupt();
    await api("/api/cancel", {});
    await reload();
  }
  async function signOut() {
    await stop();
    await api("/api/auth/sign-out", {});
    await api("/api/new-chat", {});
    await reload();
  }
  async function deleteSaved() {
    interrupt();
    const current = accountRef.current;
    if (current.status !== "signed-in") throw new Error("Sign in first");
    acceptWorkspace(
      await workspace({
        phase: "delete-saved-data",
        revision: current.workspace.revision,
        operationId: crypto.randomUUID(),
      }),
    );
  }
  return {
    state,
    account,
    draft,
    setDraft,
    activity,
    error,
    ready: ready && !resetting,
    focusMessage,
    send,
    stop,
    reset,
    reload,
    authenticated,
    signOut,
    deleteSaved,
  };
}
