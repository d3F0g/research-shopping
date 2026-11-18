# Issue #3 design verdict

The user wants authenticated preferences and conversation history that survive restarts, stay private to each account, and support durable reset, deletion, and retention. Select Candidate B's bounded PostgreSQL workspace, subject to the acceptance contract below. This is a static design decision, not implementation, runtime, or security approval.

I read the [brief](personalization-brief.md), [grounding](personalization-grounding.md), [Candidate A](personalization-design-a.md), and [Candidate B](personalization-design-b.md) in full. The grounding pins `1cf12b2`; both candidates report later source reads at `9d2a3c5`. Reconcile implementation with the final Exa commit before coding. I did not independently inspect application source or the documents linked by the candidates.

This review was not blind. The brief included root's provisional preference for B. A used Astra and B declared host inheritance after the configured role was unavailable. The root model family is unknown, so model-family diversity is not established.

The scores below are design judgments on a five-point scale. Five means the document covers the requirement clearly. Three means a material contract remains incomplete.

| Criterion grounded in the brief and current seams | A | B | Evidence and decision |
| --- | --- | --- | --- |
| Minimal scope around the canonical research operation | 2 | 5 | A adds selection/source commands, action capabilities, account deletion, and normalized turn storage. B concentrates one workspace behind load/command and leaves guest research intact. |
| Owned, durable preferences separated from historical replies | 4 | 4 | Both derive identity from sessions and separate current preferences from saved snapshots. B's aggregate matches the bounded single-conversation requirement. Neither proves the eventual codec. |
| Concurrent commands, cancellation, retries, and revocation | 4 | 3 | A specifies request digests, operation outcomes, explicit cancel, and version changes. B specifies final session locking and CAS, but cancellation and durable duplicate handling remain underspecified. Graft A's operation semantics. |
| Complete history and explicit storage bounds | 3 | 3 | A preserves display text and timestamps but permits 200 turns at 256 KiB each. B bounds the whole workspace but omits display text/timestamps and oversized-result behavior. Tighten B's codec and retention contract. |
| Cookie authentication and HTTP admission | 3 | 3 | Both recognize raw-body ordering, trusted origins, session revocation, and rate limiting. Neither pins installed auth behavior. A's cloned-body approach needs bounded-memory proof. |
| Reproducible PostgreSQL and browser acceptance | 4 | 4 | Both demand real PostgreSQL, restart tests, delayed operations, and screenshots. These are proposed tests, not observed results. |
| Total | 20 | 22 | B wins on scope and interface size. A contributes the stronger operation lifecycle. |

**The accepted shape.**

- Use one account-owned workspace row with monotonically increasing revision, generation, current preferences, bounded budget-question contexts, immutable saved turns, and a private pending operation. Keep authentication tables under the pinned library's generated schema.
- Expose load and typed command execution. Keep SQL transactions, reservation, cancellation cleanup, retention, and completion private to that owner. Do not make callers coordinate save/finalize steps.
- Commands cover message, preference application, budget skip, cancel, New chat, and Delete saved data. Every command carries a stable operation ID and expected version. The server derives the owner and authors assistant content.
- Saved turns preserve the user's displayed message, submitted message, original preference snapshot, server timestamp, operation identity, and terminal reply or interruption. Preserve canonical source attribution, uncertainty, unknown prices, and historical hard constraints.
- Keep draft text, focus, editor state, task controllers, current action authority, and theme outside the durable workspace. Historical actions hydrate inactive. Persist genuine normal research replies. Synthetic fixtures remain explicit automated-test substitutes in isolated test accounts and databases.
- Extract the budget-question decision into one pure domain policy shared by guest and authenticated flows. Persist its bounded question contexts. Remove the old duplicated controller policy when callers migrate.
- Wrap the final Exa application operation. Do not add normal product-selection commands, a paid shortlist/source sidecar, or A's 15-minute action capability. Do not persist or expose fixture commerce as normal account research.

**The operation contract.**

1. Validate the request at the HTTP boundary and derive identity from the verified cookie. In a short transaction, lock the valid session row and owned workspace row in a consistent order. Check expiry against database wall-clock time after lock acquisition. Every workspace lookup and mutation constrains the verified owner.
2. Reject a stale expected version before provider work. Record a pending operation with its ID, request digest, originating session, bounded deadline, and request snapshot. Advance the revision when accepting the operation. Commit the admitted user message and preference update together, so a crash leaves an interrupted turn rather than losing accepted input. Complete ordinary replies and budget questions in that transaction without provider work.
3. Invoke the one canonical research operation outside the transaction. Preserve actual transport cancellation and the existing quota owner. Do not introduce a second provider budget or retry automatically after conflict, timeout, crash, or uncertain external completion.
4. Finalize in a fresh transaction. Lock and revalidate the session, then perform an owned compare-and-swap against the claimed revision, generation, operation ID, pending state, and unexpired retention. Append the terminal response, adopt resulting preferences, clear pending, and advance revision atomically. Completion never inserts or upserts a workspace.
5. Explicit cancel targets the exact pending operation. Reset, deletion, expiry, and preference replacement invalidate pending ownership and advance version atomically. Allow these invalidating commands while research is pending. Abort matching in-process work after invalidation commits. A late cleanup can change only its own operation.
6. Retain the request digest and outcome identity with the bounded turn or private receipt. An identical retry returns current workspace state plus the existing operation status without rerunning research. A different payload with the same recorded ID conflicts. After a receipt is trimmed, the original stale version still rejects the replay without provider work. Never replay an old workspace snapshot over newer state.
7. A pending operation past its deadline becomes interrupted without replay. Every terminal transition consumes its version, including cancellation and failure. Test crashes immediately before dispatch, after dispatch, after provider return, and after commit but before the response reaches the browser. Do not claim exactly-once external billing.
8. Sign-out revocation and final publication must serialize through the actual auth session row. A result may commit before revocation; it cannot commit after revocation has completed. The initial middleware identity check alone does not establish this guarantee.

**The data lifecycle.**

- New chat and Delete saved data clear saved messages, preferences, question contexts, pending payloads, and content-bearing receipts. Keep the empty owned row with an advanced version to reject stale completions. Explain that account credentials remain. Full account deletion is a separately tracked capability, not an implied promise.
- Cap the workspace at 50 whole turns and 256 KiB of canonical UTF-8 JSON payload, including private pending and receipt data. Trim the oldest whole turns to fit. Reserve bounded operation overhead before dispatch. If one validated response cannot fit, store a bounded error outcome rather than truncate evidence into a misleading answer or exceed the cap.
- Use a 30-day maximum age for each saved turn and 30 days since the last accepted user mutation for current preferences. Reads, duplicate delivery, and cleanup do not renew either clock. This deliberately tightens B's inactivity-only history expiry, which otherwise permits old turns to survive indefinitely under continued use.
- Expired content becomes unreadable immediately. Clear it under the same version rules on startup or next access. Offer the same cleanup as a documented local command. Do not promise erasure while the app is stopped or secure removal from PostgreSQL WAL or external backups.
- Guest history stays ephemeral and is never silently imported. Before account changes, clear account-bound browser state, invalidate hydration and operation generations, and abort requests. Failed sign-out remains visibly incomplete. Cross-tab invalidation and focus revalidation must prevent a previous account's history from returning.

**The authentication boundary.**

- Better Auth with PostgreSQL is the provisional established-library choice. Pin the runtime and schema-generation tool first. Generate and review the actual SQL before implementing session locks or naming internal columns. Prove that revocation, expiry updates, and deletion conflict with the selected lock.
- Use local password accounts without claiming verified mailbox ownership, recovery, OAuth, or external services. Keep a stable server-only secret and explicit canonical local origin. Disable session cookie caching. Explicitly document session expiry and refresh behavior for the pinned configuration.
- Keep Host checks, exact Origin checks, byte limits, safe logging, and no-store responses ahead of auth dispatch. Cookie mutations require the canonical Origin. Route auth before the application JSON parser consumes its body. Pass the intact bounded request and preserve every Set-Cookie header.
- Bound actual streamed bytes, including chunked auth bodies. A clone is insufficient evidence of bounded memory because an unread stream branch can buffer. Verify the chosen bounded read or streaming adapter against the installed handler.
- Enable and test the library's development rate limiting. Derive client address from the trusted connection adapter and ignore attacker-supplied forwarding headers. Set host-only HttpOnly SameSite cookies and test the real Vite proxy. HTTP exceptions remain restricted to loopback development.
- Missing account configuration exposes an explicit guest-only capability. Partial or failed configuration exposes an account error. An expired session or database outage never silently converts a signed-in write into guest work. No production database, credential, permission, or deployment change belongs in this implementation.

**The acceptance gates.**

1. Pin the final Exa base and the auth dependency/schema versions. Commit ordered migrations with checksums and one advisory-locked runner. Test migration from empty and every supported prior schema, repeated application, checksum mismatch, and concurrent migration attempts. Startup verifies readiness instead of guessing schema or granting permissions.
2. Use an owned temporary PostgreSQL 17 cluster locally. Write through real HTTP cookies, restart the actual API process, restart PostgreSQL, and restore the same account's preferences and history. Verify deletion remains deleted across both restarts. Add and actually run the corresponding CI PostgreSQL service tests. An injected map, SQLite, or same-process recreation does not satisfy this gate.
3. Test account B using account A's real operation and turn identifiers. Cover reads, commands, cancel, reset, deletion, expired/revoked/forged sessions, and missing cookies. Assert zero provider calls and unchanged owned data for rejected commands. Assert logs omit credentials and transcript text.
4. Use independent PostgreSQL clients and a held local provider substitute to race completion against cancel, preference change, reset, deletion, retention, session expiry, sign-out, and another account command. Inspect persisted rows and the visible UI after release and restart. Include duplicate delivery and lost-response retries.
5. Test exact Origin and Host rejection, body-size enforcement without Content-Length, auth rate limits, forwarded-header spoofing, cookie attributes, raw-handler ordering, and the Vite proxy path. Verify configured database failure never falls back to guest execution.
6. Keep live Exa and live composition disabled in every automated run and reject unexpected external provider requests. Preserve existing budget, ambiguity, unavailable-result, disagreement, dissatisfaction, hard-constraint, and safe-link assertions against local substitutes.
7. Run package checks and the project verification skill. Independent QA must inspect desktop 1440x900 and mobile 390x844 screenshots of guest chat, account forms, restored history, account switching, deletion, unavailable persistence, theme persistence, and the usable composer. Security and QA verdicts must name the same final candidate commit.

**The decisions and remaining risks.**

Laziness Protocol selected B's single bounded aggregate and rejected A's extra action system and schema expansion. Model the Domain added explicit terminal operation states and the missing historical display/timestamp fields. Make Operations Idempotent grafted A's request digests, exact cancellation, replay outcomes, and consumed versions. Boundary Discipline kept the shared question policy pure and placed cookie/body/session checks at their actual boundaries. Prove It Works made real PostgreSQL restart, concurrent clients, actual HTTP cookies, and inspected screenshots mandatory acceptance evidence.

The highest risks are an unproven dependency on the pinned auth session schema, cancellation that revokes only the browser while a durable result still commits, and aggregate trimming or expiry that leaves content-bearing receipts behind. The final Exa response size and the older grounding commit also require reconciliation before implementation. This review created only this verdict file. It ran no application, database, dependency installation, external request, GitHub mutation, or runtime test.
