# Fieldnote product evaluation

Application bb51c38748b35d838b44109d72ab4dc9a9847d8c. Dataset 1.0.0. Assertion contract 2.0.0.

Executed 60/60. Passed 0. Failed 34. Blocked 25. Unsupported 1. Infrastructure errors 0.
Critical assertion failures 37 across 25 scenarios. Product acceptance fail.

Synthetic offline input. Exa credits consumed 0. These results do not establish real shopping usefulness.

| Category | Passed | Assessed | Unassessed | Rate |
| --- | ---: | ---: | ---: | ---: |
| conversational-understanding | 0 | 3 | 2 | 0.0% |
| preference-extraction | 0 | 5 | 0 | 0.0% |
| contextual-clarification | 0 | 4 | 1 | 0.0% |
| budget-currency | 0 | 1 | 4 | 0.0% |
| preference-retention | 0 | 4 | 1 | 0.0% |
| corrections-dissatisfaction | 0 | 4 | 1 | 0.0% |
| research-selection | 0 | 3 | 2 | 0.0% |
| product-relevance | 0 | 1 | 4 | 0.0% |
| comparison-quality | 0 | 2 | 3 | 0.0% |
| evidence-honesty | 0 | 1 | 4 | 0.0% |
| chat-interaction | 0 | 3 | 2 | 0.0% |
| recovery-safety | 0 | 3 | 2 | 0.0% |

## Observed failures

- FN-CU-001. budget:1:1, pending:1:2, calls:1:3, response:1:4, clarifications:1:5. Reproduce with `npm run eval -- --case FN-CU-001 --out artifacts/product-evals/reproduce-FN-CU-001`.
- FN-CU-002. criterion:1:1. Reproduce with `npm run eval -- --case FN-CU-002 --out artifacts/product-evals/reproduce-FN-CU-002`.
- FN-CU-005. criterion:1:2. Reproduce with `npm run eval -- --case FN-CU-005 --out artifacts/product-evals/reproduce-FN-CU-005`.
- FN-PE-001. criterion:2:1. Reproduce with `npm run eval -- --case FN-PE-001 --out artifacts/product-evals/reproduce-FN-PE-001`.
- FN-PE-002. criterion:2:2, budget:2:3. Reproduce with `npm run eval -- --case FN-PE-002 --out artifacts/product-evals/reproduce-FN-PE-002`.
- FN-PE-003. criterion:1:1, criterion:1:3. Reproduce with `npm run eval -- --case FN-PE-003 --out artifacts/product-evals/reproduce-FN-PE-003`.
- FN-PE-004. criterion:1:2, criterion:1:3. Reproduce with `npm run eval -- --case FN-PE-004 --out artifacts/product-evals/reproduce-FN-PE-004`.
- FN-PE-005. criterion:1:1. Reproduce with `npm run eval -- --case FN-PE-005 --out artifacts/product-evals/reproduce-FN-PE-005`.
- FN-CC-001. budget:1:1, criterion:1:2, calls:1:3, clarifications:1:4. Reproduce with `npm run eval -- --case FN-CC-001 --out artifacts/product-evals/reproduce-FN-CC-001`.
- FN-CC-003. criterion:1:2. Reproduce with `npm run eval -- --case FN-CC-003 --out artifacts/product-evals/reproduce-FN-CC-003`.
- FN-CC-004. criterion:1:1, calls:1:3. Reproduce with `npm run eval -- --case FN-CC-004 --out artifacts/product-evals/reproduce-FN-CC-004`.
- FN-CC-005. budget:0:0. Reproduce with `npm run eval -- --case FN-CC-005 --out artifacts/product-evals/reproduce-FN-CC-005`.
- FN-BC-001. budget:0:0, budget:1:1. Reproduce with `npm run eval -- --case FN-BC-001 --out artifacts/product-evals/reproduce-FN-BC-001`.
- FN-MR-001. budget:0:0, criterion:0:1, budget:1:0, criterion:1:1, budget:2:0. Reproduce with `npm run eval -- --case FN-MR-001 --out artifacts/product-evals/reproduce-FN-MR-001`.
- FN-MR-003. budget:0:0, budget:1:0, budget:2:0. Reproduce with `npm run eval -- --case FN-MR-003 --out artifacts/product-evals/reproduce-FN-MR-003`.
- FN-MR-004. criterion:2:1, response-length:2:3. Reproduce with `npm run eval -- --case FN-MR-004 --out artifacts/product-evals/reproduce-FN-MR-004`.
- FN-MR-005. criterion:2:1, criterion:2:2. Reproduce with `npm run eval -- --case FN-MR-005 --out artifacts/product-evals/reproduce-FN-MR-005`.
- FN-CD-001. calls:1:1, criterion:2:1. Reproduce with `npm run eval -- --case FN-CD-001 --out artifacts/product-evals/reproduce-FN-CD-001`.
- FN-CD-002. criterion:1:2. Reproduce with `npm run eval -- --case FN-CD-002 --out artifacts/product-evals/reproduce-FN-CD-002`.
- FN-CD-003. criterion:1:1. Reproduce with `npm run eval -- --case FN-CD-003 --out artifacts/product-evals/reproduce-FN-CD-003`.
- FN-CD-005. criterion:1:1, criterion:2:1. Reproduce with `npm run eval -- --case FN-CD-005 --out artifacts/product-evals/reproduce-FN-CD-005`.
- FN-RT-001. criterion:0:1, calls:1:1, response:1:2. Reproduce with `npm run eval -- --case FN-RT-001 --out artifacts/product-evals/reproduce-FN-RT-001`.
- FN-RT-002. preserve:1:0, calls:1:1. Reproduce with `npm run eval -- --case FN-RT-002 --out artifacts/product-evals/reproduce-FN-RT-002`.
- FN-RT-003. response-length:1:1. Reproduce with `npm run eval -- --case FN-RT-003 --out artifacts/product-evals/reproduce-FN-RT-003`.
- FN-PR-004. criterion:1:1. Reproduce with `npm run eval -- --case FN-PR-004 --out artifacts/product-evals/reproduce-FN-PR-004`.
- FN-PQ-001. calls:1:0, calls:2:0. Reproduce with `npm run eval -- --case FN-PQ-001 --out artifacts/product-evals/reproduce-FN-PQ-001`.
- FN-PQ-002. calls:1:1. Reproduce with `npm run eval -- --case FN-PQ-002 --out artifacts/product-evals/reproduce-FN-PQ-002`.
- FN-EH-003. budget:1:0. Reproduce with `npm run eval -- --case FN-EH-003 --out artifacts/product-evals/reproduce-FN-EH-003`.
- FN-UI-001. calls:1:1. Reproduce with `npm run eval -- --case FN-UI-001 --out artifacts/product-evals/reproduce-FN-UI-001`.
- FN-UI-004. criterion:1:1. Reproduce with `npm run eval -- --case FN-UI-004 --out artifacts/product-evals/reproduce-FN-UI-004`.
- FN-UI-005. calls:2:1. Reproduce with `npm run eval -- --case FN-UI-005 --out artifacts/product-evals/reproduce-FN-UI-005`.
- FN-ER-001. calls:1:1. Reproduce with `npm run eval -- --case FN-ER-001 --out artifacts/product-evals/reproduce-FN-ER-001`.
- FN-ER-003. criterion:0:1, calls:1:1. Reproduce with `npm run eval -- --case FN-ER-003 --out artifacts/product-evals/reproduce-FN-ER-003`.
- FN-ER-004. calls:1:1. Reproduce with `npm run eval -- --case FN-ER-004 --out artifacts/product-evals/reproduce-FN-ER-004`.

## Limits

- Offline synthetic provider inputs do not establish real Exa discovery, live product relevance, current prices, stock or merchant authorization.
- No raw original current-schema Exa answer recordings were available. Historical excerpts are not presented as genuine answer replays.
- Semantic scores remain absent until a separately supplied independent judge returns packet-bound judgments. Human calibration is pending.
- Criterion-presence checks establish structured strength and literal phrases, with explicit brand polarity where specified. They do not establish complete semantic equivalence or entailment.
- Application commit and source hash are external execution provenance. Reports do not cryptographically authenticate execution, and embedded evaluator source is never executed.
- Browser acceptance is a separate artifact; deterministic transport runs do not establish UI quality.
- Unsupported capabilities and blocked evidence remain outside assessed denominators. Observed failures retain their original expectations.
