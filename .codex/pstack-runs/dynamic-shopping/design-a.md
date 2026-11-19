# Candidate A. One cited comparison operation

The user needs useful recommendations for arbitrary products and criteria. This proposal replaces the failed source grammar with one bounded, source-linked comparison operation. The caller receives a conditional choice or an explicit inability to choose.

## Usage

```ts
const turn = await submitTurn({ message, intent, action: "message" }, signal)
const edit = reviseIntent(turn.intent, { kind: "remove", criterionId })
if (edit.question) return <PreferenceQuestion question={edit.question} />
const result = await submitTurn({ message: "Research these", intent: edit.intent,
	action: "research" }, signal)
return <LiveResearchResults comparison={result.comparison} />
```

`submitTurn` is the existing turn boundary. Message, edit, disclosure, and presentation actions make no provider call. Research makes one. Only the server interprets freeform changes. The client keeps genuine messages and immutable response snapshots.

## Shape and ownership

The following sketch names domain types. Runtime schemas own their TypeScript definitions. Identifiers, safe URLs, amounts, and bounded strings are parsed at their boundaries.

```ts
type Criterion = {
	id: CriterionId
	wording: string
	strength: "hard" | "flexible" | "unresolved"
	origin: { messageId: MessageId; start: number; end: number }
}
type Intent = {
	intentVersion: 1
	description: string
	budget: Budget | null
	market: SupportedMarket
	criteria: readonly Criterion[]
	responseLength: ResponseLength
}
type IntentEdit =
	| { kind: "message"; messageId: MessageId; text: string }
	| { kind: "remove"; criterionId: CriterionId }
	| { kind: "replace"; criterionId: CriterionId; wording: string }
	| { kind: "strength"; criterionId: CriterionId; strength: Criterion["strength"] }
	| { kind: "budget"; budget: Budget }

type Support = {
	sourceId: SourceId
	passage: string
	scope: "exact-variant" | "family" | "unclear"
	qualification: string
}
type Assessment = {
	criterion: { kind: "request"; id: CriterionId } | { kind: "budget" }
	state: "supported" | "unknown" | "contradicted" | "conflict"
	explanation: string
	support: readonly Support[]
}
type Observation = {
	label: string
	statement: string
	support: readonly Support[]
}
type Product = {
	id: ProductId
	name: string
	variant: string | null
	destination: SourceId | null
	identity: Support
	attributes: readonly Observation[]
	price: { amount: Money; conditions: string; support: Support } | null
	assessments: readonly Assessment[]
}
type Choice =
	| { kind: "conditional-choice"; productId: ProductId; reasons: readonly Observation[] }
	| { kind: "insufficient-evidence"; explanation: string }
type Comparison = {
	responseVersion: 3
	evidenceVersion: 3
	intent: Intent
	products: readonly Product[]
	choice: Choice
	sources: readonly Source[]
	limitations: readonly string[]
}

type IntentRevision = { intent: Intent; question: IntentQuestion | null }
function reviseIntent(intent: Intent, edit: IntentEdit): IntentRevision
function research(intent: Intent, signal: AbortSignal): Promise<Comparison>
```

`preferences.ts` owns `reviseIntent`. Category-independent edits identify budget, explicit requirement/preference language, and removals. Product descriptions, brand names, and criterion values stay open text. Keep every otherwise unparsed clause as `unresolved`, with its original span, and ask one relevant clarification. Never classify an unfamiliar phrase away. Ambiguous removals ask which criterion. Stable IDs survive wording edits, with new edit origins and unchanged earlier snapshots. Contextual shadcn controls let the user correct wording and strength without a prechat form. This is conservative interpretation, not a claim to understand every sentence.

`research.ts` owns the public comparison schemas. `exa-research.ts` owns the private answer schema, prompt, source binding, and eligibility calculation behind `research`. `research-turns.ts` retains operation lifecycle and publication checks. `LiveResearchResults.tsx` renders the domain result through existing official AI Elements and shadcn components. There is no new provider manager or public wire type. This boundary hides provider conventions and citation policy without adding a chain of stage modules.

## Endpoint and trust

Use `answer(query, { text: true, userLocation, systemPrompt, outputSchema }, { signal, timeout })`. The [canonical answer reference](/Users/josiahwong/Documents/research-shopping/.agents/skills/build-with-exa/references/answer.md) fits the existing absence of a separate chat LLM. Text supports evidence review, location supports the accepted market, and the schema supports cards and constraint decisions. No `objective` is sent to answer.

Use a shallow provider response with `products`, flat `observations`, and `choice`. Observations carry product ID, optional criterion ID, status, statement, qualifier, scope, explicit source URL, and source passage. Keep identity and price observations in the same flat collection. Return at most three alternatives. The server resolves URLs against returned citation objects and builds the richer public types. Never associate narrative citation numbers with array positions.

Validate bounds, URL safety, identifier coverage, exact source association, and passage containment against retained text. Preserve complete qualifications and cut provenance. Never join passages across extraction gaps. Uncontained material cannot appear as quotation or support. A full source passage makes an AI interpretation reviewable but does not prove semantic entailment. Label interpretations as source-based AI synthesis. Show the cited passage separately.

Require an assessment for every retained hard criterion, including budget. Missing rows become unknown. Family evidence cannot establish an exact variant's attribute. Conflicting sources remain conflict. Manufacturer must come from explicit source content, never seller or hostname. Prices retain currency, variant, sale/list role, and membership or voucher conditions. Compare amounts only in the accepted currency, and never treat conditional prices as unconditional affordability. Stock and current merchant offers remain unverified. Product destinations must reference retained safe source URLs.

The server permits `conditional-choice` only when identity is adequately scoped, every hard assessment is supported, any stated budget has a qualifying observed price, and no unresolved intent remains. Provider prose cannot override that decision. Reasons reference retained observations. Otherwise render distinct alternatives as unresolved options with prominent blockers, not promoted fits. Even eligible choices remain conditional on source claims and merchant confirmation. Suspected duplicate variants count as one alternative until distinguished.

The [prototype](/tmp/research-shopping-live/dynamic-prototype/live-proof.json) returned three products and eight text-bearing citations at reported US$0.005. It supplied no product prices, asserted an unsupported shared H13 requirement, and used unresolved citation numbering. It therefore fails this proposed publication contract. Its cost does not establish the cost or latency of the wider schema. Wider-output reliability and actual latency remain implementation acceptance risks.

## Deletion and history boundary

Migrate all live callers together. Delete `page-evidence.ts`, normal category/feature/brand tables, category-indexed controls, headphones fallback, five-field native observation parsing, and count-based answer prose. Keep synthetic commerce behind explicit automated composition. Do not reuse fixture ranking for live choices.

Freeze exact legacy unversioned and v2 preferences, requests, and question snapshots before changing current schemas. Freeze response kinds `message`, `clarification`, `recommendations`, `no-match`, `error`, and `research`, plus stored `pending`, `question`, `complete`, and `interrupted` bodies. Preserve the existing nested enum and evidence rules. New active intent, response, and evidence versions are independent. Unknown versions fail closed. Only active workspace preferences receive an explicit migration. Historical snapshots remain unchanged and inactive. Deliver those codecs as the integration seam for dependent PR41. Do not modify its protected unfinished worktree or add auth features.

Retain abort through SDK body completion, generation checks, session isolation, reserve/call/settle, unknown-charge stops, no retries, and server-only credentials. Extend existing private diagnostics for answer fields with the same allowlist, hashes, 128KiB cap, absolute path, exclusive `0600` writes, and sink-failure isolation.

## Alternative and synthesis decision

A structurally different design keeps native search as the evidence authority. One `/search` returns a small flat observation table plus field grounding; the app derives comparison and ranks supported flexible priorities deterministically. This offers stronger field attribution and a smaller generated judgment role. It exposes ranking policy and arbitrary criterion interpretation to local code, and useful qualitative comparisons tend to exceed the [search schema guidance](/Users/josiahwong/Documents/research-shopping/.agents/skills/build-with-exa/references/search.md). I prefer answer because the missing capability is comparative advice. Root owns cross-candidate synthesis. Neither design can turn citation presence into proof of correctness.

## Acceptance and next step

Replay unchanged original captures for attribution limits, then use the normal app for these exact requests from the [checkpoint report](/tmp/research-shopping-live/product-checkpoint-independent-integration.md).

- "Headphones for music under SGD400. Compare sound quality and battery life."
- "Laptops for programming under SGD1500. Compare battery life and portability."
- "Headphones for commuting under SGD200. Must have wireless and active noise cancelling. Exclude Sony."
- The prototype's bedroom air-purifier request, including HEPA, Dyson exclusion, noise, and filter costs.

Also exercise an unseen product noun and criterion, then budget change, removal, ambiguity, and historical restore without any registry edit. Old literal-quote tests become passage-integrity tests. Keep variant, negative evidence, conditional-price, unsafe-link, stale-result, cancellation, quota, and fixture-isolation assertions under the new contract. Do not rewrite old captures or count unused grammar tests. Require useful distinct comparisons and justified choices, desktop/mobile screenshots, and independently opened safe product destinations. Sources-only remains a failed shopping outcome.

First freeze legacy codecs and replace the normal contract in one application-owned branch. No implementation or runtime acceptance is claimed here.

Model the Domain changed preferences into identified freeform criteria. Boundary Discipline and Type System Discipline placed source binding and eligibility behind one parsed contract. Subtract Before You Add and Migrate Callers Then Delete Legacy APIs removed the old grammar rather than retaining two publishers. Minimize Reader Load kept comparison policy with one owner. Exhaust the Design Space produced the native-search alternative. Prove It Works kept the prototype's semantic failure separate from successful API transport.
