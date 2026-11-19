import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { defaultIntent, type ShoppingIntent } from "../src/domain/contracts";
import { TurnTransportResponseSchema } from "../src/domain/research";
import { createApp } from "../src/server/app";
import { createResearchTurns } from "../src/server/research-turns";
import { createExaProductResearch } from "../src/server/exa-research";
import type { Event, Intent, Json, Material, Observation, PublicScenario, TurnObservation } from "./contracts";
import type { offlineNetwork } from "./network";

type Guard = ReturnType<typeof offlineNetwork>;
export async function ownedApplication(input: Material, guard: Guard) {
  const events: Event[] = [];
  const started = performance.now();
  let currentTurn = 0;
  let providerCalls = 0;
  const record = (kind: Event["kind"], body: unknown) => events.push({ sequence: events.length + 1, turn: currentTurn, kind, elapsedMs: Math.round((performance.now() - started) * 100) / 100, body: JSON.parse(JSON.stringify(body)) as Json });
  const provider = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += String(chunk); });
    request.on("end", () => {
      providerCalls++;
      record("provider-request", { path: request.url, body: JSON.parse(body) });
      const reply = () => {
        if (response.destroyed) return;
        record("provider-response", { status: input.status, materialId: input.id, materialHash: input.sha256 });
        response.writeHead(input.status, { "content-type": "application/json" });
        response.end(JSON.stringify(input.body));
      };
      const timer = input.delayMs ? setTimeout(reply, input.delayMs) : undefined;
      response.on("close", () => {
        if (timer) clearTimeout(timer);
        if (!response.writableFinished) record("provider-aborted", { materialId: input.id });
      });
      if (!timer) reply();
    });
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerOrigin = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  guard.allow(providerOrigin);
  const seen = new Set<string>();
  const quota = {
    async reserve(operationId: string, digest: string) {
      const outcome = seen.has(operationId) ? "duplicate" as const : "admitted" as const;
      seen.add(operationId);
      record("admission", { operationId, digest, outcome, label: "Isolated in-memory quota double; no persistent ledger" });
      return outcome;
    },
    async settle(operationId: string, cost: number | null, successful: boolean) { record("settlement", { operationId, cost, successful, label: "Synthetic provider-reported amount, no billable request" }); },
  };
  let app: ReturnType<typeof createApp>;
  const api = serve({ fetch: (request, env) => app.fetch(request, env), hostname: "127.0.0.1", port: 0 });
  await once(api, "listening");
  const apiPort = (api.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${apiPort}`;
  guard.allow(origin);
  app = createApp({ researchTurns: createResearchTurns({ ...(input.id === "missing-config" ? {} : { research: createExaProductResearch("fake-offline-evaluation-key", { baseUrl: providerOrigin, timeoutMs: input.id === "timeout" ? 150 : 2000 }), quota }) }) }, { apiPort, webPort: apiPort });
  return {
    origin, events,
    setTurn(turn: number) { currentTurn = turn; },
    get providerCalls() { return providerCalls; },
    async request(body: unknown, signal?: AbortSignal) {
      record("app-request", body);
      const response = await fetch(`${origin}/api/turn`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
      const raw = await response.json();
      record("app-response", { status: response.status, body: raw });
      if (!response.ok) throw new Error(`Application HTTP ${response.status}: ${JSON.stringify(raw)}`);
      return TurnTransportResponseSchema.parse(raw);
    },
    async close() {
      if ("closeAllConnections" in api) api.closeAllConnections();
      provider.closeAllConnections();
      await Promise.all([new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve())), new Promise<void>((resolve, reject) => provider.close((error) => error ? reject(error) : resolve()))]);
      guard.forget(origin);
      guard.forget(providerOrigin);
    },
    record,
  };
}
export async function observe(scenario: PublicScenario, input: Material, guard: Guard): Promise<Observation> {
  const app = await ownedApplication(input, guard);
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
      if (action.kind === "reset") {
        preferences = defaultIntent();
        app.record("reset", { reason: "Explicit public reset action" });
      } else if (action.kind === "repeat-research") {
        if (!lastOperation) throw new Error("Cannot repeat a research phase before an actual prepared turn");
        const result = await app.request({ phase: "research", ...lastOperation });
        preferences = result.preferences;
        response = result as unknown as Record<string, Json>;
      } else {
        const operationId = randomUUID();
        const message = action.kind === "skip-budget" ? "Skip budget" : action.text;
        const prepared = await app.request({ phase: "prepare", message, preferences, operationId, ...(action.kind === "skip-budget" ? { skipBudget: true } : {}) });
        preferences = prepared.preferences;
        response = prepared as unknown as Record<string, Json>;
        if (prepared.kind === "prepared") {
          lastOperation = { operationId, preferences: structuredClone(preferences) };
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
      turns.push({ index, action, initialPreferences: before as Intent, finalPreferences: structuredClone(preferences) as Intent, response, providerCalls: app.providerCalls - beforeCalls, cancelled });
    }
  } catch (error) {
    applicationError = error instanceof Error ? error.message : String(error);
  } finally {
    await app.close();
    cleanup = true;
  }
  return { scenarioId: scenario.id, initialPreferences, finalPreferences: preferences, material: input, turns, events: app.events, network: guard.snapshot(), cleanup, applicationError };
}
