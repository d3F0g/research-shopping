# Candidate A. Source records own the result

Make genuine captured Exa research useful without weakening source proof.
This is a design against `68f8d849c757fae5ba6bef0ae7038a30549de73d`, not an implementation or a passing replay.
Grounding used the complete second-call `proof.json`, `application-response.json`, and `private-provider-diagnostic.json` under `/tmp/research-shopping-live/live-proof-1794987791536/`.
It also used `src/server/page-evidence.ts`, its adapter, `src/domain/research.ts`, current evidence tests, genuine category captures, and the recorded completeness reconciliation.

## Caller first

The adapter keeps its existing single call and receives the existing products, sources, and private decisions.
```ts
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
const identityOnly = projectPageEvidence(inputs, [], preferences);
const replay = projectPageEvidence(capturedSources, capturedNative.observations, headphonesUnder400);
```
Native quotations select or prioritize independently established source records at the same returned URL.
They cannot create ownership, rename a product, complete an open statement, or remove qualifications.
The source-first variant permits selection of a complete explicit-model specification even when no native fact fragment matches it.
Absent or malformed extraction retains the existing identity-only behavior. This differs from using a missing field as evidence.

## Private shape and ownership

All new types and logic stay inside `src/server/page-evidence.ts`. No new export or second parser is needed.
```ts
type SourceRecord =
	| { kind: "identity"; proof: SubjectProof; support: readonly Span[] }
	| { kind: "statement"; passage: CompletePassage; owner: SubjectProof; support: Span; form: "explicit-model" | "scoped-specification" }
	| { kind: "price-context"; span: Span; owner: SubjectProof; disposition: "complete" | "ambiguous" }
	| { kind: "unresolved"; passage: SourcePassage };
type SelectedRecord = Extract<SourceRecord, { kind: "statement" | "price-context" }>;
function sourceContext(source: Source, sourceId: string, preferences: Preferences, decisions: EvidenceDecision[]): SourceContext;
function projectPositive(context: SourceContext, subject: EligibleSubject, hints: readonly NativeObservation[], decisions: EvidenceDecision[]): Pick<ResearchProduct, "facts" | "price">;
```
Derive these records from the existing passage stream. Do not maintain a second normalized source or a parallel ownership map.
`SubjectProof` retains its exact source designation, complete category proof, and all actual explicit-model anchors.
`EligibleSubject` still follows assessment of every retained passage before positive selection, deduplication, or visible-window packing.
Model the Domain changes the central unit from an extracted string to a complete source-owned record with its supporting span.
Boundary Discipline keeps provider validation in `exa-research.ts` and semantic ownership in the one pure page-evidence owner.

## Identity and scope rules

Accept a complete one-token model-ID heading only with a complete same-model category statement in the captured source.
ATH's raw heading at source 0 offsets 106 through 121 and named definition at 123 through 230 provide that evidence. Do not infer Audio-Technica as a manufacturer from model knowledge.
Recognize singular `Headphone` through the existing category grammar. Preserve every actual heading token, including Edifier's `2025 edition` and HN's `Teal (800073)`.
Use the heading's complete source wording as identity. Native `name` remains advisory page metadata and is never canonicalized by deleting variant words.
Retain source-title variant contradiction checks. A title decorator is not proof that a variant suffix can be discarded.
If title completeness is needed by those checks, pass the existing `boundedTitle(...).truncated` bit through the private input. Never guess completeness from string length.
Do not add an unmarked Sony header pipeline. Gain City can remain source-only.
Unknown prose, another model, selectors, accessories, gaps, and clipped propositions still end inherited scope.
A generic section cannot restore ownership. A complete exact-model statement may establish its own local ownership without borrowing a previous heading.
Extend scoped specification forms narrowly to complete driver statements and category-led descriptions, with the same foreign-model, question, condition, and comparison checks.
For Edifier, the complete category-led sentence at 94 through 207 owns the following driver sentence at 208 through 270 before the gap. The complete support from its heading fits below 640 characters.
Do not let arbitrary complete prose keep a topic alive merely because it has punctuation.

## Selection, price context, and packing

Match a hint only within one complete record from the same URL. Whitespace and case may locate it, but output always comes from the unchanged source wording.
A match inside a negative, conditional, question, comparison, foreign-model statement, or clipped record does not create a positive fact.
If identical hint text selects records belonging to two subjects, decline that hint. A complete identity quotation can disambiguate; `name` alone cannot.
Missing or contradictory identity hints do not invalidate independently proved headings, and cannot select another subject's scoped statements.
Combine only contiguous price-only lines into one source record before assessing completeness. Include the currency line and every sale, list, and savings qualifier.
An ambiguous money-only block with proven start and end preserves the topic but withholds price. It cannot conceal unknown prose or establish a product identity.
This admits HN's complete raw 73 through 115 block as `S$ 349 was S$ 499 SGD You Save S$ 150`, selected by its shorter native price hint.
Edifier's two unlabelled amounts remain ambiguous. ATH's `From: SALE` amount remains withheld under the existing price contract.
Conditions and unresolved price context anywhere in the applicable bounded source still veto projection before packing.
Heading-derived facts retain a visible contiguous window containing the full identity and full support. Do not switch identity kinds merely to evade this rule.
An independently complete direct category statement can serve as direct identity, with separate complete explicit-model fact windows under the existing v2 contract.
Keep five sources and products, six highlights scanned per source, 16384 units per highlight, and three visible windows of at most 640 characters.

## Captured yield and limits

ATH can have the direct class identity at 123 through 230 and the complete explicit-model microphone and beamforming specification at 1212 through 1360. These are two independent source windows.
Do not publish its cropped 45 mm hint from the sentence comparing ATH-M50x. LDAC occurs after an explicit gap and stays unbound.
The 50-hour sentence at 1522 through 1756 is source text, but its inherited ownership is not established by this minimal design. The intervening additional-controls prose cannot be ignored.
Edifier can have its full heading and the complete 40 mm driver sentence. Its pre-gap LDAC sentence ends in `....`; its later repeated facts and 80-hour sentence cannot cross that gap.
HN can have its exact Teal identity and complete unverified price context, with no post-gap specifications.
Stereo Momentum can remain identity-only. Do not infer Graphite from the URL, and do not manufacture a native extraction for it.
This predicts two leads with actual specifications plus HN price context. It does not yet establish useful music or battery comparison, current affordability, stock, delivery, or merchant offers.

## Exact changes and deletion

In `headingScopes`, remove the blanket two-word minimum and whole page-title equality gate only where complete source identity and category proof replace them.
In `sourceContext`, derive canonical direct subjects and complete price records from source evidence. Keep all adverse evidence and incomplete records available to `assessSubject`.
In `projectPositive`, remove metadata-name equality, exact native-passage equality, and native price-block equality as proof gates. Select canonical owned records instead.
Remove the separate heading/direct string-selection loops only after both use those records. Keep their distinct citation-support requirements.
Leave the SDK request, schema, objective, prompt, cancellation, quota, diagnostics retention, frontend, public v2, and frozen histories unchanged.
Laziness Protocol rejects an external normalizer, a new public schema, publisher/model allowlists, and an extra fetch merely to increase capture yield.

## Red flags, tradeoffs, and proof

The one adapter call hides identity, ownership, adverse assessment, selection, and packing. No caller coordinates phases or imports new internals.
The cost is broader source-owned selection. Choosing unhinted explicit-model statements is intentional and needs an independent usefulness verdict.
The alternative makes every positive depend on a resolved native identity and field span. It offers tighter selection but loses safe source facts whenever extraction omits them.
Existing tests rejecting shortened HN hints or wrong native names conflict with parts of this behavior. Root must inspect every changed expectation explicitly; do not silently alter fixtures or call those tests green.
Direct canonical discovery also changes current wrong-native-model category controls. This is an unresolved compatibility risk, not permission to reduce the mandatory 505 expectations.
Replay the exact diagnostic native JSON and all five source strings in a clearly labelled derived SDK envelope. Preserve hashes and original artifacts; do not call it a complete captured HTTP response.
Assert literal same-source quotations, complete variants, HN post-gap refusal, ambiguous-price refusal, unverified stock, cropped-negative refusal, duplicate-phrase ambiguity, unknown prose, price-only interstitials, and real section/gap/cut/CRLF controls.
Run all previously valid mandatory 505 checks plus genuine category captures. Keep the three documented obsolete originals explicit and immutable.
Prove It Works changes acceptance from a larger product count to exact source adjudication and actual SDK/application replay with inspected desktop/mobile evidence.
Root owns synthesis and may reject this candidate if source-first discovery cannot satisfy those unchanged obligations. No human checkpoint or paid call is required to decide.
