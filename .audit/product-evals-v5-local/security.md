# Final security review of local-first evaluation integration

Verdict: PASS for the evaluation adapter and bound results at `f04068e137c2ac9b242cf4c4ec8b5d7286a95734`. Issue 50's attribution defect is independently GREEN. No unresolved blocking security or evaluation-integrity defect remains in this reviewed scope. Technical product acceptance remains FAIL; this is not application release approval or evidence of live usefulness.

## Base, head and independence

Application base is `4e42bee347b4c7909c2d4ac96122a781e945bd82`. Evaluation integration base is `32c08113f857f38138ca89d1cf4ac4eb9c7dc949`; the failed review checkpoint was `2bfca23674d1094302e96a4f346cd8028e38b690`. Final reviewed head is `f04068e137c2ac9b242cf4c4ec8b5d7286a95734` with a clean code scope. Scope covers evaluation HTTP/SDK composition, local/fixed interpretation modes, static historical validators, comparison integrity, browser metadata and published evidence. Exact reviewed file blobs are recorded in `reviewed-blobs.txt`.

The reviewer did not author the adapter or fix and changed no source, expectations, protected artifact, GitHub state, private environment, credentials or usage records. Only independent review directories were written. The application source equals the assigned upstream source. All 150 protected file hashes remain unchanged: 43 original baseline/expectation files and 107 preserved fd9 outputs. The old fd9/OpenAI review remains historical.

## Attribution fix and adversarial metadata

The unchanged independent reproduction from the blocked checkpoint now has zero incorrectly attributed lifecycle events. Immediate research/next-turn overlap, delayed preparation and cancellation/retry ownership all pass.

Inspected the actual mechanism. A random harness-only marker is created for each HTTP attempt before dispatch. The owned Hono wrapper binds that marker to AsyncLocalStorage; the network guard adds it only to the owned SDK origin; provider events retain the mapped attempt. Repeated operation IDs get distinct HTTP attempt identities, while settlement stays with the first admitted attempt. Request bodies, preferences, operation IDs and `/answer` path remain unchanged.

Six additional independent header groups pass. Missing, malformed, unknown and cross-instance markers are denied at API/provider sockets without dispatch. Invalid turns and unowned trace origins are rejected. A deliberately spoofed SDK header inserted before the guard is overwritten with the correct originating marker; the actual received body exactly matches the SDK body. Duplicate requests dispatch the SDK once, preserve original abort/settlement identity and leave immutable observations after cleanup. A delayed interpreter consumes row 0 despite an immediate next-turn request.

These markers correlate a trusted local harness, not authenticate users. Possession of an already valid same-instance marker is not presented as an adversarial security boundary. Normal application source contains no new header contract. Browser-only metadata is captured synchronously per fetch and translated by the owned route; no request body is rewritten.

The first header-spoof probe did not intercept the SDK's captured fetch reference and failed its own body assertion. The probe was corrected to install interception before SDK import, then passed. This was a test-composition issue, not a product defect. The original Issue 50 RED evidence and blocked review remain preserved outside `fixed/`.

## Commands and verification

```sh
npm run eval:typecheck
npm run eval:test
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/immediate-attribution.ts
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/header-probes.ts
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/ollama-probes.ts
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/http-probes.ts
npm run eval -- --out artifacts/product-evals/independent-security/v5-local-final/fixed/main --application-commit 4e42bee347b4c7909c2d4ac96122a781e945bd82 --gate report
EXA_RESEARCH_ENABLED=false node --import ./artifacts/product-evals/independent-security/v5-local-final/fixed/deny-fixed-inputs.mjs --import tsx evals/run.ts --intent-mode local-only --out artifacts/product-evals/independent-security/v5-local-final/fixed/local-only-hookchecked --application-commit 4e42bee347b4c7909c2d4ac96122a781e945bd82 --gate report
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/report-probes.ts
node --import tsx artifacts/product-evals/independent-security/v5-local-final/fixed/final-integrity.ts
```

Typecheck and all 60 evaluation controls pass. The independent complete main run reproduces every assertion outcome, with 5 passes, 36 failures, 18 blocked, one unsupported, 49 critical failures and 140 turns. The independent local-only run similarly reproduces 1 pass, 50 failures, 8 blocked, one unsupported, 94 critical failures and 140 turns. Neither has an infrastructure error. Each uses actual Hono and Exa SDK loopback requests with explicit synthetic materials, not paid providers.

All 26 independent Ollama loopback groups pass. They cover cloud/remote/missing/ambiguous metadata and invalid configuration, bounded UTF-8 request/output, strict operations, no tools/credentials/pull, omitted private thinking, actual-fetch redirect rejection, header/body cancellation, oversized body closure and stalled-body deadlines. These tests use ephemeral owned servers, never a real model or port 11434. The Ollama source and frozen schemas are unchanged from the prior checkpoint and were tested again here.

Ten independent HTTP/network/source groups pass. Proper owned attempt headers let the tests reach the actual application Host/Origin, content type, JSON, body-size and budget validation; the harness marker check does not mask those tests. HTTP 503 produces honest unavailability without fixture fallback. Hostile source instructions do not change accepted intent or activate unsafe source URLs or another tool. Live provider destinations, redirects and unowned origins are refused.

Seven mode/frozen-report groups pass. A self-tested filesystem hook intercepts named promise/synchronous reads and observes zero fixed interpretation JSON reads across the whole local-only run. Local-only reports omit proposal JSON inputs and all sixty rows remain incomparable under the fixed-treatment bridge, with no improvement/regression transitions. Static schema 2/schema 3 validators accept the preserved reports without executing embedded source. Schema relabeling, mode changes and nonzero inference provenance fail. Five final integrity groups also reject missing/wrong-turn/duplicate attempt IDs and mismatched settlement operation IDs, validate all reports and exactly recompute the published scorecard.

## Browser, logs and bound results

Independently inspected the owner's final f040 browser/smoke proof, labels, requests and logs. Full browser has 45 passing checks, 18 screenshots and 6 traces; smoke has 30 passing checks, 12 screenshots and 2 traces. Both have completed cleanup, no unexpected browser requests and no page errors. Synthetic images are locally fulfilled, not fetched externally. Actual browser cancellation records provider abort/no late cards, and separate contexts start empty. Independent visual QA owns full visual acceptance; this security review inspected actual desktop fallback and mobile cancellation screenshots rather than rerunning the complete browser journey.

The screenshots retain synthetic product labels, observed/unverified prices, unknown stock/delivery and the Exa-only paid-action disclosure. Vite explicitly disables environment-file loading and its child receives only the controlled environment. Owned logs contain no transcript/fake-key/Bearer markers or common secret/private-key signatures. This bounded check is not a universal secret detector; no real environment was opened to establish it.

| Bound artifact | SHA-256 of file bytes |
| --- | --- |
| Main report | `b00b8d642ea57dd8b9953fc9fdf1053ec91aa8ed5816c9c75a3561d3dc04574d` |
| Local-only report | `21ad9720be8b3342f75d145fcaac2ae69b9e6669478bea67e5d2a8d828761bb0` |
| V4 versus current scorecard | `5a93091214df7452d9a9801017ab632fca2a3342b4c13cac2acd23df04ef8712` |
| Browser proof | `c5d73e283eed5ff8fac6dd081364498ea4eec913fa8ffaf9809aa737bfb1baed` |
| Smoke proof | `70481cb8d88a36e2a6763ea868192987c56ffc7257cc709a570c0b35c7764f20` |

`final-integrity.json` also binds the original v4 and historical fd9 report hashes, structural digests, exact totals and assertion transitions.

## Limits

The main lane is conditional technical behavior under actual local parsing plus supplied synthetic fallback interpretation. The supplemental local-only lane remains distinct. Neither establishes genuine model understanding, real discovery, semantic relevance, current prices/inventory or useful live recommendations. An authored acknowledgement can avoid a tool call without answering a held-evidence comparison. Fewer source checks after fewer successful research responses cannot establish better attribution quality. The scorecard preserves these limits, missing assessment and original failures.

No real Ollama inference, installation, paid OpenAI/Exa request, private ledger, provider balance or provider-enforced spending cap was involved. The global fetch guard protects this explicit composition, not every possible Node networking API; direct wire probes used only owned loopback sockets. A malicious local service can lie about its metadata. Report hashes establish consistency, not authentication of arbitrary execution claims. GitHub CI, parent stability and merge gates remain root's responsibility. This PASS does not authorize application deployment or merging an independently blocked product implementation.
