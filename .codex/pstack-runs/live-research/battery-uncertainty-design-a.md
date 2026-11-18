# Battery uncertainty follows retained facts

The shopper needs genuine product leads and a concise sound and battery comparison. Each lead must state when its retained evidence does not establish battery life. This sketch keeps that decision inside `src/server/page-evidence.ts` and preserves public v2.

Grounded against `6a478aeb362a1004a316f31da75b873de44ab24b` through `git show`. No implementation, runtime, provider call, or repository mutation was performed.

## Caller's view

The external caller keeps its existing `projectPageEvidence(inputs, observations, preferences)` call. It receives the existing product `unresolvedConstraints` array. The client renders those strings in its per-product comparison disclosure without interpreting quotations.

Inside the private module, product assembly receives all evidence-dependent product fields from one projection call.

```ts
const { facts, price, windows, unresolvedConstraints } = projectPositive(
	context, selected, proposals, 3 - source.highlights.length, preferences, decisions,
);

products.push({
	id, name, identity, facts, price, stock: "unverified", unresolvedConstraints,
});
```

For requested `battery-life` in `headphones` or `laptops`, a product without a retained positive battery fact gets `Battery life is not established by the retained evidence`. ATH's retained full qualified battery quotation suppresses only this missing-evidence note. It remains an unverified source observation. Edifier 2025 gets the note while preserving its driver quotation and exact edition. When battery is not a requested priority, do not add this note. Keep hard-feature verification notes independently.

## Private shape

```ts
type FactKind = "battery-life" | "other";
type ResolvedFact = OwnedClaim & Readonly<{ kind: FactKind }>;
type ResolvedProposal = Readonly<{
	identity: EligibleSubject;
	facts: readonly ResolvedFact[];
	price: (OwnedClaim & {
		kind: NonNullable<ResearchProduct["price"]>["kind"];
	}) | null;
}>;
type PositiveProjection = Readonly<{
	facts: ResearchProduct["facts"];
	price: ResearchProduct["price"];
	windows: string[];
	unresolvedConstraints: string[];
}>;

function recognizeFact(predicate: string): FactKind | null;
function unresolvedConstraints(
	preferences: Preferences, retainedFacts: readonly ResolvedFact[],
): string[];
function projectPositive(
	context: SourceContext, selected: Anchor,
	proposals: readonly ResolvedProposal[], capacity: number,
	preferences: Preferences, decisions: EvidenceDecision[],
): PositiveProjection;
```

These signatures are a sketch, with bodies not implemented. `OwnedClaim`, source completion, ownership, support, adverse assessment, and price semantics remain unchanged. `ResolvedFact` adds meaning only to resolved facts. Price claims do not receive battery metadata.

Replace the existing boolean `admissibleFact` decision with `recognizeFact`. Keep its grammar in this module. Reuse `deviceRecord(predicate) === "battery"` for the complete qualified ATH form. Give the existing affirmative battery-runtime label and `Has/Have/You get` runtime patterns their battery meaning at their original recognition site. Keep the remaining accepted predicate forms as `other`. Existing affirmative long-battery feature forms can carry battery meaning through the same feature descriptors. Negative forms remain `other`, including false and unavailable labels. Do not duplicate the runtime expression in a second battery parser.

The existing direct exact-quotation admission remains. Apply the same recognizer to its already-owned predicate. An exact direct statement that does not match a supported affirmative battery form remains an admissible `other` fact. Mere occurrence of the word battery cannot clear uncertainty. This deliberately preserves evidence while declining unsupported semantic inference.

`resolveProposal` attaches the classification only after complete passage, ownership, source-support, native-locator, and ambiguity checks. No source-wide scan can count as displayed evidence. Keep the existing control-statement exclusion and all native-name vetoes.

In `projectPositive`, replace the mutable public `facts` accumulator with one private `retainedFacts: ResolvedFact[]`. Append only after the existing fact limit, duplicate handling, and atomic `pack` acceptance. Derive public citations and unresolved constraints from that same retained collection. Do not add a separately synchronized `hasBattery` flag or topic set. Failed packing, missing native proposals, and excess facts therefore cannot count as observed battery evidence. Existing quote text and support windows are unchanged.

The public interface stays unchanged. Its private projection result gains the already-public uncertainty strings, which removes the caller's independent uncertainty decision. The next maintainer finds fact admission, meaning, retention, and uncertainty within the same existing module.

## Evidence and rationale

At the pinned commit, `page-evidence.ts:32` derives uncertainty from preferences alone. Lines 464 through 540 resolve complete owned claims. Lines 486 through 503 already recognize runtime predicates, and line 231 recognizes the qualified battery sentence. Lines 543 through 574 pack retained evidence. Line 615 combines those facts with a preference-only uncertainty result. That last separation is the missing relationship.

Independent QA records the Edifier omission and ATH's full supported battery projection in `/tmp/research-shopping-live/native-alignment-independent-qa/review.md`. The selected native-alignment decision requires complete mandatory support and refuses omitted-native positives. This design preserves both requirements.

Model the Domain changed the data choice from a standalone battery boolean to meaning attached to each resolved fact. Laziness Protocol kept one private module, one retained collection, and the existing string array. Boundary Discipline kept semantic recognition on owned server evidence. Prove It Works requires testing the actual retained projection and inspecting the comparison, rather than treating successful classification as proof of visible evidence.

## Alternative considered

A structurally different option leaves resolved claims unchanged and calculates battery coverage after projection. It joins each public quotation back to `SourceContext` and reruns ownership and classification. That option avoids fact metadata but creates a second semantic pass and couples uncertainty to text joins. It also makes it easy to count a source assertion whose mandatory support was never retained. The recommended shape keeps the claim's classification beside its evidence until packing has decided retention.

Root owns synthesis across independent candidates. This artifact neither reads nor judges candidate B.

## Deletions and tradeoffs

- Delete the old boolean `admissibleFact` wrapper when its callers use `recognizeFact`. Preserve its accepted grammar, including admitted non-positive facts.
- Delete the separate public-fact accumulator. Derive public facts from retained resolved facts.
- Delete the preference-only call at product assembly. The projection now returns the final strings.
- Accept a small private fact annotation in exchange for avoiding quote reparsing and synchronized state.
- Accept conservative unknown results for unsupported direct wording. Preserve that exact quotation as evidence without claiming that the server understood battery life.
- Keep existing packing order and all bounds. Do not reorder products or make battery statements displace price or other facts in this change.

## Required verification

1. Reproduce the exact Edifier missing-note case and preserve all sixteen captured field hashes. Replay the unchanged captures locally. Require Edifier's full edition and driver quote, its battery note, and the absence of the post-gap 80-hour claim. Require ATH's complete qualified battery quote and full supporting window, with no missing-battery note and no verified-duration claim.
2. Pair retained affirmative runtime labels, scoped runtime sentences, exact direct supported runtime sentences, and qualified device-record battery sentences with absent-native, rejected-native, failed-support-packing, fact-limit, and duplicate cases. Only a retained admissible positive fact clears the note. Test the existing affirmative long-battery forms if classified as battery facts.
3. Require the note for foreign or variant claims, negated assertions, false labels, conditionals, questions, unsupported wording, and context lost across gaps. Preserve hard-negative exclusion tests. A gap cannot regain ownership merely because a battery word follows it.
4. Cover both supported categories, no battery priority, and battery priority alongside hard long-battery requirements. Keep hard-feature, stock, and affordability notes. Check the maximum preference shape against the unchanged sixteen-note public limit. Twelve required features plus brand, budget, stock, and the new battery note total sixteen.
5. Use the actual projected response in independent desktop and mobile browser QA. Open the per-product comparison disclosure and inspect the explicit Edifier note and intact ATH evidence. Preserve history, theme, source-link, and cancellation checks required by the frontend change.

No test execution or runtime acceptance is claimed here. The first implementation step is to replace the private fact recognizer's boolean result with its meaning, then derive uncertainty from the successfully retained facts.
