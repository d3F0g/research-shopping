// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { initialConversation, type ConversationState } from "../../src/domain/conversation";
import { useFieldnote } from "../../src/client/useFieldnote";

type Pending = {
  path: string;
  signal?: AbortSignal | null;
  resolve: (body: unknown) => void;
  reject: () => void;
};
function transport() {
  const pending: Pending[] = [];
  vi.stubGlobal("fetch", vi.fn((path: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
    pending.push({ path, signal: init.signal, resolve: (body) => resolve({ ok: true, json: async () => body } as Response), reject: () => reject(new Error("Fixture transport failure")) });
  })));
  async function take(path: string) {
    await waitFor(() => expect(pending.some((entry) => entry.path === path)).toBe(true));
    return pending.splice(pending.findIndex((entry) => entry.path === path), 1)[0]!;
  }
  async function respond(path: string, body: unknown) {
    const request = await take(path);
    await act(async () => request.resolve(body));
    return request;
  }
  return { pending, take, respond };
}
function conversation(text: string): ConversationState {
  return { ...initialConversation(), revision: 1, messages: [{ id: "fixture-user", role: "user", text }, { id: "fixture-assistant", role: "assistant", text: "Fixture reply" }] };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

for (const endpoint of ["account", "session"]) {
  for (const outcome of ["success", "failure"]) {
    test(`replaced ${endpoint} ${outcome} cannot clear the next transport owner or publish stale state`, async () => {
      const net = transport();
      const hook = renderHook(useFieldnote);
      if (endpoint === "session") await net.respond("/api/account", { status: "guest-only" });
      const old = await net.take(`/api/${endpoint}`);
      act(() => { hook.result.current.setDraft("Fixture retained draft"); void hook.result.current.reload(); });
      expect(old.signal?.aborted).toBe(true);
      const next = await net.take("/api/account");
      await act(async () => outcome === "failure" ? old.reject() : old.resolve(endpoint === "account" ? { status: "unavailable" } : { state: conversation("Fixture stale") }));
      expect(hook.result.current.account.status).toBe("loading");
      expect(hook.result.current.error).toBe("");
      expect(hook.result.current.draft).toBe("Fixture retained draft");
      expect(net.pending).toHaveLength(0);
      act(() => { void hook.result.current.reload(); });
      expect(next.signal?.aborted).toBe(true);
      await net.respond("/api/account", { status: "guest-only" });
      const current = conversation("Fixture current");
      await net.respond("/api/session", { state: current });
      expect(hook.result.current.state).toEqual(current);
      expect(hook.result.current.ready).toBe(true);
      await act(async () => next.reject());
      expect(hook.result.current.state).toEqual(current);
      expect(hook.result.current.error).toBe("");
      expect(hook.result.current.draft).toBe("Fixture retained draft");
    });

    test(`current ${endpoint} ${outcome} retains the draft and supports a fresh explicit reload`, async () => {
      const net = transport();
      const hook = renderHook(useFieldnote);
      act(() => hook.result.current.setDraft("Fixture retained draft"));
      if (endpoint === "session") await net.respond("/api/account", { status: "guest-only" });
      const current = await net.take(`/api/${endpoint}`);
      await act(async () => outcome === "failure" ? current.reject() : current.resolve(endpoint === "account" ? { status: "guest-only" } : { state: conversation("Fixture restored") }));
      if (outcome === "success" && endpoint === "account") await net.respond("/api/session", { state: conversation("Fixture restored") });
      expect(hook.result.current.ready).toBe(outcome === "success");
      expect(hook.result.current.error.length > 0).toBe(outcome === "failure");
      expect(hook.result.current.draft).toBe("Fixture retained draft");
      expect(net.pending).toHaveLength(0);
      act(() => { void hook.result.current.reload(); });
      await net.respond("/api/account", { status: "guest-only" });
      const recovered = conversation("Fixture recovered");
      await net.respond("/api/session", { state: recovered });
      expect(hook.result.current.state).toEqual(recovered);
      expect(hook.result.current.ready).toBe(true);
      expect(hook.result.current.error).toBe("");
      expect(hook.result.current.draft).toBe("Fixture retained draft");
    });

    for (const invalidation of endpoint === "account" ? ["submission", "generation"] : ["generation"]) {
      test(`${invalidation} invalidates late ${endpoint} ${outcome} without accepting a stale snapshot`, async () => {
        const net = transport();
        const hook = renderHook(useFieldnote);
        await net.respond("/api/account", { status: "guest-only" });
        await net.respond("/api/session", { state: initialConversation() });
        act(() => {
          void hook.result.current.reload();
          if (invalidation === "submission") void hook.result.current.send("hello");
        });
        if (endpoint === "session") {
          const account = await net.take("/api/account");
          await act(async () => account.resolve({ status: "guest-only" }));
        }
        const obsolete = await net.take(`/api/${endpoint}`);
        if (invalidation === "generation") act(() => { void hook.result.current.stop(); });
        expect(obsolete.signal?.aborted).toBe(true);
        const accepted = conversation("hello");
        await net.respond(invalidation === "generation" ? "/api/cancel" : "/api/turn", { kind: "message", state: accepted });
        act(() => hook.result.current.setDraft("Fixture newer draft"));
        const before = { state: hook.result.current.state, account: hook.result.current.account, draft: hook.result.current.draft, ready: hook.result.current.ready, error: hook.result.current.error };
        await act(async () => outcome === "failure" ? obsolete.reject() : obsolete.resolve(endpoint === "account" ? { status: "unavailable" } : { state: initialConversation() }));
        expect({ state: hook.result.current.state, account: hook.result.current.account, draft: hook.result.current.draft, ready: hook.result.current.ready, error: hook.result.current.error }).toEqual(before);
        expect(hook.result.current.state).toEqual(accepted);
        expect(hook.result.current.ready).toBe(false);
        expect(net.pending).toHaveLength(0);
      });
    }
  }
}

test("unmount aborts the account and session lifetime", async () => {
  const net = transport();
  const first = renderHook(useFieldnote);
  const account = await net.take("/api/account");
  first.unmount();
  expect(account.signal?.aborted).toBe(true);
  const second = renderHook(useFieldnote);
  const current = await net.respond("/api/account", { status: "guest-only" });
  const session = await net.take("/api/session");
  expect(session.signal).toBe(current.signal);
  second.unmount();
  expect(session.signal?.aborted).toBe(true);
});

for (const endpoint of ["account", "session"]) {
  test(`an unready send cannot abort the current ${endpoint} read`, async () => {
    const net = transport();
    const hook = renderHook(useFieldnote);
    if (endpoint === "session") await net.respond("/api/account", { status: "guest-only" });
    const current = await net.take(`/api/${endpoint}`);
    await act(async () => hook.result.current.send("hello"));
    expect(current.signal?.aborted).toBe(false);
    expect(net.pending).toHaveLength(0);
    await act(async () => current.resolve(endpoint === "account" ? { status: "guest-only" } : { state: initialConversation() }));
    if (endpoint === "account") await net.respond("/api/session", { state: initialConversation() });
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.state.messages).toEqual([]);
  });
}

test("a current unavailable account response requires explicit recovery", async () => {
  const net = transport();
  const hook = renderHook(useFieldnote);
  act(() => hook.result.current.setDraft("Fixture retained draft"));
  await net.respond("/api/account", { status: "unavailable" });
  expect(hook.result.current.account.status).toBe("unavailable");
  expect(hook.result.current.ready).toBe(false);
  expect(hook.result.current.error).toContain("Account persistence is unavailable");
  expect(net.pending).toHaveLength(0);
  act(() => { void hook.result.current.reload(); });
  await net.respond("/api/account", { status: "guest-only" });
  await net.respond("/api/session", { state: initialConversation() });
  expect(hook.result.current.ready).toBe(true);
  expect(hook.result.current.error).toBe("");
  expect(hook.result.current.draft).toBe("Fixture retained draft");
});
