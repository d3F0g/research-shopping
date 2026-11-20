# Preserve the source amount without inventing product-price attribution

The goal is to retain the real source-bound SGD 868 observation in the approved Fieldnote cards while refusing a fabricated variant price or complete fit. Choose a separate literal row observation under evidence version 4. Keep `product.price` null whenever exact-variant attribution or surrounding monetary context is unresolved. Do not attempt another lexical proof that a neighboring heading belongs to a different product.

This is a read-only architecture report. The implementation owner remains responsible for changes. I read the installed poteto-mode, architect, how, Attack the Premise, Model the Domain, and Fix Root Causes skills. Root owns the playbook and parallel design review. Ground and Sketch are complete. Agree is represented by root's follow-up accepting the failed premise and asking for the versioned shape. Implement is skipped because this task is read-only. Scrap applies to the lexical peer-deletion design.

## Evidence and failed premise

The inspected application code is identical between owner commits `8f81e1682ef7e91863b63b0bb01d493f945b9141` and `7ad7ecf0d6e309d1894ee8910b4d70c7f229a2c8`. The latter changed only eight test lines during this review. Pure local projection used the application code common to both commits. No environment files, provider transport, private capture, database, grant, ledger, or GitHub were accessed. Only this report was written.

The premise is that a heading with unfamiliar words, or a different leading name, proves physical product independence. It does not. A token may name a brand, collection, variant, campaign, bundle, or another product. The source must supply the relationship. Token differences alone leave that relationship unknown.

In `src/server/price-evidence.ts:230`, the code classifies other headings through string and word-set tests. Lines 234 through 236 delete their heading-and-money spans from the remainder. The code then treats the remainder as complete enough to retain the selected amount. This deletion is the first unsupported decision. `bindPrice` then preserves the native variant in `src/server/exa-research.ts:253`, and the summary says the source lists that product at the amount at line 434. `ResearchAnswer.tsx:125` prominently renders the amount. Neither a null choice nor an unknown price assessment retracts the displayed attribution.

I ran `projectExaAnswer` with `catalogMaterial` under `EXA_RESEARCH_ENABLED=false`. All inputs were explicitly synthetic fixture data. These are observed outputs, not predictions.

| Added source context | Stored price at inspected code | Result |
| --- | --- | --- |
| Baseline synthetic catalog | SGD 868, exact-variant scope, unknown assessment | Literal positive survives. |
| `Fixture Other Silver Sunglasses / SGD 999 SGD 499 (50% off)` | SGD 868, exact-variant scope, unknown assessment | Genuine peer positive survives. |
| `Meridian Sunglasses - Silver Edition / SGD 999` | SGD 868, exact-variant scope, unknown assessment | Related heading is discarded. |
| `New Silver colorway / SGD 999` | SGD 868, exact-variant scope, unknown assessment | Unknown leading qualifier is discarded. |
| `Spring collection / SGD 999` | SGD 868, exact-variant scope, unknown assessment | No selected token is required for the failure. |
| `Gift set / SGD 999` | SGD 868, exact-variant scope, unknown assessment | A possible selected-product package is discarded. |
| `For Gold only.` | null | Existing adverse control passes. |
| Replace selected line with `SGD 868–1200` | null | Existing range control passes. |
| Replace selected line with `SGD 868 for three units` | null | Existing quantity control passes. |

All tested catalog tails remained in `sources[0].text`, and all choices were null. Those facts do not cure the incorrect single-price projection. The proposed suffix rule can catch some related headings, but `Spring collection` and `Gift set` establish that selected-name fragments cannot exhaust the ambiguity.

It is inferred, not demonstrated by these fixtures, that some real catalog pages use such headings for selected-product variants or bundles. The narrower conclusion is sufficient and proven by the input shape. Nothing in these strings proves independence. The same visible text can describe either a separate item or a modifier whose relationship was lost in flattened page text.

## Three structural choices

1. **Conservative price plus existing prose and evidence.** Remove lexical deletion. Keep the price null and mention the bound literal row in the current summary and evidence disclosure. This needs the fewest changes, but the structured card has no source-amount slot and says only "No qualifying observed price." A generated attribute also risks consuming the six-attribute limit and turning presentation copy into an implicit data protocol. This does not meet the requested prominent useful observation as cleanly.
2. **Separate literal row observation and applicable price. Recommended.** Add one bounded observation field under evidence version 4. It describes document text, has no variant field, and never enters eligibility or budget arithmetic. Keep the existing applicable-price contract intact. Reuse the current card and disclosure with concise uncertainty next to the observed row. This directly represents the two distinct claims and removes the need to prove peer independence merely to show the literal 868.
3. **Explicit native source relationships in the existing single Exa Answer.** A future native schema could identify row spans and assess `same-product`, `other-product`, or `unknown`, with literal support. This can improve source-based interpretation but is still AI interpretation, not deterministic semantic proof. It changes the native contract, needs separate adversarial coverage, and cannot enrich the existing captured response with evidence it lacks. It must remain optional and is unnecessary for this repair. No extra Exa call or other model call is justified.

## Recommended evidence version 4 shape

Keep the persisted version 2 and version 3 readers and their actual semantics frozen. The current writer emits evidence version 4. The conversation envelope version need not change merely because evidence changes. The renderable history union accepts all actual old kinds without recomputing their prices or grades.

The caller asks one price boundary for both results. The boundary owns binding and applicability. The client renders its result without reading source text to infer prices.

```ts
type SourceRowSupport = EvidenceSupport & {
	origin: { kind: "source-context" };
};

type CatalogPriceObservation = {
	kind: "catalog-row";
	row: SourceRowSupport;
	money:
		| { kind: "single-amount"; amount: Money; currency: Currency }
		| { kind: "literal-only" };
	attribution: {
		status: "unknown" | "contradicted" | "conflict";
		rationale: string;
		support: EvidenceSupport[];
	};
	conditions: string[];
};

type PriceEvidence = {
	price: ApplicableVariantPrice | null;
	priceObservation: CatalogPriceObservation | null;
};

function bindPriceEvidence(input: NativePriceBindingInput): PriceEvidence;
```

`ApplicableVariantPrice` is the existing public price shape and meaning. The name above explains its role and does not require a new wrapper module. `priceObservation` is one bounded selected row, not a general catalog parser or product registry. `money.kind` prevents a range, quantity phrase, or two amounts from becoming one scalar. `row.literal` retains the entire heading and amount line, including whitespace. `row.context` retains the complete contiguous uncut passage. The source record remains unchanged.

The row is derived from the retained source. Its origin is `source-context`. Never invent a provider quotation by concatenating the heading with the money. Keep the existing native identity binding unchanged. Preserve the native amount quotation in `attribution.support` with its actual provider origin. Add complete source-origin context when the native quotation omits the surrounding issue. Conditions copied from the native answer retain the existing explicit provider-reported, unverified label. The native false `conditionsResolved` cannot become true in this projection.

Bound the observation through the actual native identity and amount spans. A unique full heading-and-money row may remain observable even when a second same-name row has a different price. The second row prevents exact-price promotion and remains in complete context. Duplicate equivalent full evidence that defeats unique native binding still fails closed. Case folding may detect adverse context but cannot create positive literal evidence.

Do not store a list of purported foreign product names or mark them independent. Preserve all unresolved monetary and qualification context through complete context, with a short source-linked explanation. Exceeding a bound cannot silently omit an adverse passage. Retain uncertainty or withhold a promoted price.

The new schema validates source IDs, raw offsets, exact slices, complete context, and the number/currency against the complete selected amount line. `single-amount` is allowed only when that complete line is one explicit amount and currency. A known range or quantity remains `literal-only`. Existing source and cut guards continue to apply. Quote containment proves that text appeared in the source. It does not prove the relationship between a neighboring row and the selected product.

Eligibility and numeric budget checks consume only `price`. An observation cannot satisfy a budget or a hard requirement. Existing separately proven sentence-price positives can retain their price. A catalog observation with unresolved neighboring money has `price: null`, even when a human recognizes a genuine peer. The observation still retains SGD 868. This is an explicit capability boundary rather than a loss of the source fact.

## Minimal visible behavior

Reuse the existing cards, summary, and evidence disclosure. When `price` is null and a single-amount row observation exists, the card shows "Source row shows SGD 868.00" and "Applicability to the selected variant is unresolved." It must not say only "No qualifying observed price."

The useful summary can say that the quoted catalog row shows SGD 868, followed immediately by unresolved applicability and complete-request fit. It must not say that the product costs SGD 868. A related SGD 999 row or a wrong-variant qualifier is mentioned next to the uncertainty, with its full source passage in the existing disclosure. Preserve merchant, stock, and delivery uncertainty. Do not create another confirmation or progress interface.

For a range, show the retained literal range as source text and no scalar price. For `For Gold only`, the literal 868 may remain observable, but the contradiction must be visible beside it. A generic "conditions unresolved" label is too weak for a known wrong-variant restriction. No browser verification of this proposed copy has been performed.

## Paired acceptance experiments

These are required assertions for the new design. They are not claims that the design has been implemented or passed.

| Pair | Assertions |
| --- | --- |
| Original synthetic catalog versus genuine peer with shared `Silver` and sale amounts | Both preserve the bound 868 row observation and complete source context. Unresolved catalog applicability keeps `price` null. The UI visibly shows the literal observation and uncertainty. |
| Genuine other-brand peer at SGD 858 versus `New Silver colorway / SGD 999` | Both preserve 868 as the selected source row. Neither borrows 858 or 999. No heading is declared foreign from tokens. The 999 context is visible as unresolved, not discarded. |
| `Silver Edition / SGD 999` versus `Spring collection / SGD 999` | Both keep `price` null and retain all surrounding money. No name-fragment threshold changes confidence. |
| Selected `SGD 868` versus selected `SGD 868–1200` or `SGD 868 SGD 500` | Only the first has `money.kind: single-amount`. The others retain literal text and never project amount 868 as a single price. |
| Ordinary unresolved catalog row versus the same row followed by `For Gold only` | Both retain the bound row where native binding remains valid. The latter preserves and visibly identifies the adverse variant context. Both keep price null. |
| Complete sentence-price positive versus an unsupported price suffix | The existing proven positive remains usable. The adverse case retains the existing null-price assertion. Observation presence never substitutes for applicable-price proof. |
| Whitespace-only binding versus changed case, punctuation, duplicate equivalent quote, cut tail, or forged offset | Existing positive raw-whitespace behavior survives. Invalid bindings cannot create a positive observation. |
| Persisted version 2 and version 3 beside a new version 4 result after restart | Old payloads, prices, evidence origins, and grades remain byte-equivalent at their historical boundaries. New assertions use only version 4 semantics. No replay recreates paid actions. |

Preserve the current red assertions that ambiguous attribution has `price === null`. Add observation and visible-context assertions. Do not replace the null-price assertion with merely `choice === null`. Positive catalog tests should assert their original consumer fact, that the literal 868 remains visible and attributable, in the new observation field. Preserve the former version 3 fixture unchanged as historical evidence. Run new paired cases through projection and real desktop/mobile UI, then independent QA and security at the exact candidate commit.

Current evaluation must record evidence version 4, fixture provenance, raw source checks, and its reviewed commit independently. Historical version 2 or version 3 scores cannot certify new semantics. Keep the historical grading implementation and recorded provenance intact. This report neither verifies the private human response nor approves a candidate for merge. Root's private pure replay is still necessary and must not issue a provider request.

## Principle decisions

- Attack the Premise changed the recommendation from another suffix filter to rejecting token-based foreign identity proof. The additional no-shared-token probes show why the next patch would repeat the premise.
- Model the Domain changed the public proposal to separate a literal row observation from an applicable variant price. The discriminated money shape prevents partial ranges from becoming scalar observations.
- Fix Root Causes places the repair where price evidence is projected, before deleting context or writing `product.price`. UI disclaimers and null recommendations alone cannot repair an already misattributed amount.

Memory was used only to locate the domain/history distinction. Current imports and eligibility code were inspected directly. The report relies on current repository evidence, not memory for current behavior.
