# Independent QA. ISSUES.

The goal is a useful, minimal, Exa-only conversational shopping assistant. This review drove the real Chromium UI and normal Hono + Exa SDK path at head `d858ca7a3d7be0d356c3b26848f708ed90c0b7bb`, against base `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`. I did not author application changes. No application, package, tests, eval, skill or documentation source was edited. QA copies and evidence are confined to the assigned directories.

Verdict is **ISSUES**. Passing offline plumbing and visual layout does not establish genuine Exa usefulness. Two product defects and two evaluation defects below need resolution. Independent security review remains a separate gate.

## Reproducible findings

1. **Blocking product acceptance. Concise held answers are scrolling blobs.** Start a new chat, submit `I want to buy a powerbank around $30-40.`, answer `SGD.`, submit `Keep it short.`, then `What about battery life?`. Current intent has `responseLength: concise`, but the ordinary assistant response repeats full supporting quotations and the price quotation for each of all three products. The driven extended sequence also included free comparisons and `Something cheaper.` before the short request. The resulting answer is 1,974 characters and 296 words. The mobile screenshot shows the second product still continuing below the visible conversation, with the third absent from the initial viewport. There is no disclosure around this ordinary reply. `Compare the first two.` produces the same repeated-quote structure. `src/domain/turn-reducer.ts:58` ignores response length in heldReply; the short operation only updates the flag at line 125. Evidence is `artifacts/fieldnote-v2/qa/extended-complete/proof.json` and `extended-retry/battery-life-after-short-mobile.png`. These are explicit fixture observations of presentation, not a factual product endorsement.

2. **Blocking required adaptation. Explicit brand removal fails after punctuation.** Complete powerbank clarification, then `Only Anker.`, `Make it 50.`, `Actually, USD.`, `I don't like these.`, `Show me other brands.`. Numeric budget correctly becomes USD 30–50, but current requirements still contain hard `Only Anker.`. The brand parser at `src/domain/turn-reducer.ts:240` does not accept terminal punctuation, stores it as `kind: preference`, and removal at line 212 removes only brand records. The final provider prompt therefore still carries the explicitly removed restriction. Evidence is `extended-complete/proof.json`, including every actual state and local provider count. The one failed extended group asserts the final behavioral effect, rather than requiring an internal tag alone.

3. **Strict browser runner fails before research settles.** `npm run eval:browser -- --out artifacts/fieldnote-v2/qa/strict-browser --mode strict` fails `actual-products-rendered` and `currency-answer-resumes-with-both-bounds`. `evals/v2/browser.ts:136` and the send helper wait for the Send action, which remains available during research. The trace subsequently records successful research responses, sequence 34, turn 2, elapsed 3617.98 ms, and sequence 58, turn 6, elapsed 7283.16 ms. The product runtime is not shown to fail by these premature checks. This is a real maintained verification gate failure. Initial-view checks must wait for the actual relevant completed transport and still precede manual scrolling. Proof and trace are under `strict-browser/`.

4. **Semantic packet exporter omits completed recommendation text.** Exporting six actual candidate scenarios plus four calibration anchors produces ten packets. For every completed research turn, packet assistant text says `No completed assistant response was observed.` despite actual products and `research.summary` in raw responses. `evals/v2/semantic/packets.ts` reads only `response.message` or `response.answer`. Product prose semantics cannot be graded faithfully using these packets. Export is under `semantic/`; no judgments were imported to hide the omission. Human calibration remains pending. Structured states and sources are still available for limited engineering inspection.

## Seven product principles

| Principle | Observation and verdict |
| --- | --- |
| Understand first | PASS for exact request/currency resolution, generic size 42→43 correction, first/third reference and unfamiliar folding-kayak/inkle-loom input. These establish local state transitions, not retrieval relevance. |
| Define preferences in detail | PASS for separate hard/flexible fields, both bounds across unrelated edits, real contextual editor, invalid range recovery and compound no-partial pending state. |
| Research and plan ahead | PARTIAL. Actual SDK loopback dispatch is bounded and errors remain honest. Real external research and useful candidate discovery are not established by this review. |
| Front-load | PASS for fixture leading recommendation and first product title inside desktop, mobile and short mobile viewports before manual scroll. |
| No scrolling blobs | FAIL for held comparison and battery-life reply described above. Evidence disclosures themselves are readable. |
| Per-user adaptation | FAIL for explicit brand removal with punctuation and ignored concise flag. Other budget/currency, dissatisfaction question, scalar correction and sticky hard context passed. |
| Restraint | PASS for zero substitute calls on held comparisons, cheaper sorting, help, remembering, ordinary messages, disclosure/navigation and presentation changes. Actual pending HTTP drives activity. |

## Actual runtime results

- `npm ci` succeeded. 439 packages installed, audit reported zero vulnerabilities at this lockfile. This is not a runtime verdict.
- `npm test` passed 109 tests in five files on d858ca7. `npm run build` passed typecheck and Vite build. `npm run verify:registry` confirmed 18 official generated component files match recorded CLI output.
- `npm run eval:preservation`, `npm run eval:typecheck` passed. `npm run eval:test` passed 19 tests.
- Full 60-case candidate command used `--gate critical`. All 60 executed through actual Hono and SDK loopback. Result **11 passed, 0 failed, 48 blocked, 1 unsupported, 0 infrastructure errors, 0 critical failures**. Overall acceptance is **inconclusive**. Blocked cases are not passes and no semantic usefulness metric was assessed.
- Actual cross-contract bridge against preserved `artifacts/product-evals/baseline-v1/report.json` reports unchanged normative inputs **60/60**, material differences **0**. Frozen baseline is **0 passed, 34 failed, 25 blocked, 1 unsupported, 37 critical failures**. Different evaluator contracts prevent causal model-quality claims.
- Maintained Chromium suite, copied without behavioral assertion changes to the QA harness to redirect all screenshots to the assigned directory, passed **5/5**. It covered desktop 1440×1000, mobile 390×844, short mobile 390×568, real preference editing, free messages during research, stop and replaced research. Vite explicitly used `envFile:false` in QA composition.
- Project skill stable run is **passed**, **cleanup:true**, all three journeys passed at 1440×1000, 390×844, 390×600. Exact proof is `stable-smoke/proof.json`. Its conservative cleanCandidate flag is false because assigned QA harnesses are untracked, but before/after status is stable and tracked source diff is the empty SHA-256. No application source changed.
- Extended real UI groups are **6 pass, 1 fail**. The failed group is explicit brand removal. Currency/bounds, free followups, scalar correction/history, new objective sticky requirements, unsupported compound retention, actual invalid/valid editor, keyboard Shift+Enter/Enter, historical links, free new turn during actual pending research, New chat late-publication guard, and 390×568 disclosure/composer check passed.
- Owned PostgreSQL17 suite passed **27/27**. Actual restart script passed, including restoring the typed currency draft and both bounds, disabled provider honesty, database restart, process restart and deletion durability.
- Actual crash script passed SIGKILL during loopback SDK body consumption, reservation persistence, duplicate replay and uncertain reservation stop behavior.
- Account browser script passed desktop and mobile signup, login, guest history separation, authenticated fixture research, refresh persistence, theme persistence, isolated second account, deletion and mobile sign-out during actual SDK body consumption. Better Auth cookies and owned PostgreSQL were used.

## Visual inspection

I opened actual screenshots, not only assertions. Inspected desktop light empty, mobile dark empty, short mobile light empty, desktop/mobile/short initial research, mobile evidence, mobile preference editor, mobile held comparison, mobile battery answer after short, mobile account saved research and desktop deletion sheet. They show a minimal header, centered conversation, neutral official shadcn appearance, persistent bottom composer, fixture label, observed/unverified prices, unknown inventory, representative image caveat, safe source controls and literal quotations. The initial recommendation and first title remain inside the visible viewport. No dashboard, filter sidebar, introductory scrolling or body-level horizontal overflow was observed. The source/edit controls passed rectangle-intersection and nine-point hit tests in the skill. The long ordinary held reply fails the requested concise experience despite these layout passes.

## Reproduction commands

Run from `/Users/josiahwong/Documents/research-shopping-v2-qa` on the pinned head. Commands do not load private env files.

```sh
npm ci
npm test
npm run build
npm run verify:registry
npm run eval:preservation
npm run eval:typecheck
npm run eval:test
npm run eval -- --out artifacts/fieldnote-v2/qa/final-eval --gate critical
npm run eval:scorecard -- --baseline artifacts/product-evals/baseline-v1/report.json --candidate artifacts/fieldnote-v2/qa/final-eval/report.json --out artifacts/fieldnote-v2/qa/scorecard
npm run eval:browser -- --out artifacts/fieldnote-v2/qa/strict-browser --mode strict
VERIFY_API_PORT=3273 VERIFY_WEB_PORT=5383 VERIFY_ARTIFACT_DIR=artifacts/fieldnote-v2/qa/stable-smoke node .agents/skills/verify-research-shopping/scripts/smoke.mjs
node .audit/fieldnote-v2/qa/extended.mjs
```

Package-browser configuration is `.audit/fieldnote-v2/qa/playwright.config.ts`. Account copies only relocate imports and artifact paths. `accounts-checks.log` records their exact sequence and results. All account commands ran from an allowlisted environment with no FIELDNOTE_TEST_DATABASE_URL, thereby creating their own temporary clusters. Initial QA harness failures are retained separately and are not counted as product findings. The first missing-dependency attempt, initial skill EPERM cleanup diagnostic, concurrent QA file creation rejection, and extended harness baseURL/wait predicate corrections are preserved in separate artifacts. The stable rechecks above supersede them.

## Limits and cleanup

No paid Exa, remote LLM, private env/key, real ledger/grant, existing database, production service, credential change, permission change, purchase or GitHub mutation occurred. All fixture samples stay visibly labeled. These samples do not establish genuine discovery, current price, inventory, merchant authorization, source reachability or semantic factuality. Unfamiliar input passed state handling but the generic browser fixture returns powerbanks; this cannot establish unfamiliar-class relevance. Packet prose semantics are blocked by the exporter defect; six selected structured outputs were inspected and do not establish completed shopping usefulness. Four authored calibration anchors are preserved, not human-approved. Broad accessibility/IME and a real PostgreSQL outage UI were not independently driven here. Independent security owns deeper source/URL/account boundary review.

All owned browser contexts and application children were closed, stable helper cleanup passed, and temporary PostgreSQL lifecycle scripts cleaned up their owned clusters. Review principles Prove It Works and Explain the Number led to real runtime checks and the explicit blocked/inconclusive counts above.
