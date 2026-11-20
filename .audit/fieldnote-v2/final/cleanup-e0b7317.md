# Fieldnote V2 final CommentSicko delta review

The goal is a useful Exa-only shopping conversation ready for human review. This read-only review checks the final assigned delta for narrating comments, dead branches, suppressions and workaround code.

Reviewed base `8d679f3a82663c4fc4b8d3533c0ea15ad000ce6d` and head `e0b7317f4bd00ce49141229943279e0da357cdbc` in `/Users/josiahwong/Documents/research-shopping-v2`. The checkout HEAD matched the candidate and `git status --short` was empty when inspected. Findings bind to these commits. A future documentation or evidence commit still needs its own hash binding.

Verdict is PASS for this cleanup delta. Comment deletion candidates are 0. Dead-code deletion candidates are 0. Exact MUST KILL refactor targets are none. No suppression directives were found in any of the nine changed active source, configuration, test and evaluation files. This verdict does not establish runtime, security, visual or product acceptance.

## Inspected active changes

- `src/domain/turn-reducer.ts:29-54` introduces an explicit contextual-operation union. Its three variants have live consumers at lines 190-202. They return before monetary parsing. Source questions retain intent, buyer qualifications become hard requirements, and unsupported combined instructions remain pending as a whole. The selection rule at line 73 still has its separate consumer at lines 228-230. It is not an abandoned branch. The negative-qualification recognition is bounded to the stated clause shape and has explicit rejection paths. I found no dead workaround to delete in this delta.
- `tests/api/v2-context-safety.test.ts:40-68` injects a loopback HTTP transport into the real Exa SDK and uses a local quota substitute. Lines 72-175 contain positive and adverse cases for explicit budget edits, explicit research, source claims, held prices, combined instructions and buyer restrictions. The source assertions and dispatch counts justify keeping these regression tests. I inspected them and did not execute them.
- `src/domain/turn-reducer.ts:135-159` keeps adverse assessment status ahead of the whole short rationale. Long rationale and supporting passages remain in detail. Its support check prevents an unsupported rationale becoming a brief finding. `tests/unit/v2-conversation.test.ts:194-231` covers long support, long adverse rationale, and unsupported rationale. These checks express display behavior and are not comment-backed exceptions.
- `src/server/exa-research.ts:249-277` evaluates published supporting passages before resolving price conditions, then considers every retained source. The previous whole-source relevance filter is deleted. `src/server/price-evidence.ts:27-41` shares condition recognition between the selected product and other product assertions at lines 114-130. Other-product matching at lines 74-99 is used to distinguish unambiguous separate product prices. `tests/api/v2-price-boundary.test.ts:179-265` covers mixed-source price and shipping context, identity-only native support, and separate products with shared or distinct variants. These are active evidence-boundary operations. This cleanup finding is not a comprehensive semantic proof of price correctness.
- `evals/v2/semantic/packets.ts:41-45` adds collapsed detail only from a matching final assistant message. The main text still comes from the actual response, including the research summary. `evals/v2/tests/semantic.test.ts:65-90` checks summary content, visible reply content, disclosure content, hash changes and rejection of a mismatched reply. The fields are exercised and are not a dormant compatibility bridge.
- `.github/workflows/ci.yml:68-73` narrows only uploaded artifact paths. The exact diff changes no test command, job, permission or check. It retains the always-run upload step. This review did not inspect remote workflow outcomes.

Minimize Reader Load shaped the review of `conditionProof` and `contextualOperation`. The former shares a real two-caller condition decision. The latter returns named operation variants that the reducer handles directly. Neither is a pass-through wrapper that warrants deletion.

## Protected exceptions and skips

There are 0 newly added comment exceptions and 3 carried-forward protection groups.

1. The frozen projection comment and associated `as Intent` at `evals/v2/projection.ts:12-14` remain protected by the parent-authorized historical contract exception. The file is unchanged in this delta. This review does not reopen that bridge or manufacture replacement historical data.
2. The official generated component files and `src/client/components/registry-provenance.json` are unchanged in the pinned delta. No cosmetic component changes are requested. This pass verified unchanged blobs, not an independent registry download or a new hash audit of all 18 files.
3. Frozen historical code, baselines, reports and evidence remain explicitly protected. Documentation and evidence content are outside this active-code review. Their size or repetition is not a deletion finding. The parent-excluded local Python validator environment is not an application dependency or cleanup target.

The earlier `amount` multiplier MUST KILL remains withdrawn. At `src/domain/turn-reducer.ts:6`, suffix stripping precedes conversion. The capture at line 10 accepts `k`, and lines 18 and 24 call the helper. Those lines are unchanged from the prior PASS head. Removing the multiplier would remove the required thousand-unit shorthand.

## Touched files and counts

The scoped candidate delta contains 9 files, 486 insertions and 70 deletions.

- `.github/workflows/ci.yml`
- `evals/v2/semantic/packets.ts`
- `evals/v2/tests/semantic.test.ts`
- `src/domain/turn-reducer.ts`
- `src/server/exa-research.ts`
- `src/server/price-evidence.ts`
- `tests/api/v2-context-safety.test.ts`
- `tests/api/v2-price-boundary.test.ts`
- `tests/unit/v2-conversation.test.ts`

Reviewer-touched files are only `/tmp/fieldnote-v2-comment-final.md`. Actual application, configuration, test, evaluation, documentation and Git edits are 0. Actual deletions and restored comments are 0. Deletion recommendations are 0. Suppression findings are 0. MUST KILL targets are 0. Protected groups are 3. No architect sketch, refactor or constraint encoding was performed.

## Evidence and limits

Read the installed pstack CODEX.md, CommentSicko, no-comments, poteto-mode, unslop and Minimize Reader Load instructions using absolute paths. Read both prior reports for continuity, then inspected the actual pinned diffs and source blobs. A Python scan of all nine full changed files found no comment-line markers, eslint or TypeScript suppression directives, coverage-ignore directives, prettier-ignore directives, or the specified constraint-comment markers. Pinned diff inspection confirmed the generated components, provenance manifest and frozen projection are unchanged.

No tests were run. No build, browser journey, CI execution, live provider call, GitHub operation, push, merge or deployment was attempted. No private environment, credential, real admission ledger or existing database was read. Independent QA and security retain their acceptance responsibilities. This report approves only the assigned cleanup delta at the exact head above.
