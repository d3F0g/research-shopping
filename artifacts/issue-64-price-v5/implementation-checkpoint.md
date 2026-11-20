The task preserves Fieldnote's approved chat UI and replaces the source-price sentence gate with explicit V5 price evidence.

This is an intermediate implementation checkpoint. It is not an acceptance verdict. The session dependency and browser verification still follow.

The red commit is `8ae7261`. Its original-wire Markdown and prose cases returned a ready comparison with no eligible choice. The old real route also returned no choice. Separate revision-2 cases failed schema acceptance. The exact output is in `red.log`, and the original test source is in `original-red-repro.ts.txt`.

The current implementation has native answer revision 2, evidence version 5, and workspace version 5. The response envelope and intent remain version 2. Source text and monetary occurrences have one source owner. Native groups have a maximum of 24 per product, with eight conditions. Derived occurrences are not subject to the native group cap. A bound group covers identified occurrences exactly once. Selected money still needs one scalar witness with its own explicit denomination.

Projection and stored validation use `price-evidence-v5.ts`. The finite `price-safety-v1` policy only refuses applicability. It cannot authorize prices or accept an optimistic exemption. Literal bindings prove provenance. Semantic judgments remain source-based AI interpretations. Merchant price, stock, delivery, and source-model reliability remain unverified.

The implementation removes the former positive price sentence grammar and catalog fallback from the current server. The V4 catalog binder remains frozen for actual historical decoding. Frozen V2, V3, and V4 messages do not become V5 evidence. The two new V4 fixtures were composed from exact baseline `dc61d3bae93fd347495ecbb5973d7877513ec91d` in an owned temporary directory before that directory was removed.

Observed checks at this checkpoint follow.

- `EXA_RESEARCH_ENABLED=false npx vitest run` passed 537 tests in 17 files. Later additions require a fresh final run.
- `npm run test:postgres` passed 28 tests on an owned temporary PostgreSQL 17 cluster.
- The invented rich fixture has 181 source monetary occurrences across eight sources and three products. The first integrated projection fit within 128000 native-answer characters and 256 KiB workspace bytes. Final exact serialized measurements follow after integration.
- `npm run typecheck` currently reports only four legacy `price.assessment` references in the excluded browser helper. The root has transferred that integration file after the session dependency commits.
- The evaluator currently needs explicit V4 and V5 dispatch. Frozen materials, baselines, assertions, and preservation assets have not changed.

No billable provider call, private environment, operator diagnostic, ledger, grant, or human-preview data was used. All generated source passages are invented and labeled fixture data.

Model the Domain changed the implementation to one absent, observed, or applicable price value and one source inventory. Boundary Discipline kept native parsing in the Exa adapter and deterministic money checks in the versioned domain owner. Fix Root Causes removed the authorizing sentence-format gate. Sequence Work into Verifiable Units put the independent old-wire reproduction before implementation. Test Behavior, Not Implementation kept assertions on route results, accepted constraints, retained passages, choices, and persistence. Prove It Works requires the pending browser and independent reviews before any completion claim. Laziness Protocol removed the unused current grammar rather than leaving a fallback path.
