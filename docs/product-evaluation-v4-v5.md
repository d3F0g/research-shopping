# Fieldnote v4 and v5 evaluation

All sixty original scenarios ran against application `fd9d13793342cdd7e37686b09ae6c9ffd88bb69f`. The frozen v4 baseline is `bb51c38748b35d838b44109d72ab4dc9a9847d8c`. This comparison finds conditional technical improvements and substantial regressions. It does not establish live shopping usefulness or better model understanding.

The v4 application used its parser. The v5 lane receives independently authored synthetic intent operations, then uses actual application validation, returned preferences, Hono requests and Exa SDK loopback transport. Research material matches for all sixty cases. No OpenAI HTTP or paid Exa call runs in this lane. Original expectations and baseline files remain unchanged.

## Technical outcomes

| Measure | Frozen v4 | V5 candidate |
| --- | ---: | ---: |
| Executed scenarios | 60 | 60 |
| Observed turns | 140 | 140 |
| Strict technical passes | 0 | 4 |
| Failures | 34 | 37 |
| Blocked | 25 | 18 |
| Unsupported | 1 | 1 |
| Infrastructure errors | 0 | 0 |
| Critical failed assertions | 37 | 52 |
| Scenarios with critical failures | 25 | 28 |
| All assessed assertions, passed / assessed | 1455 / 1516 | 882 / 966 |
| Assertions assessed in both, passed / assessed | 857 / 918 | 834 / 918 |

Strict technical acceptance is 0/60 versus 4/60. Among scenarios with a determinate pass/fail verdict, it is 0/34 versus 4/41; the other 26 and 19 scenarios remain unassessed. Among the 918 assertions assessed in both runs, conditional technical pass rates are 93.36% and 90.85%. These overlapping checks are not independent shopping tasks. The changed interpretation treatment prevents a causal model-quality claim.

Read the complete [machine scorecard](../artifacts/product-evals/comparison-v4-v5/scorecard.json), [sixty-row scorecard](../artifacts/product-evals/comparison-v4-v5/scorecard.md) and [candidate report](../artifacts/product-evals/candidate-v5/report.json). Each result binds original contracts, actions, research material, supplied interpretations, application source and grading inputs. The [run guide](product-evaluations.md) gives reproduction commands.

## Changes retain failures and missing coverage

Four scenarios newly pass their frozen technical contracts: FN-CU-001, FN-PE-001, FN-CD-001 and FN-ER-001. They cover currency-only clarification, a budget change with brand exclusion, supplied dissatisfaction handling and bounded retry after timeout. For example, the powerbank draft retains both SGD30 and SGD40 and automatically performs one research dispatch after the local typed answer.

Twenty-three scenarios still fail. Fourteen formerly blocked scenarios now have observed failures. Seven formerly failed scenarios become blocked, which is lost assessment rather than success. The machine scorecard lists every identifier and assertion.

At assertion level, 25 failures become passes, 36 remain failures and 48 previously passing checks fail, including 22 critical checks across fifteen scenarios. Another 598 previously assessed checks are absent or unassessed; 48 checks are newly assessed. No whole v4 scenario passed, so an empty whole-scenario pass-to-fail list cannot establish absence of regression.

The candidate has fewer research responses and consequently fewer attribution checks. Its 289/289 literal citation/price-attribution checks do not establish better evidence quality than the baseline's 636/636. Quote containment is provenance, not semantic entailment. Similarly, fourteen observed clarifications instead of 77 cannot establish fewer unnecessary questions when many requests fail before research.

## Product findings

**Conversation and constraints.** Many faithful supplied operations are rejected as `intent-unavailable`, leaving the accepted state unchanged. This safely avoids unauthorized changes but does not complete the shopper's request. Corrections to a floor lamp or portable recorder leave the old objective and budget in place. Several hard specifications and complete monetary requests never become accepted preferences. These are observations under fixed interpretations, not measurements of actual model recognition.

The 52 critical failures comprise 27 budget expectations and 25 criterion expectations. No observed hard-criterion-retention or hard-choice assertion fails. Missing admission of a requirement must not be described as loss of a previously accepted constraint. Independent QA also isolated faithful “Braille output is essential” and “Adjustable brightness is essential” proposals rejected by the lexical hard-cue guard, while “I'd rather avoid expensive consumables” is rejected as a flexible preference because the guard sees “avoid.” The original proposals and expectations remain unchanged.

Independent QA isolated one cause without changing source or proposals. A sentence-final period is swallowed into the budget amount token. In FN-MR-001, the full message parses as a clarification while its literal budget span parses as SGD120–220; the operation is rejected. A semicolon or exclamation mark instead of that period accepts the same amount. In FN-CC-001, the period prevents recovery of the numeric pending draft, so the faithful 60–90 proposal is rejected. This extends existing budget issue [43](https://github.com/d3F0g/research-shopping/issues/43), with contextual failures tracked in [44](https://github.com/d3F0g/research-shopping/issues/44).

**Tool use and held evidence.** “Compare the first and third options” returns “Your preferences and earlier research are still here.” There is no new Exa dispatch, but also no comparison. The author supplies `acknowledge`; that cannot establish intelligent tool restraint. The same gap affects source questions, requirement summaries and failure explanations. Issue [46](https://github.com/d3F0g/research-shopping/issues/46) remains open.

**Recommendation relevance and attribution.** FN-CU-002 requests a lightweight travel laptop and receives a conditional choice of Synthetic Anker Pocket 10, a power bank. The unchanged synthetic material declares request match supported while its quotation describes a power bank. Native quote containment and schema validity cannot establish semantic relevance. These observations belong with existing issue [39](https://github.com/d3F0g/research-shopping/issues/39). This is a local adverse provider input, not evidence about real Exa retrieval quality.

**Unsupported and unassessed capabilities.** EUR, GBP, AUD and JPY have no current currency representation. Missing later research, comparisons or cancellation cannot count as successful handling. Ordinal grounding, complete correction semantics, source entailment and live recommendation usefulness remain separate gaps. The suite preserves these limits rather than changing its expectations.

The [public-only input review](../artifacts/product-evals/v5-design/input-quality-review.md) explains supplied interpretation, unsupported operations and ambiguity. One independently identified carryability-strength error was corrected before final outcomes were inspected. The original proposal artifact and exact revision remain preserved. No proposal was repaired to fit application outputs.

## Verification and integration

The adapter has separate production OpenAI boundary controls using fake credentials, owned loopback transport and isolated synthetic receipts. They exercise actual receipt reuse, bounded reservations, invalid responses and transport cancellation. They do not use the private receipt program or research ledger. Real browser verification remains separate from deterministic grading and uses visibly synthetic products and intercepted image bytes.

PR [47](https://github.com/d3F0g/research-shopping/pull/47) remains draft. Application PR [38](https://github.com/d3F0g/research-shopping/pull/38) is still open at the pinned candidate. Final parent integration and a complete rerun are prerequisites to preparing the evaluation PR for merge. Genuine model access remains separately blocked in issue [48](https://github.com/d3F0g/research-shopping/issues/48); uncertainty in Exa billing remains issue [42](https://github.com/d3F0g/research-shopping/issues/42). No automated evaluation may spend the manual allowance.
