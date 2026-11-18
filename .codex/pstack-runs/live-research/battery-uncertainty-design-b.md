# Battery uncertainty from retained facts

The shopper needs to distinguish the Edifier 2025 edition's unknown battery life from ATH's qualified source observation. Keep that distinction in private retained fact records. The existing server-generated `unresolvedConstraints` array carries the visible note. The client renders the note without interpreting quotations.

This is an architectural sketch against `6a478aeb362a1004a316f31da75b873de44ab24b`. No implementation or runtime verification occurred. The configured Luna architectural seat is unavailable on this host, so this candidate uses host inheritance. No model-family comparison is claimed.

## Grounding and sequence

- [x] Ground the existing single-module owner.
- [x] Sketch a private representation and a distinct alternative.
- [ ] Root compares both independent candidates and selects a design.
- [ ] The application owner implements the selected design.
- [ ] Independent reviewers verify observable output.

`SourceContext` owns complete passages, model attribution and adverse assessment. `resolveProposal` admits whole owned quotations selected by native locators. `projectPositive` then applies the three-fact and contiguous-window limits. Today it immediately converts successful claims into public citations, which discards their semantic interpretation. `unresolvedConstraints(preferences)` therefore cannot tell whether any displayed fact establishes a battery-runtime observation.

The current battery recognition is split between `deviceRecord`'s complete qualified battery sentence and two scoped predicate patterns inside `resolveProposal`. Those existing forms can supply a single private meaning. Neither raw native hints nor all source passages should decide the displayed uncertainty. They can contain facts that never survive attribution, selection or packing.

The throughput checkpoint is one module and one observable pair first. Preserve the exact ATH and Edifier replay, add the uncertainty behavior, then run the existing source-boundary and browser gates. Do not expand the accepted grammar while fixing the note.

## Caller-first usage

```ts
const { retainedFacts, price, windows } = projectPositive(
	context, selected, proposals, capacity, decisions,
);
const facts = retainedFacts.map((fact) => fact.citation);
products.push({
	...existingIdentityFields,
	facts,
	price,
	unresolvedConstraints: unresolvedConstraints(preferences, retainedFacts),
});
```

`unresolvedConstraints` adds one note when the user requested a battery comparison and the retained records contain no positive supported battery-runtime observation. Suggested product copy is `Battery life was not established for this model or edition from the retained evidence.` The note describes the research result. It does not claim the product lacks a battery.

For ATH, retain the complete up-to/full-charge/rapid-charge/USB-C quotation and omit the unknown note. Existing global page-observation warnings continue to say that the quotation is unverified. For the Edifier 2025 edition, retain its driver quotation and add the battery note. Existing hard-feature, manufacturer, affordability, stock and delivery notes remain unchanged.

## Private shape

```ts
type FactMeaning = "battery-runtime" | "other";
type OwnedFact = OwnedClaim & Readonly<{ meaning: FactMeaning }>;
type RetainedFact = Readonly<{
	citation: ResearchProduct["facts"][number];
	meaning: FactMeaning;
}>;

type FactInterpretation =
	| Readonly<{ kind: "admissible"; meaning: FactMeaning }>
	| Readonly<{ kind: "unrecognized" }>;

function interpretFact(predicate: string): FactInterpretation {
	throw new Error("not implemented");
}

function unresolvedConstraints(
	preferences: Preferences,
	retainedFacts: readonly RetainedFact[],
): string[] {
	throw new Error("not implemented");
}
```

Change `ResolvedProposal.facts` to `readonly OwnedFact[]`. Keep `OwnedClaim` unchanged for prices. Keep `RetainedFact` private to `page-evidence.ts` and construct one only after `pack` succeeds. `projectPositive` returns those records instead of a public `facts` array plus a separately maintained flag or set. Its quotation ordering reads `retainedFacts.map(fact => fact.citation.quote)`. The final product assembly strips the private meaning by selecting only each citation.

Do not spread an `OwnedFact` into a public citation or product. The existing `citation` helper explicitly selects `sourceId` and `quote`, so public v2 validation stays strict and unchanged.

## One interpretation owner

Replace the local boolean-only `admissibleFact` with `interpretFact`. Preserve all existing admission cases and the existing complete exact-direct-quote fallback. The direct fallback becomes an `other` fact unless the same whole-predicate battery recognizer establishes a runtime observation. A full negative quotation may still be published under existing policy, but it is `other` and cannot clear battery uncertainty.

Name the existing battery patterns together in the same private module. The set contains the existing qualified device sentence, the existing `Battery` or `Runtime` label form, and the existing `Has`, `Have` or `You get` runtime form. Keep their roles explicit. `deviceRecord` uses only its existing qualified-device member, so completion and ownership do not become more permissive. `interpretFact` uses the existing scoped members and the existing device member to identify the positive runtime meaning. There is no new permissive contains-battery regex and no second ownership pass.

Classify candidates after `ownership` returns `own` and before native locator matching. Store the interpretation alongside that candidate so matching does not re-run semantic recognition for every hint. Preserve the current full-quotation negative guard, unique whole-passage match rule, title/identity consistency veto and source support requirements. No battery interpretation can bypass those gates.

The existing whole forms already reject negative, conditional and questioned runtime text because they require a positive complete anchored record. Preserve `deviceRecord`'s current negative and condition rejection. A qualitative `long battery` feature, a charge-time-only claim, an unsupported direct sentence, or a native duration without source proof does not become a comparable runtime observation.

## Requested and applicable

A product in the existing `headphones` or `laptops` category needs the runtime note when `soft.priorities` contains `battery-life`. Also treat a required `long-battery-life` or `long-battery` constraint as a battery request, including API callers whose soft priorities were not populated by the conversational parser. Keep the existing hard-feature independent-verification note in that case. A qualitative long-battery claim does not establish a duration.

When no battery request exists, do not add a new battery note. No new preferences or public fields are required. A future category must receive an explicit applicability decision rather than inherit a headphone default.

## Packing behavior

There is one record collection for the facts that the user can inspect. A fact enters `retainedFacts` only after the current deduplication, three-fact bound and atomic support packing pass. An omitted native proposal, ambiguous locator, clipped or foreign passage, missing full support, over-640 support, or exhausted capacity never creates a retained battery record. Uncertainty therefore follows displayed evidence even when useful source text existed earlier.

A repeated observation of the same quotation does not add a second fact or consume a second slot. Use the current quote deduplication rule. The meaning comes from the same owned predicate, so no separate mutable observed flag needs synchronization with the deduplication result.

## Deletions and scope

Delete the old boolean `admissibleFact` after migrating its sole matching caller. Delete the old public `facts` accumulator in `projectPositive`, replacing it with `retainedFacts`. Remove the two existing standalone scoped battery-pattern entries when they move into the named shared pattern set. Preserve all other predicate patterns, decisions and output ordering.

A reviewer previously identified unused `Scope.identity` and `Scope.text`. Their removal is compatible but not required for this battery correction. Do not mix a broad parser cleanup into this change.

No public schema, historical decoder, Exa request, query, system prompt, source bound, native field, captured value, auth module or normal fixture composition changes. No price, inventory, merchant offer or sound-quality ranking is introduced.

## Alternative considered

A smaller signature change could keep public facts in `projectPositive` and return an additional `batteryObserved` boolean. It could set the boolean only in the successful pack branch. That solves today's pair with fewer type edits, and it is a reasonable choice if root prioritizes the smallest patch.

This candidate instead keeps the fact's meaning with the fact that survived packing. The next contributor cannot remove or replace a public fact while accidentally leaving its observed flag true. It also avoids a loose boolean whose name could later be mistaken for verified performance. This design adds two small private record types and changes one private result field. It does not introduce a registry, public assessment contract or generic preference engine.

Computing uncertainty from every owned source passage is rejected. A known source fact may be omitted from native proposals or fail display packing. Computing it from public quotation text is also rejected. That repeats recognition after private semantic context has been discarded and invites a client implementation.

## Verification obligations

Drive the existing actual SDK against loopback and Hono boundary with fake credentials and live composition disabled. Assert public output rather than private helper calls.

1. Replay all sixteen captured fields without modification. ATH retains its complete qualified battery claim and lacks the unknown note. Edifier 2025 retains its pre-gap driver, has no 80-hour battery claim, and includes the unknown note. HN's full sale context and identity-only source behavior remain unchanged.
2. Omit only the native battery locator while keeping the source battery statement. The ATH result must retain its other admissible evidence and report battery uncertainty.
3. Use existing positive label and named runtime forms for a headphone and a laptop. Each full owned, retained positive removes the unknown note. Its negative, questioned, conditional, foreign-model and post-gap counterpart does not.
4. Force a genuine battery support interval beyond 640 characters, or a fourth fact after three accepted facts. Preserve the actual source text and demonstrate that packing drops the battery claim while the note remains. Keep a corresponding within-limit positive control.
5. Supply qualitative long-battery and charge-time-only source text. Neither establishes runtime. Supply no battery request and require no extra battery note. Supply the hard battery requirement without a soft priority and require the note when runtime is absent.
6. Keep all 505 valid historical assertions unchanged, with the same three adjudicated obsolete originals recorded separately. Run current unit, type, build and targeted browser checks. Independent QA must inspect the actual Edifier note and ATH qualifiers through the delegated comparison UI at desktop and mobile sizes.
7. Validate strict public v2 output with no private meaning fields. Preserve the full supporting windows, same-source citations, unverified stock, cancellation and zero extra request behavior.

These are required checks, not results of this design task. No tests, servers, paid requests, database operations, environment reads, ledger reads or GitHub actions ran.

## Principles that changed the design

Model the Domain kept meaning on each retained fact instead of synchronizing a second observed flag. Boundary Discipline kept interpretation in the existing server boundary and stripped private fields before public assembly. Laziness Protocol kept one module, the existing uncertainty array and the existing accepted grammar. Test Behavior, Not Implementation made the required checks assert quoted output and user-visible uncertainty after SDK and Hono processing.
