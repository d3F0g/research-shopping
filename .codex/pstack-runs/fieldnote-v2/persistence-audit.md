# Optional account integration audit

Source PR 41 head 1b7973238d6ec7d67bb24658301155d28e1b7461. Independent source audit, no new database runtime proof.

Reuse auth.ts, auth-schema.ts and migrations/001-better-auth.sql. Adapt accounts.ts, migrations.ts, database-command.ts. Preserve workspace-store.ts transaction/session locks, revision/epoch/operation publication checks, receipts, retention and cancellation. Rewrite payload and reducer coupling for V2. Do not merge old app/history wholesale. A separate V2 JSONB workspace table avoids rewriting historical data.

Preserve exact Origin, server-derived ownership, parameterized queries, bounded bodies, session expiry checks after lock waits, provider outside transactions and fail-closed account outages. Missing complete configuration is guest-only; partial configuration unavailable. Production remains disabled.

Tests can use existing owned temporary PG17 scripts. env -u FIELDNOTE_TEST_DATABASE_URL npm run test:postgres and matching crash/restart/browser commands. No existing service or private database.

Limits remain email verification/recovery/full deletion absent; no secure WAL erasure; immediate cross-process cancellation not implemented; receipts do not prove exactly-once billing.

Issue27 advisory GHSA-fc5q-39xc-vjpf was withdrawn 18 November2026. Fresh audit at source head reports zero vulnerabilities, no untrusted application glob consumer found. Independent final security review must confirm. This is withdrawal, not a patch. Sources https://github.com/advisories/GHSA-fc5q-39xc-vjpf and https://github.com/micromatch/picomatch/pull/235 .
