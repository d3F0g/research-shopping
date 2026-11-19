# Independent v5 local-first evaluation QA

**PASS for evaluation compatibility and the bound results at f04068e137c2ac9b242cf4c4ec8b5d7286a95734. Product acceptance remains ISSUES.** No unresolved blocking evaluator defect was found after the Issue #50 correction was independently replayed. This is not approval of live usefulness, a model's understanding, merchant verification or merging PR47.

Application source exactly matches 4e42bee347b4c7909c2d4ac96122a781e945bd82. The integration base reviewed is 32c08113f857f38138ca89d1cf4ac4eb9c7dc949. The final correction was also reviewed against 2bfca23674d1094302e96a4f346cd8028e38b690. The reviewer did not author application code, adapter code, grading, proposals or scorecard. Only independent evidence under independent-qa/ was written. No GitHub mutation, real key, environment file, private ledger, model installation, model inference or paid provider call occurred.

## Exact-head execution

All final commands completed on f04068e with suite.dirty false. Evidence is in this directory.

| Command | Result |
| --- | --- |
| npm run eval:test | 60 controls pass, including the retained controls, actual v5 Hono/SDK boundaries, frozen/current validators, treatment checks, Ollama fake transport and asynchronous attribution |
| npm run eval:typecheck |Pass |
| npm run eval with --application-commit 4e42bee and --out this-directory/full60 |All 60 scenarios and 140 turns; zero infrastructure errors |
| npm run eval with --intent-mode local-only and --out this-directory/local-only |All 60 scenarios and 140 turns; zero infrastructure errors |
| npm run eval:scorecard against the frozen v4 baseline and each independent report |Both bridges recomputed successfully |
| npm run eval:browser --mode report --out this-directory/browser |45 actual Chromium/Vite/Hono/Exa SDK checks pass |
| VERIFY_ARTIFACT_DIR=this-directory/smoke npm run verify:offline |30 checks pass, cleanup true |

The exact commands and outputs are retained in controls.log, typecheck.log, full60.log, local-only.log, scorecard.log, local-only-scorecard.log, browser.log and smoke.log. Report digests, paths and the audited source-file blob manifest are in review-binding.json. Each published result's statuses, expected/observed values and summary matches the independent execution. The published main's 140 user/assistant reply texts also match.

All 150 saved hashes pass: the original v4 baseline and two original expectation files plus the first historical v5 result are unchanged. 148 files also match their original tracked Git blobs; two ignored original server logs are checked by saved byte hash. Source still equals 4e42bee. Main and local-only reports were rerun after the attribution correction. Every reply, returned state, handling route, dispatch count and assertion outcome is unchanged from the fully reviewed 2bf output. See delta-and-preservation.json.

## Scorecard arithmetic

| Technical result | Frozen v4 | V5 local-first with supplied fallback | V5 local-only |
| --- | ---: | ---: | ---: |
| Executed |60|60|60|
| Strict pass |0|5|1|
| Fail |34|36|50|
| Blocked |25|18|8|
| Unsupported |1|1|1|
| Infrastructure errors |0|0|0|
| Critical failed assertions |37|49|94|

The main's five newly passing scenarios are CU001, PE001, CC005, CD001 and ER001. 22 scenarios still fail, 14 become newly observed failures, and seven move from failed to unassessed. There are no whole-scenario pass-to-fail regressions because v4 had no passing whole scenarios.

An independent Python recount exposes the assertion-level picture: 29 fail-to-pass assertions, 83 newly assessed passes, 32 still failing, 47 pass-to-fail regressions including 23 critical, and 598 lost assessments. The 918 assertions assessed in both runs contain 857 passes/61 failures in v4 versus 839 passes/79 failures in v5. All 60 normative contracts and research materials match. Raw aggregate rates have different assessed denominators and cannot be interpreted as a causal quality change.

Main preparation is eight actual local turns and 132 supplied fallback turns. Local-only has no composed/consumed proposals and zero interpreter invocations; its bridge explicitly marks all60 rows incomparable to the declared fixed-fallback treatment and emits no improvement or regression groups. The local-only report archives adapter loader code and constants for audit, but omits the proposal JSON files, tape contents and supplied turn rows.

## Issue #50 independently resolved

The red reproduction at 2bf remains in the parent evidence directory and review-2bf.md. The final code binds a random harness-only correlation identity when each HTTP attempt starts, carries it through owned Hono work and SDK transport, and records it independently of the production operation UUID.

The unchanged immediate research-then-Thanks overlap now passes twice. An overlapping duplicate operation preserves distinct attempt identities, admits only one SDK request and settles the actual original attempt. A delayed supplied preparation consumes its own turn's proposal despite a new local turn arriving first. A delayed cancellation records provider abort and settlement at the originating turn and remains immutable after cleanup. Successful delayed completion is covered by both the unchanged overlap and package controls. See origin-probes.json.

Independent audit of all60 main traces verifies 140 exact preparation messages, 31 research phases, both actual pending-question identities, returned-state chaining, distinct preparation/research UUIDs and 559 lifecycle events bound to their actual HTTP attempt. Actual provider path remains /answer; application bodies and operation UUID semantics are unchanged. Mutating a provider event's turn or attempt identity in a cloned report is rejected by report validation. The controlled instrumentation adds only declared test headers and does not modify application source.

## Browser evidence and seven principles

Fresh final browser and smoke runs both pass. The final browser produced 18 screenshots. Sixteen are byte-identical to the 18-image 2bf set already individually opened and inspected; both changed images were opened, along with fresh pending-question and source-evidence mobile images. screenshot-delta.json records this chain. No new visual blocker was found.

| Product principle | What the actual bounded journeys establish |
| --- | --- |
| Understand the objective and ask only consequential questions | Local powerbank draft/question identity, SGD-only continuation and automatic research pass. Useful no-budget research has no optional form. This does not establish understanding of all organic wording. |
| Separate hard requirements and flexible preferences | Actual returned preferences, contextual edits and retained bounds are visible. Rejected requirements and correction failures remain exposed in product results. |
| Attributable evidence and uncertainty | Synthetic labels, source quotations/links, observed price conditions, unknown stock/delivery, representative-image caveat and neutral failed-image fallback are readable. Quote containment does not establish relevance. |
| Useful answer first | Recommendation summaries and cards render inside assistant messages. Generic acknowledgements are visibly incomplete answers and do not receive semantic success. |
| Concise comparison with detail behind disclosure | Cards and evidence disclosures work at desktop and mobile sizes. Composer and essential controls remain accessible through conversation scrolling; no horizontal clipping was observed. |
| Adapt within the session | Authoritative budget editing, retained messages, inactive historical preference actions and local response-length controls pass. Missing conversational corrections remain product issues. |
| Avoid redundant notifications and chatter | Minimal dark first visit, theme persistence after refresh, ordinary greeting, actual preparation/search progress, cancellation and fresh isolated context pass. No simulated token or reasoning stream is claimed. |

No unexpected browser network or page error occurred. Synthetic image bytes were fulfilled locally. Browser and smoke cleanup are true; independent connection probes show all four recorded web/API origins closed. This is actual runtime verification, not a build-based inference.

## Product issues remain accurately visible

- CC001 preserves the typed 60–90 draft but cannot apply USD plus an additional specification. Its currency-only shortcut refuses the compound message; fallback budget validation treats the unresolved currency as an SGD context and demands a repeated amount. Stored state is preserved, but the request is incomplete.
- MR001's plain terminal-period range now parses, but a following No Sony sentence still contaminates range negation because the range token consumes the period. Source-span versus whole-message validation rejects the complete transaction. Semicolon/exclamation contrasts succeed.
- BC001 accepts SGD 100–160, then rejects I meant USD, not SGD while preserving the old range. It does not silently convert; it fails explicit contextual correction.
- Faithful essential hard requirements and rather-avoid flexible wording remain rejected by narrow lexical cues. The 49 main critical failures are 25 expected budgets and 24 expected criteria. No generic observed-hard-criterion-retention or hard-choice assertion fails; do not describe every missing admission as loss of accepted state.
- RT002/PQ001 suppress a second research dispatch under a supplied acknowledge action but produce no actual ordinal comparison. ER001 technically passes the frozen dispatch/budget contract while its failure-explanation request receives a generic acknowledgement.
- CU002 still conditionally recommends a synthetic powerbank for a travel-laptop request under deliberately mismatched fixed research input. The retained powerbank quote does not establish laptop relevance. Existing source/relevance tracking remains necessary.

The selected Hono replays and pure-function diagnoses in v5-local-preflight/ apply to the unchanged 4e42bee application and agree with final full 60 outputs. No diagnostic variant replaced an authoritative input or expectation. Product fixes remain with their application owner and existing issues.

The strict main pass count is 5/60 under supplied interpretation; the local-only count is 1/60. Neither is a live shopping-success rate. A full real request-to-useful-comparison-and-recommendation journey, real Ollama understanding, Exa discovery, current prices, inventory and merchant authorization remain unassessed by this work. Semantic judgments here are qualitative independent QA, not a calibrated blinded score.
