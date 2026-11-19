# Fieldnote V2 comment and maintainability review

The goal is a useful, simplified Exa-only shopping conversation. This read-only review checks active code for narrating comments, unnecessary compatibility, suppressions and dead workarounds.

Reviewed base `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11` and head `d858ca7a3d7be0d356c3b26848f708ed90c0b7bb` in `/Users/josiahwong/Documents/research-shopping-v2`. Findings apply only to that head.

Verdict is cleanup requested for one dead expression. No comment deletion is requested. This is not runtime, security or product acceptance.

## Exact cleanup target

- MUST KILL `amount`'s `/k$/i` multiplier at `src/domain/turn-reducer.ts:6`. Every call at lines 16 and 22 receives a capture from the digits, commas and decimal-only `number` pattern at line 10. The enclosing patterns require a delimiter after the number. Those captures cannot end in `k`. Moreover, `Number("10k")` would produce `NaN` before multiplication. Delete `* (/k$/i.test(value) ? 1000 : 1)`. Do not introduce shorthand parsing as part of cleanup. This removes unreachable implied behavior without changing supported inputs.

Deletion recommendations are one dead expression and zero comments. Applied deletions are zero. No architect sketch is needed for this direct deletion. Minimize Reader Load shaped this choice by removing an apparent parsing capability that callers cannot supply.

## Protected exceptions and skips

- Keep `evals/v2/projection.ts:12-13`. The comment identifies a real frozen contract limitation. The frozen `Intent` requires `budget.amount` and a string region, while V2 permits a lower-only budget and a null region. The active projection preserves missing values. `evals/v2/tests/integrity.test.ts:35-42` explicitly asserts this behavior. The historical grader compares or hashes these fields rather than calling string methods on region. The parent explicitly protects historical contracts and grading as immutable evidence. This is a constrained bridge to that frozen protocol, not a dormant alternate runtime.
- The associated `as Intent` assertion at `evals/v2/projection.ts:14` is deliberate adaptation to that frozen contract. It is not a lint or TypeScript directive suppression. The mismatch is visible and covered by the named test. Do not manufacture defaults or alter frozen source to remove it cosmetically.
- `src/client/theme-provider.tsx:34` is unchanged in the scoped diff. The only changed line in that file updates theme color values. Its storage-failure comment is outside this cleanup's changed lines.
- All 18 official component files match the SHA-256 values recorded in the candidate's `src/client/components/registry-provenance.json`. No cosmetic edits to generated components are requested.
- Frozen historical evaluations, artifacts, proposals and baselines remain protected. Historical validators and the descriptive cross-contract scorecard have active callers. They are not deletion targets.
- Frozen workspace schemas, pending drafts, explicit fixture composition, disabled production dispatch and conservative reservation bookkeeping were not treated as workarounds. No private environment, credential, ledger or existing database was read.
- Known price-evidence and held-response fixes assigned to other owners are outside this report's recommendations. Later commits require a delta review.

Restored comments are zero. No application, configuration, test, evaluation or documentation file was modified. The only file written is this report.

## Evidence and limits

The scoped source, configuration, test and active evaluation paths contain 101 changed filenames, including deletions and package metadata. Inspection used `git diff --name-status`, scoped actual diffs and `git show` at the pinned head. Comment and suppression searches covered changed active files. The only added comment is the two-line projection comment discussed above. No `eslint-disable`, `@ts-ignore`, `@ts-expect-error` or equivalent directive suppression was found in that active scope.

Direct reads traced the projection into frozen contracts and grading, all callers of `amount`, active evaluation report and scorecard use, client conversation state, server preparation and research execution, workspace persistence and quota structure. Official component hashes were calculated directly from pinned Git blobs and compared with the pinned manifest. This verifies local provenance consistency, not an independent download from the registry.

No application tests, browser journeys, live Exa calls, database commands, builds or CI workflows were run. The integrity test above was inspected, not executed. Runtime and security acceptance remain with their independent reviewers. No GitHub mutation, push, merge or deployment was attempted.
