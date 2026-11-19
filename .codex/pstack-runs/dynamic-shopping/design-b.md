# Candidate B. One sourced shopping assessment

The shopper needs useful recommendations across product classes and criteria. Replace the normal quote-admission pipeline with one source-based assessment owner. Keep the existing operation, quota, cancellation, and fixture boundaries.

## Usage before types

```ts
// research-turns.ts, after an explicit research action
const result = await shopping.research({ intent, signal: operation.signal });

// useConversation.ts, without a provider call
const intent = editIntent(current, {
	kind: "replace-criterion", id, wording: "quiet enough for bedroom use",
	strength: "hard",
});

// LiveResearchResults.tsx
return <ShoppingAssessment result={result} />;
```

`research` returns a complete assessment or a typed failure. The caller never coordinates extraction, quote admission, ranking, or fallback publication.

## Shape and owners

These are domain signatures, not exported SDK types. Existing schemas remain authoritative for budget, currency, and market bounds.

```ts
type Criterion = Readonly<{
	id: CriterionId;
	wording: string;
	strength: "hard" | "flexible" | "unclassified";
}>;
type ShoppingIntent = Readonly<{
	version: 3;
	productDescription: string;
	criteria: readonly Criterion[];
	budget: ExistingBudget;
	market: ExistingMarket;
	revision: number;
}>;
type Assessment =
	| { status: "supported" | "contradicted"; rationale: string; support: NonEmpty<EvidenceSpan> }
	| { status: "conflict"; rationale: string; support: NonEmpty<EvidenceSpan> }
	| { status: "unknown"; rationale: string };
type EvidenceSpan = Readonly<{
	sourceId: SourceId;
	start: number;
	end: number;
}>;
type Candidate = Readonly<{
	id: ProductId;
	name: string;
	variant: string | null;
	identity: Assessment;
	criteria: ReadonlyMap<CriterionId, Assessment>;
	attributes: readonly SourcedAttribute[];
	price: ObservedPrice | null;
}>;
type ShoppingResult =
	| { kind: "assessment"; evidenceVersion: 3; intent: ShoppingIntent;
		products: readonly Candidate[]; choice: ConditionalChoice | null;
		sources: readonly RetainedSource[]; limitations: readonly string[] }
	| { kind: "failure"; reason: ResearchFailure; message: string };

function editIntent(intent: ShoppingIntent, edit: IntentEdit): ShoppingIntent;
function research(input: {
	intent: ShoppingIntent; signal: AbortSignal;
}): Promise<ShoppingResult>;
```

`preferences.ts` owns `ShoppingIntent`, stable IDs, and the sole edit reducer. Preserve free text verbatim. Extract explicit budget and general linguistic cues without a product, feature, or brand dictionary. Unclassified language remains visible and blocks a claim that every requirement is satisfied. Editing resolves it inline. A follow-up appends or changes identified criteria. Ambiguous removal asks which criterion instead of deleting by fuzzy match. Ordinary replies never mutate intent. The server owns interpretation. Remove the client's second semantic parser.

`exa-research.ts` owns the entire normal research assessment, including its private wire schema and evidence binding. `research.ts` owns the public domain contract and pure eligibility rule. `research-turns.ts` owns request lifecycle and publication. UI components consume the result without independent ranking or category switches. This concentrates evidence interpretation behind one operation, per Laziness Protocol and Boundary Discipline.

## Endpoint and trust boundary

Choose one nonstreaming `/answer` per explicit action. Send `query`, `text:true`, `outputSchema`, `systemPrompt`, and `userLocation` justified by local shopping. No objective field exists on answer. The canonical [answer reference](/Users/josiahwong/Documents/research-shopping/.agents/skills/build-with-exa/references/answer.md) supports this shape, and the app has no separate generation model.

Use three bounded collections in the private schema. Products carry identity and exact variant. Assessments carry product ID, criterion ID or open attribute name, status, explanation, and explicit evidence pairs of returned URL plus literal support text. Prices carry decimal amount, currency, complete conditions, variant, URL, and support text. A bounded choice references product and assessment IDs. All requested hard criteria and budget receive assessments. Missing rows become unknown. The server derives source IDs and offsets from exact returned citation URL and contained support text. Reject ambiguous duplicate URLs with differing text. Never resolve narrative `[7]` markers by array index. Render choice explanations through structured references, never free numeric markers.

Parse the SDK response from `unknown`. Bound arrays, text, IDs, references, money, and safe URLs. Reject invalid references. Preserve source text and qualifiers unchanged. A contained quote establishes quotation provenance, not semantic truth. Identity, scope, variant, and criterion entailment remain explicitly labeled AI assessments with visible supporting context. The source disclosure exposes contradictory and conditional evidence beside the rationale. Do not claim deterministic verification of arbitrary language.

Only products with supported identity, a resolved variant sufficient for each claim, and supported assessments for every hard criterion qualify for a choice. Contradicted, conflict, unknown, absent price, unresolved price conditions, wrong currency, or an unclassified requirement prevents a compliant choice. Budget comparison uses validated decimal money, never extracted prose. Unknown merchant stock always remains unverified. Other products belong in a visibly unresolved section. A conditional recommendation states its source-based assumptions. No eligible alternatives means an honest unsuccessful shopping result.

The [prototype](/tmp/research-shopping-live/dynamic-prototype/live-proof.json) demonstrates structured answer and citation text at reported $0.005. It does not establish this richer contract or semantic acceptance. Its missing explicit prices, H13 overstatement, and unusable numeric citation mapping prohibit treating provider suitability prose as an eligibility decision. Wider output and full text may increase latency, payload, cost, or omissions. No app latency measurement exists. Retain the $0.05 reservation and stop policies. Test the exact schema before claiming production readiness.

## History and deletion

Model the Domain replaces category enums with request-specific criteria. Type System Discipline separates supported, conflicting, and unknown assessments.

Freeze actual old preferences, all old response kinds, fixture candidates, questions, requests, pending and interrupted bodies before modifying current contracts. Keep their exact nested bounds and enum members. Dispatch legacy unversioned, v2, and new v3 envelopes independently. Reject unknown versions. Migrate only active workspace preferences through an explicit converter. Preserve historical bytes and inactive snapshots. Auth PR41 later consumes these codecs without feature expansion or changes to its protected worktree.

Migrate live callers and delete `page-evidence.ts`, normal category/feature/brand tables, native five-field observations, category menus, headphones defaults, and static count-based answers in one wave, per Migrate Callers Then Delete Legacy APIs. Preserve synthetic catalog and offer logic only in automated fixture composition. No normal-runtime compatibility publisher remains.

## Alternative and synthesis decision

A structurally different option uses one `/search` synthesis, a compact comparison document, and native field grounding attached directly to output fields. The [search reference](/Users/josiahwong/Documents/research-shopping/.agents/skills/build-with-exa/references/search.md) supports this and offers stronger field-level grounding integration. It hides retrieval while exposing document-grounding interpretation to presentation. A small document loses machine-checkable criterion coverage and budget eligibility. A full matrix exceeds its documented compact-schema shape and pushes toward deeper, costlier retrieval. Choose answer's explicit assessment model provisionally. Do not introduce an endpoint switcher or fallback loop.

Root owns cross-candidate synthesis. This candidate rejects the existing grammar premise, per Redesign From First Principles. It accepts AI semantic fallibility in exchange for arbitrary-category synthesis with reviewable evidence.

## Acceptance and next step

Replay these unchanged checkpoint requests.

- "Headphones for music under SGD400. Compare sound quality and battery life."
- "Laptops for programming under SGD1500. Compare battery life and portability."
- "Headphones for commuting under SGD200. Must have wireless and active noise cancelling. Exclude Sony."

Do not treat driver size as a sound-quality measurement. Preserve selected-SKU weight, runtime uncertainty, and display conflicts. Seller hostname cannot prove manufacturer compliance. Test the prototype's HEPA air-purifier request, observed-price omission, and absent filter costs.

Add generated unfamiliar product descriptions and criteria without registry edits. Cover explicit removal, budget change, ordinary thanks, dissatisfaction, unknown criterion, conflicting sources, negative evidence, variant mismatch, conditional prices, missing support, malformed output, provider error, session isolation, cancellation during body completion, late publication, quota stops, zero-search disclosures, and unsafe URLs. Retain adverse captures unchanged. Map old quote-containment assertions to evidence spans and old grammar assertions to behavioral outcomes. Passing old unused parser tests proves nothing about the replacement.

Independent browser acceptance must inspect desktop and mobile history, contextual editing, dark-first theme persistence, comparison disclosure, composer access, and safe destination journeys. Root's later unchanged-app live proofs decide useful shopping acceptance. Start implementation by freezing historical codecs, then replace the normal assessment owner and all its callers as one verifiable unit.
