# Independent QA. ISSUES at final code candidate.

The goal is a useful, minimal, Exa-only chat-first shopping assistant. This review is pinned to base `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11` and head `8fdc2b24707dee23493b0f3f51097bf222c86310`. I did not author application changes. All QA harnesses, copies, reports and evidence remain under the assigned `.audit/fieldnote-v2/qa/` and `artifacts/fieldnote-v2/qa/` directories. Tracked application, tests, package, eval and skill files have no QA edits.

**Verdict is ISSUES.** The final browser, component and regression gates pass, and the earlier concise-reply, punctuated-brand, browser-race and packet-omission findings are fixed. Two additional contextual meaning defects found in actual selected evaluation outputs remain reproducible through the real UI. They block product acceptance even though the maintained deterministic report has zero critical assertion failures.

## Blocking product findings

### A product price reference silently changes the accepted budget

1. Submit `Find a compact photo printer under GBP 100.`.
2. Submit `That GBP 89 one looks good. I'm not a member and won't subscribe.`.
3. Inspect the normal `/api/session` response.

Expected accepted maximum is GBP 100. The second sentence is a product reference and membership constraint, without an instruction to change the cap. Actual maximum becomes GBP 89. The original request remains unchanged in history but current numerical state is overwritten. This was first observed in frozen scenario `FN-BC-005` and independently reproduced by browser at this exact head.

Evidence is `final8fd/eval/FN-BC-005.trace.json`, `final8fd/meaning-repros/proof.json`, `quoted-price-budget-state.png`, and its failure screenshot. The actual final intent contains `budget: { maximum: 89, currency: "GBP" }`. The extended case asserts the visible behavior's accepted-state effect, not an implementation detail.

### A question about held conflicting sources spends another research request and becomes a hard criterion

1. Submit `Find a waterproof backpack under USD 100. It must protect contents in heavy rain.`.
2. After research settles, submit `One source says waterproof and another says only splash-resistant. Which is it?`.
3. Inspect accepted requirements and local SDK request count.

Expected a contextual answer from held evidence with no new research dispatch, preserving current requirements. Actual response is `prepared`, another SDK operation runs, and the question is added as a hard preference. In the independent UI replay, the local count rises 15→16. The frozen `FN-EH-001` output also has an actual conflicting backpack source, so the original packet shows this is a held evidence question rather than an input-suitability failure.

Evidence is `final8fd/eval/FN-EH-001.trace.json`, `final8fd/meaning-repros/proof.json`, `source-conflict-question.png`, and its failure screenshot. This run used a fake-key loopback transport and made no actual paid call. The defect is research invocation and state mutation, not a claim of an incurred charge.

Reproduce both with:

```sh
QA_OUTPUT=artifacts/fieldnote-v2/qa/final8fd/meaning-repros node .audit/fieldnote-v2/qa/extended-meaning.mjs
npm run eval -- --case FN-BC-005 --out artifacts/fieldnote-v2/qa/reproduce-price-reference
npm run eval -- --case FN-EH-001 --out artifacts/fieldnote-v2/qa/reproduce-source-question
```

The extended real UI run reports **8 groups passed, 2 failed, cleanup true**. Both failures above are actual app behavior. The original extended scope without these added cases passes 8/8.

## Final runtime gates actually run

| Gate | Measured result | Evidence |
| --- | --- | --- |
| Core Vitest | 162 passed, 6 files | `final8fd-test.log` |
| Typecheck and build | Passed, with 538 kB minified chunk warning | `final8fd-build.log` |
| Official component provenance | 18 files match recorded CLI output | `final8fd-registry.log` |
| Evaluation preservation and typecheck | Passed | `final8fd-preservation.log`, `final8fd-evaltype.log` |
| Eval unit | 20 passed | `final8fd-evaltest.log` |
| Complete actual 60-case execution | 11 passed, 0 failed, 48 blocked, 1 unsupported, 0 critical assertion failures, 0 infrastructure errors | `final8fd/eval/report.json` |
| Frozen-baseline bridge | 60/60 unchanged normative inputs, zero material differences. Baseline 0 passed, 34 failed, 25 blocked, 1 unsupported, 37 critical failures | `final8fd/scorecard/scorecard.md` |
| Maintained actual Chromium suite | 8/8 passed | `final8fd-package-browser.log` and `final8fd/package-browser/` |
| Strict browser eval | 29/29 checks, 15 screenshots, cleanup true | `final8fd/strict-browser/proof.json` |
| Project verification skill | All three viewport journeys passed, cleanup true | `final8fd/smoke/proof.json` |
| Independent generic UI extension | 8/8 groups passed, cleanup true | `final8fd/extended/proof.json` |
| Qualified held-finding UI composition | 8/8 groups passed, cleanup true | `final8fd/qualified-final/proof.json` |

Full 60-case deterministic acceptance remains **inconclusive**, not PASS. The 48 blocked cases are not counted as passes. All semantic usefulness and live discovery metrics remain unassessed by that deterministic report. Cross-contract baseline comparisons cannot establish causal model-quality improvement.

The package browser harness copies the maintained specifications only to redirect artifact paths and uses safe Vite `envFile:false` launch. The original behavioral assertions remain. Owned fake-key loopback SDK and in-memory quota drive normal Hono. No private environment is loaded.

## Previously reported fixes verified

- Exact powerbank `$30-40` followed by typed `SGD.` retains original request and both 30/40 bounds, automatically researching once.
- `Only Anker.` is now released by `Show me other brands.`. Both bounds survive `Make it 50.`, `Actually, USD.`, dissatisfaction and the explicit brand release. `Only USB-C.` and `No Sony.` remain sticky in the maintained browser scenario.
- Generic size 42→43 correction changes the current request and retains old history. New unfamiliar folding-kayak and inkle-loom descriptions are accepted without category gates. These fixture runs do not establish matching unfamiliar-class discovery.
- Concise comparisons and battery questions use a compact lead and an actual official `Full evidence and conditions` Collapsible. Enter opens and closes it. Full quoted evidence, URLs, adverse conditions and monetary qualifiers remain reachable, with zero extra SDK requests. Expanded mode retains the fuller response.
- A separately composed labeled synthetic source uses the whole native rationale `Up to 12 hours with low-power devices only; high-power runtime is unknown.`. I inspected the actual mobile screenshot. The complete qualification is visible in the initial concise lead, without truncation, and the full passage is preserved in the keyboard-opened disclosure. Unknown overall fit remains explicit. This establishes the presentation path for a qualified finding, not factual validity of the synthetic claim.
- `Necklaces between 1k to 2k` stores numeric pending 1000/2000, asks only currency, and resumes exactly one SDK operation after `SGD.` with both bounds and original request unchanged.
- Budget editor invalid minimum/maximum rejects without changing accepted state. Valid unrelated edits preserve both bounds. Unsupported compound edits remain pending as a whole. History snapshots stay unchanged.
- Ordinary messages, comparisons, shorter/detail requests, help, remember questions, source viewing, historical navigation and disclosure use no new research call in the tested supported forms. Actual transport drives activity. Stop, New chat, changed objectives during active research and separate cookie contexts pass their maintained and extended scenarios.
- Strict browser synchronization now waits for the originating completed request; initial answer geometry is checked before manual scrolling. Source/edit controls retain rectangle-intersection and multi-point hit checks against floating scroll controls.

## Semantic packets and independent judgment

I created a purposeful six-case sample from the actual final 60-case report, with unchanged observations and contracts, then exported the existing four calibration anchors. Selection covers currency, unfamiliar input, comparison, held questions, conflicting sources and conditional pricing. It is not a random or representative sample, and I had prior engineering context. No blinded-study claim is made.

The final ten packets contain **zero omitted completed response texts**, and both selected held replies preserve their complete separate `disclosedDetail` object, including collapsed visibility and the actual UI label. Packet hashes bind visible text, structured products, supporting source text and disclosed detail. No prose or evidence was manufactured to fill a gap.

I read the actual visible leads, disclosed details, preferences, provider dispatch counts, prices, blockers and complete supporting source text. Ten independent judgments were imported through the project validator. They are explicitly **reporting-only**, **pending human calibration**, and every dimension is marked uncertain. No extra model provider was called. The judge identity records this independent QA agent and honestly states that the exact host model is not exposed. Application authors and QA author are separately identified.

Artifacts are `final8fd/semantic/selection.json`, `selected-report.json`, `packets.json`, `private-manifest.json`, `independent-judgments.json`, and `semantic-report.json`. The selected application cases have 2 qualitative not-useful verdicts for the two concrete meaning defects above and 4 uncertain verdicts. The separate four authored calibration anchors have 2 useful, 1 not-useful and 1 uncertain. These counts are descriptive only and do not update the 60-case deterministic report.

The importer records **10 calibration-dimension disagreements**. They include whether an interim acknowledgment earns usefulness 2 or 3, the inferred benefit of wider field of view for tracking, and the degree of failure when both price and brand constraints are violated. They remain recorded, not adjusted to match reference scores. Human calibration is pending. Unsuitable powerbank materials for loom, air pump and printer scenarios cannot establish relevance or completed shopping usefulness, and those dimensions are explicitly not observable. The two reported reducer/invocation defects are independently observable despite those fixture limitations.

## Visual inspection and seven principles

I inspected actual final desktop, mobile and short-mobile concise comparison screenshots; mobile qualified lead and keyboard-expanded detail; mobile range clarification; initial strict research; and the source/price reproduction screens. Earlier empty/theme/editor/account screenshots remain supported by the final unchanged component blobs and fresh skill suite. The interface stays neutral, minimal, chat-first and centered, with bottom composer and paid-call disclosure visible. No dashboard, fixed filter panel, long prechat form or horizontal document overflow was observed. Product/evidence cards and ordinary replies remain inside conversation history.

| Principle | Final finding |
| --- | --- |
| Understand first | ISSUES. The quoted product price is interpreted as a budget edit and the held-source question as a new requirement. Other driven objectives and short clarifications pass. |
| Define preferences in detail | ISSUES for unintended numerical budget overwrite; supported bounds, editor, hard/flexible separation and pending compounds pass. |
| Research and plan ahead | Actual bounded loopback lifecycle passes. Meaningful external discovery remains unestablished. |
| Front-load | Initial recommendation/title geometry passes. Whole short qualified rationale now appears before disclosure when supplied. Synthetic relevance and usefulness remain limited. |
| No scrolling blobs | PASS for default concise held replies; complete details remain behind reachable disclosure and expanded mode remains available. |
| Per-user adaptation | Prior punctuated-brand and response-length defects pass. Product price reference still changes an unrequested field. |
| Restraint | ISSUES for unnecessary research on the exact conflicting-source question. Supported held comparisons, ordinary messages and disclosures remain free. |

## Account evidence reconciliation and limits

The actual 27-test PostgreSQL suite, crash/restart scripts and account UI checks passed earlier at d858ca7. At 8d679f3 I additionally drove desktop/mobile accounts through held-detail creation, real API process restart, refresh, deep equality of all saved messages including detail, keyboard disclosure restoration, separate account, deletion and sign-out during actual SDK consumption. No account, workspace codec, conversation schema or disclosure component changed from 8d679f3 to this final head. Verified final blob identities are:

- `src/server/accounts.ts` `d6f29864f182db55ebc4fc5ff122202bd71facca`.
- `src/server/workspace-store.ts` `6a4cc592647254b39ae3a5fa29941bb92a8d533c`.
- `src/client/HeldReplyDetails.tsx` `e88001dae77559efd5bfa83baee72de69479419f`.
- `src/domain/workspace.ts` `39a0c6b6a8539e868d745a169d0ed74f79375cae`.
- `src/domain/conversation.ts` `3a0a10b21046aae34e100725e7319df362d4fd58`.

Prior account evidence is retained under `accounts/` and `candidate8d/accounts-detail/`. This is explicit reuse of unchanged-boundary evidence, not a claim those commands ran anew at 8fdc2b2. Root also coordinates separate independent security review of final source/URL/account boundaries.

No paid Exa, remote model API, private env/key, real ledger/grant, existing database, production service, permission change, credential mutation, purchase, push, merge or external comment occurred. All fixture claims remain labeled. No current inventory, merchant authorization, price, source reachability or genuine Exa usefulness is established here. Owned browser contexts, application processes and temporary account clusters were cleaned up. Earlier red proofs and harness diagnostics remain preserved. Prove It Works led to real UI repros; Explain the Number led to keeping blocked cases and calibration uncertainty explicit.
