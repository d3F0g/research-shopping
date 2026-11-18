# Private saved conversations

Accounts are an optional local development capability. Guest chat stays tab-local and never uploads its history automatically. Signing in loads only that account's saved conversation. A restored response keeps its original source observations and uncertainty; it does not refresh prices or regain old research actions.

## Configure an owned development database

Keep these settings server-only in the ignored local environment.

- `FIELDNOTE_DATABASE_URL` targets a PostgreSQL database you own for this development application.
- `FIELDNOTE_AUTH_ORIGIN` is the exact loopback browser origin, such as `http://127.0.0.1:5173`.
- `FIELDNOTE_AUTH_SECRET` is a stable private random secret of at least 32 characters.

Do not use production credentials or an unrelated database. This feature does not create database roles or grant permissions. Missing all three settings reports guest-only mode. Partial settings, failed schema readiness or an outage report account unavailability. A failed saved operation never silently runs as guest work. Production composition remains disabled.

The API development command reads `.env`. Database package commands require the settings in their environment and do not load that file implicitly. To run the migration command with the existing private file, use Node's environment-file support without printing its contents.

```sh
node --env-file=.env --import tsx src/server/database-command.ts migrate
```

Run migrations only against the explicit owned development database. Restart the application afterward. Startup checks migration readiness; it does not create tables. Cleanup uses the same explicit environment.

```sh
node --env-file=.env --import tsx src/server/database-command.ts cleanup
```

## Account and data behavior

Local email/password accounts use Better Auth 1.7.25. The email is an unverified sign-in identifier. No mailbox verification, password recovery, OAuth, linking or full account deletion is provided. Passwords require 12 to 128 characters. Sessions expire seven days after creation, with refresh and cookie caching disabled. Cookies are host-only, HttpOnly and SameSite=Lax; plain HTTP is restricted to the loopback development app.

New chat and Delete saved data clear saved messages, preferences, question contexts and pending content. Account credentials remain. Sign-out preserves saved data but clears account-bound browser state and revokes the current session. A failed sign-out remains visibly incomplete. Switching accounts invalidates pending requests and old hydration results. Current preferences stay separate from immutable historical replies.

Each account keeps at most 50 whole turns and 256 KiB of canonical workspace data, including private pending claims and replay receipts. Oldest whole turns are trimmed to fit. A response that cannot fit becomes a bounded interruption rather than misleading truncated evidence.

Saved turns expire no later than 30 days after creation. Current preferences expire 30 days after their last accepted change. Reads, retries and ordinary messages that leave preferences unchanged do not renew that clock. Expired content is inaccessible immediately and cleared on startup or access. The cleanup command uses the same rules. No cleanup while the app is stopped, secure erasure of PostgreSQL WAL or backup deletion is claimed.

Commands use server-derived ownership and checked revisions. Research runs outside database transactions. Final publication rechecks the valid session and matching operation in a short transaction. Cancel, reset, deletion and expiry invalidate older work before it can restore cleared content. Stable operation IDs support retries without automatically repeating provider work. This is not a guarantee of exactly-once external billing.

## Migrations and component provenance

The runtime and schema-generation CLI are both pinned to 1.7.25. The ordered SQL migrations include the exact generated Better Auth schema and the application workspace. The runner uses checksums and an advisory lock. The `npm run db:generate-auth` script reproduces the initial schema and requires `FIELDNOTE_SCHEMA_DATABASE_URL` for an owned empty fixture database. Generation introspects that database. For an upgrade, generate and review an additional ordered migration rather than replacing an applied file. Never point generation at an unrelated database.

Official documentation covers [Hono](https://better-auth.com/docs/integrations/hono), [PostgreSQL](https://better-auth.com/docs/adapters/postgresql), [sessions](https://better-auth.com/docs/concepts/session-management) and [password accounts](https://better-auth.com/docs/authentication/email-password). The account form composes the official shadcn Dialog, Field, Input and Button. The [dialog provenance](../artifacts/personalization/provenance/dialog-manifest.json) records the registry snapshot, installed file and CLI version. Chat keeps the existing official AI Elements composition.

## Verification

All automated verification disables live Exa and uses local test accounts and provider substitutes. PostgreSQL tests use owned temporary clusters, or the explicit CI fixture database. They do not connect to an existing user service by default.

```sh
npm test
npm run build
npm run test:postgres
npm run verify:personalization-crash
npm run verify:personalization-restart
npm run test:personalization-browser
npm run test:e2e
npm run verify:offline
```

Restart verification actually restarts the API and PostgreSQL and checks that deletion stays erased. Crash verification kills owned fixture API processes at four operation boundaries and checks that retries do not dispatch again. Browser verification uses actual proxy cookies and inspected desktop/mobile states. Independent QA and security must pin the final integrated candidate; author test results alone do not satisfy the merge gates.
