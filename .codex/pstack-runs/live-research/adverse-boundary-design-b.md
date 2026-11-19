# Candidate B. Source-owned passage context

## Problem

The shopper needs attributable Exa research that cannot hide known hard negatives or detach payment conditions from prices.
The maintainer needs one place to answer who a passage describes, independently of whether its wording can become a card fact.
This is a design-only candidate pinned to `ef1df5c774164201b1a6577f02a9c26536fd9184` in `/Users/josiahwong/Documents/research-shopping-exa-primary`.
Ground and Sketch are complete for this candidate. Agree belongs to root. Implement and Scrap remain unexecuted design obligations.
This seat inherits the active host because configured Luna is unavailable. It supplies structural independence, without a model-diversity claim.

## Usage, caller's view

The adapter keeps one projection call. The following synthetic test call sites specify observable outcomes without stage APIs.
```ts
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
const omitted = projectPageEvidence([headingAndExactNegative], [], hardWireless);
expect(omitted.products).toEqual([]);
const conditional = projectPageEvidence([conditionThenHeading], nativeSingletonPrice, preferences);
expect(conditional.products[0].price).toBeNull();
```

## Grounded explanation and ownership

`exa-research.ts` validates SDK data, URLs, native observations, and metadata before calling `page-evidence.ts` once at line 247.
`page-evidence.ts` owns exact designation proof, passage interpretation, eligibility, price context, and citation packing. That owner stays intact.
The existing research-turn facade owns quota admission and settlement. The adapter retains the single SDK search, abort propagation, costs, and diagnostics.
The heading path returns its first scope, then checks negatives through `scopedFact` at lines 188 through 208. Its exclusion at line 213 checks the name.
The direct path has another subject classifier and manufacturer decision. Its price check at lines 301 through 305 inspects immediate neighbors.
The [independent report](/tmp/research-shopping-live/page-correction-independent-security/REPORT.md) records twelve failures among 97 local cases, including six exact negatives, two manufacturers, a second matching scope, and three payment-context cases.
The failed premise was already tested. An admitted positive fact cannot decide which adverse statements count, per Attack the Premise.

## Shape

One invocation-local `PageContext` owns bounded source strings and passage relationships. Reuse `passages` and boundary recognition as its only segmentation mechanism.
```ts
type ModelKey = string & { readonly exactDesignation: unique symbol };
type Nonempty<T> = readonly [T, ...T[]];
type Span = Readonly<{ part: number | "title"; start: number; end: number }>;
type Identity =
	| { kind: "heading"; identity: Span; scope: Span }
	| { kind: "direct"; identity: Span };
type Owner =
	| { kind: "bound"; model: ModelKey; proof: Span; via: "heading" | "exact-statement" }
	| { kind: "unresolved"; reason: "unbound" | "pronoun" | "gap" | "ambiguous" };
type Relationship =
	| { kind: "bound"; proof: Span }
	| { kind: "foreign"; model: ModelKey; proof: Span }
	| Extract<Owner, { kind: "unresolved" }>;
type Adverse =
	| { kind: "feature-absent"; feature: Feature; span: Span }
	| { kind: "manufacturer"; brand: string; span: Span };
type Entry = Readonly<{
	span: Span; region: number; owner: Owner;
	adverse: readonly Adverse[];
	priceContext: "payment-condition" | "unclassified-context" | null;
	positive: "specification" | "class" | null;
	priceBlock: Span | null;
}>;
type PriceContext =
	| { kind: "absent" }
	| { kind: "complete"; block: Span; form: "singleton" | "sale-was-savings" }
	| { kind: "withheld"; reasons: Nonempty<Span> };
type Eligibility =
	| { kind: "excluded"; reasons: Nonempty<Adverse> }
	| { kind: "retained"; price: PriceContext };
type ModelContext = Readonly<{
	anchor: Identity; identities: Nonempty<Identity>; eligibility: Eligibility;
}>;
type PageContext = Readonly<{
	source: Source; entries: readonly Entry[]; models: ReadonlyMap<ModelKey, ModelContext>;
}>;
function pageContext(source: Source, native: NativeObservation[], prefs: Preferences): PageContext { throw new Error("not implemented"); }
function relationship(entry: Entry, model: ModelKey): Relationship { throw new Error("not implemented"); }
```
All new types and helpers remain unexported inside `page-evidence.ts`. `Owner` records source attribution, and `relationship` derives foreign versus bound without inspecting positive admission.
`Entry` separates ownership, adverse meanings, payment context, and positive admissibility, per Model the Domain and Type System Discipline.
The one context constructor privately resolves all identities and meanings before deriving `Eligibility`. No caller can supply a filtered positive list.

### Identity and adverse decisions

Gather every valid heading scope for each exact designation before choosing an anchor. Preserve title correlation, full variants, category proof, and gap boundaries.
Retain the existing direct identity requirement. A native observation supplies a candidate name, never proof without an attributable category statement.
Bind complete exact-model statements across all bounded same-source highlights, independently of positive grammar, native inclusion, and 640-character display limits.
Inherited labels and pronouns bind only inside a valid uninterrupted same-product scope. Foreign sections and strong variant qualifiers close inheritance.
Unclassified text never becomes a fact. An ambiguous ownership break ends inheritance, without erasing later independently bound exact statements or matching headings.
Evaluate adverse assertions in every matching scope and every complete exact-model statement. Positive support from secondary scopes does not enter the selected card.
Replace `featureTerms` with one exhaustive `Record<Feature, Descriptor>`. Derive positive patterns and adverse labels from its retained vocabulary and exclusive-wired rule.
All nine current features retain descriptors. Unknown semantics stay unresolved. Never require `Entry.positive` before recognizing or applying an adverse assertion.
One manufacturer rule handles designation prefixes, exact correlated title attribution, and bound `made by` or `manufactured by` statements for both identity kinds.
Known required-feature absence or an exact excluded manufacturer yields `excluded`. Unbound pronouns and clearly foreign assertions cannot produce that verdict.

### Price completeness and packing

A price's applicability region follows the same ownership and boundary records. Own facts, class statements, and internal section labels do not clear conditions.
For a candidate price, inspect relevant retained context on both sides through the uninterrupted same-product region, rather than its immediate neighbors.
Retain all same-model conditions for applicability assessment. Separate scopes do not establish one offer. Unresolved applicability withholds price rather than asserting global truth.
A bound payment condition withholds a standalone price. Unclassified or unresolved relevant context also withholds it, without inventing a conditional offer.
Apply root's narrow pre-heading rule. An unbound trade-in condition immediately before the sole product heading, without an intervening product or gap, withholds price.
A clearly foreign-model condition has a foreign relationship and does not transfer. Conditions across unrelated scopes or gaps do not become product claims.
Keep full contiguous HN sale, was, and savings context as one price block. Keep ordinary singleton prices when their existing evidence contract is complete.
Preserve selected-anchor positive rules and direct complete-statement support. Other scopes cannot add card facts or prices.
Build complete contexts for all safe inputs before product filtering, name deduplication, product caps, or visible packing. These operations only read settled eligibility.
Keep excluded reasons and original spans even if their explanation cannot fit. A packing failure can drop a citation, price, or lead, never revive an excluded lead.
Render quotes from literal contiguous source spans using existing normalization. Never stitch quotations or invent offsets. Existing diagnostic serialization caps remain authoritative.

## Smaller integration and deletion plan

Keep `projectPageEvidence`, its arguments, its returned `sources`, `products`, and `decisions`, and public evidence v2 unchanged, per Boundary Discipline.
Replace first-only `headingScope` with collection of exact identity scopes inside `pageContext`. Migrate both product paths to read that one context.
Delete the cross-highlight `scopedFact` adverse gate, `factsInScope` eligibility checks, duplicate manufacturer decisions, and direct neighbor-only completeness check.
Keep positive predicate recognition as a local positive-only decision. Delete `scopedProduct` once its packing uses the common eligibility result, without a compatibility path.
No new files, independent parser, registry service, event framework, or public stage APIs are needed, per Subtract Before You Add and Laziness Protocol.

## Tradeoffs, alternatives, and red flags

We accept source-local passage storage across the bounded scan in exchange for decisions that cannot lose known negatives during display packing.
We accept withholding ambiguous prices in exchange for never presenting a stripped amount.
An independent adverse scanner loses because callers must reconcile two attribution systems. It hides matching but exposes ownership disagreement and duplicated grammar.
A sequence of extract, assess, and pack services loses because callers must order them correctly and carry internal representations between shallow interfaces.
This design hides those decisions behind the existing single call. Its private interface is one context constructor plus a pure relationship lookup, per Minimize Reader Load.
The red-flag screen finds one owner, one segmentation mechanism, one feature descriptor table, unexported internals, and one eligibility route. Packing cannot mutate interpretation.

## Test obligations and scope limits

Preserve every one of the 97 existing cases. Groups cover 1 through 28 feature controls, 29 through 43 and 68 through 73 adverse controls, 44 through 52 ownership, 53 through 67 conditions, and 74 through 97 contracts, URLs, extraction, history, and citations.
Require all twelve reds to turn green with unchanged inputs and assertions. Pair each with foreign-model, strong-variant, and unbound-pronoun controls in both identity paths.
Extend every feature with omitted-native raw positives and negatives, complete named negatives, all matching scope orders, and negatives after positive inheritance ends.
Exercise conditions before and after prices, across own facts and class statements, before the sole heading, and beside clearly foreign conditions. Preserve singleton and full HN positives.
Exercise maximum scan and display bounds, filled excerpt and product capacity, multiple matching scopes, native omission, historical JBL and HN Teal 800073, and no HN post-gap transfer.
Rerun original adversarial and diagnostic suites, real-SDK local HTTP and Hono route proofs, package checks, cancellation, quota, unknown-charge stop, and diagnostic byte and permission controls.
Inspect desktop and mobile uncertainty and price cards. Preserve official chat UI, immutable snapshots, abandoned-request cancellation, and session isolation, per Test Behavior, Not Implementation.
No authentication, category, API, provider, live-call, stock, delivery, affordability, merchant-offer, or cross-source conflict work belongs here. Cross-source comparison remains Issue #4.
Bounds stay five sources and products, six scanned highlights per source, 16,384 characters per highlight, three visible excerpts per source, 640 characters per excerpt, and three facts per product.

## Synthesis decision, risks, and next step

Root selects the base after independent comparison. This independent candidate claims no synthesis or runtime approval.
Can implementation preserve all existing boundary controls while deleting both eligibility paths? The 97-case suite and added paired controls must answer before live proof.
Static acceptance proves only design consistency, per Prove It Works. It authorizes neither paid research, production actions, nor merging.
After root selection, implement the private source context and delete the duplicate decisions in one owned change, then reproduce and reverify the exact twelve failures.
