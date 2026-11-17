# Verification evidence

The initial fixture-backed vertical slice passed independent QA at application commit `2dcfe45ed05bcf476f294c3152c723806f2d6d97`. The original checkout contains the same application source, package lock, configuration, and tests. Later assembly changes add documentation, the verification skill, and retained evidence.

## Reproduced checks

| Check | Observed result | Evidence |
| --- | --- | --- |
| Clean dependency install in original checkout | npm11 `ci` passed; audit reported zero vulnerabilities | Root execution record in decision trail |
| Original checkout unit/API tests | 108 passed | Root execution record in decision trail |
| Original checkout build | Typecheck and Vite build passed | Root execution record in decision trail |
| Independent unit/API tests | 108 passed | `artifacts/security-review/tests-final.log` |
| Independent browser suite | 15 passed in Chromium | `artifacts/security-review/e2e-final.log` |
| Production dependency audit | Zero known vulnerabilities | `artifacts/security-review/audit-final.json` |
| Independent HTTP probes | 30 observations passed | `artifacts/security-review/http-final.json` |
| Independent provider probes | 19 observations passed | `artifacts/security-review/provider-http-final.json` |
| Malformed handoff responses | Five rejected without a clickable destination | `artifacts/security-review/handoff-final/proof.json` |
| Keyboard request-editor focus | Visible solid3px outline | `artifacts/security-review/textarea-focus-final.json` |
| Independent skill helper | Real journey passed; owned servers stopped | `artifacts/security-review/skill-final/proof.json` |
| Original-checkout skill helper | Passed on clean merge candidate38e50a1; cleanup confirmed | `artifacts/verification-skill/final-head/proof.json` |
| Original-checkout editor probes | Character-by-character exclusions and ambiguity follow-up passed | `artifacts/visual/final-editor-probe.json` |

The [independent final report](../artifacts/security-review/final-proof.json) records exact commands, candidate SHA, checkout state, supporting artifacts, cleanup, and review limits. Tests use one browser worker for stable scheduling. Explicit deferred-response gates still exercise overlapping requests. Independent browser contexts exercise session isolation.

## Product acceptance

- Understand first. Literal starter requests produce results, while ordinary ambiguous requests ask a category question. Unsupported hard requirements remain pending.
- Define preferences. Hard budgets, region, excluded brands, and required features filter before flexible priorities rank candidates.
- Research and plan ahead. Synthetic supported, unknown, and conflicting claims remain distinct. Handoff rechecks identity and eligibility.
- Front-load. The recommendation precedes explanatory notes and product details.
- No scrolling blobs. Small comparison cards and expandable evidence control detail.
- Per-user adaptation. Budget changes, priority changes, response length, dissatisfaction, and tab-local state have tests.
- Restraint. Each request produces one result; there are no unsolicited product notifications or background order actions.

## Scope and limits

All prices, stock, and product claims are synthetic SG/SGD scenarios. Fixture dates are scenario metadata, not actual observation dates. The deterministic parser supports a bounded grammar and two product categories. The application does not establish current merchant inventory, delivery, reviews, or a purchasable exact variant. Manufacturer links are model references. Separate retrieval checks returned seven matching model pages; the Dell reference was inaccessible through the retrieval tool.

One existing-credential live research probe returned HTTP429 without a response ID or citations. No cause was inferred and no retry or credential change occurred. Live research and merchant integration, authenticated durable state, and broader language/category coverage remain assigned backlog items.

The review covers local loopback operation and Chromium. It does not claim production multi-user security, load testing, Firefox/WebKit coverage, or an assistive-technology audit. Build output includes nonblocking Rollup notices about annotation placement in Zod dependency comments. No checks were suppressed for those notices.

The generated skill was validated and executed. Use `$maintain-verification-skill` when that installed workflow is available to keep its feature map aligned with future changes.

## Final source continuity

The root merge candidate `38e50a1c91e0cd875b7cc9d85a51512bcb8282fb` passed the default-path skill from a clean working tree. Its application source, tests, package files, and runtime configuration match independently reviewed `2dcfe45`. Subsequent assembly retains proof and updates documentation. The published application snapshot has the same source, tests, dependencies, and runtime configuration. GitHub rejected the active workflow due to missing OAuth scope, so its definition is published as an inactive proposal. The root verified that comparison with `git diff --name-only 2dcfe45 -- src tests package.json package-lock.json playwright.config.ts tsconfig.json vite.config.ts vitest.config.ts`. No application differences were reported.

## GitHub execution limit

GitHub-hosted CI did not run. The current OAuth credential rejected active workflow publication, and no credentials or permissions were changed. The tested application is published without an active workflow. [CI activation](ci.md) and issue19 preserve the exact proposed workflow and verification criteria. Local verification results are not presented as GitHub CI results.

## Published review

[Application PR20](https://github.com/d3F0g/research-shopping/pull/20) stacks on [architecture PR6](https://github.com/d3F0g/research-shopping/pull/6). Both are open and unmerged. The initial milestone and reproduced defects are closed with verification links. Live integration, durable personalization, coverage, and CI activation remain assigned backlog items.
