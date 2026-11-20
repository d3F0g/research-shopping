# Fieldnote product evaluation

Application 4e42bee347b4c7909c2d4ac96122a781e945bd82. Dataset 1.0.0. Assertion contract 4.0.0.

Executed 60/60. Passed 1. Failed 50. Blocked 8. Unsupported 1. Infrastructure errors 0.
Critical assertion failures 94 across 42 scenarios. Technical scenario acceptance fail.

Preparation handling. local 8. synthetic-fallback 0. unavailable 132. not-prepared 0. Exa SDK loopback requests 2. OpenAI HTTP 0. Ollama HTTP 0.

Synthetic offline input. Exa credits consumed 0. These results do not establish real shopping usefulness.

| Category | Passed | Assessed | Unassessed | Rate |
| --- | ---: | ---: | ---: | ---: |
| conversational-understanding | 1 | 5 | 0 | 20.0% |
| preference-extraction | 0 | 5 | 0 | 0.0% |
| contextual-clarification | 0 | 5 | 0 | 0.0% |
| budget-currency | 0 | 4 | 1 | 0.0% |
| preference-retention | 0 | 5 | 0 | 0.0% |
| corrections-dissatisfaction | 0 | 5 | 0 | 0.0% |
| research-selection | 0 | 4 | 1 | 0.0% |
| product-relevance | 0 | 5 | 0 | 0.0% |
| comparison-quality | 0 | 3 | 2 | 0.0% |
| evidence-honesty | 0 | 3 | 2 | 0.0% |
| chat-interaction | 0 | 3 | 2 | 0.0% |
| recovery-safety | 0 | 4 | 1 | 0.0% |

## Observed failures

- FN-CU-002. description:0:0, description:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-CU-002 --out artifacts/product-evals/reproduce-FN-CU-002`.
- FN-CU-003. description:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-CU-003 --out artifacts/product-evals/reproduce-FN-CU-003`.
- FN-CU-004. description:1:0, budget:1:1. Reproduce with `npm run eval -- --case FN-CU-004 --out artifacts/product-evals/reproduce-FN-CU-004`.
- FN-CU-005. budget:0:0, criterion:0:1, description:1:0, budget:1:1, criterion:1:2. Reproduce with `npm run eval -- --case FN-CU-005 --out artifacts/product-evals/reproduce-FN-CU-005`.
- FN-PE-001. description:0:0, budget:0:1, budget:1:0, description:1:1, budget:2:0, criterion:2:1, description:2:2. Reproduce with `npm run eval -- --case FN-PE-001 --out artifacts/product-evals/reproduce-FN-PE-001`.
- FN-PE-002. description:0:0, description:1:0, criterion:1:1, description:2:0, criterion:2:1, criterion:2:2, budget:2:3. Reproduce with `npm run eval -- --case FN-PE-002 --out artifacts/product-evals/reproduce-FN-PE-002`.
- FN-PE-003. budget:1:0, criterion:1:1, criterion:1:2, criterion:1:3. Reproduce with `npm run eval -- --case FN-PE-003 --out artifacts/product-evals/reproduce-FN-PE-003`.
- FN-PE-004. description:1:0, criterion:1:1, criterion:1:2, criterion:1:3. Reproduce with `npm run eval -- --case FN-PE-004 --out artifacts/product-evals/reproduce-FN-PE-004`.
- FN-PE-005. description:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-PE-005 --out artifacts/product-evals/reproduce-FN-PE-005`.
- FN-CC-001. description:1:0, budget:1:1, criterion:1:2, calls:1:3. Reproduce with `npm run eval -- --case FN-CC-001 --out artifacts/product-evals/reproduce-FN-CC-001`.
- FN-CC-002. description:2:0. Reproduce with `npm run eval -- --case FN-CC-002 --out artifacts/product-evals/reproduce-FN-CC-002`.
- FN-CC-003. description:1:0, budget:1:1, criterion:1:2. Reproduce with `npm run eval -- --case FN-CC-003 --out artifacts/product-evals/reproduce-FN-CC-003`.
- FN-CC-004. description:1:0, criterion:1:1, calls:1:3. Reproduce with `npm run eval -- --case FN-CC-004 --out artifacts/product-evals/reproduce-FN-CC-004`.
- FN-CC-005. budget:0:0, criterion:0:1. Reproduce with `npm run eval -- --case FN-CC-005 --out artifacts/product-evals/reproduce-FN-CC-005`.
- FN-BC-001. budget:0:0, description:1:0, budget:1:1. Reproduce with `npm run eval -- --case FN-BC-001 --out artifacts/product-evals/reproduce-FN-BC-001`.
- FN-BC-002. description:1:0. Reproduce with `npm run eval -- --case FN-BC-002 --out artifacts/product-evals/reproduce-FN-BC-002`.
- FN-BC-003. description:1:0. Reproduce with `npm run eval -- --case FN-BC-003 --out artifacts/product-evals/reproduce-FN-BC-003`.
- FN-BC-004. description:1:0. Reproduce with `npm run eval -- --case FN-BC-004 --out artifacts/product-evals/reproduce-FN-BC-004`.
- FN-MR-001. budget:0:0, criterion:0:1, budget:1:0, criterion:1:1, criterion:1:2, budget:2:0. Reproduce with `npm run eval -- --case FN-MR-001 --out artifacts/product-evals/reproduce-FN-MR-001`.
- FN-MR-002. budget:0:0, budget:1:0, budget:2:0, criterion:2:1, criterion:2:2. Reproduce with `npm run eval -- --case FN-MR-002 --out artifacts/product-evals/reproduce-FN-MR-002`.
- FN-MR-003. budget:0:0, budget:1:0, budget:2:0, criterion:2:1. Reproduce with `npm run eval -- --case FN-MR-003 --out artifacts/product-evals/reproduce-FN-MR-003`.
- FN-MR-004. description:2:0, criterion:2:1, response-length:2:3. Reproduce with `npm run eval -- --case FN-MR-004 --out artifacts/product-evals/reproduce-FN-MR-004`.
- FN-MR-005. description:2:0, criterion:2:1, criterion:2:2. Reproduce with `npm run eval -- --case FN-MR-005 --out artifacts/product-evals/reproduce-FN-MR-005`.
- FN-CD-001. budget:0:0, budget:1:0, budget:2:0, criterion:2:1, description:2:2. Reproduce with `npm run eval -- --case FN-CD-001 --out artifacts/product-evals/reproduce-FN-CD-001`.
- FN-CD-002. budget:1:0, description:1:1, criterion:1:2, budget:2:0. Reproduce with `npm run eval -- --case FN-CD-002 --out artifacts/product-evals/reproduce-FN-CD-002`.
- FN-CD-003. budget:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-CD-003 --out artifacts/product-evals/reproduce-FN-CD-003`.
- FN-CD-004. description:2:0, criterion:2:1. Reproduce with `npm run eval -- --case FN-CD-004 --out artifacts/product-evals/reproduce-FN-CD-004`.
- FN-CD-005. budget:0:0, budget:1:0, criterion:1:1, budget:2:0, criterion:2:1. Reproduce with `npm run eval -- --case FN-CD-005 --out artifacts/product-evals/reproduce-FN-CD-005`.
- FN-RT-001. budget:0:0, criterion:0:1, calls:0:2, response:1:2. Reproduce with `npm run eval -- --case FN-RT-001 --out artifacts/product-evals/reproduce-FN-RT-001`.
- FN-RT-002. budget:0:0, products:0:1. Reproduce with `npm run eval -- --case FN-RT-002 --out artifacts/product-evals/reproduce-FN-RT-002`.
- FN-RT-003. response-length:1:1. Reproduce with `npm run eval -- --case FN-RT-003 --out artifacts/product-evals/reproduce-FN-RT-003`.
- FN-RT-004. description:1:0, budget:1:1. Reproduce with `npm run eval -- --case FN-RT-004 --out artifacts/product-evals/reproduce-FN-RT-004`.
- FN-PR-001. description:1:0, budget:1:1, criterion:1:2. Reproduce with `npm run eval -- --case FN-PR-001 --out artifacts/product-evals/reproduce-FN-PR-001`.
- FN-PR-002. description:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-PR-002 --out artifacts/product-evals/reproduce-FN-PR-002`.
- FN-PR-003. description:1:0. Reproduce with `npm run eval -- --case FN-PR-003 --out artifacts/product-evals/reproduce-FN-PR-003`.
- FN-PR-004. description:1:0, criterion:1:1. Reproduce with `npm run eval -- --case FN-PR-004 --out artifacts/product-evals/reproduce-FN-PR-004`.
- FN-PR-005. description:1:0, budget:1:1. Reproduce with `npm run eval -- --case FN-PR-005 --out artifacts/product-evals/reproduce-FN-PR-005`.
- FN-PQ-001. budget:0:0, products:0:1. Reproduce with `npm run eval -- --case FN-PQ-001 --out artifacts/product-evals/reproduce-FN-PQ-001`.
- FN-PQ-002. budget:0:0. Reproduce with `npm run eval -- --case FN-PQ-002 --out artifacts/product-evals/reproduce-FN-PQ-002`.
- FN-PQ-005. budget:0:0, budget:1:0. Reproduce with `npm run eval -- --case FN-PQ-005 --out artifacts/product-evals/reproduce-FN-PQ-005`.
- FN-EH-001. budget:0:0, criterion:0:1, budget:1:0. Reproduce with `npm run eval -- --case FN-EH-001 --out artifacts/product-evals/reproduce-FN-EH-001`.
- FN-EH-003. budget:0:0, budget:1:0. Reproduce with `npm run eval -- --case FN-EH-003 --out artifacts/product-evals/reproduce-FN-EH-003`.
- FN-EH-004. budget:0:0, criterion:0:1, budget:1:0. Reproduce with `npm run eval -- --case FN-EH-004 --out artifacts/product-evals/reproduce-FN-EH-004`.
- FN-UI-001. budget:0:0, criterion:0:1. Reproduce with `npm run eval -- --case FN-UI-001 --out artifacts/product-evals/reproduce-FN-UI-001`.
- FN-UI-004. criterion:1:1. Reproduce with `npm run eval -- --case FN-UI-004 --out artifacts/product-evals/reproduce-FN-UI-004`.
- FN-UI-005. budget:0:0, description:1:0, budget:1:1, budget:2:0. Reproduce with `npm run eval -- --case FN-UI-005 --out artifacts/product-evals/reproduce-FN-UI-005`.
- FN-ER-001. budget:0:0, calls:0:2, budget:1:0, budget:2:0. Reproduce with `npm run eval -- --case FN-ER-001 --out artifacts/product-evals/reproduce-FN-ER-001`.
- FN-ER-003. budget:0:0, criterion:0:1. Reproduce with `npm run eval -- --case FN-ER-003 --out artifacts/product-evals/reproduce-FN-ER-003`.
- FN-ER-004. budget:0:0, budget:1:0. Reproduce with `npm run eval -- --case FN-ER-004 --out artifacts/product-evals/reproduce-FN-ER-004`.
- FN-ER-005. description:1:0. Reproduce with `npm run eval -- --case FN-ER-005 --out artifacts/product-evals/reproduce-FN-ER-005`.

## Limits

- provider-request, providerCalls, bounded-dispatch and research-after-prepare count Exa research only. The frozen no-provider-during-prepare assertion means no Exa call; production v5 may interpret during prepare. Main-lane OpenAI and Ollama HTTP counts are zero. Synthetic fallback invocations and local handling are recorded separately.
- The main lane uses actual local parsing before optional independently authored synthetic interpretations. The supplemental local-only lane has no optional interpreter. Neither lane performs OpenAI or Ollama HTTP inference. It measures conditional technical behavior, not NLU accuracy or live usefulness. Input coverage limitations are explicit and never repaired from expected states.
- Offline synthetic provider inputs do not establish real Exa discovery, live product relevance, current prices, stock or merchant authorization.
- No raw original current-schema Exa answer recordings were available. Historical excerpts are not presented as genuine answer replays.
- Semantic scores remain absent until a separately supplied independent judge returns packet-bound judgments. Human calibration is pending.
- Criterion-presence checks establish structured strength and literal phrases, with explicit brand polarity where specified. They do not establish complete semantic equivalence or entailment.
- Application commit and source hash are external execution provenance. Reports do not cryptographically authenticate execution, and embedded evaluator source is never executed.
- Browser acceptance is a separate artifact; deterministic transport runs do not establish UI quality.
- Unsupported capabilities and blocked evidence remain outside assessed denominators. Observed failures retain their original expectations.
