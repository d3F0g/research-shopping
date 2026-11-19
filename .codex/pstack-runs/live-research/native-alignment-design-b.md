# Candidate B. Resolve proposals to source-owned records
The goal is useful genuine source research without weakening ownership, variants, uncertainty, or privacy.
This design extends only `src/server/page-evidence.ts` at base `68f8d849c757fae5ba6bef0ae7038a30549de73d`.
The adapter retains its single `projectPageEvidence(inputs, observations, preferences)` call and existing result shape.

## Caller usage first
```ts
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
const replay = projectPageEvidence(derivedCapturedInputs, exactCapturedObservations, preferences);
const headingOnly = projectPageEvidence(inputs, [], preferences);
```
The first caller receives source wording, never a rewritten native fragment.

## Grounded ownership and flow
`exa-research.ts:227-249` validates the native object and safe URLs before its existing adapter call.
`page-evidence.ts:125-174` currently derives headings from `title.split(" | ")[0]` and rejects one-token names.
`page-evidence.ts:337-345` currently derives direct identities from native `name` and exact native category quotations.
`page-evidence.ts:446-488` currently gates positives on native name equality and whole-passage quote equality.
Keep source boundaries, passage completion, ownership, adverse assessment, and packing inside that same private owner.
First parse the bounded source once, establish canonical anchors, and assess all adverse and conditional evidence.
Then resolve each native proposal at its returned URL into required source records and project those records only.

## Private data shape
```ts
type CanonicalSubject = Readonly<{ name: string; anchors: readonly [Anchor, ...Anchor[]] }>;
type CompleteOwnedClaim = Readonly<{ subject: CanonicalSubject; passage: CompletePassage; support: readonly Span[] }>;
type PriceCluster = Readonly<{ span: Span; subject: CanonicalSubject; roles: "qualified" | "single" | "ambiguous" }>;
type IdentityWitness = Readonly<{ kind: "native-identity" | "direct-category"; anchor: Anchor; matched: Span }>;
type ResolvedProposal = Readonly<{ subject: EligibleSubject; identity: IdentityWitness;
    facts: readonly CompleteOwnedClaim[]; price: PriceCluster | null }>;
type ProposalResolution = Readonly<{ kind: "resolved"; value: ResolvedProposal }>
    | Readonly<{ kind: "refused"; reason: string }>;
function sourceContext(source, sourceId, preferences, decisions): SourceContext; // not implemented
function resolveProposal(context: SourceContext, proposal: NativeObservation): ProposalResolution; // not implemented
function projectPositive(context: SourceContext, proposal: ResolvedProposal): Pick<ResearchProduct, "facts" | "price">; // not implemented
```
`SourceContext` owns canonical subjects, parsed spans, price clusters, and eligibility assessments by subject.
There is no second parser, external normalizer, public option, importable internal type, cache, or optional old projection route.
The required identity record prevents a raw native observation from entering positive projection.

## Identity and alignment rules
Use the intact raw heading as the full canonical name, including colors, editions, and SKU text.
Recognize singular `headphone` as category grammar alongside existing plural forms.
A one-token mixed letter-and-number model designation needs independent same-name complete category evidence.
ATH supplies that evidence in its complete `The ATH-M50xBT2 is the second generation ... wireless over-ear headphones.` statement.
Do not invent the Audio-Technica brand or derive category from its URL, page title, or model knowledge.
Native `name` and decorative source titles are advisory only and never positive identity proof.
Resolve native `identityQuote` to one canonical subject through intact heading or complete direct-category evidence.
Remove only Markdown heading syntax and align whitespace and initial case with a raw-offset map.
Do not delete punctuation inside a name, negatives, numbers, qualifiers, suffixes, or intervening source text.
ATH's identity quote also contains introductory prices, so its entire interval must map to the heading plus recognized adjacent price records.
Repeated identical ATH headings are anchors of one proven subject, not an ambiguity between distinct models.
Two possible canonical subjects, truncated identity text, or a shortened variant name causes refusal.
Keep the existing direct-statement behavior through the same resolver using a complete exact direct-category quotation in `quotedFacts` as `direct-category` identity evidence.
This preserves fixtures with `identityQuote: null` without using native `name` as proof or retaining a compatibility projector.
A missing or contradictory identity proposal leaves source-proved headings identity-only.

## Claim and context rules
A native fact fragment locates a candidate complete source statement only within its resolved subject's owned evidence.
Require one unambiguous owned claim and publish the whole source statement with all its qualifiers.
A cropped positive inside a negative, question, conditional, comparison, foreign model, accessory, or clipped proposition stays refused.
Keep unknown prose and foreign-scope breaks, explicit gaps, selectors, and variant boundaries effective before positive selection.
A complete exact-model statement may establish a new local topic, using the same ownership rules rather than resuming a generic section.
Permit continuation only through complete recognized same-topic functional statements, never arbitrary unrecognized prose.
ATH's exact-model microphone statement and the following complete user-controls statement can support its subsequent `These headphones` battery sentence.
Their contiguous raw interval is 1212..1758, with 543 normalized characters, so its actual support fits one window.
Recognize an intact category prefix followed by a complete functional proposition as one owned record for Edifier's opening sentence.
Price-only records retain the proven topic but set ambiguous roles when two amounts lack labels.
A standalone currency token belongs only inside a contiguous recognized price cluster, not arbitrary neutral prose.
This keeps HN's `S$ 349 was S$ 499 SGD You Save S$ 150` together while preserving all qualification.
A native price substring may locate that whole cluster, but cannot remove its currency, savings, membership, or other conditions.
Keep member prices withheld, unlabelled pairs null, raw stock unverified, and affordability unresolved.
Whole-source adverse assessment precedes native resolution, deduplication, and packing, including evidence not selected by native hints.

## Exact captured yield and refusals
ATH can supply its full pre-gap battery sentence through the explicit local support above, subject to offline grammar verification.
Refuse its 45 mm fragment because the whole sentence compares the ATH-M50x, and refuse its post-gap LDAC hint.
Edifier can supply `Titanium-coated 40mm drivers deliver powerful, balanced sound.` before the first gap.
Its first codec sentence ends `quality....`, so retain the current open-at-gap refusal unless independent completion proof establishes a sentence boundary.
Do not substitute the complete duplicate codec or 80-hour bullet after that gap, and preserve `(2025 edition)` verbatim.
HN can supply the complete price context and no post-gap Teal specifications.
Sony remains source-only without a proven canonical anchor for the Black SKU. Add no generic unmarked-heading pipeline.
Stereo Momentum 4 can remain heading-only after singular category support. No native extraction or Graphite variant is invented.

## Deletion, tradeoffs, and proof
Delete title-to-heading equality and native-name-to-subject equality as positive gates, plus duplicated heading/direct quote selection loops.
Replace those loops with one mandatory resolved-record projection. Retain direct proof, all bounds, and all public contracts.
We accept lower yield when native identity or hints are absent in exchange for explicit proposal-to-source attribution.
The deeper private owner hides alignment and source policy behind the unchanged adapter call, per Boundary Discipline.
Model the Domain changes raw optional quotations into required resolved identity and owned-field records.
Laziness Protocol keeps one parser and deletes the old two-loop projector instead of adding an external normalization layer.
Prove It Works requires exact retained replay, not a claimed product count or a passing build.
Red-flag screen passes one owner, one caller contract, no importable internals, no hand-synced catalogs, and no alternate projection route.
Before selection, prove ATH's continuation grammar cannot cross unknown prose or foreign models. Reject B if that proof fails.
Replay the exact native object and all five complete highlights, then inspect literal same-source citations and all supporting windows.
Require multiple leads with useful specifications, HN complete price qualification, no Teal post-gap facts, no scalar unlabelled prices, and stock unverified.
Run all 505 valid mandatory assertions and genuine category captures. Preserve the three documented obsolete originals and their immutable evidence.
Add partial, missing, contradictory identities, shared phrases across models, cropped adverse hints, unknown prose, price interstitials, and section, gap, cut, CRLF controls.
Keep five sources/products, six highlights per source, 16384 units per highlight, and three 640-character windows per source. Decline evidence that cannot fit intact.
No paid call, environment access, database change, GitHub mutation, public history change, or current merchant proof belongs to this design.
