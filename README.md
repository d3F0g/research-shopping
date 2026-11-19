# Fieldnote V2

Fieldnote researches open-ended shopping requests through Exa and presents concise source-backed comparisons in a chat. The product ends at a safe product/source link. It does not place orders, take payments, or establish merchant inventory.

## Run locally

Use Node.js 22.12 or newer and npm 11. From the V2 checkout, run:

```sh
npx --yes npm@11.6.2 ci
API_PORT=3190 VITE_API_PORT=3190 WEB_PORT=5290 npm run dev
```

Open http://127.0.0.1:5290. These ports avoid the earlier preview on 5173 and 3000. First visits start dark. The header toggle persists light or dark selection. A missing Exa configuration returns an honest unavailable reply while retaining the request. It never returns fixture products.

The server reads the ignored checkout-local `.env`. Do not copy private environment files between worktrees. Exa requires a server-only `EXA_API_KEY` and the existing absolute `EXA_RESEARCH_LEDGER_PATH`. `EXA_RESEARCH_ENABLED=false` disables dispatch. Production research remains disabled.

**Live verification is blocked.** Issue [#42](https://github.com/d3F0g/research-shopping/issues/42) tracks uncertain charges and the stopped allowance. This rebuild made no paid calls. Do not reset or replace the ledger or renew a grant. Genuine proof needs trustworthy billing reconciliation and explicit bounded authorization. See [Exa integration](docs/exa-research.md).

## Use the conversation

Submit a complete request with any hard requirements. Useful requests do not need an optional budget form. A request such as `I want a powerbank around $30-40` asks only for currency, retains both bounds, and resumes research after the answer. Source assessments distinguish supported, unknown, contradicted and conflicting evidence. Observed prices remain unverified with merchants.

Follow-ups can change preferences, request a shorter answer, inspect held evidence or compare displayed options. Held comparisons and presentation changes do not call Exa. The inline preference editor changes the actual open request and criteria. Historical messages and research snapshots remain separate from current preferences.

Guest sessions survive refresh while the API process and session cookie remain valid. They are not durable across API restarts. Optional local accounts persist bounded conversations in PostgreSQL. No guest history is uploaded automatically. **New chat** clears the active shopping context.

## Optional local accounts

Account composition requires all three server settings. Missing settings keep guest mode; partial or failed configuration reports unavailable.

- `FIELDNOTE_DATABASE_URL` identifies a development PostgreSQL database.
- `FIELDNOTE_AUTH_ORIGIN` is the exact loopback UI origin.
- `FIELDNOTE_AUTH_SECRET` is the server-only auth secret.

Migrations are additive and checksummed. The new V2 workspace table leaves the earlier workspace untouched. This run uses owned temporary test databases only. Account shopping-data deletion retains account credentials. Email verification, recovery, full account deletion and secure backup/WAL erasure are not implemented.

## Verify

```sh
npm run typecheck
npm test
npm run build
npm run eval:preservation
npm run eval:typecheck
npm run eval:test
npm run eval -- --gate critical --out artifacts/product-evals/v2-current
npm run test:e2e
npm run verify:offline
env -u FIELDNOTE_TEST_DATABASE_URL npm run test:postgres
```

Browser checks use explicitly composed local SDK responses with visible fixture labels. They do not establish live research usefulness. The [verification skill](.agents/skills/verify-research-shopping/SKILL.md) starts only owned processes, checks actual viewport geometry, and verifies cleanup. It refuses occupied ports.

The original sixty evaluation scenarios, expectations and historical baseline remain unchanged. V2 uses an explicit adapter and comparison bridge. Blocked semantic/browser capabilities remain blocked rather than receiving invented scores. See [evaluation instructions](evals/v2/README.md) and the [run ledger](.codex/pstack-runs/fieldnote-v2/plan.md).

## Review gate

The V2 integration PR remains unmerged for the user's appearance and evaluation review. Routine repository merge authorization does not override this milestone. Production deployment and sensitive operations require separate authorization.
