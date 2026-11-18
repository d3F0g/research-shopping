# Issue #3 personalization grounding

Observed 2026-11-18. This is a read-only codebase investigation, not an implementation, protocol proposal, runtime approval, or security review of a future candidate.

## Snapshot and scope

- Repository: `/Users/josiahwong/Documents/research-shopping`.
- Pinned source: `1cf12b2cb5468872365d825751dee532bc4f9d5a` (`main`, PR #33 merge). Source reads used `git show 1cf12b2:<path>` and `git grep ... 1cf12b2`.
- Read `AGENTS.md`. Did not edit the original checkout or `/Users/josiahwong/Documents/research-shopping-exa-primary`, which another application owner is editing.
- Original checkout already had a modified `package-lock.json`, untracked `.agents/skills/build-with-exa/`, and untracked `skills-lock.json`; these were left untouched. The dependency inventory below comes from committed `package.json`, not that dirty lockfile.
- No new dependencies, subprocess servers, browser sessions, paid calls, GitHub mutations, credential reads, database connections, database discovery, or service changes. Only this report was written.
- All source paths and line references below are relative to the repository and pinned to this commit. They will need rebasing after the Exa facade lands.

## Current ownership and data flow

| Concern | Exact source | Observed owner and behavior |
| --- | --- | --- |
| Current structured preferences | `src/domain/contracts.ts:37-51`, `:202-218` | `Preferences` has separate `hard` and `soft` objects. Hard: nullable category/budget, region, excluded brands, required features, unresolved `pendingConstraint`. Soft: use case, ordered priorities, response length. Defaults: no category/budget, SG, value, concise. No account/conversation identifiers or storage version. |
| Preference extraction | `src/domain/preferences.ts:50-206` | Pure shared `updatePreferences(message, previous)` clones input, applies bounded deterministic parsing, and retains unknown hard requirements as a blocking pending constraint. Category changes clear category-specific features/priorities/use case while preserving budget/exclusions. Explicit budget removal is separate from an omitted budget. |
| Conversation ledger and active state | `src/client/useConversation.ts:27-85` | One React hook owns ordered `turns`, current `preferences`, composer `draft`, `activeTurnId`, `retryTurnId`, optional editor, and category/region contexts already asked about budget. A turn contains request snapshot, displayed user message, assistant-body state, selection state, selecting product ID, and source state. No global store or server conversation exists. |
| Snapshot separation | `src/client/useConversation.ts:195-255`, `:155-178` | Submit clones the pre-turn preferences into `turn.request`; accepted API output remains in `turn.body.value` and its resulting preferences separately become current preferences. Old response snapshots stay in the ledger. Display text can differ from submitted message for an editor apply or skipped budget. |
| Client-only assistant question | `src/client/useConversation.ts:224-253` | Client runs the shared parser to decide whether to ask the optional budget question. This question and the preference update are produced locally without `/api/turn`. A durable ledger cannot assume every visible exchange originated in an API response. |
| Ordinary replies and authoritative turn evaluation | `src/domain/shopping.ts:124-159` | Server engine handles greetings/thanks/acknowledgments as ordinary messages without provider activity; otherwise it reapplies the shared parser to request message + previous preferences, filters hard constraints, ranks, and returns a result. Provider failure retains the updated preferences. |
| Inline editor | `src/client/useConversation.ts:354-383`, `:427-517` | Editor drafts are cloned from current preferences. Invalid budget text preserves the last valid structured budget and exposes an error; edits revoke active actions. Apply sends `Show options` with edited preferences and adds an explicit user-facing update message. |
| Reset and lifetime | `src/client/useConversation.ts:76-85`, `:401-404` | New chat aborts/revokes and replaces all controller state with defaults. Refresh/unmount discards the React state. There is no persisted deletion or backend reset. |
| Rendering | `src/client/App.tsx:165-195`, `:243-281`, `:320-345` | Ledger renders genuine user text and accepted response snapshots. Each turn is marked active from the controller; active status gates preference questions, result actions, sources, and handoff. Product recommendations are inside assistant messages. |
| Theme | `src/client/theme-provider.tsx:9-36` | The only persisted browser data is `localStorage["fieldnote-theme"]`; valid light is restored, otherwise dark. Theme is separate from shopping/conversation state. |

The baseline does **not** submit prior chat history to the API. Each turn sends only the new message and a complete preference object. There is no transcript load/save endpoint or server ledger. `turn-1`, `turn-2`, etc. are per-hook in-memory IDs (`src/client/useConversation.ts:95`, `:207`), not global durable identities.

## Current generation, cancellation, and stale actions

- `src/client/useConversation.ts:90-153`: `sequence` and a single `task { key, AbortController }` coordinate all turn, selection, and source requests. `cancel()` increments the sequence, aborts transport, clears task ownership, normally revokes `activeTurnId`, and converts pending body/selection/source states to cancelled. `accepts(key)` checks the currently owned task key before accepting any completion. Unmount aborts and clears ownership.
- `:155-193`: `performTurn` accepts completion/failure only for its task key. An accepted result updates that turn and current preferences. Retry reuses the same original request/turn (`:405-411`) rather than appending a second user turn.
- `:258-305`: selection requires the origin to be the active completed recommendation, the product to be in that candidate list, and no selection already pending. It snapshots **current** preferences, cancels other work with `cancel(false)`, and checks its task key before publishing.
- `:308-351`: sources require the active completed recommendation and no current task. They send candidate IDs from that response with current preferences and use the same task-key acceptance gate.
- `:389-404`, `:354-361`: typing, editing a preference draft, stop, and reset revoke or cancel prior work; historical content remains readable except reset.
- These are browser safety/lifecycle checks. No request contains a turn ID, generation number, revision, or authoritative server-side operation identity. The server cannot enforce historical/current-turn authority from these requests. Aborting `/api/turn` or `/api/select` does not propagate the inbound signal into `createShoppingEngine`; provider calls have their own deadline controllers (`src/domain/shopping.ts:73-95`). `/api/research` does pass `context.req.raw.signal` to the injected operation (`src/server/app.ts:153-158`).
- Durable writes/restoration must preserve the same observable no-late-publication rule. A refreshed UI cannot safely treat a stored pending task key/controller or old selection capability as a resumed live operation; current source does not define restoration behavior.

## Existing HTTP/API and user boundaries

`src/client/api.ts` is the sole browser transport facade. It uses relative `fetch` URLs, JSON request bodies, supplied abort signals, and response schemas. It has no login, logout, session bootstrap, identity header, conversation load/save, or delete API.

| Endpoint | Request / response | Existing boundary |
| --- | --- | --- |
| `GET /api/health` | Fixture/live-research capability flags | No user state. `src/server/app.ts:119-124`. |
| `POST /api/turn` | `{ message, preferences }` -> discriminated result + recorded `toolActivity` | Strict input, fresh engine per request, no account identity or transcript. `src/server/app.ts:125-135`; `src/domain/contracts.ts:120-123`, `:139-176`; `src/client/api.ts:13-34`. |
| `POST /api/select` | `{ productId, preferences }` -> handoff or typed error | Finds trusted catalog identity, rechecks offer/eligibility under supplied preferences; no server check that a prior turn recommended it. `src/server/app.ts:136-145`; `src/domain/shopping.ts:162-179`; `src/client/api.ts:36-61`. Browser additionally validates returned product identity and exact catalog handoff. |
| `POST /api/research` | `{ productIds, preferences }` -> disabled/unavailable/ready excerpts | Strict shortlist of 1-5 unique known catalog IDs, validated preferences, injectable operation, response validation. No server check that shortlist belongs to a prior response. `src/server/app.ts:146-160`; `src/domain/web-research.ts:41-46`, `:73-88`; `src/client/api.ts:63-89`. |

Shared guards in `src/server/app.ts`:

- `:19-26`: strict request/preference objects, constrained budget, 16,384-byte body cap.
- `:49-67`: server request UUID, security headers including `no-store`, and bounded request/outcome logs. Request IDs are observability identities, not account/session identities. Logs omit payloads.
- `:69-86`: exact local Host/Origin allowlists using configured API/web ports. An absent Origin is accepted. OPTIONS advertises `GET, POST, OPTIONS` and `Content-Type`; no credential-aware session CORS handling exists. These checks control local HTTP origins, not user ownership.
- `:88-117`: explicit JSON content type, encoding restriction, actual streamed byte cap, JSON validation.
- `:161-162`: generic 404 and 500 responses.

`src/server/index.ts:6-12` composes environment config + optional research + logger and binds the API to `127.0.0.1`. `vite.config.ts:12-19` binds frontend to loopback and proxies `/api` to the API. This is a local-only application, not a deployed authenticated multi-user service.

There is no cross-user data read path today because no user data is stored server-side. Equally, there is no authenticated ownership enforcement: any caller admitted by the local HTTP boundary can submit its own complete valid preferences and catalog IDs. Existing tab isolation must not be presented as account authorization. A future ownership boundary must derive identity from its chosen authentication mechanism, then check every relevant read/write/action; accepting a caller-supplied owner field would not establish ownership. No auth protocol is selected here.

## Authentication, persistence, migrations, retention: what exists

- No authentication middleware, account schema, session cookie, session store, password/token verification, account routes, database connection/pool/repository, ORM/query library, SQL schema, migrations, transaction layer, or migration runner is present in the pinned `src` tree or committed package scripts/dependencies.
- `src/server/config.ts:1-17` supports API/web ports only. `src/server/index.ts` has no persistence initialization or shutdown handling. Source-level environment configuration for the research adapter exists; no environment or credential values were read.
- No retention duration, expiry sweeper, transcript/history cap, durable delete, export, account deletion, schema version, optimistic versioning, or cross-tab/device synchronization behavior exists. In-memory turns append without a count cap until New chat, refresh, or unmount. Body, message, response, and provider-output limits do not bound the number of turns.
- `docs/architecture.md:43-49` explicitly says only theme persists and PostgreSQL belongs behind authentication/ownership checks for durable multi-user state.
- `docs/capability-gaps.md:20` assigns authentication + PostgreSQL and restart retention/ownership/deletion/migrations to Issue #3.
- `docs/security-model.md` requires session isolation, reset, expiry or bounded storage, concurrency behavior, and authentication/ownership before durable shared exposure. The exact future retention policy and deletion/account scope are not specified in the baseline.
- CI (`.github/workflows/ci.yml:10-38`) installs dependencies, runs typecheck/unit+API/build/browser tests, and uploads screenshots/traces. There is no PostgreSQL service, database setup/migration job, or restart persistence check. This report did not query live workflow status.

## Seam for the Exa owner's new research response

Preserve a single application research/turn facade and its canonical response contract as the Exa work lands; do not duplicate research composition in Issue #3.

- Current server composition root: `src/server/index.ts:6-10` -> `createApp` (`src/server/app.ts:35-47`). `AppDependencies` injects fixture `Providers`, optional `WebResearchOperation`, timeout, and logger. Routes already own HTTP validation/error handling and call the injected operations.
- Current browser composition root: `useConversation` -> `src/client/api.ts` -> validated route response. This is where future session bootstrap/restoration would meet the controller; existing visual message components need not know Exa SDK details.
- Current low-level provider contracts (`src/domain/providers.ts:5-24`) accept typed shopping data plus an abort signal; they contain no account/storage concerns. `WebResearchOperation` (`src/domain/web-research.ts:85-88`) likewise takes a validated request and signal.
- Current Exa adapter factory is `src/server/exa-research.ts:137-169`; bounded projection/query building are adapter responsibilities. Auth/ownership/storage should wrap the resulting application operation rather than move account data into or clone this adapter. Preserve the cancellation signal through any wrapper.
- Current generation state and visible message/response snapshots are separate from current preferences. Persisting only the new research response would miss client-authored budget questions, displayed editor/skip messages, and current preferences; serializing the whole hook would capture ephemeral tasks/editor/request authority. Those are existing distinctions to respect, not a proposed storage protocol.
- Rebase exact contract and wrapper signatures against the Exa owner's final candidate before implementing Issue #3. This report intentionally did not inspect or race their working-tree edits.

## Minimum meaningful test surfaces for Issue #3

These are verification obligations grounded in present gaps, not new endpoint/schema/auth design. No tests were run during this investigation.

| Surface | Existing anchor | Minimum added evidence |
| --- | --- | --- |
| Domain constraints and immutable history | `tests/unit/shopping.test.ts:57-109`, `:127-165`; `tests/unit/conversation.test.ts:9-55` | Retained hard constraints, pending unsupported requirements, budget changes/removal, feedback, and response length round-trip without mutating previous response snapshots or another user's data. `conversation.test.ts` currently tests the domain engine, not `useConversation` hydration. |
| Real PostgreSQL lifecycle and migration | No existing DB surface; package scripts/CI lack a DB runner | Fresh isolated cluster/schema setup; migration from empty and supported prior schema; repeat migration safety; write then recreate application/repository objects; actual API process restart against the same cluster; database restart if restart retention is claimed. A mocked store or same-process object recreation alone cannot prove process/database restart persistence. |
| Authorization at API and storage boundary | `tests/api/app.test.ts:11-184`; injection seam `createApp` | Signed-in A/B plus unauthenticated/expired/revoked identity cases for every chosen preference/history read/write/delete and recommendation/source/selection action. Use A's actual known stored IDs from B, not only separate browser contexts. Rejected requests must not invoke paid/provider work or change owned state; enumeration responses must not expose other users' records. Preserve strict payload validation and safe logs. |
| Delete/reset/retention | Browser-local reset `tests/e2e/research-shopping.spec.ts:262-285`; cancellation tests below | Verify the chosen New chat versus durable deletion semantics explicitly; deletion removes the defined stored scope, remains removed after restart, cannot delete B's scope, and cannot be resurrected by a delayed write/result. Retention boundary tests need controllable time and an explicit policy, covering expired versus retained data and the selected bounded-storage behavior. Baseline does not decide those policies. |
| Concurrency and late persistence | `tests/e2e/research-shopping.spec.ts:287-308`, `:349-383`, `:606-657`; `tests/e2e/chat-first.spec.ts:178-243`, `:340-396` | Preserve real transport abort and no-late-publish behavior across editing/reset, plus chosen session switch/logout/delete/expiry semantics. Test stale operation completion against durable state as well as the current DOM; refresh must not revive stale selection/search actions. Verify updates from concurrent sessions against the chosen consistency policy. |
| Real browser restart/ownership journey | `tests/e2e/research-shopping.spec.ts:262-285`; multi-turn `tests/e2e/chat-first.spec.ts:21-52` | Authenticate, change structured preferences across turns, refresh/reopen, restart app, restore as the same identity, then verify another identity cannot read/change them. Check previous response snapshots remain historical, current preferences remain separate, and fixture/excerpt labels survive restoration. Existing contexts only prove ephemeral isolation. |
| Research facade wrapping | `tests/api/web-research.test.ts:54-81`, `:84-106`; existing Exa adapter substitute tests | Use local substitute research and assert authorized typed inputs and the same abort signal reach the single canonical operation; auth/ownership failures must prevent invocation; adapter/response validation still rejects malformed/unsafe outputs. No live paid calls are needed for Issue #3 boundary checks. |
| Frontend acceptance and visual QA | `tests/e2e/chat-screenshots.spec.ts:4-79` | Run existing acceptance at desktop 1440x900 and mobile 390x844 and extend only necessary auth/restoration/deletion states. Inspect actual screenshots for minimal chat layout, first-visit dark and persistent theme, historical messages, inline preferences, safe disclosures, mobile scrolling/composer, keyboard/focus. Independent QA/security review must pin the exact candidate commit. |

Existing harness facts:

- `vitest.config.ts:3-7` includes `tests/unit/**/*.test.ts` and `tests/api/**/*.test.ts` in Node; API tests use Hono `app.request` with injected providers, not a listening process.
- `playwright.config.ts:7-33` runs Chromium with one worker, uses API/web ports 3163/5273 by default, starts fresh `npm run dev`, disables live Exa, and retains failure traces/screenshots/video under `artifacts/playwright-results`.
- `tests/e2e/chat-screenshots.spec.ts:73-78` currently expects the light theme to survive reload **and the conversation to be empty**. Durable authenticated behavior needs an intentional update for authenticated restoration while retaining honest anonymous behavior; do not silently weaken the rest of acceptance.
- Package scripts: `npm run typecheck`, `npm test` (live Exa disabled), `npm run build`, `npm run test:e2e` (live Exa disabled), and `npm run verify:offline`. The verification skill lives at `.agents/skills/verify-research-shopping/`; no skill run was performed for this read-only task.

## Local execution tools observed

Only PATH discovery, directory-path checks, and `--version` were executed. No cluster initialization, sockets, running service inventory, Docker daemon request, or database connection was attempted.

| Tool | `command -v` result | Version output |
| --- | --- | --- |
| `psql` | `/opt/homebrew/bin/psql` | `psql (PostgreSQL) 17.11 (Homebrew)` |
| `postgres` | `/opt/homebrew/bin/postgres` | `postgres (PostgreSQL) 17.11 (Homebrew)` |
| `initdb` | `/opt/homebrew/bin/initdb` | `initdb (PostgreSQL) 17.11 (Homebrew)` |
| `pg_ctl` | `/opt/homebrew/bin/pg_ctl` | `pg_ctl (PostgreSQL) 17.11 (Homebrew)` |
| `docker` | `/usr/local/bin/docker` | `Docker version 20.10.17, build 100c701` |
| `podman` | Absent from PATH | Not executed |

Available matching Homebrew directories: `/opt/homebrew/opt/postgresql@17/bin` and `/opt/homebrew/Cellar/postgresql@17`. No matching `/usr/local/opt/postgresql*/bin` or `/usr/local/Cellar/postgresql*` directory was found by the bounded directory check. The initial default-zsh glob check stopped on an unmatched path; it was repeated with `setopt nullglob` and completed successfully.

These installed binaries establish that an isolated PostgreSQL test cluster is feasible without installing dependencies. They do not establish that an existing database is configured, running, safe to reuse, migrated, authenticated, or authorized for application access. Docker CLI availability does not establish a running daemon.
