import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import {
  BudgetSchema, PreferencesSchema, SelectionRequestSchema, SelectionResultSchema,
  TurnRequestSchema, TurnResponseSchema,
} from "../domain/contracts";
import {
  ShortlistResearchRequestSchema,
  WebResearchResponseSchema,
  type WebResearchOperation,
} from "../domain/web-research";
import type { ProviderEvent, Providers } from "../domain/providers";
import { catalog } from "../domain/catalog";
import { validBudgetAmount } from "../domain/preferences";
import { createShoppingEngine } from "../domain/shopping";
import { createFixtureProviders } from "./fixtures";
import { resolveServerConfig, type ServerConfig } from "./config";

const PreferenceInput = PreferencesSchema.extend({
  hard: PreferencesSchema.shape.hard.extend({ budget: BudgetSchema.strict().refine((budget) => validBudgetAmount(budget.amount)).nullable() }).strict(),
  soft: PreferencesSchema.shape.soft.strict(),
}).strict();
const TurnInput = TurnRequestSchema.extend({ preferences: PreferenceInput }).strict();
const SelectionInput = SelectionRequestSchema.extend({ preferences: PreferenceInput }).strict();
const WebResearchInput = ShortlistResearchRequestSchema.extend({ preferences: PreferenceInput }).strict();
const MAX_BODY_BYTES = 16_384;

export type RequestLog = {
  requestId: string;
  route: "/api/health" | "/api/turn" | "/api/select" | "/api/research" | "unknown";
  status: number;
  durationMs: number;
  outcomes: ProviderEvent[];
};
export type AppDependencies = {
  providers?: Providers;
  providerTimeoutMs?: number;
  webResearch?: WebResearchOperation;
  logger?: (event: RequestLog) => void;
};

export function createApp(dependencies: AppDependencies = {}, configuration: Partial<ServerConfig> = {}) {
  const config = resolveServerConfig(configuration);
  const providers = dependencies.providers ?? createFixtureProviders();
  const hosts = new Set([config.apiPort, config.webPort].flatMap((port) => [`127.0.0.1:${port}`, `localhost:${port}`]));
  const origins = new Set([...hosts].map((host) => `http://${host}`));
  const app = new Hono<{ Variables: { requestId: string; outcomes: ProviderEvent[]; payload: unknown } }>();

  app.use("*", async (context, next) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    context.set("requestId", requestId);
    context.set("outcomes", []);
    context.header("X-Request-Id", requestId);
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    context.header("X-Frame-Options", "DENY");
    context.header("Referrer-Policy", "no-referrer");
    context.header("Cache-Control", "no-store");
    try {
      await next();
    } finally {
      const path = context.req.path;
      const route = path === "/api/health" || path === "/api/turn" || path === "/api/select" || path === "/api/research" ? path : "unknown";
      dependencies.logger?.({ requestId, route, status: context.res.status, durationMs: Math.round((performance.now() - startedAt) * 100) / 100, outcomes: context.get("outcomes").slice(0, 20) });
    }
  });

  app.use("*", async (context, next) => {
    const requestId = context.get("requestId");
    const url = new URL(context.req.url);
    const host = context.req.header("host");
    if (!hosts.has(url.host) || (host && !hosts.has(host))) return context.json({ error: "Host is not allowed", requestId }, 403);
    const origin = context.req.header("origin");
    if (origin && !origins.has(origin)) return context.json({ error: "Origin is not allowed", requestId }, 403);
    if (origin) {
      context.header("Access-Control-Allow-Origin", origin);
      context.header("Vary", "Origin");
    }
    if (context.req.method === "OPTIONS") {
      context.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      context.header("Access-Control-Allow-Headers", "Content-Type");
      return context.body(null, 204);
    }
    await next();
  });

  app.use("/api/*", async (context, next) => {
    if (context.req.method === "POST") {
      const contentType = context.req.header("content-type")?.toLowerCase();
      if (!contentType || !/^application\/json(?:\s*;\s*charset=utf-8)?$/.test(contentType)) return context.json({ error: "Use application/json", requestId: context.get("requestId") }, 415);
      const encoding = context.req.header("content-encoding");
      if (encoding && encoding !== "identity") return context.json({ error: "Encoded request bodies are unsupported", requestId: context.get("requestId") }, 415);
      const reader = context.req.raw.body?.getReader();
      if (!reader) return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
      try {
        const bytes = new Uint8Array(MAX_BODY_BYTES);
        let length = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > MAX_BODY_BYTES) {
            void reader.cancel().catch(() => undefined);
            return context.json({ error: "Request body is too large", requestId: context.get("requestId") }, 413);
          }
          bytes.set(value, length - value.length);
        }
        context.set("payload", JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length))));
      } catch {
        return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
      } finally {
        reader.releaseLock();
      }
    }
    await next();
  });

  app.get("/api/health", (context) => context.json({
    status: "ok",
    mode: "fixture",
    liveIntegrations: Boolean(dependencies.webResearch),
    webResearch: dependencies.webResearch ? "enabled" : "disabled",
  }));
  app.post("/api/turn", async (context) => {
    const parsed = TurnInput.safeParse(context.get("payload"));
    if (!parsed.success) return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
    const engine = createShoppingEngine(providers, {
      providerTimeoutMs: dependencies.providerTimeoutMs,
      onProviderEvent: (event) => { if (context.get("outcomes").length < 20) context.get("outcomes").push(event); },
    });
    const result = await engine.turn(parsed.data.message, parsed.data.preferences, { signal: context.req.raw.signal });
    const toolActivity = context.get("outcomes").slice(0, 20);
    return context.json(TurnResponseSchema.parse({ ...result, toolActivity }));
  });
  app.post("/api/select", async (context) => {
    const parsed = SelectionInput.safeParse(context.get("payload"));
    if (!parsed.success) return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
    const engine = createShoppingEngine(providers, {
      providerTimeoutMs: dependencies.providerTimeoutMs,
      onProviderEvent: (event) => { if (context.get("outcomes").length < 20) context.get("outcomes").push(event); },
    });
    const result = await engine.select(parsed.data.productId, parsed.data.preferences, { signal: context.req.raw.signal });
    return context.json(SelectionResultSchema.parse(result));
  });
  app.post("/api/research", async (context) => {
    const parsed = WebResearchInput.safeParse(context.get("payload"));
    if (!parsed.success || parsed.data.productIds.some((productId) => !(productId in catalog))) {
      return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
    }
    if (!dependencies.webResearch) return context.json({ status: "disabled" });

    try {
      const result = await dependencies.webResearch(parsed.data, context.req.raw.signal);
      return context.json(WebResearchResponseSchema.parse(result));
    } catch {
      if (context.req.raw.signal.aborted) return context.body(null, 204);
      return context.json({ status: "unavailable", reason: "provider-error" });
    }
  });
  app.notFound((context) => context.json({ error: "Not found", requestId: context.get("requestId") }, 404));
  app.onError((_error, context) => context.json({ error: "The request could not be completed", requestId: context.get("requestId") }, 500));
  return app;
}
