import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../src/domain/legacy-contracts";
import { ShortlistResearchRequestSchema } from "../../src/domain/web-research";
import { createFixtureApp } from "../../src/server/test-fixture-app";
import { createExaWebResearch, createExaWebResearchFromEnvironment } from "../../src/server/fixture-web-research";

const request = ShortlistResearchRequestSchema.parse({
  productIds: ["sony-wh-ch720n"],
  preferences: { ...defaultPreferences(), soft: { ...defaultPreferences().soft, priorities: ["value"] } },
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function readBody(requestMessage: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of requestMessage) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function localApi(handler: (requestMessage: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    },
  };
}

async function reservePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

function sendJson(response: ServerResponse, body: unknown) {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

describe("Exa web research adapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends the canonical query, objective, and highlights request through the installed SDK", async () => {
    let body: unknown;
    let apiKey: string | undefined;
    const warning = vi.spyOn(console, "warn");
    const api = await localApi((incoming, outgoing) => {
      const header = incoming.headers["x-api-key"];
      apiKey = typeof header === "string" ? header : undefined;
      void readBody(incoming).then((parsed) => {
        body = parsed;
        sendJson(outgoing, {
          results: [{ title: "Review notes", url: "https://reviews.example.com/headphones", highlights: ["Comfort and battery notes."] }],
          warnings: [{ code: "IGNORED_FIELD", path: "test", message: "private warning" }],
        });
      });
    });
    try {
      const result = await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal);
      expect(body).toEqual({
        query: "Product information and independent reviews for Sony WH-CH720N considering value",
        objective: "Find useful feature and tradeoff context for these shortlisted products and the shopper's stated needs. Prioritize manufacturer documentation and substantive independent reviews. Exclude checkout, current prices, and inventory claims.",
        contents: { highlights: true },
      });
      expect(apiKey).toBe("fake-key");
      expect(result).toMatchObject({
        status: "ready",
        results: [{ title: "Review notes", url: "https://reviews.example.com/headphones", highlights: ["Comfort and battery notes."] }],
        truncated: false,
      });
      expect(warning).not.toHaveBeenCalled();
    } finally {
      await api.close();
    }
  });

  it("returns a ready empty result when Exa finds no pages", async () => {
    const api = await localApi((_request, response) => sendJson(response, { results: [] }));
    try {
      const result = await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal);
      expect(result).toMatchObject({ status: "ready", results: [], truncated: false });
    } finally {
      await api.close();
    }
  });

  it("uses the hostname when a valid Exa result has no title and drops unsafe destinations", async () => {
    const api = await localApi((_request, response) => sendJson(response, { results: [
      { title: null, url: "https://reviews.example.com/no-title", highlights: ["Safe excerpt"] },
      { title: "Loopback", url: "https://127.0.0.1/private", highlights: ["Do not expose"] },
    ] }));
    try {
      const result = await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal);
      expect(result).toMatchObject({
        status: "ready",
        results: [{ title: "reviews.example.com", url: "https://reviews.example.com/no-title", highlights: ["Safe excerpt"] }],
        truncated: true,
      });
    } finally {
      await api.close();
    }
  });

  it("bounds result count, source titles, excerpt count, excerpt length, and total highlight bytes", async () => {
    const api = await localApi((_request, response) => sendJson(response, { results: Array.from({ length: 12 }, (_, index) => ({
      title: "T".repeat(220),
      url: `https://reviews.example.com/item-${index}`,
      highlights: ["🙂".repeat(640), "B".repeat(1_000), "Third excerpt", "Omitted excerpt"],
    })) }));
    try {
      const result = await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.results).toHaveLength(10);
      expect(result.truncated).toBe(true);
      expect(result.results.every(({ title, highlights }) => title.length <= 180 && highlights.length <= 3 && highlights.every((highlight) => highlight.length <= 640))).toBe(true);
      const totalBytes = result.results.flatMap(({ highlights }) => highlights).reduce((total, highlight) => total + new TextEncoder().encode(highlight).byteLength, 0);
      expect(totalBytes).toBeLessThanOrEqual(8_192);
      expect(result.results[0].highlights.join(" ")).not.toContain("Omitted excerpt");
    } finally {
      await api.close();
    }
  });

  it.each([
    {},
    { results: "not-an-array" },
    { results: [{ url: "https://reviews.example.com/missing-title", highlights: [] }] },
    { results: [{ title: "Malformed", url: "https://reviews.example.com/item", highlights: "not-an-array" }] },
  ])("returns invalid-response for malformed Exa result data", async (body) => {
    const api = await localApi((_request, response) => sendJson(response, body));
    try {
      expect(await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal)).toEqual({ status: "unavailable", reason: "invalid-response" });
    } finally {
      await api.close();
    }
  });

  it("returns a generic provider error for upstream failures", async () => {
    const api = await localApi((_request, response) => {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ message: "secret fake-key" }));
    });
    try {
      expect(await createExaWebResearch("fake-key", { baseUrl: api.baseUrl })(request, new AbortController().signal)).toEqual({ status: "unavailable", reason: "provider-error" });
    } finally {
      await api.close();
    }
  });

  it.each([
    { EXA_API_KEY: "fake-key" },
    { NODE_ENV: "production", EXA_API_KEY: "fake-key" },
    { NODE_ENV: "development", EXA_API_KEY: "fake-key", EXA_RESEARCH_ENABLED: "false" },
  ])("does not compose outside an enabled development or test process", (environment) => {
    expect(createExaWebResearchFromEnvironment(environment)).toBeUndefined();
  });

  it.each(["development", "test"]) ("composes when %s mode has a key and no opt-out", (nodeEnv) => {
    expect(createExaWebResearchFromEnvironment({ NODE_ENV: nodeEnv, EXA_API_KEY: "fake-key" })).toBeTypeOf("function");
  });

  it("rejects an empty direct key without falling back to the process environment", () => {
    expect(() => createExaWebResearch("  ")).toThrow("An Exa API key is required");
  });

  it("cancels the SDK network request when its caller aborts", async () => {
    const started = deferred();
    const closed = deferred();
    const api = await localApi((incoming, outgoing) => {
      incoming.resume();
      incoming.once("end", () => {
        started.resolve();
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.flushHeaders();
        outgoing.write('{"results":');
        outgoing.once("close", () => closed.resolve());
      });
    });
    try {
      const controller = new AbortController();
      const operation = createExaWebResearch("fake-key", { baseUrl: api.baseUrl, timeoutMs: 2_000 });
      const result = operation(request, controller.signal);
      await started.promise;
      controller.abort();
      await expect(result).rejects.toBeDefined();
      await expect(closed.promise).resolves.toBeUndefined();
    } finally {
      await api.close();
    }
  });

  it("bounds the full SDK response including a stalled body", async () => {
    const started = deferred();
    const closed = deferred();
    const api = await localApi((incoming, outgoing) => {
      incoming.resume();
      incoming.once("end", () => {
        started.resolve();
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.flushHeaders();
        outgoing.write('{"results":');
        outgoing.once("close", () => closed.resolve());
      });
    });
    try {
      const result = createExaWebResearch("fake-key", { baseUrl: api.baseUrl, timeoutMs: 40 })(request, new AbortController().signal);
      await started.promise;
      await expect(result).resolves.toEqual({ status: "unavailable", reason: "timeout" });
      await expect(closed.promise).resolves.toBeUndefined();
    } finally {
      await api.close();
    }
  });

  it("propagates a browser disconnect through the mounted Node adapter to Exa", async () => {
    const started = deferred();
    const closed = deferred();
    const exa = await localApi((incoming, outgoing) => {
      incoming.resume();
      incoming.once("end", () => {
        started.resolve();
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.flushHeaders();
        outgoing.write('{"results":');
        outgoing.once("close", () => closed.resolve());
      });
    });

    const port = await reservePort();
    const app = createFixtureApp({ mode: "test-fixture",
      webResearch: createExaWebResearch("fake-key", { baseUrl: exa.baseUrl, timeoutMs: 2_000 }),
    }, { apiPort: port, webPort: port });
    let resolveListening!: () => void;
    const listening = new Promise<void>((resolve) => { resolveListening = resolve; });
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, resolveListening) as Server;

    try {
      await listening;
      const controller = new AbortController();
      const response = fetch(`http://127.0.0.1:${port}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      await started.promise;
      controller.abort();
      await expect(response).rejects.toBeDefined();
      await expect(closed.promise).resolves.toBeUndefined();
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await exa.close();
    }
  });
});
