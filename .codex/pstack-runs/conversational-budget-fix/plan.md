# Preserve budgets already stated in conversation

The user submitted `I want to buy a phone for my nephew that costs around 500-600` and received the optional budget question. Root reproduced that exact behavior in the actual normal preview at commit741c610. Preparation retained the full product description but returned a null budget. No provider call was made, and the original ledger hash is unchanged. Evidence is under `/tmp/research-shopping-live/conversational-budget-fix/`.

## Contract and implementation

Keep the current v4 interval contract. `amount` is the maximum; `minimum` is optional. Both amounts use one explicit or disclosed request currency. No category registry or separate LLM is needed to recognize a clearly monetary range in surrounding financial language.

An isolated owner extends monetary-range recognition beyond initial between/from cues. Preserve measurement and product-model exclusions, both bounds, supported currencies, pending constraints, history and negation protection. A recognized budget must skip the optional budget question. The original request and another product type must pass through actual server preparation and the browser. Negative financial ranges must never authorize an update or dispatch.

The owner also replaces the misleading quota copy with a local-safeguard explanation that does not claim Exa credits are exhausted. This does not change admission policy.

Root owns this plan, GitHub updates and the original-checkout delivery. Implementation uses the existing owner's isolated budget checkout and rerunnable harness. Independent QA/security review the exact integrated candidate and changed boundaries. Tests use local substitutes only. Preserve all existing user changes and raw failures.

## Manual testing policy

The current ledger is stopped after an uncertain Exa timeout, not a verified provider balance or exhausted numerical allowance. Seven settled costs total US$0.045, and the eighth has unknown cost with US$0.05 reserved. No ledger entry may be deleted, refunded or relabeled as a known charge.

The user has been asked whether to authorize bounded manual testing with an additional US$0.50 of reserved usage while retaining the uncertain record. That answer is pending. Do not implement or activate a bypass while it is pending. Continue the independently authorized budget and copy correction. Main/PR merge and genuine live product acceptance remain subject to their existing gates.

## Verification and delivery

1. Preserve the actual browser RED reproduction and commit meaningful failing regressions before the fix.
2. Check generic positive financial language, currency disclosure and unrelated product types against measurements, model numbers, ambiguous ranges and negated monetary changes.
3. Run unit/API checks, build/typecheck and affected desktop/mobile browser journeys with inspected screenshots.
4. Obtain independent exact-head QA and security verdicts and automatic PR/push CI.
5. Fast-forward the original preview without discarding local changes, restart only the recorded owned services and recheck the exact sentence in the normal application.
6. Update existing PR38 and Issue43. Do not create another application PR or claim real Exa usefulness from a substitute.
