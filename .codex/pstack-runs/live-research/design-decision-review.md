# Exa research design decision

The user wants real product discovery through Exa, useful comparisons, and attributable page observations without invented offers or inventory. Choose Candidate A as the implementation base, with the corrections below. This is an independent static architecture judgment, not runtime acceptance.

The review inspected both candidates in full, the design brief, capability audit, merchant evaluation, current code at `1cf12b2cb5468872365d825751dee532bc4f9d5a`, the canonical Exa skill output and its supporting references, and installed `exa-js` 2.28.0 source. No live calls, credential reads, application edits, tests, or GitHub writes occurred. Candidate A used Astra. Candidate B used host inheritance because Luna was unavailable. The root model family was unavailable to this reviewer, so this is not a confirmed diverse-family or blind judgment.

Throughput checkpoint is n/a for this read-only investigation. Root owns the remaining architecture and implementation workflow.

## Rubric and verdict

These scores are reviewer judgments from the written designs, not measured quality results. Five means implementable without a material design correction. Three means a sound direction with a material unresolved contract. One means conflict with the user's requirement.

| Criterion | A | B | Evidence and judgment |
| --- | --- | --- | --- |
| Truthful evidence | 4 | 3 | Both separate research observations from offers. A treats provider field names as opaque. B requires field matching before establishing the field-path contract, at `design-b.md:78,102`. Neither fully resolves cross-model quote attribution. |
| Useful discovery | 4 | 3 | A's bounded facts per observation support comparison better than B's single fact per product. Both can provide honest research leads. Neither has live evidence that its compact schema produces useful exact quotations. |
| Architecture reuse and depth | 4 | 3 | Both reuse the existing Exa transport behind one turn operation. A avoids B's cookie, session-cache, replay, expiry, and cross-session authorization machinery. The browser already owns completed conversation snapshots. |
| Budget and cancellation safety | 4 | 4 | Both reserve before dispatch, persist spending state, and forward cancellation. A separates its configurable application allowance from the two-call proof. B more clearly stops when billing is unknown. Neither local ledger is a provider-enforced spending ceiling. |
| Testability and chat UX | 4 | 4 | Both retain explicit fixture tests and the chat-first UI. B's sources-only degradation preserves useful evidence. Both still need no-charge follow-up tests, mounted cancellation, and independent desktop/mobile inspection. |
| Total | 20/25 | 17/25 | A needs fewer public concepts and fewer new lifecycle rules. |

The candidates converge on the important architecture. There is no reason to combine two service designs or run a third design exercise. Keep A's single research-turn facade. Graft B's degradation to safe sources when product extraction fails and its explicit handling of unknown billing. Do not graft B's session result cache or product-wide two-call limit.

## Smallest implementation contract

1. Keep one normal `/api/turn` operation. It owns preference interpretation, the zero-call decision, admission, one Exa request, and a typed reply. HTTP owns input validation and the incoming abort signal. The Exa adapter owns SDK parsing, safe source projection, and transport deadlines. Pure domain functions own evidence attribution and constraint outcomes.
2. Use A's explicit research versus test-fixture composition. Normal startup never imports fixture providers as a fallback. Missing configuration, empty results, errors, quota exhaustion, and unsupported requests return visible limitations. Production stays disabled. The old catalog engine and exact merchant-link assertions remain exercised only by explicit test composition.
3. Add a research reply alongside ordinary messages and clarifications. The research snapshot contains source-scoped observations, exact quoted evidence, nullable page-observed price quotations, unresolved constraints, and unknown stock. It never inhabits `Offer` or `Candidate`. Keep the future merchant boundary in the design document until a real consumer needs code. Authorized merchant proof remains an external dependency and Issue 2 stays open.
4. Reuse the current Exa SDK adapter and source-link policy. Replace catalog-only query construction. Remove the normal paid shortlist-sidecar action. Do not add another Exa client, a provider orchestration framework, an Agent loop, per-result summaries, or automatic retries.
5. Keep current preferences separate from immutable historical replies. Formatting requests, disclosure, theme changes, and comparisons of held evidence use the browser's completed snapshot and spend nothing. Material submitted research changes can initiate one request. Historical controls cannot initiate research or merchant selection. Preserve the official shadcn and AI Elements components.

This reuses concrete existing boundaries. `src/server/exa-research.ts:137` already invokes the official SDK with caller cancellation and a deadline. `src/server/app.ts:44` is the fixture-default composition that must change. `src/client/api.ts:20` already passes a signal to fetch. The supplied audit documents generation guards and retained snapshots in `useConversation.ts`.

## Evidence rules that must not be guessed

The checked SDK accepts `search(query, { objective, numResults: 5, contents: { highlights: true }, systemPrompt, outputSchema }, { signal, timeout })`. The five-result cap is a credit-conservation product choice. Keep the compact page-observation schema on `auto`. Do not expand it into a wide multi-page extraction job.

`exa-js/dist/index.d.ts:5221` defines grounding as `{ field: string, citations: { url, title }[], confidence }`. It does not define a JSON Pointer, dotted-path, wildcard, or array-index grammar for `field`. The canonical search reference also does not supply one. Mocking a guessed grammar would test the guess, not the provider contract. Preserve `field` as opaque metadata. Do not implement B's corresponding-field matcher from examples invented by the application.

Use exact quoted text in validated returned source content as the application evidence. Grounding is supplementary attribution metadata, not a substitute for that evidence. A citation URL and extraction URL must resolve to an actual validated returned result after the same canonicalization. Grounding must not introduce new navigation destinations. Provider confidence never establishes truth, merchant authorization, current price, or stock.

Require unambiguous model and variant attribution for each quote. Finding the model name and a price somewhere on the same comparison page is insufficient. A quote about model B must not become a fact about model A. Ambiguous context stays a page excerpt or produces sources-only research. Preserve negation and numeric punctuation during matching. Reject unsupported extracted names, prices, features, and URLs without another paid request.

Retain a bounded supporting excerpt around each accepted quotation. The current adapter truncates each displayed highlight to 640 characters at `src/server/exa-research.ts:54` and the public source schema enforces that limit. Matching against longer internal content while displaying an unrelated prefix would hide the actual evidence. Either select the supporting excerpt within the existing cap or drop the structured observation. Do not relax evidence checks to increase extraction yield.

The SDK also exposes `notices`, including `RESTRICTIONS_RELAXED`, at `index.d.ts:5253-5272`. Both designs omit it. Parse bounded notices and disclose relevant retrieval relaxation. Preserve the original hard constraints and assess them independently. Capture SDK warnings in developer evidence, especially ignored request fields. The existing adapter uses `warnings: "silent"`, so console output cannot be the check.

Research leads can be useful while eligibility remains unresolved. Use concise source-attributed comparisons. Do not label a lead as satisfying all requirements when price, delivery, or another hard constraint remains unknown or conflicting. Price quotations are visibly unverified and separate from retrieval time. A source URL is a “View source” link, never a verified offer or purchase action.

## Budget, cancellation, and state ownership

Use root's revised configurable local policy. It allows at most 40 attempts, one active attempt, a US$0.05 reservation per attempt, and US$2 reserved allowance. This replaces both candidate defaults and leaves most of the initial US$10 outside the application's local allowance. These numbers are application policy, not Exa prices or the user's remaining balance. Root's live verification allowance remains at most two actual calls. Do not hardcode that verification allowance as the permanent product limit. Inspect the first structured-output request's actual reported cost before relying on a base-search pricing estimate.

Persist an operation ID and request digest before dispatch. Duplicate delivery must spend nothing and must never return another browser's evidence. The simplest behavior is a duplicate status while the original browser keeps its own completed snapshot. Store no server-side conversation cache and expose no operation-ID result lookup. This avoids the session-cookie and cached-response authorization system in B.

Use one explicitly configured absolute ledger location for every live process using this development allowance, including isolated worktrees. A separate ledger per checkout would multiply the allowance. Require an exclusive owner and atomic writes. A second process, a malformed ledger, or an unresolved prior reservation fails closed. Tests use temporary ledgers and force live composition off.

Keep the reservation after cancellation, timeout, a failed request, or a crash. Record validated finite nonnegative `costDollars.total` separately. Stop further calls on unknown billing, an unexpected error, or reported cost above the reservation until root inspects it. Never refund unknown charges or replenish on refresh, restart, reset, or session change. The ledger limits admissions but cannot guarantee the provider's bill.

Depend on the verified Issue 34 cancellation change. New research passes the actual mounted request signal into the SDK and through response body consumption. SDK `index.mjs:3739-3768` keeps its signal active through `readJsonBody`; `index.mjs:3871-3897` issues one search request. Check cancellation before reservation and immediately before dispatch. A disconnected response may still have incurred a charge, so UI cancellation and billing accounting remain separate facts.

## Acceptance risks and proof

- Add local SDK/HTTP cases for valid and malformed structured output, opaque grounding field values, invented URLs, missing prices, a wrong-model quote on a shared page, variant confusion, negation, conflicting evidence, and relaxed search restrictions. Preserve original source quotations in observable output. Sources-only fallback is acceptable degradation, but is not evidence that structured discovery succeeded.
- Verify no paid call for ordinary replies, optional skipped questions, detail changes, theme changes, disclosure, repeated clicks, rejected duplicate IDs, unsupported constraints, or exhausted quota. A positive research case must show that the observer can see a call. Test request caps, restart persistence, concurrent processes, and retained cancelled reservations.
- Verify the mounted Node route actually aborts an upstream local HTTP response before headers and during body reads. Separately verify that stop, reset, edits, and new turns prevent abandoned results from publishing. A UI-only stale-result test does not prove transport cancellation.
- Test two isolated browser contexts without shared evidence, current preference updates without rewriting history, unavailable-provider recovery, and safe external navigation. Inspect first-visit dark mode, persisted light mode, ordinary chat, research cards, and the mobile composer in real screenshots. Keep historical fixture assertions intact.
- Root alone performs at most two bounded Exa calls through the project runtime after independent review. Capture sanitized request IDs, options, costs, raw grounding field values, returned source excerpts, accepted/rejected observation counts, and UI screenshots. Stop on the first unexpected charge or error. Useful product-specific source evidence must survive projection before claiming live discovery success.

The historical 167 unit/API and 43 browser counts are prior coverage, not this review's test results. No runtime acceptance is awarded here. A successful proof still does not establish current inventory, delivery, exhaustive retrieval, or unrestricted language/category support. Headphones/laptops and supported constraints remain explicit; broader interpretation belongs to the assigned follow-up scope.

## Principles that changed the decision

- Laziness Protocol selected A's one operation and rejected B's session cache, generalized provider stages, and unused merchant adapter code.
- Model the Domain kept research observations outside fixture commerce types and made unsupported or conflicting constraints explicit states.
- Boundary Discipline kept SDK fields private, placed evidence checks at the provider boundary, and kept framework request objects outside domain logic.
- Prove It Works rejected invented grounding path syntax, required visible supporting excerpts, and separated static architecture approval from live research proof.
- Test Behavior, Not Implementation required observable upstream abort and no-charge actions rather than tests that mirror helper calls or fabricated grounding examples.

Each named principle's leaf skill was read in this review. No additional agents were spawned.
