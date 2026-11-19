import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { TurnInputSchema } from "../domain/conversation";
import { createConversationService, type ConversationService } from "./conversations";
import { resolveServerConfig, type ServerConfig } from "./config";

const MAX_BODY_BYTES = 16384;
export type AppDependencies = { conversations?: ConversationService; logger?: (event: { requestId: string; route: string; status: number; durationMs: number; outcomes: unknown[] }) => void };
export function createApp(dependencies: AppDependencies = {}, configuration: Partial<ServerConfig> = {}) {
  const config = resolveServerConfig(configuration);
  const conversations = dependencies.conversations ?? createConversationService();
  const hosts = new Set([config.apiPort, config.webPort].flatMap((port) => [`127.0.0.1:${port}`, `localhost:${port}`]));
  const origins = new Set([...hosts].map((host) => `http://${host}`));
  const app = new Hono<{ Variables: { requestId: string; outcomes: unknown[]; payload: unknown; sessionId: string } }>();
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

  app.use("/api/*", async (context, next) => {
    let id = getCookie(context, "fieldnote-session");
    if (!id || !conversations.has(id)) {
      id = conversations.create();
      setCookie(context, "fieldnote-session", id, { httpOnly: true, sameSite: "Strict", path: "/", maxAge: 86400 });
    }
    context.set("sessionId", id);
    await next();
  });
  app.get("/api/health", (context) => context.json({ status: "ok", mode: "research", provider: "exa", automaticPaidChecks: false }));
  app.get("/api/session", (context) => context.json({ responseVersion: 2, state: conversations.state(context.get("sessionId")) }));
  app.post("/api/turn", async (context) => {
    const parsed = TurnInputSchema.safeParse(context.get("payload"));
    if (!parsed.success) return context.json({ error: "Invalid JSON or request fields" }, 400);
    const id = context.get("sessionId");
    const result = parsed.data.phase === "prepare" ? conversations.prepare(id, parsed.data) : await conversations.research(id, parsed.data.preparedId, context.req.raw.signal);
    return context.json({ responseVersion: 2, ...result });
  });
  app.post("/api/cancel", (context) => context.json({ responseVersion: 2, state: conversations.cancel(context.get("sessionId")) }));
  app.post("/api/new-chat", (context) => context.json({ responseVersion: 2, state: conversations.reset(context.get("sessionId")) }));
  app.notFound((context) => context.json({ error: "Not found" }, 404));
  app.onError((_error, context) => context.json({ error: "The request could not be completed", requestId: context.get("requestId") }, 500));
  return app;
}
