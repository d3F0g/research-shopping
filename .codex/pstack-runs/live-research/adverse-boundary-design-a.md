# Candidate A. Exact-subject evidence and a bounded adverse ledger

The shopper needs attributable Exa research that cannot conceal known hard negatives, excluded manufacturers, or payment conditions. The maintainer gets one private owner for attribution and adverse decisions, followed by a separately permitted positive projection.
This is an unimplemented design against `ef1df5c774164201b1a6577f02a9c26536fd9184` in `/Users/josiahwong/Documents/research-shopping-exa-primary`. No runtime, live-quality, or merge approval is implied.

## Usage

The adapter keeps its existing single call. Neither the route nor the UI coordinates evidence stages.
```ts
import { projectPageEvidence } from "./page-evidence";
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
```
Two caller-level test examples express the distinction. `inputs` contains independently proven headings in the first example. The second contains the same exact heading twice, with an omitted negative in the second scope.
```ts
const identityOnly = projectPageEvidence(inputs, [], preferences);
const excluded = projectPageEvidence(repeatedScopeInputs, omittedNegativeObservations, hardWireless);
```
The first preserves heading identities with empty facts and null prices. The second returns no matching product, even when the first scope is positive and native extraction omits the negative. These are proposed assertions, not executed results.

## Problem and grounding

Overview. `exa-research.ts:211-274` validates the external response, bounds safe source inputs, parses optional native observations, calls the projection, and validates strict v2 output. `page-evidence.ts` owns source identity, attribution, exclusions, facts, prices, and visible excerpts.
Key concepts. A source is one returned URL with at most six bounded highlights. Identity is source proof of a full designation and category. Positive evidence requires a native quotation and the existing publication rules. Adverse evidence requires independently attributable ownership and recognized adverse semantics.
How it works today. `headingScope` returns the first heading. `scopedProduct` builds `factsInScope`, then uses that positive grammar to admit negatives at lines 188-215. The direct branch separately classifies statements and exclusions at lines 274-323. Its price check sees only immediate neighbors at lines 301-305.
Gotchas. Exact-subject negative language need not satisfy a publishable fact grammar. A second matching scope can invalidate the first. An own-model fact between a price and a condition does not settle the condition's applicability.
The failed premise is that positive admissibility or price adjacency establishes adverse eligibility. The [independent report](/tmp/research-shopping-live/page-correction-independent-security/REPORT.md), [failure index](/tmp/research-shopping-live/page-correction-independent-security/failed-case-index.json), and [recorded controls](/tmp/research-shopping-live/page-correction-independent-security/independent-variants-controls.json) disprove it. Twelve recorded expectations fail, including root's now-decided conservative pre-heading case. This is evidence already supplied, not a fresh reproduction.
The local history has two page-boundary changes, `3dbb7cf` and `2b88b90`. Their identity and quotation safeguards remain constraints. This design changes private responsibility inside the existing module and does not infer broader historical intent.

## Shape

Data belongs to one exact designation within one source. All new types below are private to `src/server/page-evidence.ts`. Existing `Source`, `NativeObservation`, `EvidenceDecision`, `Feature`, and domain output types remain authoritative.
```ts
type Span = Readonly<{ sourceIndex: number; highlight: number | "title"; start: number; end: number }>;
type ScopeProof = Readonly<{ identity: Span; body: Span; name: string }>;
type Anchor =
	| Readonly<{ kind: "heading"; scope: ScopeProof }>
	| Readonly<{ kind: "direct"; statement: Span }>;
type SubjectProof = Readonly<{
	sourceIndex: number; name: string; selected: Anchor; anchors: readonly [Anchor, ...Anchor[]];
}>;
type Ownership =
	| Readonly<{ kind: "own"; basis: "complete-exact-statement" | "valid-scope" }>
	| Readonly<{ kind: "foreign" }>
	| Readonly<{ kind: "unresolved" }>;
type OwnedEvidence = Readonly<{ span: Span; ownership: Extract<Ownership, { kind: "own" }>; predicate: string }>;
type PriceContext =
	| Readonly<{ kind: "clear-within-retained-context" }>
	| Readonly<{ kind: "withhold"; reason: "owned-condition" | "unresolved-condition" | "incomplete-block"; witness: Span }>;
type AdverseLedger = Readonly<{
	negativeByFeature: Readonly<Record<Feature, Span | null>>;
	excludedManufacturer: Span | null;
	priceContext: PriceContext;
}>;
declare const eligible: unique symbol;
type EligibleSubject = Readonly<{ [eligible]: true; proof: SubjectProof; ledger: AdverseLedger }>;
type SubjectDecision =
	| Readonly<{ kind: "excluded"; proof: SubjectProof; ledger: AdverseLedger }>
	| Readonly<{ kind: "eligible"; subject: EligibleSubject }>;
type PositiveEvidence = Readonly<{ facts: ResearchProduct["facts"]; price: ResearchProduct["price"] }>;
declare const featureRules: Readonly<Record<Feature, { terms: string; contradicts: (evidence: OwnedEvidence) => boolean }>>;
function proveSubjects(source: Source, observations: readonly NativeObservation[], preferences: Preferences): readonly SubjectProof[] { throw new Error("not implemented"); }
function assessSubject(source: Source, proof: SubjectProof, preferences: Preferences): SubjectDecision { throw new Error("not implemented"); }
function projectPositive(source: Source, subject: EligibleSubject, observations: readonly NativeObservation[]): PositiveEvidence { throw new Error("not implemented"); }
```
`proveSubjects` retains full title correlation, category proof, forbidden identity checks, and variant boundaries. It enumerates every independently valid matching anchor before choosing the existing preferred publication anchor. It does not drop raw anchors for exceeding the public 640-character window. Direct identity still needs its existing native-backed category quotation. Missing native extraction does not disable heading identity or its adverse assessment.
`assessSubject` visits every retained highlight and every matching scope, including scopes outside the selected publication anchor. Its only evidence input is the bounded source plus independently proven identity. It has no native facts, positive-candidate list, or display window. Attribution and semantic recognition are separate local decisions.
An exact statement must have the full model designation followed by a complete single-subject clause. Reject a longer variant prefix, comparisons, a second subject, and foreign-target qualifiers such as `without wireless support for Orbit Quiet`. This ownership test does not require the predicate to be a positive fact. Unknown predicates may have known ownership while their meaning remains unknown.
Inherited labels, pronouns, and unnamed predicates require a valid scope. Recognized section markers preserve scope. Gaps, related products, variant menus, competing headings, foreign model statements, and ambiguous unmarked product labels end inheritance. Unknown unbound text cannot prove continued inheritance. Independently complete exact-model statements remain assessable after such a boundary. A fresh independently proven matching heading reestablishes scope.
Each owned complete statement and every owned typed label reaches the adverse classifier, regardless of whether native extraction included it. Retain all existing negation terms and exclusive-wired rules. `featureRules` has one descriptor for each `Feature`, with label negation and prose negation handled by that descriptor. Positive grammar may reuse its vocabulary, never its eligibility result or vice versa.
The ledger folds the entire bounded scan. It stores one literal witness per denied feature, one excluded-manufacturer witness, and one absorbing price obstruction. Further matches cannot restore permission. This bounds retained adverse state without an evidence-count cap that stops assessment. Exclusions use exact designation prefixes, the existing exact title-manufacturer relationship, and owned complete `made by` or `manufactured by` statements on both identity paths.
Price ownership is explicit, inherited, foreign, or unresolved. Inspect all bounded conditions attributable to the exact product, including another matching scope or complete exact-model statement. A condition remains relevant across own facts, category sentences, and harmless section headings. An explicit foreign condition belongs only to that foreign product. Do not infer condition ownership from the nearest sentence alone.
Unbound conditions inside an uninterrupted candidate region, including its leading context, make price applicability unresolved. The trade-in condition immediately before the sole heading therefore produces `withhold`, with no claim that a conditional offer is established. A competing product or gap breaks this contextual association. A generic pronoun in an unrelated highlight does not transfer ownership. Exact same-product conditions in another highlight still count.
The existing full sale/was/savings grammar defines an indivisible price block. Those role markers are not payment conditions. HN's complete block remains admissible. A payment condition or unresolved applicability outside the complete selected block withholds structured price. A clipped block, additional ambiguous price parts, or a native substring also withholds it. Literal source context remains available without an amount calculation.
`projectPositive` accepts only the sealed eligible branch. It preserves existing native inclusion, complete typed positive clauses, exact variants, selected-anchor scope, and visible citation rules. No positive fact or price is borrowed from an additional adverse scope. Direct positives retain their current complete-statement contract on the identity source. Clear price context permits consideration, not automatic publication.
Positive admission helpers and their predicate grammar live inside `projectPositive`'s lexical scope. `assessSubject` cannot call or import them. Shared vocabulary and literal price-block structure remain neutral data. Returning `PositiveEvidence` never creates an eligible seal. This removes the nearest reusable positive predicate from an agent's adverse-code path.
The outer projection assesses all source-local subjects before product deduplication or public packing. Excluded branches have no path to product assembly. Then it selects surviving positives and applies the existing five-product, five-source, three-excerpt, and 640-character bounds. A missing display slot can remove positive evidence, never erase an adverse decision. Raw offsets remain literal witnesses, and normalization never stitches disjoint spans.
Interface depth stays one projection call. It hides identity proof, exhaustive same-source adverse assessment, price completeness, and packing. The adapter exposes no new stages or flags. No new module, service, event model, entity registry, shared mutable state, or public wire type is introduced. This follows Boundary Discipline and Minimize Reader Load.

## Ownership and deletion plan

The application owner changes `src/server/page-evidence.ts` and focused API evidence tests. The adapter, quota facade, diagnostics writer, history codecs, source blobs, and official UI keep their owners and contracts. Root owns synthesis and review evidence.
Replace `headingScope`'s first-match return with complete private identity enumeration. Delete the two eligibility implementations in `scopedProduct` and the direct candidate loop. Delete the `scopedFact` admission guard on adverse scanning and the adjacent-only price test. Move positive admission helpers into `projectPositive`'s lexical scope.
Move existing feature vocabulary, label negatives, and exclusive-wired handling into one exhaustive descriptor table. Remove duplicate manufacturer logic after both identity paths use `assessSubject`. Preserve existing price-block and identity parsers where they implement the retained contract. Do not keep a legacy projection path or compatibility flag. Subtract Before You Add changed this from an added third classifier to one replacement owner.

## Control trace and required proof

The following ordinal ranges refer to `independent-variants-controls.json.rows` in its existing order. They cover all 97 cases exactly once. Expected outcomes are preserved, including all 12 red expectations. No case is relabeled as passing by this design.
| Rows | Recorded family | Proposed obligation |
| --- | --- | --- |
| 1 | Independent positive | Preserve identity, exact fact, and singleton price. |
| 2-28 | Nine features, each positive, omitted negative, and beyond-window negative | Exhaustive descriptors preserve positives and reject both negative placements before packing. |
| 29-37 | Three exact negative phrasings, same highlight, cross highlight, and foreign-model control | Full subject ownership admits six omitted negatives. Three foreign controls retain the lead. |
| 38-41 | Two manufacturer phrasings with paired foreign controls | Shared exclusion assessment rejects own manufacturer proof and ignores foreign proof. |
| 42-43 | Second matching scope and Pro scope | Aggregate every exact matching scope. Keep Pro separate. |
| 44-47 | Four foreign specification suffixes | Complete typed positive attribution still rejects them. |
| 48-52 | Unmarked model, foreign specification heading, variant, gap, and related products | Stop inherited facts and prices at each boundary. |
| 53-64 | Six payment/accessory conditions, heading and direct paths | Preserve all twelve null-price outcomes. |
| 65-67 | Separated own-fact condition, leading class condition, and pre-heading condition | Whole bounded context withholds all three prices, including root's explicit policy. |
| 68-73 | Direct negative controls, direct manufacturer controls, and reversed scope order | Preserve all six exclusions and make matching-scope order irrelevant to eligibility. |
| 74-79 | Missing or incorrect evidence versions, including string `2` | Unchanged strict v2 schema rejects all six. |
| 80-85 | Six nested strictness probes | Unchanged contract rejects extra fields without stripping them. |
| 86-89 | Four unsafe URLs | Existing adapter filtering keeps unsafe sources and observations out. |
| 90 | Invented native quotation | Positive projection requires literal source containment. |
| 91-94 | Historical absent, malformed, empty, and missing-identity extraction | Preserve exactly JBL and HN identity-only leads and incomplete-extraction disclosure. |
| 95 | Missing independent proof | Preserve source-only result. |
| 96-97 | Citation containment and same-source integrity | Preserve both schema rejections. |
Additional invariant tests must cover every `FeatureSchema` option with extraction-omitted raw positive and negative forms, unrelated model, exact variant, valid scoped pronoun, and unbound pronoun pairs. The fixture map must satisfy `Record<Feature, ...>` independently of production predicates. Include all existing negative vocabulary and exclusive-wired forms.
Add same-source permutations, three matching scopes, boundaries before a negative, native omission and malformed extraction, and contradictions beyond every display cap. Inserting admitted own facts or harmless headings between a price and its condition must not restore price. Pair leading/trailing and cross-highlight own conditions with clearly foreign conditions and genuinely unconditional singleton prices.
Require exact full HN sale context, JBL identity, no HN post-gap specifications, conditional Shop context, mixed Bose/guide declines, complete typed positive clauses, and native quotation clipping controls. Exercise source capacity and duplicate ordering without transferring evidence between URLs. Add a compile-time assertion that a `PositiveEvidence` value cannot satisfy `EligibleSubject` or substitute for the source in `assessSubject`.
Future verification must rerun the original 24 security probes, 16 diagnostics probes, three direct-price probes, three cross-highlight probes, nine additional diagnostics probes, and the unchanged 97-case suite through the actual SDK, local HTTP, and Hono route. Inspect desktop/mobile uncertainty and price cards. Recheck actual cancellation, unknown-charge stops, one-search settlement, immutable history, and session isolation. Passing unit tests alone do not establish these outcomes.

## Tradeoffs, alternatives, and red flags

We accept conservative null prices for unresolved relevant conditions in exchange for never publishing a stripped singleton. We accept bounded-language recognition in exchange for exact attribution. Unknown semantics remain unknown. Same-source assessment does not resolve future Issue #4 cross-source identity or conflict questions.
An alternative is a public extraction/assessment/packing pipeline with reusable entity events. It exposes sequence and ownership rules to callers and allows them to skip adverse assessment. Its larger interface hides less policy. A patched `scopedFact` path preserves the disproved premise. Neither alternative earns its extra maintenance cost.
The red-flag screen finds no public stage coordination, pass-through module, importable new internals, split state ownership, or second eligibility route. A schema-derived feature type makes omitted descriptors a compile error. Private types distinguish owned evidence, excluded subjects, eligible subjects, and publishable evidence. One file contains the attribution rules and both projections. Tests at the public boundary catch an agent that bypasses those types with a positive filter.
Attack the Premise changed adverse inputs to independently attributable raw evidence. Model the Domain and Type System Discipline changed permission into a private union with a sealed eligible value. Encode Lessons in Structure changed feature completeness and misuse checks into compile-time obligations. Test Behavior, Not Implementation changed proof to public omissions, retained positives, literal prices, and real transport effects.

## Synthesis decision, risks, and next step

This is one independent candidate. Root selects the base and any grafts. No other candidate was read. Ground and Sketch are complete for this package. Agree belongs to root without a human checkpoint. Implement is skipped by this design-only assignment. Scrap is the deletion plan above.
The remaining implementation questions are whether the complete-clause ownership classifier preserves every paired foreign-target control and whether all retained relevant conditions reach the ledger. Resolve both offline against the pinned records before any paid proof. The bounded returned text cannot establish actual page truth, absent content, current inventory, merchant offers, affordability, or arbitrary natural-language meaning.
The next implementation step is to replace the two eligibility paths with private subject enumeration and the adverse decision union, then reproduce and turn all twelve recorded failures green without losing the 85 controls. Keep the SDK, API, categories, auth, quota, diagnostics, frozen history, and official chat UI unchanged. Independent exact-commit QA and security remain required.
