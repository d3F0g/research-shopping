# Independent Fieldnote V2 security review

The goal is a useful, simplified Exa-only shopping assistant that preserves evidence, ownership, and spending boundaries.

Verdict is **PASS for the reviewed local security scope**. No reproduced blocking defect remains at `8fdc2b24707dee23493b0f3f51097bf222c86310`. This does not establish live Exa usefulness or authorize deployment or merging.

The review base is `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`. The final source review covers `8fdc2b24707dee23493b0f3f51097bf222c86310`. All 17 preserved adversarial and positive outcomes were rechecked at `31431143795433d68906d09792986259dc932993`. The only later code changes are the held-reply lead in `src/domain/turn-reducer.ts` and its unit tests. The complete provider, price, account, HTTP, quota, transport, stored codec, and UI renderer blobs are identical. `reviewed-code.json` records 97 reviewed blobs so a later documentation-only commit can preserve this binding.

The reviewer did not author application changes. The checkout is `/Users/josiahwong/Documents/research-shopping-v2-security`. Reviewer writes are limited to `.audit/fieldnote-v2/security/` and `artifacts/fieldnote-v2/security/`. No live Exa call, private environment-file read, existing ledger access, existing database access, deployment, credential change, GitHub mutation, or merge was performed. Provider keys, accounts, PostgreSQL clusters, and crash-test ledgers are local synthetic resources. Browser external requests are blocked. Persona instructions constrain the work but do not create an independent permission sandbox.

## Reproduced defects and independent closure

| Finding | Red proof | Final observed behavior |
| --- | --- | --- |
| P1. A qualifier beyond the retained source prefix left a confident SGD35 choice under a SGD30 to SGD40 budget. | `red-a00/evidence-probes.json`, `pre-fix-5ad8/http-probes.json` | The cut source cannot establish supported compliance or a qualifying price. Choice is null through both projection and actual Hono/SDK transport. |
| P1. Tax exclusions and required shipping were replaced by the native positive label `tax included`. | `red-a00/evidence-probes.json`, `red-d858/price-variants.json` | Negated or incomplete conditions remain unresolved. False positive labels are removed, and the choice is blocked. |
| P1. Instruction-only source text became factual product and price support. | `red-a00/evidence-probes.json` | The tested assistant-directed instructions become unknown support and cannot establish price or choice. No execution or exfiltration was ever observed. |
| P1. Another variant's price or a configuration range supplied an exact selected-variant price. | `red-d858/variant-probes.json` | The wrong-variant observation is withheld. A range cannot authorize a resolved price or choice. |
| P1. A mixed-product source caused a short target variant's conflicting price or shipping charge to be ignored. | `red-520a20d/cross-source-probes.json` | The full-source exclusion is removed. Target clauses take precedence. Only fully parsed, uniquely scoped peer price clauses are ignored. Both adverse mixed-source cases block the choice. |
| P1. An unrelated retained source qualified a price while its published support cited only an identity sentence. | `red-520a20d/price-provenance-probes.json` | Qualification must occur within published native-backed support. A price found only outside that support is withheld. No native quotation is manufactured. |

All original scripts were rerun unchanged. `green-3143114/probe-assertions.json` records the expected outcome for every preserved case. Valid exact single-unit SGD35 controls still produce a choice. Independent real-SDK controls also keep all three products eligible when variants share `standard`, and when variants are uniquely named Model A, Model B, and Model C. `positive-controls.json` records six eligible products, two actual local SDK requests, and intact native/expanded quotation bindings.

## Verified boundaries

| Scope | Observed evidence |
| --- | --- |
| HTTP validation and loopback | Actual owned API and SDK sockets bind to `127.0.0.1`. Invalid JSON, invalid UTF-8, wrong media type, encoded body, streamed bodies beyond 16KiB, overlong messages, extra fields, and inverted budgets are rejected. Foreign Host, foreign Origin, and null Origin are denied. Same-origin requests and preflight work. |
| Guest isolation and replay | Another cookie cannot execute a known prepared ID. Concurrent dispatch and replay reserve and call once. New chat prevents late publication. |
| Provider failures and cancellation | Real SDK 503, malformed response, empty evidence, and hanging response body return honest unavailability without retry or replacement research. New chat closes the actual SDK body socket and records unsuccessful unknown settlement. |
| Account ownership | Actual Better Auth cookies with known cross-user prepared and operation IDs cannot execute or cancel another workspace. Caller-supplied ownership fields, missing cookies, revoked cookies, foreign origins, excessive bodies, and wrong media types are rejected. |
| Transaction and storage behavior | Owned PostgreSQL tests cover expiry after a lock wait, revision conflicts, concurrent claims, immutable history, retention, whole-turn limits, UTF-8 byte bounds, migration checksums, and fail-closed persistence. Provider work occurs outside the database transaction. |
| Accepted revision fix | The claimed research operation does not advance the accepted revision. A presentation edit using the prepare-returned revision during pending research succeeds without losing the result. |
| Restart and crash | The normal API and owned PostgreSQL restore the typed currency draft, both SGD30 to SGD40 bounds, and saved messages after restart. SIGKILL during local SDK body consumption preserves its pending reservation. Restart and replay do not dispatch again, refund the reservation, or publish a late result. |
| Actual account browser journeys | Desktop and mobile create accounts, keep guest messages separate, retain labeled fixture research, restore after refresh, isolate another account, and delete saved shopping data. Mobile sign-out aborts the actual SDK body socket and prevents publication. |
| Source rendering and links | Chromium renders user script strings and provider HTML product names literally. JavaScript/data source URLs are discarded. No inline handler, payload execution, dialog, or external request was observed. Source navigation uses HTTPS and `noopener noreferrer`. |
| New held-reply detail | The optional field is bounded to 24,000 characters and remains plain React text in a shadcn disclosure. Final-head browser testing renders a malicious SVG-like string literally in both the lead and expanded detail. Actual PostgreSQL storage and API restart retain the detail and original immutable research. Held viewing adds zero provider calls. |
| Logs | Structured HTTP logs omit synthetic conversation, cookie, key, and provider-error sentinels. Generated runtime logs contain no synthetic credential or conversation contents. The normal entry point emits startup output and does not configure the optional request logger, so this review does not claim a production audit trail. |
| Evaluation integrity | Raw-state, provider-count, attempt-ownership, quotation, and report-hash mutation tests pass. The semantic packet now includes the actual research summary and separately identifies collapsed detail. Preservation verification confirms 389 unchanged assets from the original evaluation source commit. |
| Dependencies and CI configuration | Final `npm audit --json` reports zero vulnerabilities. CI permissions remain `contents: read`; automated compositions disable live Exa. No audit suppression or permission bypass was introduced. |

## Executed checks

All evidence paths below are relative to `artifacts/fieldnote-v2/security/`.

| Command or local reproduction | Reviewed head | Result and evidence |
| --- | --- | --- |
| `npm ci` | `a00dbbb` | Passed. Lockfile is unchanged on the final candidate. `npm-ci.txt`. |
| `npm test` | `8fdc2b2` | 162 tests passed across six files. `unit-api-tests-final.txt`. |
| `npm run typecheck` | `8fdc2b2` | Passed. `typecheck-final.txt`. |
| `npm run eval:test` | `8fdc2b2` | 20 tests passed. `eval-tests-final.txt`. |
| `env -u FIELDNOTE_TEST_DATABASE_URL npm run test:postgres` | `3143114` | 27 tests passed on an owned temporary PostgreSQL17 cluster. `postgres-3143114.txt`. |
| `npm run eval:preservation` | `5ad8f4a` | 389 original committed assets verified; those assets remain unchanged. `eval-preservation.txt`. |
| `evidence-probes.ts`, `price-variants.ts`, `variant-probes.ts`, `cross-source-probes.ts`, `price-provenance-probes.ts` | `3143114` | All 17 preserved expected outcomes pass. `green-3143114/`. |
| `http-probes.ts` | `3143114` | Seven grouped HTTP, ownership, transport, failure, and redaction checks pass. `green-3143114/http-probes.json`. |
| `positive-controls.ts` | `3143114` | Actual local SDK shared-standard and unique-variant controls pass for all six products. `positive-controls.json`. |
| `account-http.mjs` | `d858ca7` | Actual HTTP account ownership checks pass with zero provider calls. Its application code is unchanged. `account-http.json`. |
| `restart-repro.mjs` | `a00dbbb` | Actual normal API and PostgreSQL restart pass. `restart.json`. |
| `verify-personalization-crash.mjs` | `5ad8f4a` | SIGKILL, reservation, replay, and recovery checks pass. `accounts/crash.json`. |
| `verify-personalization-browser.mjs` | `5ad8f4a` | Desktop/mobile account journeys pass. `accounts/browser.json` and screenshots. |
| `browser-detail.ts` | `8fdc2b2` | Actual mobile browser untrusted lead/detail rendering passes. `browser-detail.json`, `browser-detail-final.txt`, and `inert-detail-mobile.png`. |
| `account-detail.mjs` | `8fdc2b2` | Actual optional-detail persistence and API restart pass with one initial local SDK call and no held-reply dispatch. `account-detail.json` and `account-detail-final.txt`. |
| `npm audit --json` | `8fdc2b2` | Zero reported vulnerabilities. `npm-audit-final.json`. |

Reviewer reproductions live in `.audit/fieldnote-v2/security/`. They use local test payloads and synthetic credentials. The copied account scripts redirect evidence to the permitted directory, disable Vite environment-file loading, and block browser external traffic. Application code and original test assertions are unchanged.

The inherited advisory GHSA-fc5q-39xc-vjpf was withdrawn on November 18, 2026, with no patched version listed. The zero audit result is not a claim that the repository patched that finding. No application import or call accepts untrusted glob patterns. See the [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).

## Remaining limits

This verdict covers a loopback development application and synthetic local failure exercises. It does not establish current Exa output quality, real product relevance, semantic entailment, price freshness, merchant authorization, inventory, delivery, or remaining provider credit. The unknown historical charge and stopped ledger remain external blockers and were not inspected or modified.

The affirmative price grammar is deliberately bounded. Valid merchant prose, tables, currencies, or qualifier formats outside the recognized structure can remain unresolved. The six-product controls prove that the tested positive structures still work, not broad live retrieval usefulness. Source instructions and contradictory language outside the tested forms are not comprehensively understood. Quotations establish provenance, not semantic truth. Native assessment text stays labeled as an AI source assessment, with full retained evidence available separately.

Source URL validation is syntactic HTTPS navigation validation. It does not prove merchant authorization or implement DNS-pinned arbitrary retrieval. No arbitrary server-fetch endpoint was found. Browser handoffs can still follow remote-site redirects after the user navigates.

Immediate transport cancellation is process-local. Persistent identity, session, epoch, intent-digest, and deadline checks prevent late publication in the tested cases. No exactly-once billing guarantee is claimed. The crash test ages its own fixture deadline instead of waiting two minutes. Email verification, account recovery, complete account deletion, and secure PostgreSQL WAL erasure are outside the optional local account scope.

Independent visual/product QA and root's actual CI review remain separate gates. This security review does not claim those verdicts or a production deployment.

Pstack's Prove It Works principle led to actual HTTP, SDK socket, Better Auth, PostgreSQL, and browser checks. Boundary Discipline led to adversarial native-response tests that distinguish valid schemas and quotation provenance from safe recommendation eligibility.

## Cleanup

All reviewer-owned runtime processes exited. `cleanup.json` records no Node process with this checkout as its working directory, no tracked application-file changes, and zero live provider calls. The checkout and all red and green evidence remain available for final documentation-commit reconciliation.
