# Preserve the source amount without inventing variant attribution

The goal is to keep the approved chat UI and useful SGD 868 source fact while withholding an exact-variant price. I recommend evidence version 4 with a separate structured catalog observation. A summary-only change is insufficient for durable provenance and held-evidence replies.

This is a read-only design at application head `7ad7ecf0d6e309d1894ee8910b4d70c7f229a2c8`. Root's held checkout is `ccfb87cdcbbebb4ca4b376fd6747cbbf9372b9cf`. No application, environment, provider, ledger, database, or GitHub mutation occurred. Only this report was written.

Throughput checkpoint is n/a for a read-only investigation. Ground and sketch are complete. Root owns synthesis and implementation. The configured second architect runner was unavailable on this host, so this runner uses the declared parent inheritance fallback.

## The failed premise and first wrong decision

The failed premise is that an unmatched word or different leading heading token proves a different product. The red cases `Silver colorway`, `New Silver colorway`, and `Meridian Sunglasses - Silver Edition` refute it. Shared-color foreign rows do not provide semantic proof either. Their text alone cannot establish whether another amount applies to the selected variant.

`namedCatalogObservation` removes allegedly independent rows before examining context in `src/server/price-evidence.ts` at lines 229 and 234. It then returns only an observed flag and unresolved conditions. `bindPrice` at `src/server/exa-research.ts` line 253 spreads the native price, including its variant, back into `product.price`. This is the first representation error. An unknown assessment does not remove the structured amount-to-variant attachment.

Consumers make that error visible. `ResearchAnswer.tsx` line 126 displays the amount on the product card. `exa-research.ts` line 430 builds the summary from it. `turn-reducer.ts` lines 146 and 157 reuse it in selection and detail replies. Merely leaving `choice` null does not fix these claims.

## Minimal shape and use

The server returns a distinct catalog fact. The product association means only that the row was found while assessing this candidate. It does not mean that the amount applies to the candidate's variant.

```ts
type CatalogPriceObservation = {
	kind: "catalog-row";
	amount: number;
	currency: string;
	row: EvidenceSupport;
	reportedSupport: EvidenceSupport[];
	attribution: {
		status: "unknown";
		rationale: string;
	};
};

type CurrentProduct = {
	// Existing product fields remain.
	price: QualifyingExactVariantPrice | null;
	priceObservation: CatalogPriceObservation | null;
};

type PriceBinding =
	| { kind: "qualified"; price: QualifyingExactVariantPrice }
	| { kind: "catalog-observation"; observation: CatalogPriceObservation }
	| { kind: "absent" };

function bindPriceEvidence(/* native price, identity, retained sources */): PriceBinding;
```

This is a type sketch, not proposed production code. Avoid the explanatory sketch comment in implementation.

`row.literal` contains the exact complete heading and standalone single-amount line, including their whitespace. It uses `origin.kind = "source-context"` because the server found the row. It must not claim that the provider reported that complete row. `reportedSupport` retains the original bound native price supports, with provider origin and exact reported wording, when `price` becomes null. Bound it by the existing support limit. Do not replace `SGD 868` with a manufactured provider quote containing the heading. Do not lose that native quote by retaining only the independently discovered row.

For this bounded fallback, `row.context` contains the entire complete source text, with start 0 and end equal to source length. Keep the existing complete-source and 4000-character admission limit. This preserves every other amount and qualifier without a second context list or lexical peer classifier. No source row is erased. A source beyond the bound retains its ordinary source record but does not gain a scalar catalog observation through truncation.

Attribution has only `unknown` in this shape because this operation has no semantic peer proof. Do not derive `contradicted` or `conflict` merely because another row contains 999. If future evidence establishes those states, introduce an explicit assessment path with its supporting proof. There is no variant, scope, conditions-resolved flag, or positive status on the catalog observation.

The amount parser must accept a single explicit-currency scalar money line. A range, two prices, sale pair, or ambiguous currency cannot become a scalar observation by selecting one endpoint. Those facts remain in the source text. The positive exact named 868 row may survive as an observation even when surrounding 999 rows, real foreign rows, or qualifiers make applicability unknown.

Use one internal discriminated result to make qualification and fallback exclusive. Project `qualified` into `price` and `catalog-observation` into `priceObservation`. Never feed the latter to budget validation, cheaper ordering, recommendation eligibility, or a compliant-choice explanation.

Existing direct sentence and heading price proofs continue through the existing qualified path. Preserve their positive tests. This design does not require a new native answer field, registry, AI call, or billable dispatch.

## Smallest caller changes

`price-evidence.ts` owns literal row recognition and full-context retention. Remove the catalog peer-removal and foreign-identity heuristics. `exa-research.ts` owns partitioning the binding result and authoritative summary. For the catalog case it writes `price = null`, retains `priceObservation`, and says that the source row shows SGD 868 with unresolved applicability. It does not say the variant costs SGD 868.

Keep the existing card and official disclosure components. In the existing price position show `Source row: SGD 868.00` followed immediately by `Applicability to this variant is unresolved.` Show a compact notice that other source amounts remain unattributed. The existing evidence disclosure shows the literal row, source link, attribution rationale, and complete retained catalog context. Thus the 999 row remains visible with its actual heading. Do not present 999 as either a proven target price or a proven foreign price.

Update `heldReply` qualification and detail replies to name the source-row observation when `price` is null. Its source-inspection path must include this observation. Existing cheaper and best paths continue to use only qualifying `price` and current eligibility. Presentation and follow-ups spend no money.

The summary-only alternative can truthfully render 868 once, but the next engineer must recover its row, amount, source relation, and unknown attribution from prose or reparse a stored source. The current card, held replies, and independent evaluator have no such durable relation. That alternative creates two ownership paths and makes omission after a restart easy. V4 costs a bounded schema and caller migration but makes that fact inspectable everywhere. The source-origin row and provider-origin reported supports remain separately inspectable.

## Versioning and lifecycle

Freeze `research-history-v3.ts` and the actual V3 literal-binding semantics beside it. Keep the V2 historical reader unchanged. Create a V4 snapshot contract and current binding validator. Repoint `research.ts` to current V4. Write only evidence version 4 for new research. Do not add an optional field or changed meaning to the strict historical V3 schema.

Extend the current stored-message and `RenderableResearch` union to V2, V3, and V4. Decode each snapshot with its own frozen reader. Preserve prior research objects and ordinary message text exactly. A workspace storage version is a separate decision from evidence version. If its envelope is bumped, the migration changes only the envelope and active-state mechanics. It must not rewrite historical research.

Change the explicit current-version branch at `turn-reducer.ts` line 103 from V3 to V4. Historical V3 responses join V2 as readable historical observations. They cannot regain eligibility under current semantics or reactivate stale prepared research. Current V4 follow-ups assess current hard constraints from held evidence while leaving the stored research snapshot unchanged.

The V4 schema checks the observation's row and context against its retained source and enforces whole-source bounded context for this kind. Validate amount and currency from the literal money line, rather than merely accepting a bound text span containing those tokens. Literal containment proves provenance only. It does not prove attribution or merchant price validity.

## Independent current evaluation and proof

`evals/v2/provenance.ts` line 15 currently recognizes only evidence version 3, and line 43 accepts source-origin evidence only for adverse request fit. A new observation needs an explicit current V4 branch. It must not be admitted by loosening that existing source-origin rule for arbitrary assessments.

Freeze the old current report/assertion semantics and preserve the finite historical inventory and payload digests. The new current evaluator validates V4 against actual raw material independently of the application's row parser. It checks actual native wording for provider-origin supports, literal UTF-16 spans and complete context for source-origin observations, actual source cut metadata, explicit scalar currency and amount, and absence of an invented variant on the observation. Use a new current assertion or adapter identity. Historical reports must not acquire new passing checks or be regraded under V4.

The paired regression expectation is `price === null`, retained scalar observation 868, visible unresolved 999 context, and no qualifying choice. Assert all four. A `choice === null` assertion alone is insufficient. Real other-brand rows with a shared color have the same conservative outcome without semantic peer proof. Preserve direct qualified-price positives and actual native quoted wording controls.

Verify this through schema mutation cases, the projection API, actual browser cards and evidence disclosure, and held `qualify-selection`, detail, and source replies. Include a range control that retains source text but creates no scalar endpoint observation. Use local injected material only.

Mixed-history proof must store V2, V3, and V4 messages, restart the owned API and database, and compare prior research JSON and text exactly. Exercise stale prepared operations, current preferences, and account isolation. Capture desktop and mobile screenshots with the catalog row and the expanded adverse context. This design report does not establish runtime behavior or live shopping usefulness.

## Principles that changed decisions

- Attack the Premise rejected another heading-token rule after partial-name and leading-modifier cases disproved the shared premise.
- Model the Domain separated a literal source amount from a qualifying exact-variant price. A source-origin row with unknown attribution cannot silently become the latter.
- Fix Root Causes moved the correction into the price binding result, before `product.price`, summary, storage, and display. A null recommendation alone would leave the original misattribution in place.

These leaf skills, `how`, `architect`, the architecture red-flag checklist, `unslop`, and `technical-writing` were read from the installed pstack version named in the brief. Memory was used only to locate the existing domain and history boundaries, which were then checked in the named current checkout.
