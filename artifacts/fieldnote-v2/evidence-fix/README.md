# Price evidence and evaluation synchronization fixes

Candidate `0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d` builds on `d858ca7a3d7be0d356c3b26848f708ed90c0b7bb`. All application and evaluation source files were committed before final verification. Only this evidence directory remains untracked.

The goal is useful, simplified Exa-only shopping with honest price uncertainty, ready for independent review. No GitHub mutations, production actions, private environment access, real credentials, persistent usage ledgers, database access or paid requests were used.

## Commits

- `f7e9eaf` replaces substring price certainty with a bounded affirmative clause recognizer. It requires exact variant association, explicit currency, the claimed amount, and fully recognized monetary conditions. Every relevant retained source is considered. Unrecognized financial context blocks qualification. Source overflow, conflicting duplicate URLs and source cuts cannot recover positive certainty. Only actual provider excerpts populate `originalQuote`; expanded context retains their original offsets.
- `8cc0a7b` waits for the originating actual application response and matching rendered message before browser checks. Send visibility no longer stands in for completion. Initial result geometry remains before manual scrolling.
- `b192bce` exports completed research summaries into semantic packets. The regression uses the actual SDK and Hono route, checks the matching returned summary and products, and verifies packet-hash integrity. It adds no semantic judgment.

The root already imported the first three commits. The remaining portable commits, in order, are `bd43f50`, `1b779bd`, and `0d5d7e1`. Do not import `0b07319`; it is the root's conversation-polish change included solely for local integration context.

`bd43f50` removes whole-source filtering and requires all positive price qualification to come from published native-backed support. Every retained source can reduce certainty. An unquoted extra price source cannot promote identity-only support. Only complete affirmative clauses for an unambiguous other product are excluded. `0d5d7e1` preserves uniquely scoped short peer variants when their full identity appears in the same source; target clauses always take precedence, and shared variants remain ambiguous.

`1b779bd` includes actual held-reply detail in semantic packets. The matching last assistant message must equal the response's visible message. Detail is separately labeled as collapsed content. The test uses actual SDK/Hono research and a held comparison, verifies the visible lead and disclosure separately, verifies hash changes, and rejects mismatched report provenance.

## Architecture choice

Candidate A was a global monetary-observation graph with variant, amount-role, qualification and conflict edges. It would duplicate natural-language interpretation and add several layers.

Candidate B is the selected small price module. It recognizes complete affirmative price clauses and treats unparsed monetary context as unresolved. The existing Exa projector continues to own source retention, native excerpts and public assessment projection. No new provider or public contract was added.

Attack the Premise changed the decision from another negative-phrase exception to positive atomic association. Fix Root Causes placed that decision at provider projection, where unsupported price certainty first arose. Model the Domain supplied the absent, unbound, unresolved and qualified states. Test Behavior, Not Implementation kept regressions on the public projected response, actual Hono route, SDK transport and exported packet. Prove It Works required paired controls, complete application runs and inspection of actual screenshots.

## Reproductions and results

The unchanged independent `price-variants.ts` and `variant-probes.ts` scripts were copied from the security worktree into this directory with only output destinations changed. Before the fix, all five negative inputs incorrectly yielded eligible choices. The paired ordinary controls also passed. The `*-before.json` and `*-before.log` files retain those results.

At the final candidate, every negative in both scripts is blocked and both ordinary controls remain eligible. `evidence-probes.json` also preserves the original cut-source, tax-exclusion, negative-amount and source-instruction cases as blocked while its positive control remains eligible. Each output records the exact final head.

`browser-before/proof.json` reproduces the two races. The product count was zero before research completed. The currency case read zero calls before its research response. `verified-browser/proof.json` passes all 29 checks, captures 15 screenshots, records no browser errors or denied requests, and confirms cleanup.

`semantic-before.log` records the actual summary being replaced by the incorrect missing-response text. The fixed regression passes in `verified-eval-tests.log`.

The independent review then identified a mixed-source short-variant exclusion and promotion from an unquoted price source. `cross-source-probes-before.json` and `price-provenance-probes-before.json` retain those reproductions at the earlier candidate. Both unchanged scripts now pass at the final candidate, with their positive controls preserved. The new three-product tests cover both shared generic variants and distinct short variants.

The project skill caught an intermediate positive regression because only full peer names were recognized in price clauses. Its failed evidence remains in `revised-skill/`. The final `verified-skill/` run passes after the uniquely scoped peer-clause correction. Earlier `final-*` and `revised-*` folders record superseded candidate runs. Only `verified-*` is final verification.

## Commands

All commands ran in `/Users/josiahwong/Documents/research-shopping-v2-evidence-fix`.

```sh
npm ci
npm test
npm run typecheck
npm run eval:test
npm run eval:typecheck
npm run build
npm run eval -- --gate critical --application-commit 0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d --out artifacts/fieldnote-v2/evidence-fix/verified-eval
npm run eval:browser -- --mode strict --out artifacts/fieldnote-v2/evidence-fix/verified-browser
VERIFY_API_PORT=3473 VERIFY_WEB_PORT=5583 VERIFY_ARTIFACT_DIR=artifacts/fieldnote-v2/evidence-fix/verified-skill node .agents/skills/verify-research-shopping/scripts/smoke.mjs
REVIEW_HEAD=0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d EXA_RESEARCH_ENABLED=false node --import tsx artifacts/fieldnote-v2/evidence-fix/price-variants.ts
REVIEW_HEAD=0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d EXA_RESEARCH_ENABLED=false node --import tsx artifacts/fieldnote-v2/evidence-fix/variant-probes.ts
REVIEW_HEAD=0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d EXA_RESEARCH_ENABLED=false node --import tsx artifacts/fieldnote-v2/evidence-fix/evidence-probes.ts
REVIEW_HEAD=0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d EXA_RESEARCH_ENABLED=false node --import tsx artifacts/fieldnote-v2/evidence-fix/cross-source-probes.ts
REVIEW_HEAD=0d5d7e1ca8efcde0140cfb72b8b060a4bddd472d EXA_RESEARCH_ENABLED=false node --import tsx artifacts/fieldnote-v2/evidence-fix/price-provenance-probes.ts
```

The unit and API suite passes 160 tests. The evaluation suite passes 20 tests. Both TypeScript checks and the production build pass. Vite retains its advisory about a JavaScript chunk larger than 500 kB.

The exact-head full evaluation executes all 60 original cases. It reports 11 passed, 0 failed, 48 blocked, 1 unsupported, 0 infrastructure errors and 0 critical failures. Its application and suite dirty flags are false. Overall acceptance remains inconclusive.

The project verification skill passes at the same head and confirms cleanup. Its desktop, mobile and short-mobile initial-result screenshots were inspected. The leading recommendation and first title are visible, and the bottom composer remains accessible. Strict-browser initial desktop and mobile screenshots were also inspected. Independent review remains the root coordinator's gate.

## Limits

The price recognizer is a bounded qualifying grammar, not general price understanding. Heading-plus-amount layouts, amount-only prose and other natural formulations can remain unbound or unresolved. The retained Exa interpretation and literal source context can still support useful unresolved comparisons. No total price, currency conversion, merchant verification, stock or delivery is manufactured.

These automated materials are explicitly synthetic. The strict browser runner retains its existing fixed binocular material in the currency journey and presents it as unresolved. The tests do not prove live Exa discovery, semantic relevance, current offers, merchant authorization or real shopping usefulness. No live allowance was consumed or extended. Frozen scenarios, assertions, rubrics and historical baselines were not changed. The final PR remains unmerged for user review.
