import { setTimeout as delay } from "node:timers/promises";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { defaultIntent, type ShoppingIntent } from "../src/domain/contracts";
import { TurnTransportResponseSchema } from "../src/domain/research";
import { createApp } from "../src/server/app";
import { createResearchTurns } from "../src/server/research-turns";
import { createExaProductResearch } from "../src/server/exa-research";
import type { Event, Intent, Json, Material, Observation, PublicScenario, TurnObservation } from "./contracts";
import type { offlineNetwork } from "./network";
import { InputCoverageError, scenarioIntentInput, type IntentInput } from "./inputs/intent";

type Guard = ReturnType<typeof offlineNetwork>;
const traceHeader = "x-fieldnote-eval-attempt";
type Attempt = { id: string; turn: number };
export async function ownedApplication(input: Material, guard: Guard, options: { webPort?: number; intent?: IntentInput; intentDelayMs?: number } = {}) {
  const events: Event[] = [];
  const started = performance.now();
  let currentTurn = 0;
  let providerCalls = 0;
  let interpreterCalls = 0;
  const inputLimitations: string[] = [];
  const attempts = new Map<string, Attempt>();
  const context = new AsyncLocalStorage<Attempt>();
  const bindAttempt = (turn = currentTurn) => { const attempt = { id: randomUUID(), turn }; attempts.set(attempt.id, attempt); return attempt; };
  const activeAttempt = () => { const attempt = context.getStore(); if (!attempt) throw new Error("Owned application operation has no originating HTTP attempt"); return attempt; };
  const recordAt = (turn: number, kind: Event["kind"], body: unknown, attemptId?: string) => events.push({ sequence: events.length + 1, turn, kind, ...(attemptId ? { attemptId } : {}), elapsedMs: Math.round((performance.now() - started) * 100) / 100, body: JSON.parse(JSON.stringify(body)) as Json });
  const record = (kind: Event["kind"], body: unknown) => recordAt(currentTurn, kind, body);
  const providerResponses = new Set<ServerResponse>();
  const provider = createServer((request, response) => {
    const attempt = attempts.get(String(request.headers[traceHeader] ?? ""));
    if (!attempt) { response.writeHead(400); response.end("Missing owned evaluation attempt binding"); return; }
    providerResponses.add(response);
    response.once("close", () => providerResponses.delete(response));
    let body = "";
    request.on("data", (chunk) => { body += String(chunk); });
    request.on("end", () => {
      providerCalls++;
      recordAt(attempt.turn, "provider-request", { path: request.url, body: JSON.parse(body) }, attempt.id);
      const reply = () => {
        if (response.destroyed) return;
        recordAt(attempt.turn, "provider-response", { status: input.status, materialId: input.id, materialHash: input.sha256 }, attempt.id);
        response.writeHead(input.status, { "content-type": "application/json" });
        response.end(JSON.stringify(input.body));
      };
      const timer = input.delayMs ? setTimeout(reply, input.delayMs) : undefined;
      response.on("close", () => {
        if (timer) clearTimeout(timer);
        if (!response.writableFinished) recordAt(attempt.turn, "provider-aborted", { materialId: input.id }, attempt.id);
      });
      if (!timer) reply();
    });
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerOrigin = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  guard.allow(providerOrigin);
  guard.traceRequests(providerOrigin, () => ({ [traceHeader]: activeAttempt().id }));
  const seen = new Map<string, Attempt>();
  const quota = {
    async reserve(operationId: string, digest: string) {
      const outcome = seen.has(operationId) ? "duplicate" as const : "admitted" as const;
      const attempt = activeAttempt();
      if (!seen.has(operationId)) seen.set(operationId, attempt);
      recordAt(attempt.turn, "admission", { operationId, digest, outcome, label: "Isolated in-memory quota double; no persistent ledger" }, attempt.id);
      return outcome;
    },
    async settle(operationId: string, cost: number | null, successful: boolean) { const attempt = seen.get(operationId)!; recordAt(attempt.turn, "settlement", { operationId, cost, successful, label: "Synthetic provider-reported amount, no billable request" }, attempt.id); },
  };
  let app: ReturnType<typeof createApp>;
  const appRequests = new Set<Promise<Response>>();
  const api = serve({ fetch: (request, env) => {
    const attempt = attempts.get(request.headers.get(traceHeader) ?? "");
    if (new URL(request.url).pathname === "/api/turn" && !attempt) return Response.json({ error: "Missing owned evaluation attempt binding" }, { status: 400 });
    const pending = Promise.resolve(attempt ? context.run(attempt, () => app.fetch(request, env)) : app.fetch(request, env));
    appRequests.add(pending);
    void pending.then(() => appRequests.delete(pending), () => appRequests.delete(pending));
    return pending;
  }, hostname: "127.0.0.1", port: 0 });
  await once(api, "listening");
  const apiPort = (api.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${apiPort}`;
  guard.allow(origin);
  app = createApp({ researchTurns: createResearchTurns({
    ...(options.intent ? { interpretIntent: async (request, signal) => {
      signal.throwIfAborted();
      const attempt = activeAttempt();
      interpreterCalls++;
      recordAt(attempt.turn, "interpreter-request", { operationId: request.operationId, message: request.message, questionId: request.questionId ?? null, inputHash: options.intent!.hash, label: options.intent!.label }, attempt.id);
      try {
        if (options.intentDelayMs) await delay(options.intentDelayMs, undefined, { signal });
        const proposed = options.intent!.propose(attempt.turn, request);
        recordAt(attempt.turn, "interpreter-response", { status: "ready", ...proposed }, attempt.id);
        return { status: "ready" as const, interpretation: proposed.interpretation };
      } catch (error) {
        if (!(error instanceof InputCoverageError)) throw error;
        inputLimitations.push(error.message);
        recordAt(attempt.turn, "input-limitation", { message: error.message }, attempt.id);
        recordAt(attempt.turn, "interpreter-response", { status: "unavailable" }, attempt.id);
        return { status: "unavailable" as const };
      }
    } } : {}), ...(input.id === "missing-config" ? {} : { research: createExaProductResearch("fake-offline-evaluation-key", { baseUrl: providerOrigin, timeoutMs: input.id === "timeout" ? 150 : 2000 }), quota }) }) }, { apiPort, webPort: options.webPort ?? apiPort });
  return {
    origin, events,
    interpretation() { return { mode: options.intent ? "fixed-proposals" as const : "unavailable" as const, inputHash: options.intent?.hash ?? null, openAIHttpRequests: 0 as const, ollamaHttpRequests: 0 as const, consumedTurns: events.filter((event) => event.kind === "interpreter-request").map((event) => event.turn), unconsumedTurns: (options.intent?.turns ?? []).filter((turn) => !events.some((event) => event.kind === "interpreter-request" && event.turn === turn.turnIndex)).map((turn) => turn.turnIndex), invocations: interpreterCalls, suppliedTurns: structuredClone(options.intent?.turns ?? []) as Json[], limitations: [...inputLimitations] }; },
    setTurn(turn: number) { currentTurn = turn; },
    requestHeaders(turn: number) {
      if (!Number.isInteger(turn) || turn < 0) throw new Error("Browser request has no originating turn");
      return { [traceHeader]: bindAttempt(turn).id };
    },
    get providerCalls() { return providerCalls; },
    async request(body: unknown, signal?: AbortSignal) {
      const attempt = bindAttempt();
      recordAt(attempt.turn, "app-request", body, attempt.id);
      const response = await fetch(`${origin}/api/turn`, { method: "POST", headers: { "content-type": "application/json", [traceHeader]: attempt.id }, body: JSON.stringify(body), signal });
      const raw = await response.json();
      recordAt(attempt.turn, "app-response", { status: response.status, body: raw }, attempt.id);
      if (!response.ok) throw new Error(`Application HTTP ${response.status}: ${JSON.stringify(raw)}`);
      return TurnTransportResponseSchema.parse(raw);
    },
    async close() {
      const responsesClosed = Promise.all([...providerResponses].map((response) => once(response, "close")));
      if ("closeAllConnections" in api) api.closeAllConnections();
      provider.closeAllConnections();
      await Promise.all([responsesClosed, new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve())), new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()))]);
      await Promise.allSettled([...appRequests]);
      guard.forget(origin);
      guard.forget(providerOrigin);
      attempts.clear();
    },
    record,
  };
}
export async function observe(scenario: PublicScenario, input: Material, guard: Guard, options: { intent?: IntentInput | null } = {}): Promise<Observation> {
  const intent = options.intent === undefined ? await scenarioIntentInput(scenario) : options.intent;
  const app = await ownedApplication(input, guard, intent ? { intent } : {});
  let preferences: ShoppingIntent = defaultIntent();
  const initialPreferences = structuredClone(preferences);
  const turns: TurnObservation[] = [];
  let lastOperation: { operationId: string; preferences: ShoppingIntent } | undefined;
  let cleanup = false;
  let applicationError: string | null = null;
  try {
    const health = await (await fetch(`${app.origin}/api/health`)).json() as { status: string; mode: string };
    if (health.status !== "ok" || health.mode !== "research") throw new Error("Owned app did not report normal research health");
    for (const [index, action] of scenario.actions.entries()) {
      app.setTurn(index);
      const before = structuredClone(preferences);
      const beforeCalls = app.providerCalls;
      let response: Record<string, Json> | null = null;
      let cancelled = false;
      let intentHandling: TurnObservation["intentHandling"] = "not-prepared";
      if (action.kind === "reset") {
        preferences = defaultIntent();
        lastOperation = undefined;
        app.record("reset", { reason: "Explicit public reset action" });
      } else if (action.kind === "repeat-research") {
        if (!lastOperation) throw new Error("Cannot repeat a research phase before an actual prepared turn");
        const result = await app.request({ phase: "research", ...lastOperation });
        preferences = result.preferences;
        response = result as unknown as Record<string, Json>;
      } else {
        const operationId = randomUUID();
        const message = action.kind === "skip-budget" ? "Skip budget" : action.text;
        const prepared = await app.request({ phase: "prepare", message, preferences, operationId, ...(preferences.pendingChange ? { questionId: preferences.pendingChange.id } : {}), ...(action.kind === "skip-budget" ? { skipBudget: true } : {}) });
        intentHandling = app.events.some((event) => event.turn === index && event.kind === "interpreter-request") ? "synthetic-fallback" : prepared.kind === "research-unavailable" && prepared.reason === "intent-unavailable" ? "unavailable" : "local";
        preferences = prepared.preferences;
        response = prepared as unknown as Record<string, Json>;
        if (prepared.kind === "prepared") {
          lastOperation = { operationId: randomUUID(), preferences: structuredClone(preferences) };
          if (action.kind === "cancel") {
            const controller = new AbortController();
            const pending = app.request({ phase: "research", ...lastOperation }, controller.signal);
            const deadline = Date.now() + 1000;
            while (app.providerCalls === beforeCalls && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
            controller.abort();
            try { await pending; } catch { cancelled = true; }
            await new Promise((resolve) => setTimeout(resolve, 30));
            app.record("cancelled", { reachedProvider: app.providerCalls > beforeCalls });
            response = null;
          } else {
            const result = await app.request({ phase: "research", ...lastOperation });
            preferences = result.preferences;
            response = result as unknown as Record<string, Json>;
          }
        }
      }
      turns.push({ index, action, initialPreferences: before as Intent, finalPreferences: structuredClone(preferences) as Intent, response, intentHandling, providerCalls: app.providerCalls - beforeCalls, cancelled });
    }
  } catch (error) {
    applicationError = error instanceof Error ? error.message : String(error);
  } finally {
    await app.close();
    cleanup = true;
  }
  return structuredClone({ scenarioId: scenario.id, initialPreferences, finalPreferences: preferences, material: input, interpretation: app.interpretation(), turns, events: app.events, network: guard.snapshot(), cleanup, applicationError });
}
