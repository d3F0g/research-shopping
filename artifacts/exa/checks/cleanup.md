# Exa cleanup review

Base: `9656f21` (`main`). Scope: handwritten Exa domain, adapter, API route and bootstrap, client API/component/styles, related tests, plus `.codex/pstack-runs/exa-integration/verify-no-secret.mjs`. Read-only review; no source files changed.

## Reviewed touched files

- `src/domain/web-research.ts`
- `src/server/exa-research.ts`
- `src/server/app.ts`
- `src/server/index.ts`
- `src/client/WebResearch.tsx`
- `src/client/api.ts`
- `src/client/ResearchResults.tsx`
- `src/client/styles.css`
- `tests/api/app.test.ts`
- `tests/api/exa-research.test.ts`
- `tests/api/web-research.test.ts`
- `tests/e2e/research-shopping.spec.ts`
- `tests/unit/web-research.test.ts`
- `.codex/pstack-runs/exa-integration/verify-no-secret.mjs`

Read `docs/exa-research.md`, `README.md`, and `AGENTS.md` as supporting context.

## Findings

- Deletion candidates: **0**.
- Deletion count: **0**.
- `MUST KILL` refactor targets: **0**.
- Scoped narration comments, commented-out code, lint/TypeScript suppressions, and unsupported workaround code: none found.
- No actionable cleanup findings.

The reviewed catches and guards sit on real boundaries: malformed/unsafe provider payload projection, optional environment-based provider composition, bounded request parsing, API failure mapping, browser fetch errors, and secret-safe scanner failure reporting. The client request generation/abort checks protect stale or disconnected UI work. These were not flagged as workaround code.

## Skips

- Did not read `.env` or inspect credential values, call Exa, edit files, or run tests.
- Excluded official upstream UI components and historical binary artifacts as instructed.
- Scanner controls in `/tmp/research-shopping-exa/guard-selftest.json` were supplied as already verified and were not repeated.
