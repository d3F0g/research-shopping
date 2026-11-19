import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { defaultIntent } from "../../src/domain/contracts";
import { offlineNetwork } from "../network";
import { material } from "../inputs/materials";
import { hash } from "../hash";
import { controlIntent } from "../inputs/controls";

test("advancing the client turn before HTTP arrival cannot relabel research lifecycle events", async () => {
  const guard = offlineNetwork();
  try {
    const { ownedApplication } = await import("../adapter");
    const app = await ownedApplication(material("slow"), guard);
    try {
      app.setTurn(0);
      const prepared = await app.request({ phase: "prepare", message: "I need binoculars under USD 250", operationId: randomUUID(), preferences: defaultIntent() });
      const pending = app.request({ phase: "research", operationId: randomUUID(), preferences: prepared.preferences });
      app.setTurn(1);
      assert.equal((await app.request({ phase: "prepare", message: "Thanks", operationId: randomUUID(), preferences: prepared.preferences })).kind, "message");
      assert.equal((await pending).kind, "research");
      const researchAttempt = app.events.find((event) => event.kind === "app-request" && (event.body as { phase: string }).phase === "research")!.attemptId;
      assert(researchAttempt);
      for (const kind of ["admission", "provider-request", "provider-response", "settlement"] as const) {
        const events = app.events.filter((event) => event.kind === kind);
        assert.equal(events.length, 1, kind);
        assert.equal(events[0]!.turn, 0, kind);
        assert.equal(events[0]!.attemptId, researchAttempt, kind);
      }
      const provider = app.events.find((event) => event.kind === "provider-request")!;
      assert.equal((provider.body as { path: string }).path, "/answer");
      assert.equal(app.events.filter((event) => event.kind === "app-response").at(-1)!.turn, 0);
    } finally { await app.close(); }
  } finally { guard.close(); }
});

test("advancing the client turn before HTTP arrival cannot consume another turn's fixed proposal", async () => {
  const guard = offlineNetwork();
  try {
    const { ownedApplication } = await import("../adapter");
    const message = "Find three binocular options for birdwatching under USD 250";
    const intent = controlIntent({ id: "immediate-overlap", provider: "supported", actions: [{ kind: "message", text: message }] });
    const app = await ownedApplication(material("slow"), guard, { intent, intentDelayMs: 30 });
    try {
      app.setTurn(0);
      const pending = app.request({ phase: "prepare", message, operationId: randomUUID(), preferences: defaultIntent() });
      app.setTurn(1);
      assert.equal((await app.request({ phase: "prepare", message: "Thanks", operationId: randomUUID(), preferences: defaultIntent() })).kind, "message");
      assert.equal((await pending).kind, "prepared");
      assert.deepEqual(app.interpretation().consumedTurns, [0]);
      assert.deepEqual(app.interpretation().limitations, []);
      assert.equal(app.events.find((event) => event.kind === "interpreter-response")!.turn, 0);
    } finally { await app.close(); }
  } finally { guard.close(); }
});

test("late provider abort and settlement retain their originating turn after a duplicate retry", async () => {
  const guard = offlineNetwork();
  try {
    const { ownedApplication } = await import("../adapter");
    const app = await ownedApplication(material("slow"), guard);
    let closed = false;
    try {
      app.setTurn(0);
      const prepared = await app.request({ phase: "prepare", message: "I need binoculars under USD 250", operationId: randomUUID(), preferences: defaultIntent() });
      assert.equal(prepared.kind, "prepared");
      const operation = { phase: "research", operationId: randomUUID(), preferences: prepared.preferences };
      const controller = new AbortController();
      const pending = app.request(operation, controller.signal).catch(() => null);
      const deadline = Date.now() + 1000;
      while (!app.providerCalls && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(app.providerCalls, 1);
      app.setTurn(1);
      const retry = await app.request(operation);
      assert.equal(retry.kind, "research-unavailable");
      assert.equal("reason" in retry && retry.reason, "duplicate");
      controller.abort();
      await pending;
      await app.close();
      closed = true;
      const completed = structuredClone(app.events);
      const admissions = completed.filter((event) => event.kind === "admission");
      assert.notEqual(admissions[0]!.attemptId, admissions[1]!.attemptId);
      for (const kind of ["provider-request", "provider-aborted", "settlement"] as const) {
        const events = completed.filter((event) => event.kind === kind);
        assert.equal(events.length, 1, kind);
        assert.equal(events[0]!.turn, 0, kind);
        assert.equal(events[0]!.attemptId, admissions[0]!.attemptId, kind);
      }
      assert.equal(completed.filter((event) => event.kind === "admission").at(-1)!.turn, 1);
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(hash(app.events), hash(completed));
    } finally { if (!closed) await app.close(); }
  } finally { guard.close(); }
});

test("a delayed successful provider response retains its dispatch turn while another turn completes", async () => {
  const guard = offlineNetwork();
  try {
    const { ownedApplication } = await import("../adapter");
    const app = await ownedApplication(material("slow"), guard);
    try {
      app.setTurn(0);
      const prepared = await app.request({ phase: "prepare", message: "I need binoculars under USD 250", operationId: randomUUID(), preferences: defaultIntent() });
      const pending = app.request({ phase: "research", operationId: randomUUID(), preferences: prepared.preferences });
      const deadline = Date.now() + 1000;
      while (!app.providerCalls && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(app.providerCalls, 1);
      app.setTurn(1);
      await app.request({ phase: "prepare", message: "Thanks", operationId: randomUUID(), preferences: prepared.preferences });
      assert.equal((await pending).kind, "research");
      assert.equal(app.events.find((event) => event.kind === "provider-response")!.turn, 0);
      assert.equal(app.events.find((event) => event.kind === "settlement")!.turn, 0);
      assert.equal(app.events.filter((event) => event.kind === "app-response").at(-1)!.turn, 0);
    } finally { await app.close(); }
  } finally { guard.close(); }
});
