import type { HttpBindings } from "@hono/node-server";
import { AccountError } from "./workspace-store";
import type { Accounts } from "./accounts";
import { PreferenceInput, WorkspaceCommandSchema } from "../domain/workspace";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApplicationTurnResponseSchema, type ResearchTurns } from "../domain/research";
import { createResearchTurns } from "./research-turns";
import { Hono } from "hono";
import {
  SelectionRequestSchema, SelectionResultSchema,
  TurnRequestSchema, TurnResponseSchema,
} from "../domain/contracts";
import {
  ShortlistResearchRequestSchema,
  WebResearchResponseSchema,
  type WebResearchOperation,
} from "../domain/web-research";
import type { ProviderEvent, Providers } from "../domain/providers";
import { catalog } from "../domain/catalog";
import { createShoppingEngine } from "../domain/shopping";
import { resolveServerConfig, type ServerConfig } from "./config";

const TurnInput = TurnRequestSchema.extend({ preferences: PreferenceInput, operationId: z.string().uuid().optional() }).strict();
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
  accounts?: Accounts;
  accountCapability?: "guest-only" | "unavailable" | "configured";
  mode?: "research" | "test-fixture";
  researchTurns?: ResearchTurns;
  researchAvailable?: boolean;
  providers?: Providers;
  providerTimeoutMs?: number;
  webResearch?: WebResearchOperation;
  logger?: (event: RequestLog) => void;
};

export function createApp(dependencies: AppDependencies = {}, configuration: Partial<ServerConfig> = {}) {
  const config = resolveServerConfig(configuration);
  const fixtureMode = dependencies.mode === "test-fixture";
  const providers = fixtureMode ? dependencies.providers : undefined;
  if (fixtureMode && !providers) throw new Error("Test fixture providers must be supplied explicitly");
  const researchTurns = dependencies.researchTurns ?? createResearchTurns({});
  const hosts = new Set([config.apiPort, config.webPort].flatMap((port) => [`127.0.0.1:${port}`, `localhost:${port}`]));
  const origins = new Set([...hosts].map((host) => `http://${host}`));
  const app = new Hono<{ Bindings: HttpBindings; Variables: { requestId: string; outcomes: ProviderEvent[]; payload: unknown; rawBody: Uint8Array } }>();

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
    const accountRoute = url.pathname.startsWith("/api/auth/") || url.pathname === "/api/workspace";
    if (accountRoute && context.req.method === "POST" && origin !== dependencies.accounts?.origin) return context.json({ error: "Account requests require the canonical Origin", requestId }, 403);
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
        context.set("rawBody", bytes.slice(0, length));
        context.set("payload", JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length))));
      } catch {
        return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
      } finally {
        reader.releaseLock();
      }
    }
    await next();
  });

  app.get("/api/account", async (context) => {
    if (!dependencies.accounts) return context.json({ status: dependencies.accountCapability === "unavailable" ? "unavailable" : "guest-only" });
    try { return context.json(await dependencies.accounts.state(context.req.raw.headers)); }
    catch { return context.json({ status: "unavailable" }, 503); }
  });
  app.on(["GET", "POST"], "/api/auth/*", async (context) => {
    const supported = new Set(["POST /api/auth/sign-up/email", "POST /api/auth/sign-in/email", "POST /api/auth/sign-out", "GET /api/auth/get-session"]);
    if (!supported.has(`${context.req.method} ${context.req.path}`)) return context.json({ error: "Not found" }, 404);
    if (!dependencies.accounts) return context.json({ error: "Account persistence is unavailable" }, 503);
    const headers = new Headers(context.req.raw.headers);
    headers.set("x-fieldnote-connection-ip", context.env?.incoming?.socket.remoteAddress ?? "127.0.0.1");
    headers.delete("content-length");
    const request = new Request(context.req.url, { method: context.req.method, headers, signal: context.req.raw.signal,
      ...(context.req.method === "POST" ? { body: context.get("rawBody") as BodyInit } : {}),
    });
    try { return await dependencies.accounts.handle(request); }
    catch { return context.json({ error: "Account request could not complete" }, 503); }
  });
  app.post("/api/workspace", async (context) => {
    const parsed = WorkspaceCommandSchema.safeParse(context.get("payload"));
    if (!parsed.success) return context.json({ error: "Invalid saved-conversation command" }, 400);
    if (!dependencies.accounts) return context.json({ error: "Account persistence is unavailable" }, 503);
    try { return context.json(await dependencies.accounts.command(context.req.raw.headers, parsed.data, context.req.raw.signal)); }
    catch (error) { return context.json({ error: error instanceof AccountError ? error.message : "Account persistence is unavailable. Your request was not retried." }, error instanceof AccountError ? error.status : 503); }
  });
  app.get("/api/health", (context) => context.json({
    status: "ok",
    mode: fixtureMode ? "fixture" : "research",
    liveIntegrations: fixtureMode ? Boolean(dependencies.webResearch) : (dependencies.researchAvailable ?? Boolean(dependencies.researchTurns)),
    webResearch: fixtureMode && dependencies.webResearch ? "enabled" : "disabled",
    ...(!fixtureMode ? { merchantVerification: "unavailable" } : {}),
  }));
  app.post("/api/turn", async (context) => {
    if (context.req.header("cookie")?.includes("fieldnote.session_token=")) return context.json({ error: "Use the saved-conversation command for account research" }, 409);
    const parsed = TurnInput.safeParse(context.get("payload"));
    if (!parsed.success) return context.json({ error: "Invalid JSON or request fields", requestId: context.get("requestId") }, 400);
    if (!fixtureMode || !providers) {
      if (!parsed.data.operationId) return context.json({ error: "A research operation ID is required", requestId: context.get("requestId") }, 400);
      const result = await researchTurns.turn({ ...parsed.data, operationId: parsed.data.operationId }, context.req.raw.signal);
      return context.json(ApplicationTurnResponseSchema.parse(result));
    }
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
    if (!fixtureMode || !providers) return context.json({ error: "Verified merchant selection is unavailable", requestId: context.get("requestId") }, 409);
    const engine = createShoppingEngine(providers, {
      providerTimeoutMs: dependencies.providerTimeoutMs,
      onProviderEvent: (event) => { if (context.get("outcomes").length < 20) context.get("outcomes").push(event); },
    });
    const result = await engine.select(parsed.data.productId, parsed.data.preferences, { signal: context.req.raw.signal });
    return context.json(SelectionResultSchema.parse(result));
  });
  app.post("/api/research", async (context) => {
    if (!fixtureMode) return context.json({ status: "disabled" });
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
