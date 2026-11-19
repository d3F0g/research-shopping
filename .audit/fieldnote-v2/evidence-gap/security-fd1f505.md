# Independent security review of evidence version 4

Verdict: **PASS within the reviewed security scope** at `fd1f505c116e5112af5597292c5f6c1d9499b824`, against original base `33fadc7e3cfde2207528adb32b650287e758d343`. This consolidates the original V3 review, the structural V4 review at `8ea7db2679b3f59353255a35e222f4a41d64c9b5`, and the final lexer/UI delta. The previously reported money-only fit, catalog peer-attribution, historical report forgery, and JSON-answer-shape defects are resolved in the tested cases. No additional blocking security defect was found.

The reviewer did not author application changes. Review ran in `/Users/josiahwong/Documents/research-shopping-v2-evidence-security`; tracked files remain clean at the named head. Writes were restricted to assigned security audit/artifact directories and owned temporary fixture resources. Root separately installed the authenticated public historical fixture archive. These role and ownership boundaries are not an independent permission sandbox.

No private environment, key, ledger, grant, capture, existing database, user history, real provider, paid operation, GitHub mutation, credential change, deployment, or merge was accessed. All HTTP/SDK/database runs used explicitly composed local fixtures and a cleared environment. Four specifically authorized public archives were read. Pstack's boundary and runtime-proof guidance informed this review; root owns orchestration, CI, independent visual QA, and merging.

## Final runtime evidence

The unchanged 21-case expected-behavior runtime from the rejected V4 head now passes through actual loopback Hono and the Exa SDK. It covers the original complete-objective positive, money prefix/suffix/currency-name/wrapper/price-prose controls, all three former no-budget bypasses, and catalog positives/adverse headings. Each isolated scenario made exactly one injected admission, one local SDK request, and one settlement.

An additional independent 60-case HTTP/SDK matrix passes. Its 45 money-only cases cover word, ASCII and symbol operators; bounded numeric operands; each/per-item/per-piece conditions; incl/excl forms; and six declared whitespace forms within currency aliases. These cases retain the actual native quote and literal span, but produce unknown fit, ineligibility, and null choice. Its 15 nonmonetary controls preserve product codes, objective prose, unrecognized codes, and So-category emoji instead of classifying them as money. Preserving a native assessment in these synthetic controls is not a claim of semantic entailment.

The final lexer consumes the entire input into typed tokens. It does not destructively delete substrings and then reinterpret the remainder. Word operators require numeric operands on both sides; declared currency and condition tokens may intervene. Unknown objective text prevents a monetary-only classification. The currency aliases remain shared with the existing price grammar, and no product/category/brand registry was introduced.

All catalog cases have `price: null`, a literal SGD868 observation, unknown attribution, no observation variant field, a source-origin row, and the complete uncut source including SGD999 and qualifiers. No row is classified as an independent peer or deleted. Provider assessment, actual provider wording, conditions, and reported resolution remain separate from computed unknown attribution. The direct sentence-price positive remains an applicable SGD35 price and a qualifying choice. Range, multi-money and quantity-bearing lines do not become scalar endpoints.

Nineteen independent observation forgeries are rejected by the schema and/or native-material evaluator at the appropriate boundary: amount, currency, invented variant or attribution authority, source identity, offsets/text, incomplete context, cut metadata, source/provider origin swaps, simultaneous applicable price, and modified native status/scope/rationale/conditions/resolution/wording. Valid serialized JSON answers remain accepted; malformed and oversized answers fail closed.

Four explicit row-offset controls pass for leading/trailing whitespace, tabs, CRLF, and suffix currency. They compare exact raw UTF-16 positions, full row text, complete context, schema admission, and the independently implemented current provenance check.

The actual React render of adversarial observation metadata escapes script and event-handler strings, keeps safe external-link attributes, and displays uncertainty and stock/delivery unknown. The revised concise copy preserves the adverse native assessment and provider-condition labels. The reviewer assertion was updated only from the removed duplicate phrase `this variant` to the retained rationale phrase `the selected variant`; all XSS and authority assertions remain intact. This is a rendering-security check, not visual layout approval.

The observation probe also exercises unsafe URLs, source instructions, source-size bounds, free held replies, unchanged historical messages, and inability of an observation to satisfy an explicit budget. Source-origin and provider-origin evidence remain distinct. Observation amounts are not used for price sorting or eligibility.

## HTTP, privacy, diagnostics, failure and settlement boundaries

The thirteen independent runtime groups were rerun on this exact final head and all pass. They cover actual socket Host/Origin/media/JSON/body/monetary validation and loopback binding; session isolation and stale/cache behavior; actual SDK capture; known and unknown settlement; cancellation; throwing and hanging observers; timeout, error and invalid JSON without fixture fallback or automatic retry; projection failure stages; private destination/Git exclusion; complete omission rather than partial captures; exclusive lock ownership and cleanup; directory count/byte limits across writers; safe-link equivalence; and source instructions/cut qualifiers.

Normal logs exclude fixture shopper/source/credential sentinels. Diagnostics remain opt-in, bounded, private and outside ordinary responses/history. The observer's asynchronous deadline does not preempt synchronous JavaScript, and same-user process/filesystem tampering remains outside a separate sandbox boundary.

## History and historical report evidence bound to the final head

`unchanged-blobs-fd1f505.json` compares source, evaluator, scripts, package/lock files, stored fixtures, and PostgreSQL tests with reviewed `8ea7db2`. It records 141 identical blobs. Only the client price presentation and server price-evidence file changed in that set. The final server delta changes monetary classification, reuses parsed row offsets, and shortens uncertainty copy. Historical schemas, storage/migration, provider projection, current provenance evaluator, archived report inventory/reader, account/action boundaries, and dependency files are unchanged.

The following actual `8ea7db2` results are therefore retained for those unchanged mechanisms; they were **not rerun** and are not relabeled as new executions:

- Two owned PostgreSQL/Hono/SDK migration and restart runs: wrapper2→4 preserves four original V2 messages; wrapper3→4 preserves eight mixed V2/V3 messages, then stores current V4 beside them. Old V3 amount868 remains unchanged historical data and gains no new proof. Both runs interrupt old prepared/running receipts, clear pending preparation, increment revision/epoch, prevent stale dispatch, keep historical replies free, enforce cross-account isolation, preserve the complete workspace across API/database restart, and avoid extra dispatch on cached retry. Each uses one explicit fixture request/admission/settlement; normal logs omit fixture content and credential/email sentinels. All owned resources were stopped and removed.
- Twenty-eight repository PostgreSQL tests passed on an owned cluster.
- Nineteen authenticated historical payloads passed: 13 actual base33 Git blobs, four reports in the previously authorized public V2 archives, and two actual historical V3 reports from the authorized579 and ccfb archives. The harness checked Git blob identity or archive SHA-256 before payload digests. Ninety-five altered-check, invented-check, unknown-run and embedded-code mutations were rejected. No embedded code was executed and no old report was regraded through current semantics.

V2 and V3 evidence readers remain frozen; V3's only schema-file change is exporting an existing intent schema. Workspace4 decodes mixed snapshots through their actual versions. Current reassessment and paid-action behavior dispatches explicitly on current evidence4. Current adapter/assertion identities remain separate from the finite authenticated historical dispatch.

## Repository checks and workflow review

On the exact final head, the full application suite passes **449 tests, zero failures**. One checkout-root-writing diagnostic test is skipped for ownership and has a passing scoped equivalent in the independent runtime harness. The current evaluation suite passes **29 tests**. Application and evaluation TypeScript checks both pass.

The full60 result remains product-inconclusive: 11 pass, 48 blocked, 1 unsupported, zero fail. This review does not turn that result into product acceptance.

The workflow changes add offline history/browser verification and artifact paths under existing read permissions. No elevated token permission, credential, deployment, or live provider composition was added. The final browser-test delta waits for actual disclosure animation completion and visibility before screenshots; it does not replace behavioral assertions or fabricate progress. Actual browser appearance and hosted CI status are separate root/QA gates.

## Reproduction

From the owned checkout, pin `fd1f505c116e5112af5597292c5f6c1d9499b824`. Harnesses live under `.audit/fieldnote-v2/evidence-gap-security/v4/`; outputs live under the matching `artifacts/` path. All commands below passed at this head.

```sh
env -i PATH="$PATH" REVIEW_HEAD=fd1f505c116e5112af5597292c5f6c1d9499b824 EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx .audit/fieldnote-v2/evidence-gap-security/v4/expanded-money-runtime.ts
env -i PATH="$PATH" REVIEW_HEAD=fd1f505c116e5112af5597292c5f6c1d9499b824 EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx .audit/fieldnote-v2/evidence-gap-security/v4/lexer-runtime.ts
env -i PATH="$PATH" REVIEW_HEAD=fd1f505c116e5112af5597292c5f6c1d9499b824 EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx .audit/fieldnote-v2/evidence-gap-security/v4/observation-probes.ts
env -i PATH="$PATH" REVIEW_HEAD=fd1f505c116e5112af5597292c5f6c1d9499b824 EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx .audit/fieldnote-v2/evidence-gap-security/v4/row-offset-probes.ts
env -i PATH="$PATH" REVIEW_HEAD=fd1f505c116e5112af5597292c5f6c1d9499b824 EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx .audit/fieldnote-v2/evidence-gap-security/v4/runtime-final-probes.ts
env -i PATH="$PATH" EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node node_modules/vitest/vitest.mjs run --no-cache --configLoader runner -t '^(?!.*rejects capture within the current source checkout)' --reporter=json --outputFile=artifacts/fieldnote-v2/evidence-gap-security/v4/fd1f505-app-tests.json
env -i PATH="$PATH" EXA_RESEARCH_ENABLED=false TSX_DISABLE_CACHE=1 node --import tsx --test evals/v2/tests/*.test.ts
env -i PATH="$PATH" node node_modules/typescript/bin/tsc --noEmit
env -i PATH="$PATH" node node_modules/typescript/bin/tsc --noEmit -p evals/v2/tsconfig.json
```

The retained `review-8ea7db2.md` lists exact commands and authorized inputs for the actual PostgreSQL and archive runs. Its former monetary red is resolved by this report and by the unchanged red harness now passing; its archived red output remains as failure evidence.

## Remaining limits

This scoped PASS is not a live-usefulness, merchant-authorization, stock, delivery, real-billing, universal semantic-entailment, visual-acceptance, or merge verdict. The lexer checks the recognized monetary grammar; quotation provenance is not semantic proof of a complete objective. Unknown or malicious prose is not exhaustively understood by deterministic controls. Private captures were neither read nor replayed. Hosted CI, independent product/visual QA, repository policy, and any remaining capability gaps remain root's gates. No new human approval is required or requested by this review.
