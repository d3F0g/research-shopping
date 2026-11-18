# Candidate B: one owned PostgreSQL workspace

The user wants preferences and conversation history that survive restarts and remain private to the signed-in account. Keep the guest conversation unchanged. Add one bounded workspace per account, not a general conversation platform or a second research pipeline.

## Phase checklist and grounding

- [x] Ground. Read the supplied audit and stable main `9d2a3c5`, including `useConversation`, `api.ts`, and `app.ts`.
- [x] Sketch. This document is the independent B candidate. Candidate A was not read.
- [ ] Agree. Root compares the candidates and records the selected design.
- [ ] Implement. Skip here because this task permits a design document only.
- [ ] Scrap. Revisit if the final Exa contract requires a second source of conversation authority.

The current hook owns both visible history and current preferences. It also creates optional budget questions locally and guards active actions with an abort controller and generation. The API accepts independent requests and stores nothing. Authentication belongs around the canonical application operation, not inside Exa. Use the final Exa reply schema after it lands. No implementation or runtime acceptance is claimed here.

## Caller first

```ts
const accounts = configured ? createAccounts({ pool, auth, turns }) : undefined;
const app = createApp({ turns, accounts });
const identity = await accounts.requireIdentity(request.headers);
return accounts.command(identity, parsedCommand, request.signal);
const saved = await api.loadWorkspace(signal);
conversation.restore(saved); // completed snapshots, no restored active actions
const next = await api.workspaceCommand({ revision: saved.revision, command }, signal);
if (accepts(accountEpoch, generation)) conversation.restore(next);
```

The illustrative `accounts` interface hides authentication, SQL, ownership, concurrency, retention, and command execution. No caller coordinates reserve/save/finalize methods. The browser continues to own draft text, focus, pending visuals, and cancellation. PostgreSQL owns signed-in accepted preferences and saved replies. Guest state remains tab-local and is never silently imported into an account.

## Types and storage

```ts
type Identity = { userId: UserId; sessionId: SessionId }; // server-created after verification
type Revision = number; // nonnegative safe integer, validated at the HTTP boundary
type Workspace = { revision: Revision; preferences: Preferences; budgetQuestions: BudgetContext[]; turns: SavedTurn[]; expiresAt: string };
type SavedTurn = { id: string; request: { message: string; preferences: Preferences }; body:
  { state: "complete"; reply: CanonicalTurnReply } | { state: "budget-question"; preferences: Preferences }
  | { state: "cancelled" } };
type WorkspaceCommand = { revision: Revision; operationId: UUID; command:
  { kind: "message"; text: string } | { kind: "apply-preferences"; preferences: Preferences }
  | { kind: "skip-budget" } | { kind: "new-chat" } | { kind: "delete-saved-data" } };
type Accounts = {
  requireIdentity(headers: Headers): Promise<Identity>;
  load(identity: Identity): Promise<Workspace>;
  command(identity: Identity, input: WorkspaceCommand, signal: AbortSignal): Promise<Workspace>;
};
```

One `shopping_workspace` row has `user_id` as its primary key and a foreign key to the generated auth user table. It contains `revision`, `generation`, `preferences jsonb`, `budget_questions jsonb`, `turns jsonb`, `pending jsonb`, and `expires_at`. `pending` is a private operation descriptor with operation ID, session ID, request snapshot and digest, proposed preferences, and deadline. It is never a saved authority or a client-controlled response. Store a schema version inside the JSON codec.

Validate the public snapshot with the final canonical reply schema when reading and writing the database. Do not store the entire hook, SDK response, cookies, abort controllers, editor, task keys, or active selection. Completed history is append-only from application commands. Replacing the aggregate row does not authorize rewriting prior replies. Client payloads contain commands, never assistant text, evidence, product facts, or a user ID.

## Established authentication and configuration

Use pinned Better Auth with its PostgreSQL `pg.Pool` integration. Its official Hono integration accepts the raw Request and Response. Keep the existing Host, Origin, body-size, no-store, and generic-error boundaries ahead of it. Auth routing must not consume the request body before forwarding it. Mount only the supported local account actions and reject unused recovery, email-change, social, linking, and administration paths.

Enable local email/password accounts with the library's password hashing and its database session cookie. Email is an account identifier, not verified mailbox ownership. Show that limitation in the account dialog. Do not enable email verification, password recovery, OAuth, or account linking without their actual service and a separate design. Registration and sign-in use the library handler, preserving its request validation and rate limiter. Enable rate limiting explicitly in development. Ignore caller-supplied forwarded-IP headers on direct loopback connections.

Keep cookie caching and secondary session storage disabled so revocation is checked against PostgreSQL. Use host-only HttpOnly SameSite=Lax cookies. Plain HTTP cookie support is confined to the existing loopback development app. Production remains disabled in this unit. Configure one canonical web origin and exact trusted origins, and test the actual Vite proxy path rather than guessing cookie behavior across ports or hosts.

Require an explicit database URL and stable server-only Better Auth secret. Missing configuration reports account persistence unavailable and leaves guest chat functional. A database outage returns unavailable for a signed-in workspace command. It must not silently execute the command as a guest. Do not put secrets in browser storage, VITE variables, traces, or source. Normal app startup never creates or changes a database role.

## Transactions, cancellation, and late completion

For a cheap command, begin a short transaction. Lock the still-valid session row and owned workspace row. Check the supplied revision, apply the shared pure conversation decision, then increment revision and commit. Every lookup and update constrains `user_id` to the verified identity. A mismatched revision returns conflict with no provider call. Never automatically replay an expensive command after a conflict.

For research, the first short transaction checks ownership/revision, rejects another pending operation, and records `pending` before dispatch. It does not advance the public revision yet. Run the one canonical research operation outside the transaction with the actual incoming abort signal. Exa's existing global quota remains the only paid admission owner.

The final short transaction rechecks the database session and locks its row, then updates only when owner, revision, generation, pending operation, and unexpired retention all match. Append the server-authored reply, adopt its resulting preferences, clear pending, and increment revision atomically. If any check fails, discard the completion and return conflict or unauthorized. Never upsert a workspace from a completion. Locking the session row makes revocation and completion commit in a defined order. Check this against the exact generated auth schema and real PostgreSQL before acceptance.

New chat resets preferences and history, increments generation and revision, and clears pending in that same owned row. Delete saved data has the same persistent erasure semantics and also clears any saved preference metadata. Keeping the empty row and revision prevents a stale operation from recreating deleted content. Identity credentials remain until a separately implemented account-deletion feature. The account dialog must state that scope.

After reset/delete commits, abort any matching in-process provider controller. An ordinary HTTP disconnect already reaches Exa through the existing request signal. Cancellation cleanup changes only the matching pending operation and marks its user turn cancelled. It cannot overwrite a newer generation. On startup or access, a pending operation beyond its recorded deadline becomes cancelled, never replayed. A crash cannot resume a paid request. Unknown Exa billing stays charged under the existing budget policy.

Sign-out first clears the browser's account epoch, aborts tasks, clears its displayed workspace and editor, and then completes session revocation. If revocation fails, show the failure and do not claim the account is signed out. Once revocation commits, a late final transaction cannot authorize a write. A completion that committed before revocation is already saved history, not a post-sign-out write. A new account always loads its own workspace before enabling signed-in commands.

## Retention and UI

Retain up to 50 whole saved turns and 256 KiB per workspace for 30 days since the last accepted write. Trim oldest whole turns to meet both bounds. Explain the limits once in the account dialog. Expired data is inaccessible immediately and is physically cleared on startup or the next workspace access. Do not claim a background erasure deadline while the app is stopped. Clearing expiration increments revision and generation, so an old request cannot restore expired content.

Add one account control to the minimal header. Use existing official shadcn dialog, form controls, and button patterns. Keep chat and AI Elements unchanged. Sign-in restores completed history with all historical actions inactive, then permits a fresh submitted request. Theme remains device-local. Extract the existing budget-question decision into a pure domain function shared by guest and signed-in commands. Persist its bounded category/region question contexts so refresh does not repeat the question. The server generates the saved assistant question. Do not accept arbitrary assistant text to fill that gap.

## Modules, migration, and proof

- `domain/workspace.ts` owns the bounded saved-state schema and pure commands, reusing Preferences and the final Exa reply schema.
- `server/accounts.ts` owns Better Auth composition, verified Identity, account capability, and the deep workspace operation. `server/workspace-store.ts` privately owns SQL, session-row checks, retention, and transactions. Avoid a public generic repository API.
- `server/app.ts` mounts account routes, validates workspace commands, and preserves HTTP guards. `server/index.ts` composes the optional pool and closes it on shutdown. `client/api.ts` remains the only browser transport. `useConversation` receives explicit restore/account-change commands.
- Generate auth SQL using the exact pinned library configuration, review it, and commit it beside one application migration. A migration runner uses an advisory lock and version/checksum table. It applies each migration once in a transaction. App startup verifies schema readiness instead of silently running DDL or broad grants.
- Test an empty temporary PostgreSQL cluster, repeated migrations, persisted writes, API process restart, database restart, account A/B known-ID attempts, expired/revoked sessions, cookie attributes, CSRF/origin checks, and disabled configuration. No map or SQLite substitute proves this unit.
- Hold a local substitute research operation while another request resets, deletes, changes preferences, signs out, or expires the workspace. Release the result and verify both the DOM and database reject its late write. Verify conflicts, crash recovery, duplicate delivery, and zero provider calls on unauthorized or stale commands.
- CI adds an isolated PostgreSQL service with fixture credentials. Browser journeys inspect desktop/mobile sign-in, restored history, account switch, unavailable persistence, deletion, and the unchanged chat composer. Independent runtime QA and security review pin the final commit. No paid Exa calls or production operations are needed.

## Tradeoffs and synthesis

Candidate B chooses one bounded JSONB aggregate and optimistic command execution over normalized message tables or an event store. The history size makes row rewriting acceptable for this local product. This avoids history joins, arbitrary conversation IDs, distributed jobs, and separate preference/history writers. It does not promise simultaneous collaborative chat or unbounded history.

The material cost is moving client-only cheap assistant decisions into a shared domain command for signed-in persistence. If that requires a second conversation policy, revise the boundary instead of duplicating it. Use a row lock that conflicts with session expiry updates and deletes. Auth session-row locking deliberately depends on the committed generated schema, so library upgrades need a focused migration and concurrency check.

Root owns synthesis. No other candidate, implementation, database, secret, or runtime was inspected or changed. Model inheritance is the declared fallback because the configured Luna role is unavailable.

## Sources and principles

Primary documentation read on 2026-11-18 supports [direct Hono integration](https://better-auth.com/docs/integrations/hono), [PostgreSQL composition and migrations](https://better-auth.com/docs/adapters/postgresql), [database sessions and cache revocation limits](https://better-auth.com/docs/concepts/session-management), [cookie behavior](https://better-auth.com/docs/concepts/cookies), [password authentication](https://better-auth.com/docs/authentication/email-password), and [development rate limiting and proxy trust](https://better-auth.com/docs/concepts/rate-limit). PostgreSQL's [row-lock semantics](https://www.postgresql.org/docs/17/explicit-locking.html) and [Read Committed behavior](https://www.postgresql.org/docs/17/transaction-iso.html) ground the proposed short transactions. The proposal still needs installed-version and runtime proof.

Model the Domain chose one owned workspace and separate ephemeral browser state. Boundary Discipline kept cookies and SQL outside the domain reply. Laziness Protocol rejected a general conversation platform and a second paid provider path. Make Operations Idempotent required revisions and cancellation recovery without replay. Prove It Works required actual PostgreSQL and process restart evidence before any completion claim.
