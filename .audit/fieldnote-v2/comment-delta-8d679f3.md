# Fieldnote V2 CommentSicko delta review

The goal is a useful, simplified Exa-only shopping conversation. This review checks the assigned delta for narrating comments, dead compatibility, suppressions and workarounds.

Reviewed base `d858ca7a3d7be0d356c3b26848f708ed90c0b7bb` and head `8d679f3a82663c4fc4b8d3533c0ea15ad000ce6d` in `/Users/josiahwong/Documents/research-shopping-v2`. All application reads used pinned Git blobs or the pinned diff. Working-tree changes and other branches were not inspected.

Verdict is PASS for this comment and cleanup delta only. There are no new MUST KILL refactor targets or comment deletion candidates. This does not approve product behavior, price correctness, security, runtime or visual acceptance. The parent's separately assigned cross-source/provenance and detail-packet fixes remain open and require review at their subsequent commit.

## Findings and exceptions

- Withdraw the prior dead-multiplier deletion recommendation at `src/domain/turn-reducer.ts:6` for this head. The number capture at line 10 now includes an optional `k`; both range and single-price paths call `amount` at lines 18 and 24. `amount` strips the suffix before `Number` and then multiplies by 1000. The expression is reachable and implements the parent's stated financial shorthand requirement. `tests/unit/v2-conversation.test.ts:364-397` covers compact `Necklaces between1kto2k`, decimal and uppercase variants, explicit currency, preserved bounds and original request after `SGD.`, and nonfinancial counterexamples. These tests were inspected, not executed. Deleting the multiplier now would remove required behavior.
- Keep the source completeness guard at `src/server/exa-research.ts:130-135` and its positive-assessment downgrade at lines 198-205. It represents actual discarded or conflicting provider context, including the ten-source packing limit, duplicate-URL disagreement and text truncation. The paired source-limit and duplicate-URL cases are inspected at `tests/api/v2-price-boundary.test.ts:122-152`. It is an active boundary invariant, not dead compatibility or a comment-supported workaround.
- `src/server/price-evidence.ts:1-105` has no narration or suppression. Its four result kinds have active consumers in `bindPrice` at `src/server/exa-research.ts:257-275`. The affirmative-clause parser has positive and adverse cases at `tests/api/v2-price-boundary.test.ts:35-121` and local SDK cases at `tests/api/v2-exa.test.ts:172-206`. No broader parser rewrite is recommended in this cleanup scope. This observation does not settle the separately assigned cross-source correctness issues.
- Keep `evals/v2/browser.ts:60-73`. `settledTurn` waits for the originating turn's non-prepared response and the resulting visible message. Its callers at lines 78 and 152 use the returned turn identity. This replaces the prior ready-button race with a completion predicate rather than an arbitrary delay.
- `evals/v2/semantic/packets.ts:41` now includes `research.summary` for the actual research response shape. `evals/v2/tests/semantic.test.ts:50-75` checks actual prose and packet-hash binding. The separate pending detail export is not treated as completed by this patch.
- `src/client/HeldReplyDetails.tsx:1-19` composes existing official Button and Collapsible primitives. The optional `ChatMessage.detail` at `src/domain/conversation.ts:63` has an active producer in `heldReply`, an active renderer in `src/client/App.tsx:122`, and bounded persistence at `src/domain/workspace.ts:44`. It is not a dormant compatibility field. Long detail packing retains whole paragraphs, discloses omitted detail and leaves canonical snapshots intact; inspected tests cover those claims at `tests/unit/v2-conversation.test.ts:131-187`.
- Preserve the prior frozen-contract exception at `evals/v2/projection.ts:12-14`. Its blob is unchanged between the pinned base and head. The parent's protected historical adaptation and `as Intent` assertion are not renewed cleanup targets.
- All 18 official component blobs match the pinned SHA-256 provenance manifest. The manifest is unchanged. No frozen-v4, artifact or documentation file changes occur in this delta. These are protected, not cosmetic cleanup candidates.

## Touched files and counts

The candidate delta has 14 changed files, 816 insertions and 159 deletions. Those are candidate counts, not reviewer edits.

- `evals/v2/browser.ts`
- `evals/v2/semantic/packets.ts`
- `evals/v2/tests/semantic.test.ts`
- `src/client/App.tsx`
- `src/client/HeldReplyDetails.tsx`
- `src/domain/conversation.ts`
- `src/domain/turn-reducer.ts`
- `src/domain/workspace.ts`
- `src/server/exa-research.ts`
- `src/server/price-evidence.ts`
- `tests/api/v2-exa.test.ts`
- `tests/api/v2-price-boundary.test.ts`
- `tests/e2e/v2-held-replies.spec.ts`
- `tests/unit/v2-conversation.test.ts`

Reviewer-touched files are only `/tmp/fieldnote-v2-comment-delta.md`. Actual deletions are 0. Restored comments are 0. Comment deletion candidates are 0. Exact MUST KILL targets are none. No architect sketch, refactor, constraint encoding or application edit was performed.

## Verification limits

Commands used were pinned `git diff`, `git show`, `git rev-parse` and a Python inspection of those blobs. All 14 changed-file contents were searched for comment lines, eslint/TypeScript suppressions, coverage ignores and constraint-comment markers. None were found. Component hashes were calculated from pinned Git blobs and checked against the pinned manifest; this verifies repository provenance consistency, not an independent registry download.

Tests were not run. No browser, build, CI, paid call, GitHub mutation, push, merge or deployment was attempted. No private environment, real ledger or existing database was read. Independent QA and security own runtime acceptance. Later commits require a fresh delta review.
