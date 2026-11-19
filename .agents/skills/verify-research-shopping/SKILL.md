---
name: verify-research-shopping
description: Launch an owned offline Fieldnote V2 instance and verify real chat journeys, responsive geometry, themes, preferences, evidence, cancellation and session isolation after application changes.
---

# Verify Fieldnote V2

Use the [feature map](features/README.md) to choose additional checks. V2 is a minimal conversation with source-backed recommendations and merchant or product links. It has no catalog category gate or checkout. Normal runtime uses Exa. Automated substitutes cannot establish real retrieval, product usefulness, current prices, stock, delivery, or merchant authorization.

## Run the owned offline journey

Use the project's Node version and installed dependencies. Install Chromium with `npx playwright install chromium` if absent.

```sh
node .agents/skills/verify-research-shopping/scripts/smoke.mjs
```

Pass `--project-dir /absolute/checkout` to exercise another worktree. The helper resolves Playwright and application dependencies from that checkout. It refuses occupied API and web ports, defaulting to 3173 and 5283. Override `VERIFY_API_PORT`, `VERIFY_WEB_PORT`, and `VERIFY_ARTIFACT_DIR` for concurrent runs.

The helper launches `tests/helpers/browser-server.ts` directly through the project's tsx loader. That explicit automated composition runs the actual Hono service and Exa SDK against an owned loopback substitute. The browser labels all returned research as fixture data. Vite starts programmatically with `envFile: false`. Child environments use an allowlist, `NODE_ENV=test`, and `EXA_RESEARCH_ENABLED=false`. No private environment files, keys, database, migration, paid ledger, or grant is needed. Do not replace this with `npm run dev`, which can load a private `.env`.

Require the owned health response to report `status: ok`, `provider: exa`, and `automaticPaidChecks: false`. Require the owned test statistics endpoint as well. Health alone does not establish offline composition or product acceptance. Never drive an unknown occupied instance.

## Judge the rendered chat

The helper creates fresh OS-light browser contexts at 1440×1000, 390×844, and 390×600. It checks first-visit dark mode and both theme selections after refresh. Inspect viewport screenshots for a minimal header, centered conversation, compact composer, readable contrast, and official shadcn compositions.

Require the leading recommendation and first product name inside the visible conversation viewport after research settles. Capture this initial view before manual scrolling. `toBeVisible()` alone accepts content above the viewport and does not catch issue #52. Preserve red screenshots and geometry when this fails. Do not scroll the answer into view to manufacture an initial-view pass.

The helper then explicitly scrolls to evidence and history. Check that disclosures remain readable and the composer and send action remain inside the viewport without overlap or document-level horizontal overflow. A long card may need conversation scrolling. Essential source and edit controls must remain reachable. The helper checks rectangle intersection with floating scroll controls and samples visible hit-test points, so an unobstructed center alone cannot hide partial overlap. Inspect actual screenshots; a passing helper or build does not establish visual quality.

## Match the driven scope

The helper drives ordinary messages, the exact powerbank `$30-40` request, a typed `SGD.` answer, automatic research, both budget bounds, fixture labels, attributable image rendering or safe failure, evidence quotations, safe source links, a held comparison with zero provider calls, contextual maximum-budget editing, unchanged historical snapshots, provider failure without fixture fallback, Stop followed by New chat before a held research request dispatches, and separate cookie contexts.

Its cancellation case intercepts the browser transport before dispatch. It does not prove SDK socket cancellation or every late-response race. Its provider call counts count only local substitute traffic. Its fixture assessments are synthetic and do not prove semantic evidence correctness.

Run the package checks appropriate to the change. `npm test`, `npm run build`, and `npm run test:e2e` cover core reducers, API boundaries, provider normalization, and the maintained browser suite. Inspect current `package.json` and test files before naming their coverage. Use distinct `PLAYWRIGHT_API_PORT` and `PLAYWRIGHT_WEB_PORT` values where needed. The package runner is separate from this helper's restricted spawn. Keep CI and automated tests free of billable traffic.

Use [chat](features/chat.md), [preferences](features/preferences.md), [research](features/research.md), [evidence](features/evidence.md), [links](features/selection.md), [session recovery](features/session-recovery.md), and [live research boundaries](features/web-research.md) for affected cases beyond the helper.

## Retain proof and clean up

Keep `proof.json`, `server.log`, per-viewport traces, and screenshots together under `artifacts/fieldnote-v2/verification-skill/`. Require `result: passed` and `cleanup: true`. Proof records the exact application commit and worktree status. A dirty run proves that working tree, not its commit alone. Review a clean candidate again after code changes.

The helper closes its browser and terminates only the process groups it created, then verifies its ports are free. Occupied-port refusal must leave existing listeners untouched. If forcibly interrupted, verify the recorded PID still belongs to the owned run before cleanup. Never kill by name, stop shared previews, delete evidence, or clear billing records.

Record independent visual, functional, and security verdicts against the exact candidate. The final V2 integration PR remains unmerged for the user's appearance and evaluation review. The V2 request overrides the older automatic-merge guidance. Production deployment and sensitive changes retain their separate authorization gates.
