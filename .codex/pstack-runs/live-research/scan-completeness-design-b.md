# Candidate B preserves adapter cuts with each highlight

The shopper must not lose a lead or gain a claim because a suffix was discarded. Keep clipping in the SDK adapter and interpretation in `SourceContext`.
The inspected checkout is `9a97eddefffe11c42e5fbd70eb96c41e664479c9`.

## Caller first

```ts
const inputs: Parameters<typeof projectPageEvidence>[0] = value.results.slice(0, 5).flatMap((result, sourceIndex) => {
	const url = safeUrl(result.url); if (!url) return [];
	return [{ sourceIndex, url, title: boundedTitle(result.title, new URL(url).hostname).title,
		highlights: (result.highlights ?? []).slice(0, 6).map((raw) => ({
			text: raw.slice(0, MAX_HIGHLIGHT_SCAN_LENGTH), clipped: raw.length > MAX_HIGHLIGHT_SCAN_LENGTH,
		})),
	}];
});
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
const context = sourceContext(input, sourceId, native, preferences, decisions);
```

The two internal call sites retain their responsibilities and result shapes. Preserve existing source URL deduplication after this mapping.
The adapter reads only raw length beyond the scan and never inspects a suffix character.

## Shape and ownership

```ts
type Highlight = Readonly<{ text: string; clipped: boolean }>;
type Source = Readonly<{ sourceIndex: number; url: string; title: string; highlights: readonly Highlight[] }>;
type PassageBody = Span & { text: string; kind: ExistingKind; region: number; scope: Scope | null };
type SourcePassage = PassageBody & ({ completion: "complete" } | { completion: "scan-cut" | "gap" | "continuation" });
type CompletePassage = Extract<SourcePassage, { completion: "complete" }>;
function sourceContext(source: Source, sourceId: string, native: readonly NativeObservation[], preferences: Preferences, decisions: EvidenceDecision[]): SourceContext;
function ownership(context: SourceContext, subject: SubjectProof, passage: CompletePassage): Ownership;
```

`Highlight` and `Source` remain private server types in `page-evidence.ts`, exposed only structurally by its existing function signature.
`exa-research.ts` owns the existing numeric scan limit and the required `clipped` value at the actual slice.
`SourceContext` owns passage completeness, ownership, adverse assessment, identity admission, and positive projection.
Keep each highlight item intact in the context. Do not retain a second string array or pass a separate cut array.
Retain offsets into the original bounded string and normalize only a selected span after its boundaries are known.
Derive completeness before admitting heading or direct identities. A class or model prefix ending at a scan cut proves neither identity nor a variant.
For a clipped highlight, an unfinished terminal proposition remains open even if its prefix matches a whole-property, label, identity, or price pattern.
Existing recognized EOF-terminated forms retain acceptance only when `clipped` is false. A scan cut never supplies a genuine returned-highlight EOF.
A closed sentence wholly inside the scan remains complete, including a period at the last retained character before a cut.
Recognized whole structured items retain existing acceptance only when their observed boundaries close the entire item.
Treat a newline in prose as possible wrapping. Consume its contiguous continuation before matching a property, or leave the proposition unresolved.
Never join across an explicit gap, different highlight, or product boundary. An explicit gap opens an unfinished predecessor and ends inherited scope.
Preserve the complete HN sale block before its gap, including was-price and savings context, while rejecting post-gap facts.
Recognize actual Markdown sections and standalone section labels separately from inline words with brackets.
Remove the generic trailing-bracket boundary shortcut. Preserve the literal flattened JBL Variations selector grammar as a selector boundary.
A selector or section boundary does not itself certify an unfinished preceding clause. Inline `wireless accessories [included items].` stays whole.
All adverse and positive semantic reads require `CompletePassage`. Identity admission must use the same completeness decision before it creates anchors.
Open passages remain available to the existing conservative price-context gate and scope invalidation. They cannot become facts, prices, exclusions, or anchors.
Price packing requires complete constituent passages and the existing unobstructed context gate. An open qualifier can withhold an earlier apparent price.
Public excerpt packing reads `item.text`; public v2 schemas and diagnostic capture retain their existing fields and bounds.

## Changes, tradeoffs, and red flags

Change only the product adapter mapping, private highlight shape, context segmentation, and its semantic consumers. Migrate direct test callers together.
Delete the string-only internal input contract and bracket-only structural shortcut. Keep no optional provenance, default `false`, overload, or compatibility path.
Keep legacy `boundedHighlight` and its shared constant use unchanged. Do not import the adapter into `page-evidence.ts` or add a clipping module.
This accepts one required metadata field across the adapter boundary in exchange for preventing raw suffixes from reaching semantic consumers.
Compared with raw-through-context ownership, the context cannot recompute provenance. The adapter owns that mechanical truth once, beside the slice.
The exported operation still hides segmentation and assessment behind one call. No caller coordinates interpretation stages or imports context internals.
Red-flag screen passes only with one bound owner, one completeness owner, no parallel arrays, no duplicated semantic guard lists, and no new stage APIs.
An implementation that leaves heading matching or price-block assembly reading unchecked prefix strings fails this design even if the four reds pass.
Root owns synthesis. This candidate has no independent cross-family or blind-review claim and grants no implementation or release approval.

## Exact offline proof obligations

Re-run all 12 existing boundary rows through actual local SDK and Hono transport. The four recorded reds must become passes and eight controls must stay green.
Pair inline brackets with a real Accessories section in both identity paths. Pair wrapped wireless charging and Bluetooth LE Audio with complete generic absences.
Test lengths 16,383, 16,384, and 16,385 with actual clipping metadata, including equal retained prefixes from complete and longer inputs.
Cut heading names, variants, category subtitles, direct identities, positive facts, negative predicates, manufacturer propositions, prices, and qualifiers.
Pair each open proposition with its closed control before a later cut. Require no new identity, fact, price, or exclusion from an open prefix.
Retain all 309 prior assertions, nine-feature coverage, manufacturer polarity, condition headings, JBL selectors, and HN full sale context with no post-gap facts.
Retain same-source contiguous citation bounds, public strict v2 validation, zero normal fixture fallback, legacy sidecar behavior, cancellation, quota, and request shape.
Inspect every assertion row rather than process exit alone, then run package tests and build. No bound increase, paid call, secret read, or production operation is authorized.
Model the Domain and Type System Discipline chose the required co-located item. Boundary Discipline and Fix Root Causes put completeness before every semantic consumer.
Laziness Protocol kept two existing modules and one call. Migrate Callers Then Delete Legacy APIs removed the old input route. Prove It Works requires paired exact-boundary evidence.
