# Interim independent Fieldnote V2 security review

The goal is a useful, simplified Exa-only shopping assistant whose recommendations preserve evidence, ownership, and spending boundaries.

Review base is `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`. Initial review head is `a00dbbbda2e1dc5368a974fab83fedd33119582a`. Subsequent reviewed heads are `5ad8f4adc792aa423c5c1fcfa04dd531386fa5d0` and `d858ca7a3d7be0d356c3b26848f708ed90c0b7bb`. Final candidate review is pending the remaining price-evidence fixes.

The reviewer did not author application changes. The review checkout is `/Users/josiahwong/Documents/research-shopping-v2-security`. Reviewer writes are limited to this audit directory and `artifacts/fieldnote-v2/security/`. No live Exa request, private environment file, existing ledger, existing database, deployment, credential change, GitHub mutation, or merge was performed. Local provider credentials, accounts, PostgreSQL clusters, and crash-test ledgers are synthetic and reviewer-owned. Browser external requests are blocked. Persona instructions are a work constraint, not a separate permission sandbox.

## Current verdict

This is the completed interim review, not final candidate approval. Root requested a return while a separate owner fixes the remaining price cases.

Blocked on reproducible price-evidence defects at `d858ca7`. The original three adversarial cases pass after its fixes. Additional negated-condition, required-fee, wrong-variant, and price-range cases still produce confident eligibility.

## Reproduced findings

1. **P1. Discarded source qualifiers authorized a choice.** At `a00dbbb`, a complete positive first paragraph, an innocuous second paragraph, and more than 24,000 characters of filler hid the later membership-only SGD35 and ordinary SGD65 condition. The projection returned `textTruncated=true`, `conditionsResolved=true`, and a choice under SGD30 to SGD40. The same result reproduced through actual Hono HTTP and the Exa SDK at `5ad8f4a`. At `d858ca7`, the original input returns unknown support, no price, and no choice. Original red proof is `red-a00/evidence-probes.json` and `pre-fix-5ad8/http-probes.json`.
2. **P1. Contradictory price qualifiers became positive labels.** At `a00dbbb`, a complete quote saying that SGD35 excludes tax and mandatory shipping retained the native label `tax included` and authorized the choice. At `d858ca7`, that exact input removes the false label, marks conditions unresolved, and blocks the choice. However, `not tax included` and `without tax included` still retain the positive label. A complete source that adds required SGD15 shipping to the SGD35 price still marks conditions resolved. Reproduction is `price-variants.ts`, with red proof in `red-d858/price-variants.json`.
3. **P1. Assistant-directed source instructions counted as factual support.** At `a00dbbb`, an instruction-only source that said to ignore user requirements, assert the product and price, and send credentials supplied exact supported evidence and a choice. This demonstrates unsafe projection of an injected native response. It does not establish that live Exa follows the source instruction or that any exfiltration occurred. At `d858ca7`, the original input becomes unknown and cannot establish price or choice. Its paired ordinary factual source still produces a choice.
4. **P1. Amounts were not bound to the selected variant or resolved configuration.** At `d858ca7`, `Model A costs SGD 65 while Model B costs SGD 35, tax included` authorizes Model A at SGD35. `Model A costs SGD 35 to SGD 65 depending on configuration, tax included` also authorizes exact SGD35. Both sources are complete and retained. Reproduction is `variant-probes.ts`, with red proof in `red-d858/variant-probes.json`. The matched exact Model A SGD35 control remains accepted.

The original projection probes are deterministic local inputs. The HTTP probes exercise a real local SDK transport with a synthetic key. Evidence files contain the exact payloads and actual outputs. Reproduction commands use `REVIEW_HEAD=$(git rev-parse HEAD) node --import tsx .audit/fieldnote-v2/security/<script>.ts` from the review checkout.

## Verified boundaries

| Scope | Observed evidence |
| --- | --- |
| Request validation and loopback | Seven grouped HTTP checks cover invalid JSON, invalid UTF-8, wrong media type, encoded body, streamed body beyond 16KiB, overlong message, unknown fields, inverted budget, foreign Host and Origin, null Origin, and valid same-origin requests. Actual owned API and provider sockets bind to `127.0.0.1`. |
| Guest ownership and replay | Another cookie cannot execute a known prepared ID. Concurrent dispatch and replay reserve once and call the provider once. |
| Provider failures and cancellation | Real SDK 503, malformed response, empty evidence, and hanging body return unavailable without retry or replacement research. New chat closes the actual SDK body socket, records unsuccessful unknown settlement, and prevents late publication. |
| Accounts and persistence | Actual Better Auth cookies and owned PostgreSQL users deny cross-user prepared IDs, cancellation targets, forged ownership fields, anonymous commands, and revoked cookies. Tests also cover session expiry after a lock wait, concurrent claims, immutable history, retention, whole-turn and UTF-8 size bounds, migration checksums, and fail-closed persistence. |
| Prepare revision fix | A claimed operation does not advance the accepted revision. The PostgreSQL test submits a presentation edit using the prepare-returned revision during pending research and preserves the final result. |
| Process lifecycle | Actual API and database restart restores typed currency drafts and SGD30 to SGD40 bounds. SIGKILL during local SDK body consumption leaves the persistent reservation pending. Restart and replay do not dispatch again. An aged claim expires without refunding or changing the ledger. |
| Browser account behavior | Desktop and mobile journeys create accounts, separate guest history, retain preferences and labeled fixture research, restore after refresh, isolate another account, delete shopping data, and cancel the body transport on mobile sign-out. |
| Untrusted rendering and links | Actual Chromium renders user script text and provider HTML product names literally. No inline handlers, dialogs, or payload execution occurred. JavaScript and data URLs were discarded. Source links use HTTPS and `noopener noreferrer`. Fixture labels were visible. |
| Logs and secrets | Injected structured request logs contain request IDs, routes, status, and duration. Synthetic conversation, key, cookie, and provider-error sentinels are absent. Normal index startup and account-test process logs contain no synthetic credential or conversation contents. The normal index does not configure the optional request logger, so this review does not claim a production request audit trail. |
| Evaluation integrity | Nineteen evaluation tests pass, including mutation checks on raw state, counts, attempt ownership, original quotations, and report hashes. Preservation checks verify 389 unchanged committed assets from `f865939c669153943e77af3870e54c10daad6750`. The projection keeps native quotations distinct from expanded context. |
| Dependencies and CI configuration | Fresh `npm audit --json` reports zero vulnerabilities. Workflow permissions remain `contents: read`, and automated compositions disable Exa. No audit suppressions were added. |

## Commands and evidence

- `npm ci` passed. Evidence is `npm-ci.txt`.
- `npm test` passed 91 tests at `a00dbbb` and 109 at `d858ca7`. Evidence is `unit-api-tests.txt` and `unit-api-tests-final.txt`.
- `npm run typecheck` passed at `5ad8f4a` and `d858ca7`.
- `env -u FIELDNOTE_TEST_DATABASE_URL npm run test:postgres` passed 27 tests at `a00dbbb`.
- `restart-repro.mjs` passed against the normal API entry point and an owned PostgreSQL17 cluster at `a00dbbb`.
- Copied `verify-personalization-crash.mjs` and `verify-personalization-browser.mjs` passed at `5ad8f4a`. Output paths are redirected to the permitted security folder. The runtime copy disables Vite environment-file loading. The browser copy blocks all external traffic. Assertions and application code are unchanged.
- `account-http.mjs` passed actual HTTP ownership and authentication tests at `d858ca7`, with zero provider calls.
- `http-probes.ts` passed at `5ad8f4a` and `d858ca7`. Only the former returned the red cut-source choice.
- `browser-inert.ts` passed at `5ad8f4a`. `inert-source-mobile.png` was inspected and displays the payload as text with a fixture badge.
- `npm run eval:test` passed 19 tests and `npm run eval:preservation` verified the 389 assets at `5ad8f4a`.

GHSA-fc5q-39xc-vjpf was withdrawn on November 18, 2026. The advisory lists no patched version. The zero audit result is not a claim that this repository patched the old finding. No application import or call accepts untrusted glob patterns. See [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).

## Remaining limits

This is a loopback development review. It does not authorize public hosting. Local SDK doubles and synthetic evidence do not establish current Exa output quality, semantic entailment, merchant authorization, price freshness, inventory, delivery, or remaining provider credit. The original unknown charge and stopped ledger remain external blockers and were not read or changed.

Safe source URLs are syntactic HTTPS navigation checks, not merchant authorization or a server-side DNS-pinned fetcher. No arbitrary server fetch endpoint was found. The source-instruction checks can reject the tested instruction forms but do not prove protection against every natural-language injection. Quotations establish provenance, not semantic entailment.

Immediate cancellation is process-local. Persisted identity, session, epoch, intent digest, and deadline checks prevent later publication in the tested cases. No exactly-once billing guarantee is claimed. The process-crash test ages only its owned fixture deadline instead of waiting two minutes. Email verification, account recovery, complete account deletion, and secure WAL erasure are outside this optional local account scope.

Pstack's Prove It Works principle led to actual HTTP, SDK socket, Better Auth, PostgreSQL, and browser checks rather than accepting build summaries. Boundary Discipline led to the adversarial native-response probes that distinguish schema validity and quotation provenance from safe recommendation eligibility.

## Cleanup and continuation

All reviewer-owned runtime commands exited. `cleanup.json` records no remaining Node process with the review checkout as its working directory, zero live provider calls, and no tracked application-file changes. The detached checkout, red evidence, current proof, and reproduction scripts remain available for the final candidate review.
