# Independent historical v5 QA

**Evaluation compatibility PASS for the historical pinned candidate. Product acceptance ISSUES.** This verdict covers evaluator code ee6d33850d4849ccc155f2fcdee291bd15de9118 against application fd9d13793342cdd7e37686b09ae6c9ffd88bb69f. It does not cover the subsequently integrated local/Ollama application contract at4e42bee, and is not approval of live product usefulness or merging PR47.

The reviewed integration base is cd145e317da1d38361dede8cf1e5c72b2812dc55, with evaluation adaptation compared to b10f4b88dda44f729338eef1197e74c374d65440. The upstream application base for the PR is fd9d137. The reviewer did not author application code, evaluator code, proposals, grading or scorecard. Only independent review artifacts were written; no GitHub mutation, real key, private environment, receipt or usage ledger was used.

## Executed verification

All commands below completed before the application source advanced from fd9d137.

- `npm run eval:test` passed51 controls, including the retained sensitivity controls, actual Hono/SDK v5 protocol, frozen/current report validation, cross-contract treatment/coverage, symbolic bindings and bounded fake-key production OpenAI transport.
- `npm run eval:typecheck` passed.
- `npm run eval -- --out artifacts/product-evals/independent-qa/v5-final/full60 --application-commit fd9d13793342cdd7e37686b09ae6c9ffd88bb69f --issue-drafts` executed all60 cases and140 turns with zero infrastructure errors.
- `npm run eval:scorecard -- --baseline artifacts/product-evals/baseline-v1/report.json --candidate artifacts/product-evals/independent-qa/v5-final/full60/report.json --out artifacts/product-evals/independent-qa/v5-final/comparison` independently recomputed the bridge.
- `npm run eval:browser -- --out artifacts/product-evals/independent-qa/v5-final/browser --mode report` passed44 real Chromium/Vite/Hono/Exa SDK checks. All18 desktop/mobile screenshots were opened and inspected, rather than inferred from geometry assertions.
- `VERIFY_ARTIFACT_DIR=artifacts/product-evals/independent-qa/v5-final/smoke npm run verify:offline` passed with cleanup true.

Protected-byte validation passes for all41 saved files. All39 protected files tracked at b10f4b8 also match their original Git bytes; the two original ignored server logs are verified by the saved manifest only. Original scenarios, milestones and every frozen baseline file remain unchanged. V2 proposals differ from preserved v1 only in the independently reviewed carryability strength. At execution, src matched fd9d137 exactly. No product fix was authored in the evaluation tree.

The independently rerun expected values, observed values, statuses, critical flags and full summary match the published historical result. All140 actual user/assistant reply texts match. An independent Python transition recount matches the scorecard. Report and audited-file bindings are in review-binding.json; protected bytes and reply equality are separately retained.

## Historical technical scorecard

| Measure | V4 | Historical v5 |
| --- | ---: | ---: |
| Executed scenarios |60|60|
| Strict pass |0|4|
| Fail |34|37|
| Blocked |25|18|
| Unsupported |1|1|
| Infrastructure errors |0|0|
| Critical failed assertions |37|52|

New strict passes are CU001, PE001, CD001 and ER001. There are23 still-failing scenarios,14 newly observed failing scenarios and7 failed-to-unassessed scenarios. Whole-scenario pass-to-fail is zero because v4 had no passing whole cases. The assertion view exposes25 fail-to-pass transitions,48 newly assessed passes,36 still-failing assertions and48 pass-to-fail regressions, including22 critical.598 previously assessed assertions lose assessment. All60 normative contracts and research materials are equal. Raw aggregate assertion rates have different assessed denominators and cannot be read as causal quality change.

The main lane has zero OpenAI HTTP requests and supplies independently authored synthetic interpretations. V4 used its parser. Improvement claims are conditional descriptions under this different treatment. They are not model-understanding, genuine retrieval, current-price, inventory, merchant or live recommendation evidence. Qualitative review of all140 replies is independent product QA, not a blinded or calibrated semantic metric.

## Seven product principles and visual acceptance

| Principle | Observed evidence |
| --- | --- |
| Understand the objective and ask consequential questions | The actual powerbank pending question retains its typed original request, question identity and30–40 draft. Typed SGD bypasses interpretation and automatically researches. No-budget requests research without an optional form. Many other faithful proposals are rejected, detailed below. |
| Separate hard constraints from flexible preferences | Structured state, preserved bounds, genuine local controls and rejection paths are captured.52 critical expected-field failures remain visible. These are27 budget and25 criterion failures; none is a failed generic observed-hard-criterion-retention/hard-choice assertion. Do not relabel every missing admission as loss of previously accepted state. |
| Attributable research and uncertainty | Actual cards visibly label synthetic inputs, observed/unverified price, unverified stock/delivery, exact-variant caveats, literal quotes and source links. Quote provenance does not prove relevance. |
| Useful answer first | Recommendations render inside assistant messages. The generic acknowledgement returned for comparisons or error explanation is not a useful answer and is not accepted as semantic success. |
| Concise comparisons with disclosure | Compact cards, source illustrations and expandable evidence remain legible at1440x1000,390x844 and390x600. Detailed content scrolls within history; essential composer and controls remain accessible. |
| Adapt within the session | Actual contextual budget editing, retained user/assistant messages, inactive historical preference controls and typed continuation passed. Unsupported corrections and incomplete held-answer capability remain explicit. |
| Avoid redundant chatter | Minimal dark first visit, ordinary greeting, persisted theme, real preparation/search progress, no mandatory optional-budget gate, cancellation and isolated fresh sessions passed. No simulated token/reasoning stream is claimed. |

I inspected every browser screenshot listed in review-binding.json. Dark/light contrast, centered conversation, compact composer, responsive source quotes, attributed image plus deliberate error fallback, pending currency choices, no-budget results, retained history, stopped response and separate fresh context were readable. No new visual blocker was found in this bounded composition. The currency browser journey deliberately reuses synthetic binocular material and therefore proves budget continuation, not powerbank relevance. The held-comparison screenshot visibly shows only the generic acknowledgement.

Both browser and smoke report cleanup true. Independent connection probes confirm all four recorded web/API origins no longer listen. No unexpected browser network or page error occurred. Synthetic image responses were fulfilled from local bytes; external image traffic did not occur.

## Product issues remain exposed

- Range punctuation. MR001's complete SGD120–220 sentence is rejected although its literal source span parses correctly. A trailing dot is swallowed by the money token; with a following Sony exclusion it also contaminates negation checking. CC001's60–90 draft becomes null during dollar-to-SGD draft parsing because90. fails amount validation. Independent Hono replays and isolated pure-function diagnostics are under v5-preflight/. Extend existing budget/contextual-intent tracking.
- Strength semantics. PE003's Braille-is-essential and CC004's brightness-is-essential proposals are faithful hard requirements but the lexical cue guard rejects them. MR004's rather-avoid preference is flexible but is rejected because avoid matches a hard cue. The diagnostic omitted-action variants never replaced the authoritative tape.
- Recommendation relevance and attribution. CU002 requests a travel laptop and receives a conditional Synthetic Anker powerbank choice. Its valid retained quote proves powerbank identity, not laptop relevance. This belongs with existing relevance/evidence tracking, and is conditional on the deliberately mismatched fixed material rather than a claim about live Exa.
- Held comparisons and recovery. RT002/PQ001 avoid another research call but do not compare actual first/third options. ER001 technically passes frozen dispatch/budget checks while its failure-explanation turn receives a generic acknowledgement. Supplied acknowledge routing does not establish intelligent restraint or completed user intent.

The frozen checks and semantic/browser blocked states were not changed to hide these issues. Technical evaluator acceptance and actual product acceptance are separate.

## Nonblocking inherited event-attribution limitation

In the historical adapter, provider response-close/abort callbacks record the mutable currentTurn when the callback runs. In ER001 a delayed close can consequently be labeled with the next turn. This changes evidence sequence/buckets between runs, while every expected/observed assertion outcome, verdict and comparison transition is unchanged. Both traces retain the terminal event. Root and the sole owner were informed; capture the owning request turn in the latest adapter rather than slowing the conversation. This review does not claim byte-identical asynchronous traces.

A cloned-report adversarial test changed an unused proposal and assigned a custom control hash. The current bridge correctly marks that row incomparable, sets assertionChanges to null and excludes it from all improvement groups. The canonical candidate remains fully comparable for its declared fixed treatment. Embedded evaluator source is not executed; cryptographic execution authenticity is not claimed.

The newer4e42bee local/Ollama application requires its own full rerun, browser evidence and exact-head review. These historical artifacts must remain frozen.
