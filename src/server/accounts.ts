import { Pool } from "pg";
import type { AccountState, WorkspaceCommand } from "../domain/workspace";
import { createAuth } from "./auth";
import { assertDatabaseReady } from "./account-migrations";
import { AccountError, createWorkspaceStore, type WorkspaceDependencies } from "./workspace-store";

export type AccountConfiguration = { status: "guest-only" | "unavailable" } | { status: "configured"; databaseUrl: string; origin: string; secret: string };
export function accountConfiguration(environment: NodeJS.ProcessEnv): AccountConfiguration {
  const values = [environment.FIELDNOTE_DATABASE_URL, environment.FIELDNOTE_AUTH_ORIGIN, environment.FIELDNOTE_AUTH_SECRET];
  if (!values.some(Boolean)) return { status: "guest-only" };
  if (!["development", "test"].includes(environment.NODE_ENV ?? "") || !values.every(Boolean)) return { status: "unavailable" };
  const [databaseUrl, origin, secret] = values as [string, string, string];
  try {
    const url = new URL(origin);
    if (url.origin !== origin || !["127.0.0.1", "localhost"].includes(url.hostname) || !["http:", "https:"].includes(url.protocol) || secret.length < 32 || !["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol)) return { status: "unavailable" };
  } catch { return { status: "unavailable" }; }
  return { status: "configured", databaseUrl, origin, secret };
}
async function authRequest(request: Request, origin: string): Promise<Request> {
  const url = new URL(request.url);
  const routes = new Map([["/api/auth/sign-up/email", "POST"], ["/api/auth/sign-in/email", "POST"], ["/api/auth/sign-out", "POST"], ["/api/auth/get-session", "GET"]]);
  if (routes.get(url.pathname) !== request.method) throw new AccountError(400, "This account operation is unsupported.");
  if (request.method === "POST" && request.headers.get("origin") !== origin) throw new AccountError(403, "Account requests require the configured origin.");
  if (request.headers.has("origin") && request.headers.get("origin") !== origin) throw new AccountError(403, "Origin is not allowed.");
  const headers = new Headers(request.headers);
  for (const name of ["forwarded", "x-forwarded-for", "x-real-ip", "x-fieldnote-connection-ip"]) headers.delete(name);
  headers.set("x-fieldnote-connection-ip", "127.0.0.1");
  if (request.method === "GET") return new Request(url, { method: "GET", headers });
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(headers.get("content-type") ?? "") || ![null, "identity"].includes(headers.get("content-encoding"))) throw new AccountError(415, "Use an unencoded application/json body.");
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError(400, "A JSON body is required.");
  const bytes = new Uint8Array(16_384);
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) { void reader.cancel().catch(() => undefined); throw new AccountError(413, "The account request is too large."); }
      bytes.set(value, length); length += value.length;
    }
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)));
  } catch (error) { if (error instanceof AccountError) throw error; throw new AccountError(400, "The account request is invalid."); }
  finally { reader.releaseLock(); }
  headers.delete("content-length");
  return new Request(url, { method: "POST", headers, body: bytes.slice(0, length), signal: request.signal });
}
export type Accounts = ReturnType<typeof createAccounts>;
export function createAccounts(pool: Pool, origin: string, secret: string, dependencies: WorkspaceDependencies) {
  const auth = createAuth(pool, origin, secret);
  const store = createWorkspaceStore(pool, dependencies);
  async function session(headers: Headers) {
    await assertDatabaseReady(pool);
    return auth.api.getSession({ headers, query: { disableCookieCache: true, disableRefresh: true } });
  }
  async function identity(headers: Headers) {
    const found = await session(headers);
    if (!found) throw new AccountError(401, "Your session ended. Sign in again.");
    return { userId: found.user.id, sessionId: found.session.id };
  }
  return {
    origin,
    async state(headers: Headers): Promise<AccountState> {
      const found = await session(headers);
      if (!found) return { status: "guest" };
      const workspace = await store.load({ userId: found.user.id, sessionId: found.session.id });
      return { status: "signed-in", user: { id: found.user.id, email: found.user.email }, workspace };
    },
    async handle(request: Request) {
      const bounded = await authRequest(request, origin);
      await assertDatabaseReady(pool);
      const signingOut = new URL(request.url).pathname === "/api/auth/sign-out";
      const found = signingOut ? await session(request.headers) : null;
      const response = await auth.handler(bounded);
      if (signingOut && found && response.ok) {
        const stillPresent = await pool.query('SELECT id FROM "session" WHERE id = $1 AND "userId" = $2', [found.session.id, found.user.id]);
        if (stillPresent.rowCount) throw new AccountError(503, "Sign-out could not complete. Try again.");
        store.abortSession(found.session.id);
      }
      return response;
    },
    async command(headers: Headers, input: WorkspaceCommand, signal: AbortSignal) {
      if (headers.get("origin") !== origin) throw new AccountError(403, "Account requests require the configured origin.");
      return store.command(await identity(headers), input, signal); },
  };
}
export async function configuredAccounts(configuration: AccountConfiguration, dependencies: WorkspaceDependencies) {
  if (configuration.status !== "configured") return { capability: configuration.status, accounts: undefined, close: async () => undefined };
  const pool = new Pool({ connectionString: configuration.databaseUrl, max: 10, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10_000, statement_timeout: 10_000 });
  pool.on("error", () => undefined);
  return { capability: "configured" as const, accounts: createAccounts(pool, configuration.origin, configuration.secret, dependencies), close: () => pool.end() };
}
