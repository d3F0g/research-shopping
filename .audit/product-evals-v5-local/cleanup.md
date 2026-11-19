# Independent local-contract cleanup review

Verdict PASS on exact code head `f04068e137c2ac9b242cf4c4ec8b5d7286a95734`.

Reviewed the local-contract delta from `32c0811` and carried forward the historical evaluation cleanup at `ee6d338`. Scope is evaluator code/data, package scripts, the dedicated product-evaluation workflow, ignore rules and verification guidance. The accompanying manifest records the complete tracked scoped tree; all listed working bytes equal the exact head. Imported application source and product fixes are excluded.

## Findings

- Narrating comments, commented-out code and deletion candidates 0.
- TypeScript/lint suppressions 0.
- Exact MUST KILL refactor targets 0.
- `git diff --check` passes.
- No misleading inference, installation or live-usefulness claim found in scoped generators and tests.

## Retained design

`recordAt`, `activeAttempt` and `traceRequests` are evaluation instrumentation for actual HTTP boundaries. Each HTTP attempt gets a random identity; AsyncLocalStorage carries it through application work, and a harness-only header carries it over the owned SDK HTTP boundary. Late completion and duplicate operation tests preserve the original attempt rather than reading the mutable current turn. Header insertion is registered only for an owned allowed origin and is removed with that origin. Request bodies, application operation identities and provider path remain unchanged. This is a scoped trace mechanism, not a product workaround or a retry bypass.

The frozen-v3 validator and its copied operation/money schemas preserve the prior v5 report contract without importing mutable current application schemas or executing embedded source text. Historical validators and versioned tapes remain necessary audit material. The v4 and original fd9 v5 artifact directories have no delta from the integrated starting point. They were not rewritten or deleted.

Current schema 4 reports distinguish local handling, supplied optional fallback, unavailable handling and no preparation. Supplemental local-only execution does not read proposal JSON. Main-lane OpenAI/Ollama HTTP counts remain zero. Separate Ollama boundary tests use a fake tags/chat server and explicitly state no real model or inference. The prior active OpenAI boundary tests were replaced by current local-provider tests; original committed results and frozen report validation remain preserved.

Verification guidance follows proactive no-budget research and typed currency continuation. Browser instrumentation adds only declared trace metadata and keeps the existing screenshot framing, synthetic image labeling and actual transport observations.

## Evidence and limits

Read scoped diffs and relevant current modules/tests, searched for comment narration and suppressions, inspected exact committed bytes and ran the whitespace check. No application/evaluator code was modified. Only this review and its manifest were written. No GitHub action, paid request, private configuration/credential/ledger access, model installation or production inference occurred.

This is independent static cleanup approval. Runtime QA, security and actual product usefulness remain separate. After generated results, docs or run records are committed, carry this verdict forward only if the complete scoped manifest remains unchanged.
