# Fieldnote V2 evaluations

The active V2 runner sends the original sixty public conversations through normal Hono HTTP and the actual Exa SDK. The SDK contacts an owned loopback server with the unchanged synthetic research materials. An injected in-memory quota records admission and settlement. These runs read no private environment or persistent usage ledger and make no billable requests.

## Preserved assets

`evals/preservation-v2.json` binds all 390 imported assets to Git blobs from `f865939c669153943e77af3870e54c10daad6750`. Run `npm run eval:preservation` to check that 389 assets remain committed and unchanged. The remaining asset, `.github/workflows/product-evals.yml`, is explicitly adapted for V2.

The source dataset bytes have SHA-256 `c452827b9aa87bc0b47c3e9a4cc6427a42bbf0303539bc2c09a2093ed754cb8f`. The historical baseline report bytes have SHA-256 `a9577869cd991fdd4713ef4bc5a6a5842b1d5839282d7e4a18a404cab2a32a56`.

Historical runners, tests, proposal tapes, reports, semantic judgments, screenshots, traces and browser logs remain intact. Active V2 tests replace application-bound historical execution. The preserved interpreter tests are not claimed to execute against V2. Standalone frozen schema 2, 3 and 4 validators still validate their corresponding reports.

## Actual execution

Run `npm run eval:test` for report integrity, mutation sensitivity and actual HTTP controls. Run `npm run eval -- --out artifacts/product-evals/v2-candidate --gate critical` for the sixty conversations. `--gate report` writes failures without using the result as an acceptance gate. A report is not product acceptance.

The application receives exact public messages. The adapter never reads expected milestones or interpretation proposals. Server sessions own accepted intent and pending questions. The adapter prepares before researching, uses the actual returned `preparedId`, and preserves session cookies. HTTP attempts have immutable correlation IDs that carry through quota and SDK operations, including late settlement and cancellation.

Each trace retains raw V2 states, raw responses and transport events. Historical grading receives a mechanical projection of actual state. Requirement text maps to criterion wording. Budget maximum maps to amount. Absent bounds and region stay absent. No accepted requirement or product evidence is invented.

Actual support retains both the provider's native quotation and the expanded complete context. Historical quotation checks receive the actual `originalQuote`, `originalStart` and `originalEnd` fields. Raw responses retain the complete context used for certainty and display. An additional critical check requires both spans to bind to the retained source and requires the native span to stay inside uncut complete context. The adapter never creates a native quotation by selecting a substring.

## Explicit grading differences

Schema 5 identifies V2 independently of historical reports. Original milestones and frozen objective assertions remain unchanged. Two architecture-dependent assertions use actual V2 contracts. The provider query must equal the accepted open description, and the system prompt must contain the complete authoritative V2 intent. Choice eligibility uses supported exact identity, full-request and hard-requirement assessments with applicable currency, conditions and both numeric bounds. It does not invent the historical provider budget assessment.

V2 adds exact SDK `/answer` path, native and complete context provenance, network isolation and owned-resource cleanup assertions. The same-contract comparator rejects changed adapter or grader hashes. The separate historical-to-V2 bridge binds unchanged conversations, expectations and candidate materials. It shows actual strict verdicts, individual normative requirement statuses, regressions and lost assessment. It does not treat the old fixed-proposal composition as the same interpretation treatment or claim causal model-quality improvement.

Source-based assessments remain provider interpretations. Literal quotation containment proves provenance and does not prove semantic entailment. Semantic results remain unassessed until packet-bound independent judgments are imported and calibration is reviewed. Existing historical judgments never become V2 judgments.

## Browser and semantic evidence

Run `npm run eval:browser -- --out artifacts/product-evals/v2-browser --mode strict` to exercise real desktop and mobile browser journeys. The proof records screenshots, browser traces, lifecycle events, failures and fixture provenance. Independent QA must inspect the screenshots. The deterministic report cannot establish visual quality.

Run `npm run eval:scorecard -- --baseline artifacts/product-evals/baseline-v1/report.json --candidate artifacts/product-evals/v2-candidate/report.json --out artifacts/product-evals/v2-scorecard` for a descriptive cross-contract report. Export separate V2 blind packets with `npm run eval:judge -- export --report artifacts/product-evals/v2-candidate/report.json`. Exporting packets performs no inference. The original semantic rubric, calibration and judgment-import checks remain in use.

Synthetic runs do not establish genuine Exa discovery, live relevance, shopping usefulness, current prices, inventory, delivery or merchant authorization. Live proof requires a separately recorded valid spending allowance and is outside these automated runners.
