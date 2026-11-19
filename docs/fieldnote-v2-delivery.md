# Fieldnote V2 delivery for review

PR [#53](https://github.com/d3F0g/research-shopping/pull/53) remains **draft and unmerged**, with auto-merge off, for the user's appearance and evaluation review. This is a locally verified rebuild with an explicit external live-research blocker. It is not a production deployment or a claim of completed live shopping acceptance.

## Architecture and selective reuse

React renders a minimal centered conversation using unchanged official shadcn/ui and AI Elements. A typed Hono reducer owns accepted preferences, pending currency questions, immutable messages and prepared research operations. Exa native Answer is the sole external runtime research and structured-answer provider. One bounded SDK operation follows an explicit submitted research request; retained comparisons, source inspection and presentation changes are free. There is no separate runtime inference provider.

The source boundary retains native quotations separately from complete contextual passages. Server code computes eligibility, preserves adverse and conditional evidence, checks both price bounds and explicit currency, and keeps uncertainty visible. A quotation establishes provenance, not semantic truth or merchant verification. Safe product links end the journey; payments and order placement are absent.

| Source | Reused or adapted | Rewritten or retired |
| --- | --- | --- |
| PR #38 | Persistent conservative quota, cancellation semantics, safe navigation, source and price regression cases | New current conversation/evidence contracts and chat composition; removed optional OpenAI/Ollama interpretation, normal synthetic catalogs, category registries and old overlapping runtime codecs |
| PR #41 | Better Auth, ownership and transactional persistence patterns, additive migration discipline, restart/crash/account verification | V2 bounded workspace payload; old workspace remains untouched; accounts are optional |
| PR #47 | All 60 scenarios, normative inputs, frozen baseline, historical raw evidence and rubrics | Explicit V2 adapter and versioned comparison bridge; original workflow adapted without weakening the corpus |

The original PRs and worktrees remain intact. [Issue disposition](../.codex/pstack-runs/fieldnote-v2/issue-disposition.md) separates verified candidate fixes from broader open acceptance. V2 is based on main `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`. The reviewed application commit is `e0b7317f4bd00ce49141229943279e0da357cdbc`, with `src` tree `e1d7c10c59e1251216e3ba99c0a55c5157109fd9`. Subsequent configuration/evidence changes have independent [QA](../.audit/fieldnote-v2/final/qa-43bafcf-binding.md) and [security](../.audit/fieldnote-v2/final/security-43bafcf-binding.md) binding reports. Eighteen official generated component hashes are enforced by `npm run verify:registry`.

## Run the application

From `/Users/josiahwong/Documents/research-shopping-v2`, with Node 22.12+ and npm 11:

```sh
npx --yes npm@11.6.2 ci
EXA_RESEARCH_ENABLED=false API_PORT=3190 VITE_API_PORT=3190 WEB_PORT=5290 npm run dev
```

Open <http://127.0.0.1:5290>. This safely previews the normal application without paid dispatch. Research reports its actual unavailable state; it does not select fixtures. The automated screenshot journey uses an explicitly composed test-only SDK transport. Do not enable billable verification until the existing stopped ledger and authorization boundary are resolved. Server-only configuration and optional PostgreSQL settings are in [README](../README.md) and [Exa integration](exa-research.md). Existing preview ports 3000/5173 remain untouched.

The mandatory `$30–40` then `SGD` flow retains the product and both bounds, and automatically prepares research. The real browser/API journey verified it against a local SDK substitute. That is not evidence of live Exa output quality.

## Actual desktop and mobile views

These are real Chromium captures with visibly labeled synthetic provider data. Root inspected the desktop and mobile initial recommendations; independent QA inspected the full required viewport/state set. They show the first useful answer inside the initial viewport and the bottom composer available.

| View | Screenshot |
| --- | --- |
| Desktop initial answer, 1440×1000 | [Desktop](../artifacts/fieldnote-v2/delivery/desktop-05-research-initial.png) |
| Mobile initial answer, 390×844 | [Mobile](../artifacts/fieldnote-v2/delivery/mobile-05-research-initial.png) |
| Short mobile, 390×600 | [Short mobile](../artifacts/fieldnote-v2/delivery/short-mobile-05-research-initial.png) |
| First dark visit | [Empty conversation](../artifacts/fieldnote-v2/delivery/desktop-01-dark-empty.png) |
| Persisted light theme | [Light theme](../artifacts/fieldnote-v2/delivery/desktop-02-light-empty.png) |
| Contextual editor | [Mobile preferences](../artifacts/fieldnote-v2/delivery/mobile-08-preferences.png) |
| Progressive evidence | [Mobile evidence](../artifacts/fieldnote-v2/delivery/mobile-06-evidence.png) |

The [evidence map](../artifacts/fieldnote-v2/delivery/EVIDENCE.md) resolves reviewer-relative paths into two preserved archives. The [manifest](../artifacts/fieldnote-v2/delivery/manifest.json) binds copied screenshots and the complete final QA raw archive by SHA-256; the support manifest hashes sibling logs and final security outputs. Earlier red evidence remains preserved. The mobile selection/answer can occupy much of the viewport; long evidence is disclosed separately. Source-conflict replies remain more verbose than ideal.

## Evaluation outcomes

All sixty original cases execute against the normal Hono state owner and real SDK boundary with owned loopback responses. No expected milestone tape is supplied to the application. All 389 unchanged imported assets are verified by Git blob; the adapted workflow is explicitly distinguished in the 390-asset preservation manifest.

| Run | Pass | Fail | Blocked | Unsupported | Critical failures |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frozen historical baseline, original v4 contract | 0 | 34 | 25 | 1 | 37 |
| Final V2, current contract | 11 | 0 | 48 | 1 | 0 |

Final V2 has 140 turns and zero infrastructure errors. **Overall product acceptance is inconclusive.** The 48 blocked cases are not passes. Distinct application/evaluator contracts mean these totals are not a causal measure of model improvement. The explicit bridge finds 60/60 unchanged normative inputs, no material differences, and 61 newly passing requirements among 220 requirements assessed in both contracts (159 to 220), with zero regressions in that paired subset. [Raw result](../artifacts/fieldnote-v2/delivery/eval-report.json), [descriptive bridge](../artifacts/fieldnote-v2/delivery/scorecard-scorecard.md).

A purposeful semantic spot check covers six actual candidate cases plus four authored calibration anchors. The candidate sample has one useful and five uncertain judgments, no reported critical failure. It is reporting-only, not representative, with human calibration pending and ten dimension disagreements retained. It establishes neither a full sixty-case semantic score nor factual correctness. [Semantic report](../artifacts/fieldnote-v2/delivery/semantic-semantic-report.json).

## Functional, visual and security evidence

Independent reviewers did not author the application changes. Their reports record base, exact head, commands, unchanged-boundary reuse and limits. Passing package tests were supplemented with actual Chromium, HTTP, SDK socket, Better Auth, owned PostgreSQL, restart and SIGKILL journeys.

| Check | Actual outcome |
| --- | --- |
| Core unit/API | 183 passed |
| Evaluation integrity | 20 passed; types and preservation passed |
| PostgreSQL ownership/retention/migration | 27 passed on owned temporary PostgreSQL 17 |
| Maintained Chromium suite | 8 passed; latest metadata fix also passes all eight under synthetic PR environment |
| Strict evaluation browser | 29 checks passed, 15 screenshots |
| Verification skill | Desktop, mobile and short-mobile journeys passed; cleanup verified |
| Independent contextual browser | 10/10 broad groups and 4/4 targeted groups passed |
| Account runtime | Real account/browser isolation, API/database restart, immutable history, crash reservation and cancellation verified |
| Dependency audit | Zero reported vulnerabilities; inherited advisory withdrawal is documented, not claimed as a patch |
| Cleanup review | Zero must-kill findings or new suppressions |

The initial mobile scroll defect (#52), source-question extra dispatch, quoted-price budget overwrite and reproduced source/price-certainty defects were fixed and independently reverified. Valid price and explicit-edit positive controls still pass. [Independent QA](../.audit/fieldnote-v2/final/qa-e0b7317.md), [independent security](../.audit/fieldnote-v2/final/security-e0b7317.md), [cleanup](../.audit/fieldnote-v2/final/cleanup-e0b7317.md). The [reviewed-code manifest](../artifacts/fieldnote-v2/delivery/reviewed-code.json) binds security-sensitive source blobs.

## Hosted CI and final review gate

The PR's Checks tab and final root comment record the actual final pushed head and hosted workflow outcomes. Local evidence alone does not establish hosted success. The earlier PR run `44481618019` failed before Chromium because Playwright collected a 778,617,084-byte preserved evidence diff into one JavaScript string. The supported `captureGitInfo: { commit: true, diff: false }` configuration keeps commit and PR provenance while disabling optional inline diff capture. Tests, assertions, workflow permissions and preserved evidence remain unchanged. [Root-cause and reproduction](../artifacts/fieldnote-v2/ci-metadata/notes.txt).

At inspection, main had no configured branch protection or rulesets; this run did not change safeguards or fabricate approvals. Project checks and independent reviews remain mandatory regardless. No auto-merge was enabled. The final integration PR is held for the user's appearance and evaluation approval.

The [distinct-model trail audit](../.audit/fieldnote-v2/final/trail-review-gpt-6-astra.md) found and rechecked the corrected evidence packaging gap. Its remaining attention items are final hosted CI and the explicitly inconclusive live product acceptance.

## Remaining external blockers and limits

- **Live Exa proof (#42):** no billable request was made during V2. Existing stopped usage, uncertain charges and manual grant were not reset, renewed, consumed or inspected. Trustworthy provider reconciliation and explicit bounded authorization are required before any new live verification. This is the next genuine product acceptance step.
- **Merchant verification (#36):** safe research links do not establish authorization, current payable offers, stock or delivery. No scraping/account workaround is implemented.
- **Language and evidence:** the local operation classifier and affirmative price grammar are bounded. Unsupported compound language remains whole and pending; unfamiliar source wording can remain unknown. Provenance is not entailment. Source-driven relevance and recommendation usefulness need varied live validation, including unfamiliar product classes.
- **Accounts:** loopback development only; no email verification/recovery, full account deletion or secure backup/WAL erasure. Guest state is process-local. Authenticated history is bounded to 30 days, 50 turns and 256 KiB. Transport abort is process-local; durable publication fencing does not promise exactly-once provider billing.
- **Runtime size:** the build passes with a roughly 538 kB minified JavaScript chunk warning. No bundle-size claim is inferred from passing CI.

No production deployment, sensitive credential/permission change, destructive existing-database migration, purchase or merge was performed. The only planned routine approval is the user's final appearance/evaluation review of PR #53. Paid research and sensitive operations retain their separate authorization requirements.
