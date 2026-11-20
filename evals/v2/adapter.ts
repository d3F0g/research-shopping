import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import type { ConversationState, TurnResponse } from "../../src/domain/conversation";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { createExaProductResearch } from "../../src/server/exa-research";
import type { Event, Json, Material, PublicScenario, TurnObservation } from "../frozen-v4/contracts";
import type { offlineNetwork } from "../network";
import type { Observation, RawTurn } from "./contracts";
import { projectIntent, projectResponse } from "./projection";

type Guard = ReturnType<typeof offlineNetwork>;
type Attempt = { id: string; turn: number };
const traceHeader = "x-fieldnote-eval-attempt";
export async function ownedApplication(input: Material, guard: Guard, options: { webPort?: number } = {}) {
  const events: Event[] = [];
  const attempts = new Map<string, Attempt>();
  const context = new AsyncLocalStorage<Attempt>();
  const started = performance.now();
  let currentTurn = 0;
  let providerCalls = 0;
  let cookie = "";
  const recordAt = (attempt: Attempt, kind: Event["kind"], body: unknown) => events.push({ sequence: events.length + 1, turn: attempt.turn, attemptId: attempt.id, kind, elapsedMs: Math.round((performance.now() - started) * 100) / 100, body: JSON.parse(JSON.stringify(body)) as Json });
  const bindAttempt = (turn = currentTurn) => { const attempt = { id: randomUUID(), turn }; attempts.set(attempt.id, attempt); return attempt; };
  const activeAttempt = () => { const attempt = context.getStore(); if (!attempt) throw new Error("Application operation has no originating HTTP attempt"); return attempt; };
  const providerResponses = new Set<ServerResponse>();
  const provider = createServer((request, response) => {
    const attempt = attempts.get(String(request.headers[traceHeader] ?? ""));
    if (!attempt) { response.writeHead(400); response.end("Missing owned evaluation attempt"); return; }
    providerResponses.add(response);
    response.once("close", () => providerResponses.delete(response));
    let body = "";
    request.on("data", (chunk) => { body += String(chunk); });
    request.on("end", () => {
      providerCalls++;
      recordAt(attempt, "provider-request", { path: request.url, body: JSON.parse(body) });
      const reply = () => {
        if (response.destroyed) return;
        recordAt(attempt, "provider-response", { status: input.status, materialId: input.id, materialHash: input.sha256 });
        response.writeHead(input.status, { "content-type": "application/json" });
        response.end(JSON.stringify(input.body));
      };
      const timer = input.delayMs ? setTimeout(reply, input.delayMs) : undefined;
      response.once("close", () => {
        if (timer) clearTimeout(timer);
        if (!response.writableFinished) recordAt(attempt, "provider-aborted", { materialId: input.id });
      });
      if (!timer) reply();
    });
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerOrigin = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  guard.allow(providerOrigin);
  guard.traceRequests(providerOrigin, () => ({ [traceHeader]: activeAttempt().id }));
  const reserved = new Map<string, Attempt>();
  const quota = {
    async reserve(operationId: string, digest: string) {
      const outcome = reserved.has(operationId) ? "duplicate" as const : "admitted" as const;
      const attempt = activeAttempt();
      if (!reserved.has(operationId)) reserved.set(operationId, attempt);
      recordAt(attempt, "admission", { operationId, digest, outcome, label: "Isolated in-memory quota double. No persistent ledger." });
      return outcome;
    },
    async settle(operationId: string, cost: number | null, successful: boolean) {
      const attempt = reserved.get(operationId);
      if (!attempt) throw new Error("Settlement has no originating reservation");
      recordAt(attempt, "settlement", { operationId, cost, successful, label: "Synthetic reported amount. No billable traffic." });
    },
  };
  let app: ReturnType<typeof createApp>;
  const requests = new Set<Promise<Response>>();
  const api = serve({ hostname: "127.0.0.1", port: 0, fetch: (request, env) => {
    const attempt = attempts.get(request.headers.get(traceHeader) ?? "");
    if (new URL(request.url).pathname !== "/api/health" && !attempt) return Response.json({ error: "Missing owned evaluation attempt" }, { status: 400 });
    const pending = (async () => {
      if (attempt) recordAt(attempt, "app-request", request.method === "POST" ? await request.clone().json() : { method: request.method, path: new URL(request.url).pathname });
      const response = await (attempt ? context.run(attempt, () => app.fetch(request, env)) : app.fetch(request, env));
      if (attempt) recordAt(attempt, "app-response", { status: response.status, body: await response.clone().json() });
      return response;
    })();
    requests.add(pending);
    void pending.then(() => requests.delete(pending), () => requests.delete(pending));
    return pending;
  } });
  await once(api, "listening");
  const apiPort = (api.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${apiPort}`;
  guard.allow(origin);
  app = createApp({ conversations: createConversationService({ ...(input.id === "missing-config" ? {} : { research: createExaProductResearch("fake-offline-evaluation-key", { baseUrl: providerOrigin, timeoutMs: input.id === "timeout" ? 150 : 2000 }), quota }) }) }, { apiPort, webPort: options.webPort ?? apiPort });
  async function request(path: string, body?: unknown, signal?: AbortSignal) {
    const attempt = bindAttempt();
    const response = await fetch(`${origin}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "content-type": "application/json", [traceHeader]: attempt.id, ...(cookie ? { cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0]!;
    const raw = await response.json();
    if (!response.ok) throw new Error(`Application HTTP ${response.status}: ${JSON.stringify(raw)}`);
    return raw;
  }
  return {
    origin, events,
    get providerCalls() { return providerCalls; },
    setTurn(turn: number) { currentTurn = turn; },
    requestHeaders(turn: number) { if (!Number.isInteger(turn) || turn < 0) throw new Error("Invalid browser originating turn"); return { [traceHeader]: bindAttempt(turn).id }; },
    request: (body: unknown, signal?: AbortSignal) => request("/api/turn", body, signal) as Promise<TurnResponse>,
    session: () => request("/api/session") as Promise<{ state: ConversationState }>,
    reset: () => request("/api/new-chat", {}),
    cancel: () => request("/api/cancel", {}),
    record(kind: "reset" | "cancelled", body: unknown) { events.push({ sequence: events.length + 1, turn: currentTurn, kind, elapsedMs: Math.round((performance.now() - started) * 100) / 100, body: JSON.parse(JSON.stringify(body)) as Json }); },
    async close() {
      const closed = Promise.all([...providerResponses].map((response) => once(response, "close")));
      if ("closeAllConnections" in api) api.closeAllConnections();
      provider.closeAllConnections();
      await Promise.all([closed, new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve())), new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()))]);
      await Promise.allSettled([...requests]);
      guard.forget(origin); guard.forget(providerOrigin); attempts.clear();
    },
  };
}
export async function observe(scenario: PublicScenario, input: Material, guard: Guard): Promise<Observation> {
  const app = await ownedApplication(input, guard);
  let state: ConversationState;
  try { state = (await app.session()).state; } catch (error) { await app.close(); throw error; }
  const initial = structuredClone(state);
  const turns: TurnObservation[] = [];
  const rawTurns: RawTurn[] = [];
  let lastPreparedId: string | undefined;
  let applicationError: string | null = null;
  try {
    for (const [index, action] of scenario.actions.entries()) {
      app.setTurn(index);
      const before = structuredClone(state), beforeCalls = app.providerCalls;
      let response: TurnResponse | null = null;
      let cancelled = false;
      if (action.kind === "reset") {
        await app.reset(); state = (await app.session()).state; lastPreparedId = undefined;
        app.record("reset", { reason: "Explicit public reset action" });
      } else if (action.kind === "repeat-research") {
        if (!lastPreparedId) throw new Error("No actual prepared identity to retry");
        response = await app.request({ phase: "research", preparedId: lastPreparedId }); state = response.state;
      } else {
        const message = action.kind === "skip-budget" ? "Skip budget" : action.text;
        const prepared = await app.request({ phase: "prepare", operationId: randomUUID(), message, ...(state.pending ? { questionId: state.pending.id } : {}) });
        response = prepared; state = prepared.state;
        if (prepared.kind === "prepared") {
          lastPreparedId = prepared.preparedId;
          if (action.kind === "cancel") {
            const controller = new AbortController();
            const pending = app.request({ phase: "research", preparedId: lastPreparedId }, controller.signal);
            const deadline = Date.now() + 1000;
            while (app.providerCalls === beforeCalls && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
            controller.abort();
            try { await pending; } catch { cancelled = true; }
            await new Promise((resolve) => setTimeout(resolve, 30));
            app.record("cancelled", { reachedProvider: app.providerCalls > beforeCalls });
            state = (await app.session()).state; response = null;
          } else { response = await app.request({ phase: "research", preparedId: lastPreparedId }); state = response.state; }
        }
      }
      rawTurns.push({ index, before, after: structuredClone(state), response: structuredClone(response) });
      turns.push({ index, action, initialPreferences: projectIntent(before), finalPreferences: projectIntent(state), response: projectResponse(response), intentHandling: action.kind === "reset" || action.kind === "repeat-research" ? "not-prepared" : "local", providerCalls: app.providerCalls - beforeCalls, cancelled });
    }
  } catch (error) { applicationError = error instanceof Error ? error.message : String(error); }
  finally { await app.close(); }
  return structuredClone({ scenarioId: scenario.id, initialPreferences: projectIntent(initial), finalPreferences: projectIntent(state), rawInitialState: initial, rawTurns, material: input, turns, events: app.events, network: guard.snapshot(), interpretation: { mode: "unavailable", inputHash: null, openAIHttpRequests: 0, ollamaHttpRequests: 0, consumedTurns: [], unconsumedTurns: [], invocations: 0, suppliedTurns: [], limitations: [] }, cleanup: true, applicationError });
}
