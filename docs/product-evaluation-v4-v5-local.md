# Fieldnote v4 versus local-first v5

The unchanged sixty-case suite exposes substantial product gaps in application `4e42bee347b4c7909c2d4ac96122a781e945bd82`. The conditional technical run passes five scenarios. The separate run with the optional interpreter absent passes one. Neither result establishes live shopping usefulness.

This application keeps v5 conversation, intent and research contracts, resolves supported language locally and optionally accepts an interpreter. Evaluation uses actual Hono requests, authoritative returned preferences, validated operations and Exa SDK loopback responses. The main lane supplies independently authored synthetic fallback proposals only when the application invokes that optional boundary. The supplemental lane supplies none. No model is installed; neither lane makes OpenAI or Ollama HTTP requests or spends Exa credits.

## Side-by-side outcomes

| Measure | Frozen v4 | V5 with fixed fallback | V5 without optional interpreter |
| --- | ---: | ---: | ---: |
| Executed scenarios / turns | 60 / 140 | 60 / 140 | 60 / 140 |
| Strict technical passes | 0 | 5 | 1 |
| Failures | 34 | 36 | 50 |
| Blocked | 25 | 18 | 8 |
| Unsupported | 1 | 1 | 1 |
| Infrastructure errors | 0 | 0 | 0 |
| Critical failed assertions | 37 | 49 | 94 |

The main strict pass rate is 5/60, or 8.33%. Among determinate scenarios it is 5/41, or 12.20%, with nineteen blocked or unsupported. The default local-only strict pass rate is 1/60, or 1.67%; CU001, the two-turn powerbank currency clarification, is its one passing scenario. These are technical contracts, not completed useful shopping tasks.

The [sixty-row scorecard](../artifacts/product-evals/comparison-v4-v5-local/scorecard.md) and [machine scorecard](../artifacts/product-evals/comparison-v4-v5-local/scorecard.json) compare the original v4 parser with the v5 local-first plus fixed-fallback treatment. All sixty original actions, expectations and research materials match. The separate [no-interpreter report](../artifacts/product-evals/candidate-v5-local/without-interpreter/report.json) has a different declared treatment and cannot inherit the fixed-proposal comparison transitions.

Of 918 assertions assessed in both main reports, v4 passes 857 and v5 passes 839, or 93.36% versus 91.39%. The main candidate has 1001 assessed assertions overall, compared with 1516 in v4. Another 598 previously assessed assertions lose assessment, and 83 are newly assessed. Reduced downstream research coverage must remain visible beside any pass rate.

## Passing, failing and regressing

Five scenarios newly pass their frozen technical contracts: FN-CU-001, FN-PE-001, FN-CC-005, FN-CD-001 and FN-ER-001. They cover typed currency continuation, budget/brand changes, ambiguous cheaper feedback, supplied dissatisfaction handling and a bounded retry after timeout. Supplied feedback or acknowledgement does not establish that a model understood the shopper or answered the question.

Twenty-two scenarios still fail. Fourteen formerly blocked scenarios now fail, while seven formerly failed scenarios become blocked. There are no whole-scenario pass-to-fail transitions because the original v4 run passed no whole scenarios. At assertion level, 29 failures become passes, 32 remain failures and 47 previously passing assertions fail, including 23 critical regressions. Exact identifiers, bound requirements, expected/observed values and evidence remain in the scorecard and per-case traces.

The 49 critical failures are 25 budget expectations and 24 criterion expectations. No observed hard-criterion-retention or hard-choice assertion fails. Many requirements never become accepted state; this must not be described as loss of a previously accepted hard constraint.

Independent current-head diagnostics distinguish the budget failures. CC001 now retains its initial 60–90 pending draft, but “USD. Adjustable from 2 to 8 Nm is essential” is rejected as a compound answer; the typed local path does not accept it and the supplied fallback draft cannot satisfy monetary validation. BC001's “I meant USD, not SGD” leaves SGD100–160 unchanged instead of applying the explicit currency correction. MR001 accepts the ordinary sentence-final range in isolation but rejects it before “No Sony products” because negation context crosses that sentence boundary. Semicolon and exclamation-mark contrasts accept the same range. No currency conversion or missing criterion is silently accepted.

## Critical product findings

- Conversational handling and constraints remain incomplete. Faithful hard proposals containing “essential” are rejected by the lexical guard. Corrections to a floor lamp, manual grinder or portable recorder do not reliably replace the old objective. Several complete monetary and currency corrections return honest unavailability while leaving the old accepted preferences in place. Existing issues [43](https://github.com/d3F0g/research-shopping/issues/43) and [44](https://github.com/d3F0g/research-shopping/issues/44) own these product fixes.
- Tool restraint is conditional. RT002 and PQ001 receive a supplied acknowledgement and avoid another research request, but the reply does not compare the held first and third products. ER001 passes its dispatch/budget checks while “What happened?” receives only the same generic acknowledgement. Issue [46](https://github.com/d3F0g/research-shopping/issues/46) remains a useful incomplete-capability tracker.
- Recommendation relevance and evidence attribution remain separate. CU002 requests a lightweight travel laptop and receives a conditional Synthetic Anker powerbank choice. The fixed provider input incorrectly labels request match supported; its retained quotation describes a power bank. Quote containment and valid schema cannot prove laptop relevance. This extends existing issue [39](https://github.com/d3F0g/research-shopping/issues/39), without making a claim about genuine Exa retrieval quality.
- Unsupported currency and missing evidence block later assessment. EUR, GBP, AUD and JPY remain unrepresentable in the current intent. Later comparison, cancellation or source-answer checks cannot gain a pass because no research result exists. The suite retains these requirements and explicit unassessed statuses.

The main run invokes synthetic fallback on 132 of 140 turns, leaving eight handled locally. It records 31 Exa loopback dispatches. The local-only run handles eight turns locally and returns interpretation unavailability on 132, with two Exa loopback dispatches. These counts distinguish actual local capability from authored interpretation. They do not assess a configured real Ollama model.

Literal citation/price-attribution checks pass 312/312 in the main candidate versus 636/636 in v4. This is a provenance detector result with fewer research responses, not stronger semantic evidence. Live product relevance, current prices, inventory, merchant authority, calibrated semantic success and useful final recommendations remain unassessed.

## Reproduction and integration

Follow the [evaluation guide](product-evaluations.md) for full-run and bridge commands. Current report schema 4 has an explicit static validator. Frozen schema 2 and schema 3 reports retain their own static validators; embedded source is audit data and is never executed. Changed contracts, provider material or declared interpretation treatments cannot become improvement claims.

The original v4 baseline, dataset and milestones remain byte-for-byte unchanged. The earlier fd9 v5 run, its [historical report](product-evaluation-v4-v5.md) and exact-head independent QA/security/cleanup are also preserved. An independently reproduced harness timing defect is corrected by attributing asynchronous provider-close events to their owning request turn rather than a later mutable turn. Historical traces retain their original evidence.

Independent QA and security reproduced a residual pre-arrival overlap race at evaluator `2bfca236`. The correction at `f04068e137c2ac9b242cf4c4ec8b5d7286a95734` binds a separate random identity to each HTTP attempt before dispatch. Declared harness-only headers correlate Hono and the owned SDK transport; application bodies, preferences, operation IDs and provider paths remain unchanged. The unchanged independent reproductions now pass, including preparation overlap, duplicate retries, delayed completion and cancellation. Issue [50](https://github.com/d3F0g/research-shopping/issues/50) retains the defect and verification trail.

Exact-code independent QA, security and cleanup pass for the adapter and bound results. Verification includes 60 evaluation controls, both full sixty-case lanes, recomputed bridges, 45 actual browser checks, 30 smoke checks, inspected desktop/mobile screenshots and owned cleanup. The same application source passes 811 application tests and build. [QA](../.audit/product-evals-v5-local/qa.md), [security](../.audit/product-evals-v5-local/security.md) and [cleanup](../.audit/product-evals-v5-local/cleanup.md) record scope and limits. These infrastructure verdicts do not approve product usefulness.

Model the Domain separated interpretation, research and immutable HTTP attempts. Boundary Discipline kept correlation metadata outside application bodies. Explain the Number preserved lost assessment and separated default local behavior from supplied fallback. Prove It Works required independent adverse runtime probes and actual screenshots.

PR [47](https://github.com/d3F0g/research-shopping/pull/47) remains draft while PR [38](https://github.com/d3F0g/research-shopping/pull/38) is open. Final parent integration and a complete rerun remain required after it merges. No active application worktree, real credential, stopped receipt, research ledger or paid allowance is changed by this evaluation.
