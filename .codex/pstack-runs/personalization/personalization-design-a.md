# Design A. Durable accounts around the existing conversation

Issue #3 should let a signed-in person recover their preferences and chat after restart without changing Fieldnote's chat-first interface or making paid research calls during verification. The smallest proposed implementation uses Better Auth, PostgreSQL, and one durable conversation per account. This is a design recommendation, not a tested implementation.

## Grounding and scope

- Ground and Sketch are complete for this candidate. Root owns Agree and synthesis. Implement and Scrap are skipped because this assignment authorizes only a design artifact.
- Read `personalization-brief.md` and `personalization-grounding.md`. Verified the relevant source with `git show 9d2a3c5:<path>`. The exact base is `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`.
- `src/client/useConversation.ts` owns current preferences, immutable response snapshots, optional budget questions, and ephemeral action cancellation. `src/client/api.ts` is the browser transport boundary. `src/server/app.ts` validates HTTP requests and invokes the domain engine.
- At this base, turn and selection routes pass the inbound abort signal into the engine. Preserve that fix. Reconcile this sketch with the Exa owner's final canonical turn contract before implementation. Do not duplicate its research composition.
- Throughput checkpoint. Auth configuration and SQL migrations are the first dependency. A rerunnable isolated PostgreSQL test script is the proof artifact. App code then adds the coordinator and browser restoration. Independent QA and security inspect the resulting exact commit.

## Authentication decision

Use Better Auth's native Hono handler and direct `pg.Pool` integration. Add only the authentication package, PostgreSQL driver, and required types. An additional ORM or external identity service earns no place in this scope. Both integrations are documented officially. [Hono integration](https://better-auth.com/docs/integrations/hono), [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql).

Enable local email-and-password accounts. Email is an unverified sign-in identifier. Show no verification, recovery, OAuth, or account-linking promises. No mail transport or external provider exists. Keep the library's password hashing and explicitly require 12 to 128 characters. [Email and password](https://better-auth.com/docs/authentication/email-password), [password hashing](https://better-auth.com/docs/reference/security).

Keep database-backed sessions, disable cookie caching, and disable sliding refresh. Choose a seven-day absolute expiry and a five-minute freshness window for sensitive account actions. This avoids a cached cookie outliving revocation. Use library-issued HttpOnly, host-only, SameSite=Lax cookies. Secure cookies are mandatory whenever HTTPS is used. Plain HTTP is restricted to the existing loopback development mode. [Sessions](https://better-auth.com/docs/concepts/session-management), [cookies](https://better-auth.com/docs/concepts/cookies).

Configure `DATABASE_URL`, `BETTER_AUTH_SECRET`, and a single explicit `BETTER_AUTH_URL` matching the Vite-facing origin. Keep them server-only and ignored locally. Use the existing same-origin `/api` proxy. Keep exact Host and Origin checks, add an exact Origin requirement for cookie-authenticated mutations, and never derive trusted origins from request headers. No wildcard CORS or cross-subdomain cookies are needed.

Mount `/api/auth/*` after common host, origin, body-size, and logging guards but before the existing JSON parser consumes the raw body. Bound a cloned auth request stream, then pass an intact request to `auth.handler`. The current `/api/*` parser otherwise makes the official integration fail. Preserve all Set-Cookie headers and no-store responses.

Enable Better Auth rate limits explicitly in development and tests, with database storage. Proposed limits are 100 auth requests per minute and five sign-in or signup attempts per minute per address. Test those thresholds. The Node adapter must replace a private client-IP header from the socket address before auth sees it. Ignore caller-supplied forwarding headers. Library defaults otherwise trust forwarded addresses and disable development limiting. [Rate limits](https://better-auth.com/docs/concepts/rate-limit).

Missing configuration exposes guest-only capability honestly and hides account actions. Configured but unavailable PostgreSQL returns an unavailable account state and 503 for durable operations. Never replace signed-in data with an in-memory store or silently treat an expired session as a guest write. Existing guest research remains available through its explicit guest path.

## Caller and typed contract

The existing controller keeps one transport facade. The authentication library handles credentials and cookies. Application code receives a server-derived identity.

```ts
const view = await api.loadConversation(signal);
const next = await api.command({
	operationId: crypto.randomUUID(), expected: view.version,
	command: { kind: "submit", message, displayMessage },
}, signal);
```

```ts
type Principal = { userId: UserId; sessionId: SessionId };
type Version = { epoch: UUID; revision: number };
type SavedTurn = {
	id: UUID; displayMessage: string; requestMessage: string;
	requestPreferences: Preferences; createdAt: string; expiresAt: string;
	assistant: { kind: "question"; question: "budget"; preferences: Preferences }
		| { kind: "response"; value: CanonicalTurnResponse }
		| { kind: "interrupted" };
};
type ConversationView = {
	version: Version; preferences: Preferences; budgetQuestions: BudgetContext[];
	turns: SavedTurn[];
};
type Command = Submit | ApplyPreferences | SkipBudget | CancelOperation
	| SelectProduct | ResearchSources | ClearSavedData;
interface Personalization {
	load(principal: Principal): Promise<ConversationView>;
	execute(principal: Principal, command: VersionedCommand, signal: AbortSignal): Promise<CommandResult>;
}
```

`CanonicalTurnResponse` means the Exa owner's accepted response type. Brand IDs at validation boundaries. Versioned commands carry an operation UUID, expected epoch and revision, and a discriminated command. Clients never submit assistant snapshots, a trusted owner ID, session tokens in JSON, or an entire replacement ledger.

Use `GET /api/me/conversation` and `POST /api/me/conversation/commands`. The auth adapter alone constructs `Principal`. Authenticated selection and source commands reference an owned current turn and its allowed candidates. They cannot use the stateless guest route to mutate account data or gain saved-turn authority. Paid work remains subject to the existing explicit-action and provider-enablement policy in either mode.

## Storage and concurrency proof

Better Auth owns its generated user, account, session, verification, and rate-limit tables. Application tables are `conversation_state` and `conversation_turn`. State is keyed by `user_id` with a cascading user foreign key. It stores current preferences, asked-budget contexts, epoch, revision, and current operation/action identity. Turns have unique operation UUIDs, owner foreign keys, request hashes, request snapshots, terminal responses, and expiry. Never serialize AbortController, editor drafts, task keys, or action credentials into history.

The first authenticated load creates an empty state row while holding the valid session lock. Its user foreign key and unique owner key prevent orphaned or duplicate initialization. Later loads never replace it. Clear and preference expiry retain that empty ownership row with a fresh epoch. Only account deletion removes it. Delayed operations have no initializer path.

Each command uses a single checked-out PostgreSQL client. Authenticate, lock the still-valid session row, then lock the owned state row in a fixed order. Every state mutation also uses `UPDATE ... WHERE user_id = $owner AND epoch = $epoch AND revision = $revision RETURNING ...`. Zero rows means conflict, with no provider invocation. The turn insert and revision change share that transaction. This is a database compare-and-swap, not a read followed by an unconditional save. [PostgreSQL isolation](https://www.postgresql.org/docs/17/transaction-iso.html), [node-postgres transactions](https://node-postgres.com/features/transactions).

For a submit, apply the existing pure preference parser to stored preferences and the command. Commit the new preferences and user message together with an operation claim. Compute ordinary replies and optional questions without provider work. Move the existing budget-question policy into a shared pure function so signed-in turns include questions, skip messages, and editor messages without accepting fabricated assistant content.

Release the transaction before invoking the canonical engine with its original abort signal. Finish in a new transaction only when the session still exists and is unexpired, the epoch and claimed revision match, and the same pending operation still owns the state. Commit the terminal response and resulting preferences atomically. A failed predicate discards the result. Finishing never inserts or upserts state.

Locking the session row through each short commit makes session deletion serialize with publication. A result either commits before sign-out completes or fails after revocation. Holding a row lock blocks a concurrent deleting transaction until release. Expiry is checked against database time at the commit gate. No database lock spans a provider request. [PostgreSQL row locking](https://www.postgresql.org/docs/17/explicit-locking.html).

Cancel targets an exact operation UUID and is idempotent. It clears pending ownership and current action authority and advances the revision only when applicable. A late cancel cannot cancel a newer turn. Reset rotates the epoch and deletes the owned ledger in the same transaction. Therefore an earlier result cannot recreate cleared data even if its transport ignored cancellation.

Same operation UUID plus identical request hash returns its recorded outcome or pending/interrupted status without repeating provider work. A different payload with that UUID conflicts. An old replay never replaces newer preferences or reissues action authority. Each pending claim has a bounded lease derived from the canonical operation deadline. Expired claims become interrupted and are never automatically retried. A crash after an external request therefore does not authorize another paid call.

Concurrent tabs and devices share one canonical account state. The first valid revision wins. A conflicting caller reloads current state and receives a concise conflict message. Never merge complete preference objects automatically or retry a paid command automatically. Snapshot reads hold session and state share locks through the turn query, so compliant writers cannot interleave inconsistent preferences and history.

Selection and source responses remain attached to their origin turn. Current actions require the active turn, epoch, revision, and a 15-minute action capability bound to the originating session and issued only with a newly accepted response. Save only its server-side verifier outside the historical response. Cancel, preference change, reset, and session revocation invalidate it. Loading history returns no action capability. Historical messages remain readable with their original fixture labels, source dates, uncertainty, and unknown prices.

## Reset, retention, and browser behavior

One account has one saved conversation. Signed-in New chat clears saved messages and restores default preferences after a compact confirmation that names this effect. Guest New chat retains its current immediate reset behavior. Sign-out preserves saved data but aborts local work, clears the screen and all action state, and revokes the current database session. Failed sign-out stays visibly pending until revocation is confirmed.

Offer Delete account through Better Auth's supported deletion flow and require the current password. Application state cascades from the user row. Verify the library's session/account deletion and custom foreign-key cascades against real PostgreSQL. Deleting shopping data preserves account credentials. Deleting the account removes both. No account data survives in browser storage. [Account deletion](https://better-auth.com/docs/concepts/users-accounts).

Proposed defaults are 30 days per historical turn, 90 days since the last preference mutation, 200 turns per account, and 256 KiB per saved turn. Validate that bound against the final response contract. An oversized result becomes a bounded durable error. Reject a full ledger before provider work and offer clear/reset. Do not silently discard history to accept a paid command. Authentication records remain until account deletion. The hourly cleanup also removes expired sessions and rate-limit rows older than their configured windows.

Reads exclude expired personal data immediately. A startup and hourly cleanup deletes expired turns and resets expired preferences under the same state lock, revision, and epoch rules. Read-triggered expiry performs that reset before returning. A documented package command runs the same cleanup. The live database deletes rows. PostgreSQL WAL and external backups are not claimed to be securely erased, and this scope creates no backups.

Keep the minimal header and add an official shadcn account dialog. Guests can chat without registering. Guest history is ephemeral and is never uploaded automatically. Signing in loads that account's saved history and clearly identifies the switch. Browser state uses an identity generation alongside the existing task sequence. Abort and increment it before login, logout, reset, and account replacement. Discard old bootstrap and turn responses. Use cross-tab auth invalidation plus focus revalidation. Hydrated pending turns display interrupted, and all hydrated actions start inactive.

## Modules, migrations, and acceptance

- `src/server/auth.ts` owns Better Auth configuration and the identity adapter. `src/server/personalization.ts` owns the small load/execute interface, transactions, and operation lifecycle. `src/domain/conversation.ts` owns the shared pure question and preference command policy. Existing `app.ts`, `api.ts`, and `useConversation.ts` remain the HTTP and browser owners.
- Reuse domain preference schemas, hard-constraint parsing, canonical engine, safe source navigation, merchant-link checks, and cancellation. Delete the hook's duplicate question policy after callers migrate. Do not add a generic repository framework, event bus, second research pipeline, or transcript cache in localStorage.
- Pin compatible package and CLI versions. Commit the generated auth SQL and application SQL as ordered, checksum-verified migrations. A single migration runner takes a database advisory lock, records completed versions transactionally, and rejects changed checksums. No startup schema guessing, runtime auto-migration, or migration against existing services is part of this work.
- Add a package test command that creates an isolated temporary PostgreSQL cluster using available binaries and a CI PostgreSQL service. Run empty-database migration twice, checksum rejection, schema evolution, application process restart, database restart, and restoration through real HTTP cookies. No map or SQLite substitute establishes this acceptance.
- Exercise A's actual IDs from B and from missing, expired, revoked, and forged sessions across read, command, reset, delete, selection, and sources. Assert rejected requests do not invoke providers or change state. Verify cookie flags, CSRF, body limits, auth limiting, safe errors, and logs without credentials or transcript text.
- Use controlled delayed providers and real concurrent database clients to prove CAS, duplicate retries, sign-out, delete, reset, retention, lease expiry, cancellation, and old-account hydration races. Assert database contents after restart as well as the visible DOM. Crash after reservation and after provider completion must not duplicate external work.
- All automated runs explicitly disable live Exa and live composition, inject local substitutes, and reject external provider traffic. Run package checks and the project verification skill, then inspect desktop and mobile screenshots for chat history, account dialogs, theme persistence, composer access, and inactive historical actions. Record what local tests do not establish about deployment or email.

## Decision principles and remaining risks

Model the Domain changed the design to one account aggregate with typed commands and separate historical snapshots. Boundary Discipline keeps cookies and PostgreSQL rows behind the identity and persistence adapters. Separate Before Serializing Shared State assigns independent rows to different accounts and requires CAS only within an account. Make Operations Idempotent gives commands stable identities and prevents automatic crash retries. Laziness Protocol removes a second ORM and generic repository layer. Prove It Works and Test Behavior, Not Implementation require real HTTP, PostgreSQL restart, database race assertions, and inspected screenshots.

The three largest risks are compatibility between the pinned auth schema and our transactional session checks, missed client-authored turns during controller migration, and a false concurrency guarantee caused by checking revision/session state outside the committing transaction. The acceptance cases above must settle all three before this candidate can ship. Root decides the actual implementation and any sensitive exception from the eventual diff. This proposal requires no production deployment, service mutation, repository permission change, or elevated workflow permission.
