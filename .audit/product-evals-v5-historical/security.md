# Security review of the preserved v5 evaluation candidate

Verdict: PASS for the evaluation adapter, report-integrity boundary and recorded results at `ee6d33850d4849ccc155f2fcdee291bd15de9118`. No unresolved blocking security defect was reproduced in this scope. Technical product acceptance remains FAIL. This verdict does not approve application PR38, a paid provider, live usefulness or a newer application integration.

## Reviewed identities and scope

- Application/PR base: `fd9d13793342cdd7e37686b09ae6c9ffd88bb69f`.
- Evaluation head: `ee6d33850d4849ccc155f2fcdee291bd15de9118`.
- Evaluation adaptation base: `cd145e317da1d38361dede8cf1e5c72b2812dc55`; original evaluation `b10f4b88dda44f729338eef1197e74c374d65440`.
- Frozen original application: `bb51c38748b35d838b44109d72ab4dc9a9847d8c`.
- Scope: `evals/`, package scripts, product-evaluation CI, synthetic input provenance, frozen codecs, comparison bridge, final reports and browser proof. `docs/security-model.md` and the v5 plan/design were read.

No application/evaluator code, baseline, expectations, GitHub state, credentials, real environment files or persistent usage records were changed. All writes were confined to the independent security artifact directories. Application `src` is byte-equivalent through Git to the assigned application commit. All 41 baseline artifact hashes and both original expectation-file hashes match the starting manifest.

PR38 subsequently advanced to `4e42bee347b4c7909c2d4ac96122a781e945bd82`. The parent reports that this removes OpenAI composition in favor of local parsing and optional Ollama. That newer integration was not inspected by this review. The OpenAI transport results below are historical boundary evidence for fd9d137 only.

The parent froze these artifacts in `becee3c` and then advanced the evaluation checkout to `32c08113f857f38138ca89d1cf4ac4eb9c7dc949` while this report was being written. All runtime and integrity results below had already completed on ee6d338. No old runtime suite was rerun after the source advanced. Source-equality statements refer to the reviewed historical head, not the later checkout.

## Commands and observed results

```sh
npm run eval:typecheck
npm run eval:test
node --import tsx artifacts/product-evals/independent-security/v5-final/probes.ts
node --import tsx artifacts/product-evals/independent-security/v5-final/treatment-probes.ts
npm run eval -- --out artifacts/product-evals/independent-security/v5-final/rerun --application-commit fd9d13793342cdd7e37686b09ae6c9ffd88bb69f --gate report
node --import tsx artifacts/product-evals/independent-security/v5-final/results-integrity.ts
```

Typecheck passes. All 51 evaluation controls pass, including actual loopback Hono/Exa SDK, source/price integrity, malicious-link detector sensitivity, detached cancellation observations, duplicate research identity, stale questions, frozen v2 validation, cross-contract coverage, and fake-key OpenAI receipt/cancellation controls.

The independent complete runner executes all sixty cases and 140 turns. It reproduces exactly 4 passes, 37 failures, 18 blocked, one unsupported, zero infrastructure errors, and 52 critical assertion failures across 28 scenarios. The saved final candidate and scorecard validate and the scorecard recomputes exactly. The comparison contains all sixty original scenario/action/expectation contracts, matching research material and the canonical v2 interpretation hash.

Ten additional runtime/security probe groups pass. Actual owned HTTP rejects foreign Origin and explicit wire Host, malformed JSON, invalid content type, negative budget and oversized body without dispatch. Provider HTTP503 yields honest unavailability without a fallback product. Hostile source instructions leave budget/objective unchanged, do not introduce a non-HTTPS published source or invoke another tool. Missing or ambiguous symbolic targets fail closed. Live provider destinations and nonexact owned origins are denied. Altered deterministic checks are rejected, while rehashed malicious embedded implementation text remains inert audit data.

Six treatment-integrity controls pass. Canonical v2 remains comparable. Identical proposals carrying a custom control hash, alternate empty acknowledgement proposals, missing interpretation and missing execution are explicitly incomparable and excluded from transition counts. A custom proposal claiming the canonical tape hash is rejected. The final helper also rejects consuming the same interpretation row twice; the earlier preflight detector gap is closed.

Six final-result integrity groups pass. Truncated/duplicated cases, forged expectation hashes, concealed interpreter counts and nonzero paid-HTTP claims are rejected. A self-consistent changed research body is visibly incomparable. No report source string is executed.

## Browser and sensitive-output evidence

Independently inspected the owner's exact-ee6d browser and smoke proof, requests/responses, labels and logs. The full browser proof has 44 passing checks, 18 screenshots and six traces; smoke has 30 passing checks, twelve screenshots and two traces. Both record completed cleanup, zero unexpected browser requests and zero page errors. Image bytes are locally fulfilled and deliberately broken images produce the real fallback. No external image response is used. Actual browser cancellation records upstream abort/no late cards, and a separate context begins empty.

Inspected the actual desktop image-fallback and mobile-cancellation screenshots. Products remain visibly synthetic, prices observed/unverified, stock/delivery unverified, and the cancellation screenshot has no result cards. Independent visual QA remains a separate owner; this security review did not rerun the complete browser journey itself.

Server logs contain no transcript/fake-key/Bearer markers and no common secret-token/private-key signatures. The candidate and scorecard likewise contain no common secret-token/private-key signatures. This bounded signature check is not a universal secret detector. Evaluation transcripts are intentionally retained from public synthetic cases. No private environment or real ledger was read to establish this.

## Bound result digests

| Artifact | SHA-256 of file bytes |
| --- | --- |
| Frozen baseline report | `a9577869cd991fdd4713ef4bc5a6a5842b1d5839282d7e4a18a404cab2a32a56` |
| Preserved candidate report | `563fdbeef71e331f8f21d4311a2807ec3493427a9badf48c34da7a625daf29e3` |
| Preserved scorecard | `fa6bc79232c864aeaf4ec40d537e753a653c513a90e0c513c20ca90496150a51` |
| Full browser proof | `7995b06c3f337d0c8341b0eb913290e89d778e6e07d7da3cb28d86cfbeb0225c` |
| Smoke proof | `a28507ee37a19b91ebc1c0562603fa1124229c62211dc9a997037d712412fc97` |

Canonical structural report digests used by the bridge are separately recorded in `results-integrity.json`. Logs, scripts, independent rerun and machine evidence are retained beside this report.

## Fairness and remaining limits

The v4 parser and v5 supplied interpretation are different treatments. The scorecard states this, preserves every original failure, distinguishes lost assessment and excludes altered treatment/material from improvement counts. Four strict passes cannot establish live task success or better model understanding. An acknowledgement disposition supplied for held-evidence comparisons can avoid a tool call without producing a comparison. Fewer attribution checks after fewer research responses cannot establish stronger source quality. The current report keeps semantic/live usefulness unassessed.

No paid provider request, genuine model understanding, live discovery, current inventory, merchant authorization, provider balance or provider-enforced spending cap is established. The synthetic in-memory Exa quota is not the real ledger. Temporary OpenAI receipt fixtures are isolated and bounded rather than rotated per turn. The global fetch guard covers the explicit composition; it is not a process-wide sandbox for every Node networking primitive. A wire-Host probe used only the already owned 127.0.0.1 socket. Report hashes provide consistency, not authentication of arbitrary supplied execution claims. No DNS retrieval or general SSRF fetcher was added.

The newer parent integration requires a fresh complete run and exact-head independent review. PR47 should remain draft until those gates and final parent integration are satisfied.
