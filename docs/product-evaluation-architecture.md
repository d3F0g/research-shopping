# About Fieldnote product evaluation

Fieldnote's product evaluation measures observed shopping behavior independently of its product implementation. Unit and browser tests remain necessary. Their passing counts do not establish that the assistant understands a shopper or recommends a useful product.

## Actual behavior precedes grading

A versioned scenario supplies organic user messages and fixed, labeled research inputs. The application adapter submits the exact messages through the normal Hono prepare/research contract. Each next turn uses only the preferences returned by the application. Expectations never repair missing state, supply a missing budget, or construct a compliant provider reply.

The adapter retains HTTP responses, accepted preferences, SDK requests, admission decisions, settlements and cancellation observations. Independent deterministic assertions grade these observations afterward. They do not call production parsing or recommendation-eligibility functions to generate expected truth.

The provider double uses the actual Exa SDK against an owned loopback HTTP server. A separate network boundary rejects other destinations. An in-memory quota recorder replaces live accounting only within this explicit automated composition. Neither the normal server entrypoint nor a private environment or persistent ledger is needed.

## Evidence has distinct meanings

Synthetic provider replies establish behavior under supplied evidence. They cannot establish that Exa will discover relevant products in the market. A historical excerpt can establish what text was retained at capture time. It cannot establish current price, inventory, delivery or merchant authorization.

The initial repository corpus contains normalized historical application excerpts and derived provider envelopes. It does not contain a complete original current-contract Exa response. A reconstruction stays labeled as a reconstruction. Source hashes and capture provenance remain separate from the time the evaluator replays the material.

Literal quote containment establishes provenance. It does not establish that the passage supports an interpretation. Product identity, request relevance, exact-variant specifications, hard constraints, price currency and unresolved price conditions require separate checks.

## Results preserve uncertainty

Execution coverage and verdict are separate. An observed constraint violation is a failure. A missing capability is unsupported only when a concrete interface boundary establishes it. A measurement lacking required evidence is blocked. An infrastructure error is not a product verdict.

A scenario can pass budget retention and still have unassessed live recommendation relevance. Reports show assessed denominators and unassessed counts by dimension. Null means no score was established. Critical failures remain visible regardless of aggregate results.

The initial dataset contains sixty independently authored multi-turn scenarios across twelve dimensions. Dataset review and reference calibration have explicit status records. No author or agent may claim human review that did not occur.

## Semantic judgments supplement objective assertions

The judge receives opaque labels, organic conversations, observed assistant outputs and supporting source passages. It does not receive implementation identities, commit labels or private mapping files. Imported judgments bind to the packet hash and record the judge identity, uncertainty and rationale.

Scores for intent, relevance, usefulness, reasoning, naturalness, concision, adaptation and question necessity remain reporting-only until reference examples receive human review and calibration establishes useful agreement. Objective critical failures do not become discretionary judge decisions.

## Browser evidence is independent

Actual browser driving verifies the rendered chat, themes, preference controls, progress, cards, citations, history, cancellation and mobile composer. Geometry assertions cannot replace inspecting desktop and mobile screenshots. Browser provider doubles remain visibly synthetic. They establish UI behavior under controlled input rather than live research usefulness.

The project verification skill owns application-driving recipes and cleanup. The evaluation system owns scenarios, grading and scorecards. Each points to the other without duplicating its responsibility.

## Compare like expectations

Baseline and later results pin application revision, evaluator revision, dataset and assertion versions, and provider material. A changed expectation is not a newly passing scenario. Comparison reports separate incompatible cases, newly passing cases, newly failing cases, unchanged failures and critical regressions.

The first baseline is the unchanged normal application at `bb51c38748b35d838b44109d72ab4dc9a9847d8c`. The evaluation PR depends on application PR 38. It must integrate the eventual application head, rerun evaluation and receive independent exact-head verification before merging.
