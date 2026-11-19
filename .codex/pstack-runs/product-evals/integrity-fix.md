# Blocking evaluator integrity corrections

Goal. Prevent the evaluation system from calling lost hard constraints, adverse evidence or rewritten expectations an improvement. Application behavior remains unchanged. Base is bb51c38748b35d838b44109d72ab4dc9a9847d8c. Current candidate 8a5746e38854544b2ee6fb0cbe30d48f17bc657a remains unapproved.

Root independently reproduced the first three findings. QA independently established the fourth as measurement timing, with stable mobile layout evidence.

## 1. Preserve observed hard criteria across turns

`node --import tsx artifacts/product-evals/independent-qa/sensitivity.ts` currently prints pass with finalCriteria empty. FN-CC-005 retains wireless only at turn zero; later milestones check budget alone.

Fix the invariant rather than adding one local wireless assertion. Every observed prior hard criterion must survive later turns unless the independent scenario contract explicitly permits the user-directed replacement, withdrawal or refinement at that action. Flexible additions are valid. Declare precise exceptions for actual objective replacements, size corrections, brand relaxation and other explicit changes in the independent cases. Do not derive exceptions from the application parser or treat arbitrary changes as withdrawal. Preserve budget assertions separately. Add paired controls for dropped/demoted/inverted hard criteria and legitimate explicit replacement/removal.

## 2. Preserve known adverse source evidence

`env -i PATH="$PATH" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}" NODE_ENV=test EXA_RESEARCH_ENABLED=false node --import tsx artifacts/product-evals/independent-security/integrity-probe.ts` mutates a known contradicted Fieldglass display unit to supported and selects it. Current grade returns no failed checks and eligibility pass although the retained quote says non-functional and cannot be used.

Bind objective adverse input oracles to the fixed supplied source material. A mutable returned status cannot erase a known contradicted or conflicting assessment. At minimum independently compare source-linked upstream adverse assessments and required source passages with published states and choice; do not call production eligibility helpers. Extend to exact identity, request match, hard criteria and price/budget where applicable. Do not assume all provider synthesis is semantic truth. Unknown semantic entailment remains explicitly unassessed. Add the exact independent mutation plus paired valid-support/unknown cases.

## 3. Validate comparison payloads, not declared hashes alone

The same security probe changes expectedBehavior, check statuses and verdict on a failed report, keeping original hashes and actual observation. compareReports currently returns compatible true and newlyPassing FN-CU-001.

Persist the complete evaluator-owned scenario/requirement contract or equivalent immutable input beside the observed trace. Recompute all hashes from payloads at ingestion. Validate expectedBehavior against the bound contract, checks/verdict/summary against deterministic grading and honest statuses, and material identity/provenance against its actual contents. A payload with stale hashes must be rejected or not comparable. An honestly rehashed changed expectation must remain not comparable to the old expectation. Do not introduce a caller-controlled trusted flag, blanket checksum bypass, process-global secret or production dependency. Keep old report version handling explicit and reject incompatible historical envelopes. Add CLI-level tamper controls as well as direct function controls.

The data shape remains ScenarioContract plus Observation plus independently recomputed CaseResult. Runtime adapter still receives only public actions and fixed provider input. Private expectations remain outside SDK requests. Use a small explicit contract boundary rather than a second reporting engine.

## 4. Wait for responsive reflow before measuring browser geometry

QA's earlier 390x600 capture retained desktop composer y889.8 immediately after resize. A stable probe on the same candidate observed y493.8 at immediate/100/400/1000ms and the actual image confirms a reachable composer. This is a flaky measurement, not a proven persistent product layout failure.

Wait for bounded observable layout stability before composer geometry and screenshot. Do not waive overflow or clipping checks, add an arbitrary long sleep, or convert failure into a pass. If stable required geometry is not reached in the bound, retain failure and screenshot. Add a meaningful resize check and rerun mobile journeys.

## Gates

Only evaluation code, its tests, dedicated workflow if needed and existing verification script are in scope. No src changes or other worktree edits. Preserve all prior failed artifacts. Run current tests plus new positive/adverse controls, actual full sixty-case report, browser report and smoke. Commit a new candidate and freeze it. Root and independent QA/security rerun all surviving commands on that exact head. Do not edit code again until root accepts a new reproduced finding.

## 5. Reject local and internal source hosts independently

Security and root reproduced `unsafe-source-probe.ts` under the same clean environment. The actual application drops `https://localhost./product`, `https://host.internal/product` and `https://host.local./product`. Reintroducing these supplied URLs into the observed result makes the evaluator report safe-source-urls pass and no failures. The independent validator accepts all three.

Canonicalize hostname trailing dots, reject local/internal/special-use names and unsafe IP, credential, scheme, port and malformed-label forms independently of production code. Add the three exact mutations and paired valid public HTTPS controls. Do not perform DNS lookups or claim navigation reachability. Keep fixture.example.com accepted for explicit synthetic source tests. This is an evaluation false-negative, not a defect in the existing application validator.
