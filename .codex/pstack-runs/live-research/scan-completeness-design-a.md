# Candidate A. Bound and interpret inside SourceContext

The shopper needs genuine research without invented specifications, lost price conditions, or false hard-constraint exclusions.
This design targets `9a97eddefffe11c42e5fbd70eb96c41e664479c9` in `/Users/josiahwong/Documents/research-shopping-exa-primary`.
Ground and sketch are complete. Root owns synthesis. Implementation and runtime verification are outside this design task.

The caller passes validated source metadata and neutral raw highlight strings through its existing single call.
```ts
const inputs = [{ sourceIndex, url, title, rawHighlights: result.highlights ?? [] }];
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
const context = sourceContext(input, sourceId, native, preferences, decisions);
const subjects = context.subjects.map((proof) => assessSubject(context, proof, preferences));
```
`exa-research.ts:243` stops slicing product highlights. It keeps response validation, safe URLs, source selection, and native extraction adaptation.
`page-evidence.ts:216` becomes the first and only product-highlight scan owner. Its constructor bounds text before calling `headingScopes` or any matcher.

The small private type change separates source input, bounded text, and proposition completeness.
```ts
type SourceInput = Readonly<{ sourceIndex: number; url: string; title: string; rawHighlights: readonly string[] }>;
type BoundedHighlight = Readonly<{ text: string; end: "excerpt-end" | "scan-cut" }>;
type BoundedSource = Readonly<Omit<SourceInput, "rawHighlights"> & { highlights: readonly BoundedHighlight[] }>;
type Completion = Readonly<{ kind: "complete"; basis: "sentence" | "excerpt-end" | "record" | "price-block" }>
  | Readonly<{ kind: "incomplete"; cause: "scan-cut" | "gap" | "continuation" | "structural-cut" }>;
type SourcePassage = Span & { text: string; kind: PassageKind; completion: Completion; region: number; scope: Scope | null };
type CompletePassage = SourcePassage & { completion: Extract<Completion, { kind: "complete" }> };
type SourceContext = Readonly<{ source: BoundedSource; sourceId: string; passages: readonly SourcePassage[]; subjects: readonly SubjectProof[] }>;
```
`PassageKind` retains existing structural kinds and removes `fragment`. Required `completion` replaces that overlapping state.
`sourceContext(input: SourceInput, ...): SourceContext` locally selects the first six highlights and slices each to 16,384 UTF-16 code units.
It sets `end` from `original.length > retained.length`. It does not read a suffix character or infer clipping from `length === limit`.
It drops raw highlight references from the returned context. Every heading, boundary, ownership, fact, price, and publication read uses bounded records.
Keep original highlight indexes and raw-prefix offsets. Normalize only bounded ranges, and retain their original `Span` values.
The boundary constructor consumes `SourceInput`; `headingScopes` consumes `BoundedSource`. Raw and bounded sources cannot share one ambiguous `highlights: string[]` type.

Derive structural boundaries once per bounded highlight and reuse them for scopes and passages. Each boundary retains its reason and raw positions.
An actual sentence terminator within the retained range closes a proposition, including a period at character 16,384 before a later scan cut.
A genuine excerpt end also closes an otherwise admitted unpunctuated proposition. Exactly 16,384 characters with no discarded text is genuine EOF.
A scan-cut end without an earlier completion witness stays incomplete, even when the retained prefix matches the whole-property or price grammar.
An explicit gap keeps an unfinished proposition incomplete. A completed sentence before the gap remains usable.
A newline alone does not certify completion. Keep a contiguous line-wrap continuation in the same proposition, or leave the prefix incomplete when uncertain.
Existing explicit headings and independent labeled records delimit records. Their syntax may establish intact headings or field values, but cannot rescue a record cut by the scan limit.
A structural boundary ends attribution without automatically completing preceding prose. Preserve a complete negative before a separate `## Accessories` section.
Delete the unrestricted token-plus-`[` or `*` shortcut at `page-evidence.ts:109`. Inline `wireless accessories [included items]` remains one narrower proposition.
Recognize standalone structural labels and explicit Markdown headings. Preserve the literal flattened `Variations * * [ Blue ](...)` menu grammar without generalizing it to arbitrary inline labels.
Keep the established complete sale/list/savings block before the HN explicit gap as a price-block completion. A scan cut can never borrow that gap-specific completion rule.
Never concatenate across a gap, structural boundary, or highlight. Preserving a single contiguous multiline range does not stitch excerpts.

Heading identity admission must use completion before constructing an anchor. A clipped designation or class subtitle cannot produce a new identity.
Direct category identity and additional exact-model anchors require complete passages. Native quotations cannot certify source completeness.
`Ownership` gains `passage: CompletePassage` in its `own` branch. Adverse feature and affirmative manufacturer interpretation consume that same proof.
Positive fact selection and direct citations likewise require complete passages. Heading price blocks require complete constituent passages and the existing source-wide price gate.
Incomplete relevant passages remain available to the existing unresolved price gate. They cannot create a negative exclusion, positive fact, price, or identity.
All matching scopes and exact-model statements still contribute to the adverse ledger before deduplication, product caps, or excerpt packing.

Change `exa-research.ts` and `page-evidence.ts` plus focused offline regression cases. Delete product-side clipping, the bracket shortcut, and the old fragment-only completeness rule.
Keep the legacy sidecar's `MAX_HIGHLIGHT_SCAN_LENGTH` and `boundedHighlight` behavior unchanged. Give the product context its private 16,384-unit limit.
These equal constants belong to separate legacy and product contracts. Do not import the adapter into the projector or create a general clipping module to share one number.
Public v2 snapshots, diagnostics, SDK requests, cancellation, quota, UI, and frozen history retain their contracts. No new optional compatibility input or fallback path is needed.

I accept raw references crossing one extra private call in exchange for one owner of bounding and interpretation. This does not bound provider-body memory or change diagnostics capture.
The alternative adapter-owned bounded item preserves provenance earlier, but exposes product scan policy across both modules. Candidate A keeps the adapter neutral and makes the one projector responsible.
I accept conservative uncertainty for ambiguous line breaks. A feature-word exception would leave identity, positive facts, and prices vulnerable to the same information loss.
The red-flag screen finds one adapter call, one context owner, no parallel arrays, no optional truncation flag, no exported parser internals, and no new service layer.
The main implementation risk is bypassing completeness in early heading admission or price-block packing. The private input types and paired consumer tests must catch those bypasses.

Offline proof must rerun all 309 prior assertions and inspect their JSON rows. The four exact red IDs must retain one unresolved lead in both heading and direct paths.
Their complete scan, explicit-gap, and separate-Accessories controls must still exclude. Inline brackets and flattened menu boundaries must remain distinguishable.
Add 16,383-, 16,384-, and 16,385-unit cases with genuine EOF, discarded suffixes, and complete clauses before later cuts. Include unpunctuated true-EOF controls.
Place identity, direct category, adverse feature, manufacturer, positive fact, and price propositions at the cut. Pair each unknown prefix with a genuinely complete control.
Cover contiguous line-wrap narrower properties, explicit gaps, all nine features, manufacturer polarity, condition headings, every matching scope, and pre-publication adverse assessment.
Retain JBL identity, the full HN sale/list/savings quotation, no post-gap facts, same-source citation containment, publication bounds, strict v2, and zero normal fixture fallback.
Use the actual SDK and Hono route with local transport. Recheck unchanged request count and payload, settlement, cancellation, diagnostics, unit suite, and build after implementation.
This sketch does not claim those future checks pass. [The security report](/tmp/research-shopping-live/adverse-correction-independent-security/REPORT.md) and [full probe JSON](/tmp/research-shopping-live/adverse-correction-independent-security/fresh-boundary-probes.json) record four failures and eight passing boundary expectations at the pinned head.

Fix Root Causes moved the correction before information loss. Boundary Discipline put bounding and completion in the existing private source owner.
Model the Domain and Type System Discipline replaced ambiguous strings and fragment flags with required bounded records and passage completion.
Laziness Protocol kept one call and two affected modules. Test Behavior, Not Implementation made public SDK/route outcomes and paired controls the proof obligations.
Root's next step is to select the ownership shape, then have the branch owner implement against these completion rules. No human checkpoint or paid proof is needed for design selection.
