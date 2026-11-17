# Fieldnote verification map

Use a fresh browser context and the fixture app for each independent journey. The [skill entrypoint](../SKILL.md) owns launch, doctor, evidence, and cleanup. `scripts/smoke.mjs` proves the starter request and product-link journey. The other paths need their own browser checks or matching tests in `tests/e2e`.

## Features

- [Research requests](research.md) covers typed requests, example buttons, ambiguity, and no matches.
- [Hard limits and preferences](preferences.md) covers editable constraints, category changes, priorities, and answer length.
- [Evidence and uncertainty](evidence.md) covers claim disclosures, fixed fixture timestamps, unknown claims, and conflicts.
- [Product selection](selection.md) covers exact product identity and safe manufacturer-link handoff.
- [Session and recovery](session-recovery.md) covers reset, independent contexts, failed requests, and stale responses.

- [Optional Exa web context](web-research.md) covers explicit retrieval, source disclosures, live-versus-stubbed evidence, safe links, and cancellation.

## Proof standard

Record the commit, worktree state, feature, entry point, actions, and observed results. Keep screenshots and traces with the report. Every fixture claim, price, and stock state must stay visibly labeled. An API result alone does not prove its UI rendering. A screenshot alone does not prove the action or boundary behavior.

Browser recipes use Playwright's `page`, `context`, and `expect`. Choose stable roles and labels first. `.product-card` is the existing result-card selector when the card has no accessible name. Do not treat an untested entry point as covered by a different path.

## Existing browser tests

`tests/e2e/research-shopping.spec.ts` contains the following focused groups. Pass the pattern to `npm run test:e2e -- --grep 'pattern'`. These commands select tests, not every action listed in each feature file.

| Feature | Existing test-title pattern |
| --- | --- |
| Research | `compares fixture headphones\|asks for the product category` |
| Preferences | `keeps the prior budget\|moves a selected flexible priority\|does not convert a budget\|clears incompatible preferences\|starter portability priority\|opens mobile filters` |
| Evidence and selection | `compares fixture headphones\|opens comparison and source disclosures` |
| Recorded activity | `shows only recorded activity\|rejects malformed activity` |
| Session and recovery | `keeps browser contexts\|does not let a late result\|cancels a pending selection\|recovers from an interrupted request` |

The API and domain suites in `tests/api/app.test.ts` and `tests/unit/shopping.test.ts` cover boundary and provider failure cases through `npm test`.
