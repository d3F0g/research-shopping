import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import type { ResearchOperation } from "../../src/domain/research";
import { createApp } from "../../src/server/app";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchTurns } from "../../src/server/research-turns";
import { createResearchQuota } from "../../src/server/research-quota";
import { syntheticAnswer } from "../fixtures/dynamic-research";

const preferences = () => {
  const value = defaultIntent();
  value.productDescription = "Headphones";
  return value;
};
const request = (message = "Headphones under SGD300") => ({
  message,
  preferences: preferences(),
  operationId: randomUUID(),
});
const post = (
  app: ReturnType<typeof createApp>,
  body: unknown,
  route = "turn",
) =>
  app.request(`http://127.0.0.1:3000/api/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
async function quotaPath() {
  return join(await mkdtemp(join(tmpdir(), "fieldnote-turn-")), "usage.json");
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function close(server: Server) {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

describe("normal research composition", () => {
  it("never returns fixtures when no provider is configured and disables legacy paid or merchant routes", async () => {
    const app = createApp();
    const response = await post(app, request());
    expect(await response.json()).toMatchObject({
      kind: "research-unavailable",
      reason: "not-configured",
    });
    expect(
      await (await app.request("http://127.0.0.1:3000/api/health")).json(),
    ).toMatchObject({
      mode: "research",
      liveIntegrations: false,
      merchantVerification: "unavailable",
    });
    expect(
      (
        await post(
          app,
          { productId: "sony-wh-ch720n", preferences: preferences() },
          "select",
        )
      ).status,
    ).toBe(409);
    expect(
      await (
        await post(
          app,
          { productIds: ["sony-wh-ch720n"], preferences: preferences() },
          "research",
        )
      ).json(),
    ).toEqual({ status: "disabled" });
  });
  it("requires a bounded operation UUID before any research and rejects client evidence fields", async () => {
    const app = createApp();
    expect(
      (await post(app, { message: "Headphones", preferences: preferences() }))
        .status,
    ).toBe(400);
    expect(
      (await post(app, { ...request(), research: syntheticAnswer() })).status,
    ).toBe(400);
  });
  it("makes no calls for ordinary conversation, detail changes, ambiguous edits or invalid budgets", async () => {
    let calls = 0;
    const research: ResearchOperation = async () => {
      calls++;
      return { status: "unavailable", reason: "empty", reportedCostUsd: 0.007 };
    };
    const turns = createResearchTurns({
      research,
      quota: createResearchQuota(await quotaPath()),
    });
    for (const message of [
      "Hi",
      "Thanks",
      "More detail",
      "Shorter",
      "Remove that requirement",
      "Headphones under EUR200",
    ]) {
      const result = await turns.turn(
        request(message),
        new AbortController().signal,
      );
      expect(JSON.stringify(result)).not.toMatch(
        /sample catalog|this fixture|compare sample/i,
      );
    }
    expect(calls).toBe(0);
    await turns.turn(request(), new AbortController().signal);
    expect(calls).toBe(1);
  });
  it.each([
    "projectors under 200 CHF",
    "projectors under CHF200",
    "projectors under ₹200",
  ])(
    "preserves the current HTTP intent and blocks paid dispatch for %s",
    async (message) => {
      let calls = 0;
      const app = createApp({
        researchTurns: createResearchTurns({
          research: async () => {
            calls++;
            return {
              status: "unavailable",
              reason: "empty",
              reportedCostUsd: 0.005,
            };
          },
          quota: createResearchQuota(await quotaPath()),
        }),
      });
      const previous = {
        ...preferences(),
        budget: { amount: 300, currency: "SGD" as const },
        budgetClarified: true,
      };
      const response = await post(app, {
        ...request(message),
        preferences: previous,
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        kind: "clarification",
        reason: "currency",
        preferences: previous,
      });
      expect(calls).toBe(0);
    },
  );
  it("asks an optional budget question and continues the retained request after skip", async () => {
    const seen: unknown[] = [];
    const turns = createResearchTurns({
      research: async (request) => {
        seen.push(request.preferences);
        return {
          status: "unavailable",
          reason: "empty",
          reportedCostUsd: 0.005,
        };
      },
      quota: createResearchQuota(await quotaPath()),
    });
    const question = await turns.turn(
      request("A ceramic fermentation crock with a water-seal lid"),
      new AbortController().signal,
    );
    expect(question.kind).toBe("question");
    expect(seen).toHaveLength(0);
    const result = await turns.turn(
      {
        ...request("Skip budget"),
        preferences: question.preferences,
        skipBudget: true,
      },
      new AbortController().signal,
    );
    expect(result.kind).toBe("research-unavailable");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      budgetClarified: true,
      productDescription: expect.stringContaining("fermentation crock"),
    });
  });
  it("stages explicit preference edits without spending and keeps separate sessions independent", async () => {
    const seen: unknown[] = [];
    const turns = createResearchTurns({
      research: async (request) => {
        seen.push(request.preferences);
        return {
          status: "unavailable",
          reason: "empty",
          reportedCostUsd: 0.005,
        };
      },
      quota: createResearchQuota(await quotaPath()),
    });
    const edited = await turns.turn(
      {
        ...request(),
        edit: { kind: "add-criterion", wording: "no glass", strength: "hard" },
      },
      new AbortController().signal,
    );
    expect(edited.kind).toBe("message");
    expect(seen).toHaveLength(0);
    await turns.turn(
      { ...request(), preferences: edited.preferences },
      new AbortController().signal,
    );
    await turns.turn(
      request("A tea scale under SGD100"),
      new AbortController().signal,
    );
    expect(seen[0]).toMatchObject({ criteria: [{ wording: "no glass" }] });
    expect(seen[1]).toMatchObject({ criteria: [] });
  });
  it.each(["unknown-cost", "provider-error", "overrun"])(
    "stops subsequent work after %s without a retry",
    async (reason) => {
      let calls = 0;
      const turns = createResearchTurns({
        research: async () => {
          calls++;
          return {
            status: "unavailable",
            reason: reason === "provider-error" ? "provider-error" : "empty",
            ...(reason === "unknown-cost"
              ? {}
              : { reportedCostUsd: reason === "overrun" ? 0.06 : 0 }),
          };
        },
        quota: createResearchQuota(await quotaPath()),
      });
      await turns.turn(request(), new AbortController().signal);
      expect(
        await turns.turn(request(), new AbortController().signal),
      ).toMatchObject({ kind: "research-unavailable", reason: "quota" });
      expect(calls).toBe(1);
    },
  );
  it("rejects duplicates without billing twice or returning another request's evidence", async () => {
    let calls = 0;
    const research: ResearchOperation = async () => {
      calls++;
      return { status: "unavailable", reason: "empty", reportedCostUsd: 0.007 };
    };
    const turns = createResearchTurns({
      research,
      quota: createResearchQuota(await quotaPath()),
    });
    const submitted = request();
    await turns.turn(submitted, new AbortController().signal);
    const duplicate = await turns.turn(
      { ...submitted, message: "Laptops under SGD1000" },
      new AbortController().signal,
    );
    expect(duplicate).toMatchObject({
      kind: "research-unavailable",
      reason: "duplicate",
    });
    expect(calls).toBe(1);
  });
  it("does not start an external operation for a pre-aborted caller", async () => {
    let calls = 0;
    const controller = new AbortController();
    controller.abort();
    const turns = createResearchTurns({
      research: async () => {
        calls++;
        return { status: "unavailable", reason: "empty" };
      },
      quota: createResearchQuota(await quotaPath()),
    });
    await expect(
      turns.turn(request(), controller.signal),
    ).rejects.toBeDefined();
    expect(calls).toBe(0);
  });
  it.each(["before-headers", "during-body"] as const)(
    "propagates mounted disconnect to real SDK HTTP transport %s and retains the budget reservation",
    async (phase) => {
      const started = deferred();
      const upstreamClosed = deferred();
      const upstream = createServer((incoming, outgoing) => {
        incoming.resume();
        incoming.once("end", () => {
          outgoing.once("close", upstreamClosed.resolve);
          if (phase === "during-body") {
            outgoing.writeHead(200, { "Content-Type": "application/json" });
            outgoing.flushHeaders();
            outgoing.write('{"answer":');
          }
          started.resolve();
        });
      });
      upstream.listen(0, "127.0.0.1");
      await once(upstream, "listening");
      const path = await quotaPath();
      const turns = createResearchTurns({
        research: createExaProductResearch("fake-test-key", {
          baseUrl: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
          timeoutMs: 2000,
        }),
        quota: createResearchQuota(path),
      });
      const reservation = createServer();
      reservation.listen(0, "127.0.0.1");
      await once(reservation, "listening");
      const port = (reservation.address() as AddressInfo).port;
      await close(reservation);
      const app = createApp(
        { researchTurns: turns },
        { apiPort: port, webPort: port },
      );
      const listening = deferred();
      const server = serve(
        { fetch: app.fetch, hostname: "127.0.0.1", port },
        listening.resolve,
      ) as Server;
      await listening.promise;
      try {
        const controller = new AbortController();
        const response = fetch(`http://127.0.0.1:${port}/api/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request()),
          signal: controller.signal,
        });
        await started.promise;
        controller.abort();
        await expect(response).rejects.toBeDefined();
        await Promise.race([
          upstreamClosed.promise,
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Upstream did not close before deadline")),
              500,
            ),
          ),
        ]);
        await close(server);
        const ledger = JSON.parse(await readFile(path, "utf8"));
        expect(ledger.attempts).toHaveLength(1);
        expect(ledger.attempts[0].reservedUsd).toBe(0.05);
        expect(
          await createResearchQuota(path).reserve(randomUUID(), "a".repeat(64)),
        ).not.toBe("admitted");
      } finally {
        if (server.listening) await close(server);
        await close(upstream);
      }
    },
  );
});
