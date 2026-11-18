import { Pool } from "pg";
import type { ResearchTurns } from "../domain/research";
import type { AccountState, WorkspaceCommand } from "../domain/workspace";
import { createAuth } from "./auth";
import { assertDatabaseReady } from "./migrations";
import {
  AccountError,
  cleanExpiredWorkspaces,
  createWorkspaceStore,
} from "./workspace-store";

export type AccountConfiguration =
  | { status: "guest-only" | "unavailable" }
  | {
      status: "configured";
      databaseUrl: string;
      origin: string;
      secret: string;
    };
export function accountConfiguration(
  environment: NodeJS.ProcessEnv,
): AccountConfiguration {
  const values = [
    environment.FIELDNOTE_DATABASE_URL,
    environment.FIELDNOTE_AUTH_ORIGIN,
    environment.FIELDNOTE_AUTH_SECRET,
  ];
  if (!values.some(Boolean)) return { status: "guest-only" };
  if (environment.NODE_ENV !== "development" && environment.NODE_ENV !== "test")
    return { status: "unavailable" };
  if (!values.every(Boolean)) return { status: "unavailable" };
  const [databaseUrl, origin, secret] = values as [string, string, string];
  try {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      secret.length < 32 ||
      !["postgres:", "postgresql:"].includes(new URL(databaseUrl).protocol)
    )
      return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
  return { status: "configured", databaseUrl, origin, secret };
}
export type Accounts = ReturnType<typeof createAccounts>;
export function createAccounts(
  pool: Pool,
  origin: string,
  secret: string,
  turns: ResearchTurns,
) {
  const auth = createAuth(pool, origin, secret);
  const store = createWorkspaceStore(pool, turns);
  async function session(headers: Headers) {
    await assertDatabaseReady(pool);
    return auth.api.getSession({
      headers,
      query: { disableCookieCache: true, disableRefresh: true },
    });
  }
  async function identity(headers: Headers) {
    const found = await session(headers);
    if (!found)
      throw new AccountError(401, "Your session ended. Sign in again.");
    return { userId: found.user.id, sessionId: found.session.id };
  }
  return {
    origin,
    async state(headers: Headers): Promise<AccountState> {
      const found = await session(headers);
      if (!found) return { status: "guest" };
      const workspace = await store.load({
        userId: found.user.id,
        sessionId: found.session.id,
      });
      return {
        status: "signed-in",
        user: { id: found.user.id, email: found.user.email },
        workspace,
      };
    },
    async handle(request: Request) {
      await assertDatabaseReady(pool);
      const signingOut = new URL(request.url).pathname === "/api/auth/sign-out";
      const found = signingOut ? await session(request.headers) : null;
      const response = await auth.handler(request);
      if (signingOut && found && response.ok) {
        const stillPresent = await pool.query(
          'SELECT id FROM "session" WHERE id = $1 AND "userId" = $2',
          [found.session.id, found.user.id],
        );
        if (stillPresent.rowCount)
          throw new AccountError(
            503,
            "Sign-out could not complete. Try again.",
          );
        store.abortSession(found.session.id);
      }
      return response;
    },
    async command(
      headers: Headers,
      input: WorkspaceCommand,
      signal: AbortSignal,
    ) {
      return store.command(await identity(headers), input, signal);
    },
  };
}
export async function configuredAccounts(
  configuration: AccountConfiguration,
  turns: ResearchTurns,
) {
  if (configuration.status !== "configured")
    return {
      capability: configuration.status,
      accounts: undefined,
      close: async () => undefined,
    };
  const pool = new Pool({
    connectionString: configuration.databaseUrl,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 10_000,
  });
  pool.on("error", () => undefined);
  try {
    await assertDatabaseReady(pool);
    await cleanExpiredWorkspaces(pool);
  } catch {}
  return {
    capability: "configured" as const,
    accounts: createAccounts(
      pool,
      configuration.origin,
      configuration.secret,
      turns,
    ),
    close: () => pool.end(),
  };
}
