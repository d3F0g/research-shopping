import { storedResearchV2 } from "../helpers/v2-stored-material";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { reduceTurn } from "../../src/domain/turn-reducer";
import type { ResearchOperation } from "../../src/domain/research";
import { RETENTION_MS, WORKSPACE_LIMIT, WorkspaceCommandSchema, workspaceBytes, type WorkspaceCommand } from "../../src/domain/workspace";
import { accountConfiguration, createAccounts } from "../../src/server/accounts";
import { assertDatabaseReady, migrate, migrationManifest } from "../../src/server/account-migrations";
import { cleanExpiredWorkspaces, createWorkspaceStore, type Identity } from "../../src/server/workspace-store";

const databaseUrl = process.env.FIELDNOTE_TEST_DATABASE_URL;
if (!databaseUrl || new URL(databaseUrl).pathname !== "/fieldnote_fixture") throw new Error("Use the owned temporary PostgreSQL test runner.");
const pool = new Pool({ connectionString: databaseUrl, max: 12 });
pool.on("error", () => undefined);
const origin = "http://127.0.0.1:5173";
const secret = "fixture-only-local-auth-secret-32-characters";
let calls = 0;
let hold: (() => void) | undefined;
let started: (() => void) | undefined;
let paused = false;
let oversized = false;
let observedSignal: AbortSignal | undefined;
const research: (intent: Parameters<ResearchOperation>[0]["intent"], operationId: string, signal: AbortSignal) => ReturnType<ResearchOperation> = async (intent, _operationId, signal) => {
  calls++; observedSignal = signal;
  if (paused) await new Promise<void>((resolve) => { hold = resolve; started?.(); });
  const text = "Fixture data: no merchant inventory or price is established.";
  const assessment = { status: "unknown" as const, scope: "unclear" as const, rationale: "Fixture data: no product facts are established.", support: [{ sourceId: "fixture", origin: { kind: "provider" as const, reportedQuote: "Fixture data", match: "literal" as const }, literal: { start: 0, end: 12, text: "Fixture data" }, context: { start: 0, end: text.length, text } }] };
  return { status: "ready", research: { version: 2, evidenceVersion: 3, dataKind: "test-fixture", intent: structuredClone(intent), retrievedAt: new Date().toISOString(), summary: "Fixture data: local research response.", products: [{ id: "fixture-item", name: "Fixture data item", variant: null, identity: assessment, requestMatch: assessment, requirements: [], attributes: [{ name: "Fixture data", assessment }], price: null, stock: "unverified", eligible: false, blockers: ["Fixture data: unresolved identity and request fit."] }], choice: null, sources: oversized ? Array.from({ length: 10 }, (_, i) => ({ id: `fixture-${i}`, url: `https://example.com/fixture-${i}`, title: "Fixture data", text: "測".repeat(24000), originalLength: 24000, textTruncated: false })) : [{ id: "fixture", url: "https://example.com/fixture", title: "Fixture data", text, originalLength: text.length, textTruncated: false }], limitations: ["Fixture data only. No paid requests or verified offers."], requestId: "fixture-request", reportedCostUsd: 0 } };
};
const dependencies = { reduce: reduceTurn, research };
let store = createWorkspaceStore(pool, dependencies);
let accounts = createAccounts(pool, origin, secret, dependencies);
let identities: Array<Identity & { cookie: string; email: string; token: string }> = [];
const authRequest = (path: string, body: unknown, cookie = "", extras: Record<string, string> = {}) => new Request(`${origin}/api/auth/${path}`, { method: "POST", headers: { origin, "content-type": "application/json", cookie, ...extras }, body: JSON.stringify(body) });
const command = (identity: Identity, input: WorkspaceCommand) => store.command(identity, input, new AbortController().signal);
const prepare = async (identity: Identity = identities[0], message = "A powerbank around SGD30-40", operationId: string = randomUUID(), revision?: number) => command(identity, { phase: "prepare", revision: revision ?? (await store.load(identity)).revision, operationId, message });
async function active(identity = identities[0]) {
  paused = true;
  const prepared = await prepare(identity);
  const observed = new Promise<void>((resolve) => { started = resolve; });
  const response = command(identity, { phase: "research", revision: prepared.workspace.revision, preparedId: prepared.workspace.pendingPreparedId! });
  await observed;
  return { prepared, response, release() { paused = false; hold?.(); hold = undefined; } };
}
async function data(userId = identities[0].userId) { return (await pool.query("SELECT data FROM fieldnote_v2_workspace WHERE user_id=$1", [userId])).rows[0].data; }
async function age(path: string, value: string, userId = identities[0].userId) { await pool.query("UPDATE fieldnote_v2_workspace SET data = jsonb_set(data, $2::text[], $3::jsonb) WHERE user_id=$1", [userId, path.split("."), JSON.stringify(value)]); }

beforeAll(async () => {
  await migrate(pool);
  for (let i = 0; i < 3; i++) {
    const email = `fixture-${randomUUID()}@example.test`;
    const response = await accounts.handle(authRequest("sign-up/email", { name: `Fixture ${i}`, email, password: "fixture-password-long-only" }));
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(" ")).toContain("HttpOnly");
    expect(response.headers.getSetCookie().join(" ")).toContain("SameSite=Lax");
    expect(response.headers.getSetCookie().join(" ")).not.toMatch(/Domain=|session_data/i);
    const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const body = await response.json();
    const session = (await pool.query('SELECT id, token FROM "session" WHERE "userId"=$1', [body.user.id])).rows[0];
    identities.push({ userId: body.user.id, sessionId: session.id, token: session.token, cookie, email });
  }
});
beforeEach(async () => {
  hold?.(); hold = undefined; started = undefined; calls = 0; paused = false; oversized = false; observedSignal = undefined;
  store = createWorkspaceStore(pool, dependencies);
  accounts = createAccounts(pool, origin, secret, dependencies);
  await pool.query("TRUNCATE fieldnote_v2_workspace, shopping_workspace");
  for (const identity of identities) await pool.query('INSERT INTO "session" (id, token, "expiresAt", "updatedAt", "userId") VALUES ($1,$2,clock_timestamp()+interval \'1 day\',clock_timestamp(),$3) ON CONFLICT (id) DO UPDATE SET "expiresAt"=EXCLUDED."expiresAt"', [identity.sessionId, identity.token, identity.userId]);
});
afterAll(async () => { hold?.(); await pool.end(); });

describe("V2 PostgreSQL account persistence", () => {
  it("keeps the original auth migrations byte-for-byte and adds a separate V2 table", async () => {
    expect((await migrationManifest()).map((item) => item.name)).toEqual(["001-better-auth.sql", "002-shopping-workspace.sql", "003-fieldnote-v2-workspace.sql"]);
    await pool.query("INSERT INTO shopping_workspace(user_id,data) VALUES($1,$2::jsonb)", [identities[0].userId, '{"schema":1,"historical":"untouched"}']);
    await prepare();
    await migrate(pool);
    expect((await pool.query("SELECT data FROM shopping_workspace")).rows[0].data).toEqual({ schema: 1, historical: "untouched" });
    await assertDatabaseReady(pool);
  });
  it("migrates the wrapper, freezes historical research and interrupts stale paid preparation", async () => {
    const prepared = await prepare();
    const previous = await data();
    previous.schema = 2;
    previous.state.messages.push({ id: "fixture-history", role: "assistant", text: "Fixture historical response", detail: "Fixture historical disclosure", research: storedResearchV2() });
    await pool.query("UPDATE fieldnote_v2_workspace SET data=$2::jsonb WHERE user_id=$1", [identities[0].userId, JSON.stringify(previous)]);
    const oldMessages = structuredClone(previous.state.messages);
    const loaded = await createWorkspaceStore(pool, dependencies).load(identities[0]);
    expect(loaded.state.messages).toEqual(oldMessages);
    expect(loaded.revision).toBe(prepared.workspace.revision + 1);
    expect(loaded.epoch).toBe(prepared.workspace.epoch + 1);
    expect(loaded.pendingPreparedId).toBeNull();
    const migrated = await data();
    expect(migrated.schema).toBe(3);
    expect(migrated.receipts).toEqual(previous.receipts.map((receipt: Record<string, unknown>) => ({ ...receipt, status: "interrupted" })));
    const stale = await command(identities[0], { phase: "research", revision: prepared.workspace.revision, preparedId: prepared.workspace.pendingPreparedId! });
    expect(stale.operation?.status).toBe("interrupted");
    expect(calls).toBe(0);
    const next = await prepare(identities[0], "Find a different powerbank under SGD50");
    const current = await command(identities[0], { phase: "research", revision: next.workspace.revision, preparedId: next.workspace.pendingPreparedId! });
    expect(current.response?.kind).toBe("research");
    const persisted = await createWorkspaceStore(pool, dependencies).load(identities[0]);
    expect(persisted.state.messages.slice(0, oldMessages.length)).toEqual(oldMessages);
    expect(persisted.state.messages.filter((message) => message.research).map((message) => message.research!.evidenceVersion)).toEqual([2, 3]);
    expect((await store.load(identities[1])).state.messages).toEqual([]);
    expect(calls).toBe(1);
  });
  it("persists the currency draft, both bounds, original request, and typed answer across instances", async () => {
    const first = await prepare(identities[0], "I want to buy a powerbank around $30-40.");
    expect(first.response?.kind).toBe("clarification");
    const reloaded = createWorkspaceStore(pool, dependencies);
    const before = await reloaded.load(identities[0]);
    expect(before.state.pending?.kind).toBe("currency");
    const answer = await reloaded.command(identities[0], { phase: "prepare", revision: before.revision, operationId: randomUUID(), message: "SGD.", questionId: before.state.pending!.id }, new AbortController().signal);
    expect(answer.response?.kind).toBe("prepared");
    expect(answer.workspace.state.intent.budget).toEqual({ minimum: 30, maximum: 40, currency: "SGD" });
    expect(answer.workspace.state.intent.originalText).toContain("powerbank");
    expect(answer.workspace.state.messages.map((message) => message.text)).toContain("I want to buy a powerbank around $30-40.");
    expect(calls).toBe(0);
  });
  it("stores ordinary replies without research and never uploads a guest conversation", async () => {
    const account = await accounts.state(new Headers({ cookie: identities[0].cookie }));
    expect(account.status).toBe("signed-in");
    if (account.status !== "signed-in") throw new Error("Fixture sign-in failed");
    expect(account.workspace.state.messages).toEqual([]);
    const reply = await prepare(identities[0], "Hello");
    expect(reply.response?.kind).toBe("message");
    expect((await store.load(identities[0])).state.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(calls).toBe(0);
  });
  it("persists immutable research snapshots separately from changed active preferences", async () => {
    const prepared = await prepare();
    const response = await command(identities[0], { phase: "research", revision: prepared.workspace.revision, preparedId: prepared.workspace.pendingPreparedId! });
    expect(response.response?.kind).toBe("research");
    const snapshot = structuredClone(response.workspace.state.messages.find((message) => message.research)!.research);
    expect(snapshot!.products[0].identity.support[0]).toMatchObject({ origin: { kind: "provider", reportedQuote: "Fixture data", match: "literal" }, literal: { start: 0, end: 12, text: "Fixture data" } });
    await prepare(identities[0], "Make it 50");
    const reloaded = await createWorkspaceStore(pool, dependencies).load(identities[0]);
    expect(reloaded.state.intent.budget).toEqual({ minimum: 30, maximum: 50, currency: "SGD" });
    expect(reloaded.state.messages.find((message) => message.research)!.research).toEqual(snapshot);
    expect(calls).toBe(1);
  });
  it("fails closed for missing, forged, expired and revoked sessions", async () => {
    for (const identity of [{ userId: identities[0].userId, sessionId: "forged" }, { userId: identities[1].userId, sessionId: identities[0].sessionId }]) await expect(prepare(identity)).rejects.toMatchObject({ status: 401 });
    await pool.query('UPDATE "session" SET "expiresAt"=clock_timestamp()-interval \'1 second\' WHERE id=$1', [identities[0].sessionId]);
    await expect(prepare()).rejects.toMatchObject({ status: 401 });
    await pool.query('DELETE FROM "session" WHERE id=$1', [identities[1].sessionId]);
    await expect(prepare(identities[1])).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(0);
  });
  it("does not expose or execute another account's actual prepared identity", async () => {
    const a = await prepare();
    const b = await store.load(identities[1]);
    expect(b.state.messages).toEqual([]);
    await expect(command(identities[1], { phase: "research", revision: b.revision, preparedId: a.workspace.pendingPreparedId! })).rejects.toMatchObject({ status: 409 });
    await expect(command(identities[1], { phase: "cancel", revision: b.revision, operationId: randomUUID(), target: a.workspace.pendingOperationId! })).rejects.toMatchObject({ status: 409 });
    expect(calls).toBe(0);
  });
  it("replays lost prepare and research responses without a second provider dispatch", async () => {
    const operationId = randomUUID();
    const a = await prepare(identities[0], "A powerbank around SGD30-40", operationId);
    const duplicate = await prepare(identities[0], "A powerbank around SGD30-40", operationId, 0);
    expect(duplicate.workspace.pendingPreparedId).toBe(a.workspace.pendingPreparedId);
    const input = { phase: "research" as const, revision: a.workspace.revision, preparedId: a.workspace.pendingPreparedId! };
    await command(identities[0], input);
    const replay = await command(identities[0], input);
    expect(replay.operation?.status).toBe("complete");
    expect(replay.response).toBeNull();
    expect(calls).toBe(1);
    await expect(prepare(identities[0], "Changed payload", operationId)).rejects.toMatchObject({ status: 409 });
  });
  it("deduplicates concurrent research across store instances", async () => {
    const running = await active();
    const second = createWorkspaceStore(pool, dependencies);
    const duplicate = await second.command(identities[0], { phase: "research", revision: running.prepared.workspace.revision, preparedId: running.prepared.workspace.pendingPreparedId! }, new AbortController().signal);
    expect(duplicate.operation?.status).toBe("running");
    expect(calls).toBe(1);
    running.release();
    await running.response;
  });
  it("admits only one concurrent prepare for a revision", async () => {
    const results = await Promise.allSettled([prepare(identities[0], "First objective", randomUUID(), 0), prepare(identities[0], "Second objective", randomUUID(), 0)]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
  });
  it("cancels the real request signal and prevents late publication", async () => {
    const running = await active();
    const workspace = await store.load(identities[0]);
    const operationId = randomUUID();
    const cancelled = await command(identities[0], { phase: "cancel", revision: workspace.revision, operationId, target: workspace.pendingOperationId! });
    expect(observedSignal?.aborted).toBe(true);
    const rejected = expect(running.response).rejects.toMatchObject({ status: 409 });
    running.release(); await rejected;
    const replay = await command(identities[0], { phase: "cancel", revision: workspace.revision, operationId, target: workspace.pendingOperationId! });
    expect(replay.workspace.revision).toBe(cancelled.workspace.revision);
    expect((await store.load(identities[0])).state.messages.some((message) => message.research)).toBe(false);
  });
  it("preserves ordinary presentation changes while a research request finishes", async () => {
    const running = await active();
    const edit = await prepare(identities[0], "Keep it short", randomUUID(), running.prepared.workspace.revision);
    expect(edit.workspace.pendingPreparedId).toBe(running.prepared.workspace.pendingPreparedId);
    running.release();
    const complete = await running.response;
    expect(complete.workspace.state.messages.map((message) => message.text)).toContain("Keep it short");
    expect(complete.workspace.state.intent.responseLength).toBe("concise");
    expect(complete.response?.kind).toBe("research");
  });
  it("accepts Stop with the revision actually returned before dispatch", async () => {
    const running = await active();
    await command(identities[0], { phase: "cancel", revision: running.prepared.workspace.revision, operationId: randomUUID(), target: running.prepared.workspace.pendingOperationId! });
    expect(observedSignal?.aborted).toBe(true);
    const rejected = expect(running.response).rejects.toMatchObject({ status: 409 });
    running.release(); await rejected;
    expect(calls).toBe(1);
    expect((await store.load(identities[0])).state.messages.some((m) => m.research)).toBe(false);
  });
  it("invalidates late results after new chat and keeps operation tombstones", async () => {
    const running = await active();
    const workspace = await store.load(identities[0]);
    await command(identities[0], { phase: "new-chat", revision: workspace.revision, operationId: randomUUID() });
    const rejected = expect(running.response).rejects.toMatchObject({ status: 409 });
    running.release(); await rejected;
    const replay = await prepare(identities[0], "A powerbank around SGD30-40", running.prepared.operation!.operationId);
    expect(replay.operation?.status).toBe("interrupted");
    expect(replay.workspace.state.messages).toEqual([]);
    expect(calls).toBe(1);
  });
  it("deletes saved shopping data without deleting the authentication account", async () => {
    const prepared = await prepare();
    const deleted = await command(identities[0], { phase: "delete-saved-data", revision: prepared.workspace.revision, operationId: randomUUID() });
    expect(deleted.workspace.state.messages).toEqual([]);
    expect(deleted.workspace.state.intent.budget).toBeNull();
    expect((await pool.query('SELECT id FROM "user" WHERE id=$1', [identities[0].userId])).rowCount).toBe(1);
    expect((await pool.query('SELECT id FROM "account" WHERE "userId"=$1', [identities[0].userId])).rowCount).toBe(1);
  });
  it("rejects publication if the session expires while waiting for its lock", async () => {
    const running = await active();
    const client = await pool.connect();
    await client.query("BEGIN");
    await client.query('UPDATE "session" SET "expiresAt"=clock_timestamp()+interval \'200 milliseconds\' WHERE id=$1', [identities[0].sessionId]);
    const rejected = expect(running.response).rejects.toMatchObject({ status: 401 });
    running.release();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await client.query("COMMIT"); client.release();
    await rejected;
    expect((await data()).state.messages.some((message: { research?: unknown }) => message.research)).toBe(false);
  });
  it("rejects publication if a valid session expires while waiting for a workspace lock", async () => {
    const running = await active();
    await pool.query('UPDATE "session" SET "expiresAt"=clock_timestamp()+interval \'200 milliseconds\' WHERE id=$1', [identities[0].sessionId]);
    const client = await pool.connect(); await client.query("BEGIN");
    await client.query("SELECT user_id FROM fieldnote_v2_workspace WHERE user_id=$1 FOR UPDATE", [identities[0].userId]);
    const rejected = expect(running.response).rejects.toMatchObject({ status: 401 });
    running.release(); await new Promise((resolve) => setTimeout(resolve, 300));
    await client.query("COMMIT"); client.release(); await rejected;
  });
  it("signs out through Better Auth and prevents the released result from publishing", async () => {
    const prepared = await accounts.command(new Headers({ origin, cookie: identities[0].cookie }), { phase: "prepare", revision: 0, operationId: randomUUID(), message: "A powerbank SGD35" }, new AbortController().signal);
    paused = true;
    const observed = new Promise<void>((resolve) => { started = resolve; });
    const pending = accounts.command(new Headers({ origin, cookie: identities[0].cookie }), { phase: "research", revision: prepared.workspace.revision, preparedId: prepared.workspace.pendingPreparedId! }, new AbortController().signal);
    await observed;
    const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
    const response = await accounts.handle(authRequest("sign-out", {}, identities[0].cookie));
    expect(response.status).toBe(200);
    expect(observedSignal?.aborted).toBe(true);
    hold?.(); await rejected;
    expect((await accounts.state(new Headers({ cookie: identities[0].cookie }))).status).toBe("guest");
  });
  it("expires interrupted operation claims after a crash without dispatching them again", async () => {
    const running = await active();
    await age("pending.deadline", new Date(Date.now() - 1).toISOString());
    const recovered = await createWorkspaceStore(pool, dependencies).load(identities[0]);
    expect(recovered.pendingOperationId).toBeNull();
    expect((await data()).receipts[0].status).toBe("interrupted");
    const rejected = expect(running.response).rejects.toMatchObject({ status: 409 });
    running.release(); await rejected;
    expect(calls).toBe(1);
  });
  it("expires old whole turns and accepted preferences without renewing retention on reads", async () => {
    await prepare();
    const old = new Date(Date.now() - RETENTION_MS - 1000).toISOString();
    await age("turns.0.createdAt", old); await age("receipts.0.createdAt", old); await age("acceptedAt", old);
    const recovered = await store.load(identities[0]);
    expect(recovered.state.messages).toEqual([]);
    expect(recovered.state.intent.budget).toBeNull();
    expect((await data()).acceptedAt).toBeNull();
    expect(await cleanExpiredWorkspaces(pool)).toBe(0);
  });
  it("does not renew accepted preference retention for ordinary replies", async () => {
    await prepare();
    const old = new Date(Date.now() - RETENTION_MS + 10000).toISOString();
    await age("acceptedAt", old);
    await prepare(identities[0], "Hello");
    expect((await data()).acceptedAt).toBe(old);
  });
  it("bounds 50 whole turns, 64 receipts and the complete UTF-8 payload", async () => {
    for (let i = 0; i < 70; i++) await prepare(identities[0], "Hello");
    const saved = await data();
    expect(saved.turns).toHaveLength(50);
    expect(saved.receipts).toHaveLength(64);
    expect(saved.state.messages).toHaveLength(100);
    expect(workspaceBytes(saved)).toBeLessThan(WORKSPACE_LIMIT);
  });
  it("discards an oversized research result honestly and retains accepted preferences", async () => {
    oversized = true;
    const prepared = await prepare();
    const complete = await command(identities[0], { phase: "research", revision: prepared.workspace.revision, preparedId: prepared.workspace.pendingPreparedId! });
    expect(complete.response?.kind).toBe("research-unavailable");
    expect(complete.workspace.state.messages.at(-1)?.text).toContain("exceeds");
    expect(complete.workspace.state.intent.budget).toEqual({ minimum: 30, maximum: 40, currency: "SGD" });
    expect(workspaceBytes(await data())).toBeLessThan(WORKSPACE_LIMIT);
  });
  it("fails closed when stored schema or migration readiness is unavailable", async () => {
    await prepare();
    await pool.query("UPDATE fieldnote_v2_workspace SET data=jsonb_set(data,'{schema}','99')");
    await expect(store.load(identities[0])).rejects.toThrow();
    await pool.query("UPDATE fieldnote_migration SET checksum='fixture-invalid' WHERE name='003-fieldnote-v2-workspace.sql'");
    await expect(accounts.state(new Headers({ cookie: identities[0].cookie }))).rejects.toThrow();
    const manifest = await migrationManifest();
    await pool.query("UPDATE fieldnote_migration SET checksum=$1 WHERE name='003-fieldnote-v2-workspace.sql'", [manifest.at(-1)!.checksum]);
    expect(calls).toBe(0);
  });
  it("requires exact origins and rejects unknown account fields at the HTTP boundary", async () => {
    await expect(accounts.handle(authRequest("sign-out", {}, identities[0].cookie, { origin: "https://evil.example" }))).rejects.toMatchObject({ status: 403 });
    await expect(accounts.command(new Headers({ cookie: identities[0].cookie }), { phase: "new-chat", revision: 0, operationId: randomUUID() }, new AbortController().signal)).rejects.toMatchObject({ status: 403 });
    expect(WorkspaceCommandSchema.safeParse({ phase: "new-chat", revision: 0, operationId: randomUUID(), userId: identities[1].userId }).success).toBe(false);
    await expect(accounts.handle(authRequest("sign-out", { large: "x".repeat(17000) }, identities[0].cookie))).rejects.toMatchObject({ status: 413 });
  });
  it("rate limits password attempts despite forged forwarding headers", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const response = await accounts.handle(authRequest("sign-in/email", { email: identities[0].email, password: "fixture-incorrect-password" }, "", { "x-forwarded-for": `192.0.2.${i}`, "x-fieldnote-connection-ip": `198.51.100.${i}` }));
      statuses.push(response.status);
    }
    expect(statuses).toContain(429);
  });
  it("reports missing and partial configuration honestly and disables production", () => {
    expect(accountConfiguration({})).toEqual({ status: "guest-only" });
    expect(accountConfiguration({ NODE_ENV: "test", FIELDNOTE_DATABASE_URL: "postgresql://localhost/fixture" })).toEqual({ status: "unavailable" });
    const config = { NODE_ENV: "test", FIELDNOTE_DATABASE_URL: "postgresql://localhost/fixture", FIELDNOTE_AUTH_ORIGIN: origin, FIELDNOTE_AUTH_SECRET: secret };
    expect(accountConfiguration(config).status).toBe("configured");
    expect(accountConfiguration({ ...config, NODE_ENV: "production" }).status).toBe("unavailable");
    expect(accountConfiguration({ ...config, FIELDNOTE_AUTH_ORIGIN: "https://example.com" }).status).toBe("unavailable");
  });
  it("serializes concurrent migrations and refuses historical checksum changes", async () => {
    await Promise.all([migrate(pool), migrate(pool)]);
    await pool.query("UPDATE fieldnote_migration SET checksum='fixture-invalid' WHERE name='001-better-auth.sql'");
    await expect(migrate(pool)).rejects.toThrow("Migration checksum mismatch");
    const manifest = await migrationManifest();
    await pool.query("UPDATE fieldnote_migration SET checksum=$1 WHERE name='001-better-auth.sql'", [manifest[0].checksum]);
  });
});
