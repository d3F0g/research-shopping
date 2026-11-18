# Adverse evidence boundary decision

The shopper needs genuine Exa research that does not hide known hard negatives, excluded manufacturers, or payment conditions. The maintainer needs one private owner for source attribution and eligibility. Select Candidate A's exact-subject decision and bounded adverse ledger. Graft Candidate B's shared source passage context into that design. Keep the adapter's single projection call and ordinary evidence v2 output unchanged.

This is an independent static selection against `ef1df5c774164201b1a6577f02a9c26536fd9184`. The inspected checkout at `/Users/josiahwong/Documents/research-shopping-exa-primary` reports that HEAD. No implementation, tests, providers, servers, databases, credentials, or GitHub operations ran in this task. This decision is not runtime, security, live-quality, or merge approval.

The candidates used Astra and host inheritance because Luna was unavailable. The root model family is unknown. This review makes no blind-review or diverse-family claim.

The evidence comes from the complete [brief](/tmp/research-shopping-live/adverse-evidence-brief.md), [Candidate A](/tmp/research-shopping-live/adverse-boundary-design-a.md), [Candidate B](/tmp/research-shopping-live/adverse-boundary-design-b.md), [independent report](/tmp/research-shopping-live/page-correction-independent-security/REPORT.md), and all 97 rows of [the recorded controls](/tmp/research-shopping-live/page-correction-independent-security/independent-variants-controls.json). The latter contains 83 recorded SDK and route executions and 14 contract-only rows. It is not 97 independent live searches. Its recorded outcome is 85 passes and 12 failed expectations. Eleven failures establish blockers. Root has explicitly adopted the twelfth expectation, the pre-heading trade-in case, as the required conservative price policy. None may be relabeled as passing.

The later [manufacturer-polarity probe](/tmp/research-shopping-live/root-manufacturer-polarity-probe.json) adds one observed failure among four synthetic local controls. The direct path wrongly drops `Aster Wave 2 is not made by Bose.` when Bose is excluded. Both designs need the polarity correction below.

## Why A is the base

Scores describe the written designs before the required synthesis. Five means the design directly encodes the obligation. They are judgments about structure, not measured correctness.

| Criterion | A | B | Evidence and implication |
| --- | ---: | ---: | --- |
| Interface depth and unchanged owners | 5 | 5 | Both hide interpretation behind one existing call and retain the adapter, quota, diagnostics, and v2 contracts. |
| Exact ownership and all matching scopes | 4 | 5 | B explicitly shares source passage relationships. A leaves more room to repeat ownership inside positive projection. Graft that shared representation. |
| Eligibility independent of positive projection | 5 | 3 | A requires an assessed eligible subject and hides positive predicates lexically. B's general `Entry.positive` field remains an attractive adverse-filter input. |
| Whole-context price ownership and uncertainty | 4 | 4 | Both reject adjacency as proof. Both still need precise region handling and paired foreign-condition tests. |
| Exhaustive negatives, manufacturer policy, and useful positives | 4 | 4 | Both cover nine features and historical controls. Neither explicitly specifies manufacturer assertion polarity. |
| Small footprint and deletion of competing paths | 4 | 3 | A retains bounded witnesses and a small permission boundary. B stores overlapping entry meanings, model contexts, relationships, and price state. |
| Total | 26 | 24 | A needs one focused representation graft, not B's complete context model. |

The present coupling is visible in `page-evidence.ts` at lines 190, 207, and 214. The direct path has separate exclusions at lines 314 through 322 and adjacent-only price checks at lines 301 through 305. `headingScope` returns its first match at line 120. These are the decisions to replace. Another keyword addition to `scopedFact` cannot repair their shared premise.

## Accepted private shape

The adapter usage stays exactly one call.

```ts
const { sources, products, decisions } = projectPageEvidence(inputs, observations, preferences);
```

At that boundary, an omitted native negative still excludes its proven subject. An own fact between the amount and a retained condition still yields `price: null`. Missing native extraction can still produce a valid heading identity with no facts or price.

The following is a private sketch, not additional public API. All new declarations stay in `src/server/page-evidence.ts`. `Source`, `Passage`, `NativeObservation`, `Feature`, `Preferences`, and research output types retain their existing owners.

```ts
type Span = Readonly<{
	part: number | "title";
	start: number;
	end: number;
}>;
type Anchor =
	| Readonly<{ kind: "heading"; identity: Span; scope: Span }>
	| Readonly<{ kind: "direct"; identity: Span }>;
type SubjectProof = Readonly<{
	name: string;
	selected: Anchor;
	anchors: readonly [Anchor, ...Anchor[]];
}>;
type SourcePassage = Readonly<Passage & {
	highlight: number;
	region: number;
}>;
type SourceContext = Readonly<{
	source: Source;
	passages: readonly SourcePassage[];
	subjects: readonly SubjectProof[];
}>;
type Ownership =
	| Readonly<{ kind: "own"; basis: "exact-statement" | "valid-scope"; predicate: string }>
	| Readonly<{ kind: "foreign" }>
	| Readonly<{ kind: "unresolved" }>;
type PriceGate =
	| Readonly<{ kind: "unobstructed" }>
	| Readonly<{
		kind: "withheld";
		reason: "owned-condition" | "unresolved-context" | "incomplete-block";
		witness: Span;
	}>;
type AdverseLedger = Readonly<{
	absentFeatures: Readonly<Record<Feature, Span | null>>;
	excludedManufacturer: Span | null;
}>;
const eligibleSubject = Symbol("eligible-subject");
type EligibleSubject = Readonly<{
	[eligibleSubject]: true;
	proof: SubjectProof;
	price: PriceGate;
}>;
type SubjectDecision =
	| Readonly<{ kind: "excluded"; proof: SubjectProof; ledger: AdverseLedger }>
	| Readonly<{ kind: "eligible"; subject: EligibleSubject; ledger: AdverseLedger }>;

function sourceContext(source: Source, native: readonly NativeObservation[], prefs: Preferences): SourceContext {
	throw new Error("not implemented");
}
function ownership(context: SourceContext, subject: SubjectProof, passage: SourcePassage): Ownership {
	throw new Error("not implemented");
}
function assessSubject(context: SourceContext, subject: SubjectProof, prefs: Preferences): SubjectDecision {
	throw new Error("not implemented");
}
function projectPositive(context: SourceContext, subject: EligibleSubject, native: readonly NativeObservation[]): Pick<ResearchProduct, "facts" | "price"> {
	throw new Error("not implemented");
}
```

The context stores bounded source passages and exact identity anchors. It has no positive-admission flag, generic entity registry, adverse event list, or duplicated semantic cache. `region` records the existing source boundary decisions. It is not a claim that all text in a region belongs to one product. Both consumers use the same `ownership` rule over those passages.

`assessSubject` receives the complete retained source context and subject proof. It cannot receive a filtered fact list or a native quotation list. Only that function constructs the active `eligibleSubject` property after assessment. `projectPositive` requires that value, and product assembly occurs only in the eligible branch. The symbol is used in actual construction and signatures. Do not add unused type assertions, artificial failing assignments, casts, TypeScript suppressions, or lint suppressions to demonstrate it.

Positive predicates remain inside `projectPositive`. Shared ownership, source segmentation, feature vocabulary, and literal price-block grammar remain neutral. There must be one ownership implementation and one segmentation mechanism. A second complete-subject classifier hidden inside the positive projector would defeat the graft.

## Required interpretation rules

Assessment is keyed by exact designation within one source. Enumerate every valid matching heading and independently complete exact-model statement before choosing the publication anchor. Preserve full variants, title correlation, category proof, mixed-category rejection, and forbidden identities. The 640-character publication window cannot discard an anchor before adverse assessment. Intrinsic identity limits remain intact.

Ownership does not require a publishable positive predicate. A complete exact-model negative can bind across retained highlights even when extraction omitted it. Longer variants, a second subject, comparisons, foreign-target qualifiers, and unrelated model statements cannot become own evidence through a prefix match. Scoped labels and pronouns bind only inside a valid uninterrupted same-product scope. An ambiguous unmarked label ends inheritance. A later independently complete exact statement remains assessable, and a fresh valid matching heading can establish another scope.

Assess all matching scopes. Adding another matching scope with an owned negative can only remove eligibility. Reordering matching scopes cannot change eligibility. A Pro scope, unrelated model, or unbound pronoun cannot invalidate the base model. Secondary scopes supply adverse evidence only. They do not supply new positive card facts or prices.

Use one schema-derived `Record<Feature, Descriptor>` for all nine existing features. Retain every existing negative form, typed label value, and exclusive-wired rule. Positive grammar may reuse vocabulary, but neither direction may reuse the other's admission result. Unknown semantics stay unknown. They cannot prove a feature, its absence, or hard-constraint satisfaction.

Use one manufacturer policy for heading and direct identities. It includes exact designation prefixes, the existing exact title-manufacturer relationship, and affirmative owned `made by` or `manufactured by` assertions. A substring match is insufficient. Negated, hypothetical, interrogative, or ownership-ambiguous statements do not prove the excluded manufacturer. Recognizing `is not made by Bose` does not establish another manufacturer or clear the unresolved-identity disclosure.

For `excludedBrands: ["Bose"]`, the four recorded controls must return these results in both identity paths.

| Statement | Required product count |
| --- | ---: |
| No manufacturer statement | 1 |
| `Aster Wave 2 is made by Bose.` | 0 |
| `Aster Wave 2 is not made by Bose.` | 1 |
| `Orbit Quiet is made by Bose.` | 1 |

Pair the same polarity tests with `manufactured by`. These obligations concern bounded recognized assertions, not arbitrary-language inference.

A price needs its full relevant bounded context. Inspect both sides of its candidate region. Own facts, category statements, and harmless internal headings do not reset a condition. Explicit same-model conditions elsewhere in the retained source must participate. If another matching scope leaves offer applicability unresolved, withhold price without merging offers. A clearly foreign-model condition does not transfer. Unbound text in an unrelated highlight or beyond an established gap does not become a product condition.

Apply root's precise pre-heading decision. Unbound trade-in text immediately before the sole heading, without an intervening product or gap, withholds the standalone price. A paired clearly foreign-model condition cannot itself invalidate an otherwise complete own price. Keep the condition's literal source context without asserting a current conditional offer.

`unobstructed` permits positive consideration only. The selected price must still match a complete literal singleton or the existing sale/was/savings block, satisfy native inclusion, and fit its citation. Unknown relevant context, clipping, ambiguous multiple amounts, accessory applicability, or a native substring cannot produce a standalone amount. Preserve HN's full `S$ 349 was S$ 499 SGD You Save S$ 150` block. Do not calculate an amount, savings, rank, affordability, inventory, or delivery.

Fold the complete bounded assessment before name deduplication, product caps, and excerpt packing. One witness per feature and one excluded-manufacturer witness bound retained adverse state without limiting the scan. Price withholding is absorbing for relevant obstructions. A dropped diagnostic or full excerpt slot cannot revive a candidate. Eligibility is order-independent even if the retained diagnostic witness changes with source order.

Keep source assessments separate across URLs. Display deduplication follows source-local decisions. This correction does not resolve cross-source identity or conflict policy, which remains Issue #4. Preserve literal spans and normalize contiguous source text only. Do not invent offsets or stitch quotations.

## Grafts, rejections, and deletion contract

The sole representation graft from B is the invocation-local source passage context and common ownership result. It gives A one attribution mechanism for adverse assessment, positive projection, and price regions. Retain A's bounded ledger, active eligible branch, and lexical separation of positive grammar. This is one subject-assessment design, not both candidate implementations running together.

Reject B's stored `Entry.positive`, per-entry adverse arrays, generic model-key map, and overlapping relationship representation. Those structures are unnecessary for this bounded correction and expose more state to keep consistent. Reject A's proposed unused compile-time misuse assertions. The actual eligible parameter and normal typecheck must enforce the chosen boundary. Both candidates' manufacturer rules need the polarity correction above.

The application owner changes `src/server/page-evidence.ts` and focused evidence tests. The ordinary output contract, SDK adapter call site, quota facade, diagnostic writer, auth/history codecs, source blobs, and official chat UI retain their contracts. New reason codes remain private diagnostics.

The replacement must delete these competing decisions in the same change.

1. Replace `headingScope`'s first-match return with complete source-local identity enumeration. Separate display packing failure from assessment eligibility.
2. Delete `scopedProduct`'s eligibility role, including `factsInScope`-based negative admission, its cross-highlight `scopedFact` gate, and its separate manufacturer decision. Delete the old wrapper after migrating publication.
3. Delete direct-path `modelStatements` exclusion and manufacturer decisions. Replace the unanchored `made|manufactured by` substring check with the shared assertion rule.
4. Delete the direct `completePriceContext` immediate-neighbor proof. Whole retained relevant context decides the price gate.
5. Delete the direct path's separate statement splitting and ownership classifier after callers use the common passage representation. Preserve literal containment and complete positive-quotation checks in the positive projector.
6. Consolidate `featureTerms`, label negatives, and exclusive-wired semantics into the exhaustive descriptor owner. Move positive-only predicates out of adverse reach. Keep the useful identity and price grammars.
7. Remove early product-count and name-dedup exits that skip assessment. Apply the existing output caps after all bounded source-local decisions.

No legacy route, feature flag, fallback parser, public sequence of stages, new module hierarchy, generic entity/event framework, additional model, retry, fetcher, SDK operation, auth work, category expansion, or provider change belongs in the patch.

## Exact proof contract

Preserve the original 97 inputs and assertions. Copy scripts to a fresh evidence directory because their current output paths overwrite their owned artifacts. Reproduce the baseline failures and turn all 12 green. Preserve the 85 controls. The additional manufacturer-polarity failure must turn green with its three paired controls intact.

| Existing rows | Required retained behavior |
| --- | --- |
| 1 through 28 | Singleton positive and all nine feature positives, omitted negatives, and beyond-window negatives. |
| 29 through 43 | Six omitted exact negatives, two manufacturer assertions, second matching scope, foreign-model controls, and separate Pro scope. |
| 44 through 52 | Foreign specification suffixes, unmarked competitors, foreign section labels, variants, gaps, and related-product boundaries. |
| 53 through 67 | Twelve existing qualifier rejections and all three separated or leading-condition null prices. Row 67 is root's adopted policy. |
| 68 through 73 | Direct negative/manufacturer exclusions and reversed matching-scope exclusion. |
| 74 through 90 | Strict v2, nested strictness, unsafe URLs, and invented quotation rejection. |
| 91 through 97 | Exactly JBL and HN identity-only survival on incomplete extraction, source-only fallback, citation containment, and same-source integrity. |

Add a fixture table keyed by all `FeatureSchema` options, independently authored from production matchers. For each feature, cover raw positives and negatives omitted from extraction, named negatives in both identity paths, valid scoped labels and pronouns, unrelated models, longer variants, and unbound pronouns. Raw positives omitted from extraction retain identity and uncertainty. They do not become native-backed published facts.

Cover every retained negative vocabulary form and exclusive-wired form. Test three matching scopes and their permutations, negatives after inheritance boundaries, and complete exact statements beyond the public window. Exercise six-highlight and 16,384-character scan boundaries, three excerpt slots, 640-character windows, three facts, five source/product limits, and duplicate ordering. No cap may erase already retained adverse evidence. Do not expand the scan or paid request bounds.

For price, insert own facts, class statements, and harmless headings between each existing condition and its amount. Cover leading, trailing, and cross-highlight exact-model conditions. Pair them with explicitly foreign conditions, gaps, unrelated unbound context, genuinely unconditional heading/direct singleton positives, and complete HN sale context. Unknown relevant context remains null. No test may define an amount as unconditional merely because its condition missed a positive grammar.

Replay the actual normalized historical capture with valid and incomplete extraction. Preserve JBL identity and the exact HN Teal `800073` designation. Preserve HN's complete price context with valid native quotation and no post-gap specifications. Preserve conditional or ambiguous Shop context and the mixed Bose/guide declines. Keep complete typed positive clauses, literal quotation containment, and clipping controls. Synthetic examples alone do not establish historical usefulness.

Rerun the existing 24 adversarial, 16 diagnostic, three direct-price, three cross-highlight, and nine additional diagnostic probes. Run the expanded evidence cases through the real SDK against local HTTP and the Hono route, with live composition disabled. Inspect assertions and outcomes rather than relying on exit status. Package checks remain necessary.

Fresh independent reviewers must pin base, candidate head, commands, evidence, and verdict. Runtime QA must inspect desktop/mobile uncertainty and price cards, chat history, theme persistence, preference changes, session isolation, and abandoned-request behavior. Security verification must recheck real upstream abort, one search and one settlement, unknown-charge stops, provider failure without fixtures, safe source navigation, diagnostic privacy/permissions/byte bounds, and unchanged merchant-link policy. The existing reports do not approve the new implementation.

The source bounds stay five sources/products, six highlights per source, 16,384 characters per highlight, three visible excerpts per source, 640 characters per excerpt, and three facts per product. Freeze every existing negative and usefulness limit. Output remains strict `evidenceVersion: 2`, with unverified stock, unresolved constraints, and no commerce execution.

## Implementation handoff and limits

Root assigns a fresh application owner in an isolated worktree. That owner implements this private shape and the deletion contract as one coherent correction. Root then integrates the reviewed parent delta into the pending auth/history work without changing frozen codecs or source blobs. Any changed integrated head receives fresh exact-head gates.

One initial-budget live proof remains after offline and independent gates. The brief reports one prior actual call at US$0.007 under the initial two-call allowance. This decision consumes none and authorizes no additional paid operation. Root owns the reserved proof and all merge decisions.

The remaining implementation risks are complete-clause ownership, unknown text at region boundaries, offer applicability across matching scopes, and literal-span preservation during normalization. The paired tests above must resolve them. Bounded returned excerpts cannot establish arbitrary natural-language truth, missing page content, current offers, inventory, delivery, or comprehensive cross-source consistency.

Ground, comparison, and the static synthesis are complete. Implementation and runtime verification remain unexecuted. Static acceptance selects the design only.

The following read principles changed material decisions.

| Principle | Decision it changed |
| --- | --- |
| Attack the Premise | Removed positive admissibility and immediate price adjacency as prerequisites for adverse assessment. |
| Model the Domain and Type System Discipline | Chose an exact source-local subject decision and an actively consumed eligible value. |
| Redesign from First Principles | Integrated B's shared ownership representation into A instead of retaining two parsers. |
| Boundary Discipline | Kept one private pure projection call and unchanged SDK, quota, history, and v2 contracts. |
| Laziness Protocol and Minimize Reader Load | Rejected B's overlapping semantic caches, generic maps, and A's unused assertion scaffolding. |
| Subtract Before You Add | Required deletion of both old eligibility implementations and the neighbor-only price proof in the replacement change. |
| Encode Lessons in Structure | Required the exhaustive feature descriptor and a positive projector that cannot accept an unassessed subject. |
| Test Behavior, Not Implementation | Preserved exact public outcomes, historical positives, polarity controls, and real transport effects. |
| Prove It Works | Kept the candidate blocked and separated this static decision from runtime, security, live-proof, and merge approval. |
