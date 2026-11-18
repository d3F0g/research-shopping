import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import { defaultPreferences, ProductIdSchema } from "../../src/domain/contracts";
import type { ProviderContext, Providers } from "../../src/domain/providers";
import { createApp, type AppDependencies, type RequestLog } from "../../src/server/app";
import { createFixtureProviders } from "../../src/server/fixtures";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

async function beforeDeadline<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Cancellation did not reach the provider before its deadline")), 500); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function mounted(dependencies: AppDependencies) {
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const { port } = reservation.address() as AddressInfo;
  await close(reservation);
  const app = createApp({ providerTimeoutMs: 2_000, ...dependencies }, { apiPort: port, webPort: port });
  const listening = deferred();
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, () => listening.resolve()) as Server;
  await listening.promise;
  return { url: `http://127.0.0.1:${port}`, close: () => close(server) };
}

const productId = ProductIdSchema.parse("sony-wh-ch720n");
const preferences = defaultPreferences();
preferences.hard.category = "headphones";
const payload = (route: "turn" | "select") => route === "turn"
  ? { message: "headphones under SGD500", preferences }
  : { productId, preferences };

describe("mounted shopping request cancellation", () => {
  it.each(["turn", "select"] as const)("aborts discovery on /api/%s disconnect without starting later providers", async (route) => {
    const started = deferred();
    const aborted = deferred();
    const completed = deferred<RequestLog>();
    const fixture = createFixtureProviders();
    let laterCalls = 0;
    const wait = ({ signal }: ProviderContext) => new Promise<never>((_, reject) => {
      started.resolve();
      signal.addEventListener("abort", () => { aborted.resolve(); reject(signal.reason); }, { once: true });
    });
    const api = await mounted({
      providers: {
        discovery: { discover: (_, context) => wait(context), findById: (_, context) => wait(context) },
        research: { research: async (...args) => { laterCalls++; return fixture.research.research(...args); } },
        merchant: { lookup: async (...args) => { laterCalls++; return fixture.merchant.lookup(...args); } },
      },
      logger: (event) => completed.resolve(event),
    });
    try {
      const controller = new AbortController();
      const response = fetch(`${api.url}/api/${route}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(route)), signal: controller.signal,
      });
      await beforeDeadline(started.promise);
      controller.abort();
      await expect(response).rejects.toBeDefined();
      await beforeDeadline(aborted.promise);
      const log = await beforeDeadline(completed.promise);
      expect(laterCalls).toBe(0);
      expect(log.outcomes).toEqual([]);
    } finally {
      await api.close();
    }
  });

  it.each(["turn", "select"] as const)("aborts parallel research and merchant work on /api/%s disconnect", async (route) => {
    const started = [deferred(), deferred()];
    const aborted = [deferred(), deferred()];
    const completed = deferred<RequestLog>();
    const fixture = createFixtureProviders();
    const wait = (index: number, { signal }: ProviderContext) => new Promise<never>((_, reject) => {
      started[index].resolve();
      signal.addEventListener("abort", () => { aborted[index].resolve(); reject(signal.reason); }, { once: true });
    });
    const providers: Providers = {
      discovery: {
        ...fixture.discovery,
        discover: async (_, context) => [(await fixture.discovery.findById(productId, context))!],
      },
      research: { research: (_, context) => wait(0, context) },
      merchant: { lookup: (_, __, context) => wait(1, context) },
    };
    const api = await mounted({ providers, logger: (event) => completed.resolve(event) });
    try {
      const controller = new AbortController();
      const response = fetch(`${api.url}/api/${route}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(route)), signal: controller.signal,
      });
      await beforeDeadline(Promise.all(started.map((event) => event.promise)));
      controller.abort();
      await expect(response).rejects.toBeDefined();
      await beforeDeadline(Promise.all(aborted.map((event) => event.promise)));
      const log = await beforeDeadline(completed.promise);
      expect(log.outcomes).toEqual([{ provider: "discovery", outcome: "ok" }]);
    } finally {
      await api.close();
    }
  });

  it("closes an actual provider HTTP response body when the shopping client disconnects", async () => {
    const started = deferred();
    const closed = deferred();
    const upstream = createServer((incoming, outgoing) => {
      incoming.resume();
      incoming.once("end", () => {
        outgoing.once("close", () => closed.resolve());
        outgoing.writeHead(200, { "Content-Type": "application/json" });
        outgoing.flushHeaders();
        outgoing.write("[");
        started.resolve();
      });
    });
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const { port } = upstream.address() as AddressInfo;
    const fixture = createFixtureProviders();
    const api = await mounted({ providers: {
      ...fixture,
      discovery: {
        ...fixture.discovery,
        discover: async (_, { signal }) => (await fetch(`http://127.0.0.1:${port}`, { signal })).json(),
      },
    } });
    try {
      const controller = new AbortController();
      const response = fetch(`${api.url}/api/turn`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload("turn")), signal: controller.signal,
      });
      await beforeDeadline(started.promise);
      controller.abort();
      await expect(response).rejects.toBeDefined();
      await beforeDeadline(closed.promise);
    } finally {
      await api.close();
      await close(upstream);
    }
  });
});
