import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import net from "node:net";
import { request as httpRequest } from "node:http";
import { conversationPolicy } from "../../src/domain/conversation-policy";
import {
  createAccounts,
  accountConfiguration,
} from "../../src/server/accounts";
import { createApp, type RequestLog } from "../../src/server/app";
import {
  assertDatabaseReady,
  migrate,
  migrationManifest,
} from "../../src/server/migrations";
import { defaultPreferences } from "../../src/domain/contracts";
import type {
  ApplicationTurnResponse,
  ResearchTurns,
} from "../../src/domain/research";
import legacyCapture from "../fixtures/research-history/unversioned-application-response.json";
import {
  version2Response,
  storedResearchTurn,
  legacyBrowserResponse,
} from "../fixtures/research-history/records";
import {
  RETENTION_MS,
  workspaceBytes,
  WORKSPACE_LIMIT,
  type WorkspaceAction,
} from "../../src/domain/workspace";
import { createResearchTurns } from "../../src/server/research-turns";

if (!process.env.FIELDNOTE_TEST_DATABASE_URL)
  throw new Error(
    "Run through npm run test:postgres against a fixture database",
  );
const pool = new Pool({
  connectionString: process.env.FIELDNOTE_TEST_DATABASE_URL,
  max: 12,
});
pool.on("error", () => undefined);
const secret = "fixture-only-local-auth-secret-32-characters";
let origin: string;
let server: ServerType;
let logs: RequestLog[] = [];
let calls = 0;
let hold: (() => void) | null = null;
let started: (() => void) | null = null;
let shouldHold = false;
let resultSize = 0;
let researchResult: unknown;
let identities: {
  cookie: string;
  id: string;
  session: Record<string, unknown>;
}[];
const operation: ResearchTurns = {
  async turn(request, signal) {
    calls++;
    if (shouldHold) {
      await new Promise<void>((resolve) => {
        const previous = hold;
        hold = () => {
          previous?.();
          resolve();
        };
        started?.();
      });
    }
    signal.throwIfAborted();
    if (researchResult)
      return structuredClone(researchResult) as ApplicationTurnResponse;
    return {
      kind: "message",
      message: "Local fixture research result",
      preferences: conversationPolicy(request.message, request.preferences)
        .preferences,
      notes: resultSize
        ? Array.from({ length: resultSize }, () => "x".repeat(240))
        : [],
      toolActivity: [],
    };
  },
};
const post = (
  path: string,
  body: unknown,
  cookie = "",
  extras: Record<string, string> = {},
) =>
  fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, cookie, ...extras },
    body: JSON.stringify(body),
  });
const state = async (cookie: string) => {
  const response = await fetch(`${origin}/api/account`, {
    headers: { cookie },
  });
  return response.json();
};
const command = (
  cookie: string,
  revision: number,
  action: WorkspaceAction,
  operationId = randomUUID(),
) => post("/api/workspace", { revision, operationId, command: action }, cookie);
async function pending(cookie: string) {
  shouldHold = true;
  const operationId = randomUUID();
  const observed = new Promise<void>((resolve) => {
    started = resolve;
  });
  const response = command(
    cookie,
    0,
    { kind: "message", text: "headphones under SGD300" },
    operationId,
  );
  await observed;
  const account = await state(cookie);
  return {
    operationId,
    response,
    workspace: account.workspace,
    release() {
      shouldHold = false;
      hold?.();
      hold = null;
    },
  };
}

beforeAll(async () => {
  const listener = net.createServer();
  await new Promise<void>((resolve) =>
    listener.listen(0, "127.0.0.1", resolve),
  );
  const port = (listener.address() as net.AddressInfo).port;
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  origin = `http://127.0.0.1:${port}`;
  await migrate(pool);
  const app = createApp(
    {
      accounts: createAccounts(pool, origin, secret, operation),
      researchTurns: createResearchTurns({ unavailableReason: "disabled" }),
      logger: (event) => logs.push(event),
    },
    { apiPort: port, webPort: port },
  );
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
  identities = [];
  for (let i = 0; i < 3; i++) {
    const response = await post("/api/auth/sign-up/email", {
      name: `Fixture ${i}`,
      email: `fixture-${randomUUID()}@example.test`,
      password: "fixture-password-long-only",
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(response.headers.getSetCookie().join(" ")).toContain("HttpOnly");
    expect(response.headers.getSetCookie().join(" ")).toContain("SameSite=Lax");
    expect(response.headers.getSetCookie().join(" ")).not.toMatch(
      /Domain=|session_data/i,
    );
    const body = await response.json();
    const session = (
      await pool.query('SELECT * FROM "session" WHERE "userId" = $1', [
        body.user.id,
      ])
    ).rows[0];
    identities.push({ cookie, id: body.user.id, session });
  }
});
beforeEach(async () => {
  hold?.();
  hold = null;
  started = null;
  shouldHold = false;
  calls = 0;
  resultSize = 0;
  researchResult = undefined;
  logs = [];
  await pool.query("TRUNCATE shopping_workspace");
  for (const identity of identities) {
    const s = identity.session;
    await pool.query(
      'INSERT INTO "session" (id, "expiresAt", token, "createdAt", "updatedAt", "userId") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET "expiresAt" = EXCLUDED."expiresAt"',
      [s.id, s.expiresAt, s.token, s.createdAt, s.updatedAt, s.userId],
    );
  }
});
afterAll(async () => {
  hold?.();
  server?.close();
  await pool.end();
});

describe("PostgreSQL account workspace through HTTP cookies", () => {
  async function seedLegacy(value: unknown = legacyCapture) {
    const identity = identities[0];
    await state(identity.cookie);
    const row = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identity.id],
      )
    ).rows[0].data;
    row.turns = [storedResearchTurn(value)];
    await pool.query(
      "UPDATE shopping_workspace SET data = $2::jsonb WHERE user_id = $1",
      [identity.id, JSON.stringify(row)],
    );
    return row;
  }

  it("preserves actual legacy bytes and new v2 evidence through commands, hydration and replay", async () => {
    const { cookie, id } = identities[0];
    const before = await seedLegacy();
    const restored = await state(cookie);
    expect(restored.workspace.turns).toEqual(before.turns);
    expect(calls).toBe(0);
    researchResult = version2Response;
    const operationId = randomUUID();
    const action = {
      kind: "message" as const,
      text: "headphones under SGD250",
    };
    const response = await command(
      cookie,
      restored.workspace.revision,
      action,
      operationId,
    );
    expect(response.status).toBe(200);
    const saved = (await response.json()).workspace;
    expect(saved.turns[0]).toEqual(before.turns[0]);
    expect(saved.turns[1].body.value).toEqual(version2Response);
    expect(saved.turns[1].body.value.research.products[0].price.quote).toBe(
      "S$ 249 was S$ 349 SGD You Save S$ 100",
    );
    expect(saved.turns[1].body.value.research.products[1].facts).toEqual([]);
    expect(saved.preferences.hard.budget.amount).toBe(250);
    expect(saved.turns[0].body.value.preferences.hard.budget.amount).toBe(400);
    expect((await state(cookie)).workspace).toEqual(saved);
    expect(
      (await command(cookie, restored.workspace.revision, action, operationId))
        .status,
    ).toBe(200);
    expect(calls).toBe(1);
    const ordinary = (
      await (
        await command(cookie, saved.revision, {
          kind: "message",
          text: "thanks",
        })
      ).json()
    ).workspace;
    expect(ordinary.turns.slice(0, 2)).toEqual(saved.turns);
    expect(calls).toBe(1);
    const stored = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [id],
      )
    ).rows[0].data;
    expect(stored.turns[0]).toEqual(before.turns[0]);
    expect(stored.turns[1].body.value).toEqual(version2Response);
    expect((await state(identities[1].cookie)).workspace.turns).toEqual([]);
  });

  it.each([
    { version: 3 },
    { version: "2" },
    { version: null },
    { version: 2 },
    { extra: "assessmentVersion" },
  ])(
    "rejects unreadable stored evidence without rewriting it %j",
    async (change) => {
      const bad = structuredClone(legacyBrowserResponse);
      if ("version" in change)
        Object.assign(bad.research, { evidenceVersion: change.version });
      else Object.assign(bad.research, { assessmentVersion: 1 });
      const before = await seedLegacy(bad);
      expect((await state(identities[0].cookie)).status).toBe("unavailable");
      expect(
        (
          await command(identities[0].cookie, 0, {
            kind: "message",
            text: "hello",
          })
        ).status,
      ).toBe(503);
      const after = (
        await pool.query(
          "SELECT data FROM shopping_workspace WHERE user_id = $1",
          [identities[0].id],
        )
      ).rows[0].data;
      expect(after).toEqual(before);
      expect(calls).toBe(0);
    },
  );

  it.each(["legacy", "malformed-v2"])(
    "rejects a newly completed %s research response",
    async (kind) => {
      researchResult =
        kind === "legacy"
          ? legacyCapture
          : {
              ...legacyBrowserResponse,
              research: {
                ...legacyBrowserResponse.research,
                evidenceVersion: 2,
              },
            };
      const response = await command(identities[0].cookie, 0, {
        kind: "message",
        text: "headphones under SGD250",
      });
      const workspace = (await response.json()).workspace;
      expect(workspace.turns[0].body).toEqual({
        status: "interrupted",
        reason: "failed",
      });
      expect(calls).toBe(1);
    },
  );

  it("counts v2 identities and price quotes in canonical UTF-8 workspace limits and trims whole turns", async () => {
    const large = structuredClone(version2Response);
    if (large.kind !== "research")
      throw new Error("Expected a research fixture");
    const quote = "Automated fixture " + "😀".repeat(300);
    large.research.sources = Array.from({ length: 5 }, (_, index) => ({
      id: `large-${index}`,
      title: "Automated fixture source",
      url: `https://example.com/large-fixture-${index}`,
      highlights: [quote, quote, quote],
    }));
    large.research.products = large.research.sources.map((source, index) => ({
      id: `large-product-${index}`,
      name: "Automated fixture product",
      identity: { kind: "direct-model-statement", sourceId: source.id, quote },
      facts: Array.from({ length: 3 }, () => ({ sourceId: source.id, quote })),
      price: {
        kind: "page-price-context-unverified",
        sourceId: source.id,
        quote,
      },
      stock: "unverified",
      unresolvedConstraints: Array.from({ length: 16 }, () => "😀".repeat(90)),
    }));
    large.research.limitations = Array.from({ length: 12 }, () =>
      "😀".repeat(150),
    );
    large.notes = Array.from({ length: 12 }, () => "😀".repeat(150));
    large.research.grounding = Array.from({ length: 30 }, () => ({
      field: "😀".repeat(120),
      sourceIds: [],
    }));
    researchResult = large;
    let revision = 0;
    const ids: string[] = [];
    for (let index = 0; index < 4; index++) {
      const response = await command(identities[0].cookie, revision, {
        kind: "message",
        text: `headphones under SGD${250 + index}`,
      });
      expect(response.status).toBe(200);
      const saved = (await response.json()).workspace;
      revision = saved.revision;
      ids.push(saved.turns.at(-1).id);
      for (const turn of saved.turns)
        expect(turn.body).toEqual({ status: "complete", value: large });
    }
    const data = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    expect(data.turns.length).toBeGreaterThan(0);
    expect(data.turns.length).toBeLessThan(4);
    expect(data.turns.map((turn: { id: string }) => turn.id)).toEqual(
      ids.slice(-data.turns.length),
    );
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      WORKSPACE_LIMIT,
    );
    expect(calls).toBe(4);
  });

  it("persists ordinary messages, questions and immutable preferences without provider work", async () => {
    const { cookie } = identities[0];
    const hello = await command(cookie, 0, { kind: "message", text: "hello" });
    expect(hello.status).toBe(200);
    let saved = (await hello.json()).workspace;
    expect(saved.turns[0].body.value.kind).toBe("message");
    expect(saved.turns[0].createdAt).toMatch(/Z$/);
    const question = await command(cookie, saved.revision, {
      kind: "message",
      text: "headphones",
    });
    saved = (await question.json()).workspace;
    expect(saved.turns[1].body.status).toBe("question");
    expect(saved.turns[0].request.preferences.hard.category).toBeNull();
    expect(saved.preferences.hard.category).toBe("headphones");
    expect(calls).toBe(0);
    const final = await command(cookie, saved.revision, {
      kind: "message",
      text: "under SGD200",
    });
    saved = (await final.json()).workspace;
    expect(saved.preferences.hard.budget.amount).toBe(200);
    expect(saved.turns[1].body.preferences.hard.budget).toBeNull();
    expect((await state(cookie)).workspace).toEqual(saved);
    expect(calls).toBe(1);
    expect(JSON.stringify(logs)).not.toMatch(
      /fixture-password|headphones|session_token|example.test/,
    );
  });

  it("rejects missing, forged, expired and revoked sessions before research", async () => {
    for (const cookie of ["", "fieldnote.session_token=forged"]) {
      expect(
        (
          await command(cookie, 0, {
            kind: "message",
            text: "headphones under SGD200",
          })
        ).status,
      ).toBe(401);
    }
    await pool.query(
      'UPDATE "session" SET "expiresAt" = clock_timestamp() - interval \'1 second\' WHERE id = $1',
      [identities[0].session.id],
    );
    expect(
      (
        await command(identities[0].cookie, 0, {
          kind: "message",
          text: "headphones under SGD200",
        })
      ).status,
    ).toBe(401);
    await pool.query('DELETE FROM "session" WHERE id = $1', [
      identities[1].session.id,
    ]);
    expect(
      (
        await command(identities[1].cookie, 0, {
          kind: "message",
          text: "headphones under SGD200",
        })
      ).status,
    ).toBe(401);
    expect(calls).toBe(0);
    expect(
      (await pool.query("SELECT count(*) FROM shopping_workspace")).rows[0]
        .count,
    ).toBe("0");
  });

  it("isolates accounts even when B knows A's real turn and operation identifiers", async () => {
    const active = await pending(identities[0].cookie);
    const b = identities[1].cookie;
    const before = await pool.query(
      "SELECT data FROM shopping_workspace WHERE user_id = $1",
      [identities[0].id],
    );
    expect((await state(b)).workspace.turns).toEqual([]);
    expect(
      (await command(b, 0, { kind: "cancel", target: active.operationId }))
        .status,
    ).toBe(409);
    expect(
      (
        await post(
          "/api/workspace",
          {
            revision: 0,
            operationId: randomUUID(),
            userId: identities[0].id,
            command: { kind: "new-chat" },
          },
          b,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          "/api/workspace",
          {
            revision: 0,
            operationId: randomUUID(),
            command: {
              kind: "delete-saved-data",
              turnId: active.workspace.turns[0].id,
            },
          },
          b,
        )
      ).status,
    ).toBe(400);
    expect((await command(b, 0, { kind: "new-chat" })).status).toBe(200);
    const after = await pool.query(
      "SELECT data FROM shopping_workspace WHERE user_id = $1",
      [identities[0].id],
    );
    expect(after.rows).toEqual(before.rows);
    expect(calls).toBe(1);
    active.release();
    expect((await active.response).status).toBe(200);
  });

  it("keeps in-process cancellation isolated when two accounts use the same operation UUID", async () => {
    const a = await pending(identities[0].cookie);
    const observedB = new Promise<void>((resolve) => {
      started = resolve;
    });
    const responseB = command(
      identities[1].cookie,
      0,
      { kind: "message", text: "headphones under SGD300" },
      a.operationId,
    );
    await observedB;
    expect(
      (
        await command(identities[0].cookie, a.workspace.revision, {
          kind: "cancel",
          target: a.operationId,
        })
      ).status,
    ).toBe(200);
    a.release();
    expect((await a.response).status).toBe(409);
    const resultB = await responseB;
    expect(resultB.status).toBe(200);
    expect((await resultB.json()).workspace.turns[0].body.status).toBe(
      "complete",
    );
  });

  it("keeps exact cancellation idempotent and distinguishes a reused operation after reset", async () => {
    const cookie = identities[0].cookie;
    const first = await pending(cookie);
    const reset = await command(cookie, first.workspace.revision, {
      kind: "new-chat",
    });
    const empty = (await reset.json()).workspace;
    const observed = new Promise<void>((resolve) => {
      started = resolve;
    });
    const secondResponse = command(
      cookie,
      empty.revision,
      { kind: "message", text: "headphones under SGD200" },
      first.operationId,
    );
    await observed;
    const second = (await state(cookie)).workspace;
    const cancellationId = randomUUID();
    const action = { kind: "cancel" as const, target: first.operationId };
    const cancelled = await command(
      cookie,
      second.revision,
      action,
      cancellationId,
    );
    const cancelledWorkspace = (await cancelled.json()).workspace;
    const duplicate = await command(
      cookie,
      second.revision,
      action,
      cancellationId,
    );
    expect((await duplicate.json()).workspace).toEqual(cancelledWorkspace);
    first.release();
    expect((await first.response).status).toBe(409);
    expect((await secondResponse).status).toBe(409);
    expect((await state(cookie)).workspace).toEqual(cancelledWorkspace);
  });

  it("deduplicates pending and lost-response retries, and rejects changed payloads and stale versions", async () => {
    const cookie = identities[0].cookie;
    const active = await pending(cookie);
    const repeat = await command(
      cookie,
      0,
      { kind: "message", text: "headphones under SGD300" },
      active.operationId,
    );
    expect((await repeat.json()).operation.status).toBe("pending");
    expect(
      (
        await command(
          cookie,
          0,
          { kind: "message", text: "headphones under SGD100" },
          active.operationId,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await command(cookie, 0, {
          kind: "message",
          text: "headphones under SGD200",
        })
      ).status,
    ).toBe(409);
    active.release();
    const completed = await (await active.response).json();
    const lostResponseRetry = await command(
      cookie,
      0,
      { kind: "message", text: "headphones under SGD300" },
      active.operationId,
    );
    expect((await lostResponseRetry.json()).workspace).toEqual(
      completed.workspace,
    );
    expect(calls).toBe(1);
  });

  it.each([
    "new-chat",
    "delete-saved-data",
    "cancel",
    "apply-preferences",
  ] as const)("invalidates a held result when %s commits", async (kind) => {
    const cookie = identities[0].cookie;
    const active = await pending(cookie);
    const prefs = defaultPreferences();
    prefs.hard.category = "laptops";
    const action: WorkspaceAction =
      kind === "cancel"
        ? { kind, target: active.operationId }
        : kind === "apply-preferences"
          ? { kind, preferences: prefs }
          : { kind };
    if (kind === "apply-preferences") shouldHold = false;
    const invalidation = await command(
      cookie,
      active.workspace.revision,
      action,
    );
    expect(invalidation.status).toBe(200);
    const expected = (await invalidation.json()).workspace;
    active.release();
    expect((await active.response).status).toBe(409);
    const saved = (await state(cookie)).workspace;
    expect(saved).toEqual(expected);
    if (kind === "new-chat" || kind === "delete-saved-data") {
      expect(saved.turns).toEqual([]);
      expect(saved.preferences).toEqual(defaultPreferences());
      const row = (
        await pool.query(
          "SELECT data FROM shopping_workspace WHERE user_id = $1",
          [identities[0].id],
        )
      ).rows[0].data;
      expect(JSON.stringify(row)).not.toContain("headphones");
      expect(row.pending).toBeNull();
    } else if (kind === "cancel") {
      expect(saved.turns[0].body.status).toBe("interrupted");
      expect(saved.revision).toBeGreaterThan(active.workspace.revision);
    } else expect(saved.preferences.hard.category).toBe("laptops");
  });

  it.each(["signout", "expire", "retention"] as const)(
    "prevents late publication after %s",
    async (mode) => {
      const cookie = identities[0].cookie;
      const active = await pending(cookie);
      if (mode === "signout")
        expect((await post("/api/auth/sign-out", {}, cookie)).status).toBe(200);
      if (mode === "expire")
        await pool.query(
          'UPDATE "session" SET "expiresAt" = clock_timestamp() - interval \'1 second\' WHERE id = $1',
          [identities[0].session.id],
        );
      if (mode === "retention")
        await pool.query(
          "UPDATE shopping_workspace SET data = jsonb_set(data, '{mutatedAt}', $2::jsonb) WHERE user_id = $1",
          [
            identities[0].id,
            JSON.stringify(
              new Date(Date.now() - RETENTION_MS - 1000).toISOString(),
            ),
          ],
        );
      active.release();
      expect([401, 409]).toContain((await active.response).status);
      const row = (
        await pool.query(
          "SELECT data FROM shopping_workspace WHERE user_id = $1",
          [identities[0].id],
        )
      ).rows[0].data;
      expect(
        row.turns.some(
          (turn: { body: { status: string } }) =>
            turn.body.status === "complete",
        ),
      ).toBe(false);
    },
  );

  it("uses wall-clock expiry after a session-lock wait", async () => {
    const cookie = identities[0].cookie;
    const active = await pending(cookie);
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query(
      'UPDATE "session" SET "expiresAt" = clock_timestamp() + interval \'250 milliseconds\' WHERE id = $1',
      [identities[0].session.id],
    );
    active.release();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await client.query("COMMIT");
    client.release();
    expect((await active.response).status).toBe(401);
  });

  it("expires old turns despite newer activity and never renews preference TTL on reads", async () => {
    const cookie = identities[0].cookie;
    await command(cookie, 0, { kind: "message", text: "hello" });
    let row = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    row.turns[0].createdAt = new Date(
      Date.now() - RETENTION_MS - 1000,
    ).toISOString();
    row.receipts[0].createdAt = row.turns[0].createdAt;
    row.preferences.hard.category = "headphones";
    row.mutatedAt = new Date(Date.now() - RETENTION_MS - 1000).toISOString();
    await pool.query(
      "UPDATE shopping_workspace SET data = $2 WHERE user_id = $1",
      [identities[0].id, row],
    );
    const saved = (await state(cookie)).workspace;
    expect(saved.turns).toEqual([]);
    expect(saved.preferences.hard.category).toBeNull();
    row = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    expect(row.mutatedAt).toBeNull();
    expect(row.receipts).toEqual([]);
  });

  it("does not renew current preference retention for an ordinary message", async () => {
    const cookie = identities[0].cookie;
    const question = await command(cookie, 0, {
      kind: "message",
      text: "headphones",
    });
    const workspace = (await question.json()).workspace;
    const original = new Date(Date.now() - RETENTION_MS + 60_000).toISOString();
    await pool.query(
      "UPDATE shopping_workspace SET data = jsonb_set(data, '{mutatedAt}', $2::jsonb) WHERE user_id = $1",
      [identities[0].id, JSON.stringify(original)],
    );
    expect(
      (
        await command(cookie, workspace.revision, {
          kind: "message",
          text: "hello",
        })
      ).status,
    ).toBe(200);
    const row = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    expect(row.mutatedAt).toBe(original);
  });

  it("marks abandoned pending work interrupted without replaying after its deadline", async () => {
    const active = await pending(identities[0].cookie);
    await pool.query(
      "UPDATE shopping_workspace SET data = jsonb_set(data, '{pending,deadline}', $2::jsonb) WHERE user_id = $1",
      [
        identities[0].id,
        JSON.stringify(new Date(Date.now() - 1000).toISOString()),
      ],
    );
    const saved = (await state(identities[0].cookie)).workspace;
    expect(saved.pendingOperationId).toBeNull();
    expect(saved.turns[0].body.status).toBe("interrupted");
    active.release();
    expect((await active.response).status).toBe(409);
    expect(calls).toBe(1);
  });

  it("bounds whole records and stored bytes including receipts", async () => {
    const cookie = identities[0].cookie;
    let revision = 0;
    for (let i = 0; i < 55; i++) {
      const response = await command(cookie, revision, {
        kind: "message",
        text: "hello",
      });
      expect(response.status).toBe(200);
      revision = (await response.json()).workspace.revision;
    }
    const data = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    expect(data.turns).toHaveLength(50);
    expect(workspaceBytes(data)).toBeLessThanOrEqual(WORKSPACE_LIMIT);
  });

  it("returns a bounded interruption when a validated response exceeds the whole workspace limit", async () => {
    resultSize = 1500;
    const response = await command(identities[0].cookie, 0, {
      kind: "message",
      text: "headphones under SGD200",
    });
    expect(response.status).toBe(200);
    const workspace = (await response.json()).workspace;
    expect(workspace.turns[0].body).toEqual({
      status: "interrupted",
      reason: "too-large",
    });
    const data = (
      await pool.query(
        "SELECT data FROM shopping_workspace WHERE user_id = $1",
        [identities[0].id],
      )
    ).rows[0].data;
    expect(workspaceBytes(data)).toBeLessThanOrEqual(WORKSPACE_LIMIT);
  });

  it("admits only one concurrent command for a revision", async () => {
    const responses = await Promise.all([
      command(identities[0].cookie, 0, { kind: "message", text: "hello" }),
      command(identities[0].cookie, 0, { kind: "message", text: "thanks" }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect((await state(identities[0].cookie)).workspace.turns).toHaveLength(1);
    expect(calls).toBe(0);
  });

  it("fails closed when persistence loses readiness and never routes an account write as a guest", async () => {
    await pool.query(
      "ALTER TABLE shopping_workspace RENAME TO unavailable_fixture_workspace",
    );
    try {
      expect(
        (
          await command(identities[0].cookie, 0, {
            kind: "message",
            text: "headphones under SGD200",
          })
        ).status,
      ).toBe(503);
      expect((await state(identities[0].cookie)).status).toBe("unavailable");
      expect(
        (
          await post(
            "/api/turn",
            {
              message: "headphones under SGD200",
              preferences: defaultPreferences(),
              operationId: randomUUID(),
            },
            identities[0].cookie,
          )
        ).status,
      ).toBe(409);
      expect(calls).toBe(0);
    } finally {
      await pool.query(
        "ALTER TABLE unavailable_fixture_workspace RENAME TO shopping_workspace",
      );
    }
  });

  it("rejects unsafe origins, hosts, unknown fields and streamed oversized auth bodies", async () => {
    expect(
      (
        await post("/api/auth/sign-in/email", {}, "", {
          origin: "http://localhost:9999",
        })
      ).status,
    ).toBe(403);
    const hostileHost = await new Promise<number | undefined>((resolve) => {
      const request = httpRequest(
        `${origin}/api/workspace`,
        {
          method: "POST",
          headers: {
            host: "evil.test",
            origin,
            "content-type": "application/json",
          },
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      );
      request.end("{}");
    });
    expect(hostileHost).toBe(403);
    const noOrigin = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(noOrigin.status).toBe(403);
    const stream = new ReadableStream({
      start(controller) {
        for (let i = 0; i < 20; i++)
          controller.enqueue(new TextEncoder().encode("x".repeat(1024)));
        controller.close();
      },
    });
    const oversized = await fetch(`${origin}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit);
    expect(oversized.status).toBe(413);
    expect((await post("/api/auth/request-password-reset", {})).status).toBe(
      404,
    );
    expect(calls).toBe(0);
  });

  it("rate limits password attempts despite forged forwarding headers", async () => {
    let status = 0;
    for (let i = 0; i < 7; i++)
      status = (
        await post(
          "/api/auth/sign-in/email",
          { email: "missing@example.test", password: "fixture-only-password" },
          "",
          {
            "x-forwarded-for": `192.0.2.${i}`,
            "x-fieldnote-connection-ip": `192.0.2.${i}`,
          },
        )
      ).status;
    expect(status).toBe(429);
    expect(calls).toBe(0);
  });

  it("reports missing and partial configuration distinctly and disables production", () => {
    expect(accountConfiguration({})).toEqual({ status: "guest-only" });
    expect(
      accountConfiguration({
        NODE_ENV: "development",
        FIELDNOTE_DATABASE_URL: "postgresql://localhost/example",
      }),
    ).toEqual({ status: "unavailable" });
    expect(
      accountConfiguration({
        NODE_ENV: "production",
        FIELDNOTE_DATABASE_URL: "postgresql://localhost/example",
        FIELDNOTE_AUTH_ORIGIN: origin,
        FIELDNOTE_AUTH_SECRET: secret,
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("migrates the supported auth-only schema and leaves empty startup schema untouched", async () => {
    const schema = `fixture_${randomUUID().replaceAll("-", "")}`;
    await pool.query(`CREATE SCHEMA ${schema}`);
    const isolated = new Pool({
      connectionString: process.env.FIELDNOTE_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    try {
      await expect(assertDatabaseReady(isolated)).rejects.toThrow();
      expect(
        (
          await isolated.query(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = $1",
            [schema],
          )
        ).rows[0].count,
      ).toBe("0");
      const manifest = await migrationManifest();
      await isolated.query(
        "CREATE TABLE fieldnote_migration (name text PRIMARY KEY, checksum text NOT NULL)",
      );
      await isolated.query(manifest[0].sql);
      await isolated.query("INSERT INTO fieldnote_migration VALUES ($1, $2)", [
        manifest[0].name,
        manifest[0].checksum,
      ]);
      await migrate(isolated);
      await assertDatabaseReady(isolated);
    } finally {
      await isolated.end();
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    }
  });

  it("applies ordered migrations concurrently and rejects changed checksums", async () => {
    await Promise.all([migrate(pool), migrate(pool)]);
    await assertDatabaseReady(pool);
    const manifest = await migrationManifest();
    await pool.query(
      "UPDATE fieldnote_migration SET checksum = 'changed' WHERE name = $1",
      [manifest[0].name],
    );
    await expect(migrate(pool)).rejects.toThrow("checksum");
    await expect(assertDatabaseReady(pool)).rejects.toThrow();
    await pool.query(
      "UPDATE fieldnote_migration SET checksum = $2 WHERE name = $1",
      [manifest[0].name, manifest[0].checksum],
    );
  });
});
