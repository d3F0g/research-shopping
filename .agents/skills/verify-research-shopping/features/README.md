# Fieldnote verification map

Use a fresh browser context and the fixture app for each independent journey. The [skill entrypoint](../SKILL.md) owns launch, doctor, evidence, and cleanup. `scripts/smoke.mjs` records its driven chat and product-link subset. It does not replace independent visual judgment. The other paths need their own browser checks or matching tests in `tests/e2e`.

## Features

- [Conversation and theme](chat.md) covers dark first visit, persisted theme, retained messages, contextual questions and the scrolling composer.

- [Research requests](research.md) covers typed requests, example buttons, ambiguity, and no matches.
- [Hard limits and preferences](preferences.md) covers editable constraints, category changes, priorities, and answer length.
- [Evidence and uncertainty](evidence.md) covers claim disclosures, fixed fixture timestamps, unknown claims, and conflicts.
- [Product selection](selection.md) covers exact product identity and safe manufacturer-link handoff.
- [Session and recovery](session-recovery.md) covers reset, independent contexts, failed requests, and stale responses.

- [Optional Exa web context](web-research.md) covers explicit retrieval, source disclosures, live-versus-stubbed evidence, safe links, and cancellation.

## Proof standard

Record the commit, worktree state, feature, entry point, actions, and observed results. Keep screenshots and traces with the report. Every fixture claim, price, and stock state must stay visibly labeled. An API result alone does not prove its UI rendering. A screenshot alone does not prove the action or boundary behavior.

Browser recipes use Playwright's `page`, `context`, and `expect`. Choose stable roles and labels first. Scope `.product-card` and repeated controls to their assistant turn. Global first-card selectors can select a historical result. Do not treat an untested entry point as covered by a different path.

## Package checks

Run `npm test` for domain, API and SDK boundaries. Run `npm run test:e2e` for the real Chromium journeys. Read the current test titles in `tests/e2e/research-shopping.spec.ts` before choosing a focused `--grep` pattern. A focused selection does not prove all mapped paths.

The browser suite covers fixture recommendations, hard limits, priorities, unknown requirements, exact handoff rejection, session isolation, stale requests, recovery, evidence, comparisons, recorded activity and optional source behavior. Chat changes also need dark-default/theme persistence, ordinary messages, contextual questions/skip, retained turns, obsolete actions and mobile scrolling/composer evidence. Confirm the named tests actually exercise these behaviors on the reviewed candidate instead of inheriting a previous candidate's counts.
