# Chat-first comments and focused cleanup review

Verdict: PASS for bounded static no-comments/workaround review. No blocking comment or workaround finding. This is not runtime, security, or visual acceptance.

Reviewed base: `151fa506f58f4171add9f5efd684da809ee3248f`.
Reviewed head: `38f75c271ba5396950b1fe37892350497ac15709` (verified current HEAD).
Application checkout: `/Users/josiahwong/Documents/research-shopping-chat`.
Instructions: installed pstack `CODEX.md`, `agents/comment-sicko.md`, and `skills/no-comments/SKILL.md` read by absolute path.

## Touched files and deletion count

Repository files modified by reviewer: none. Report written only to `/tmp/research-shopping-chat/comment-review.md`.
Comments deleted: 0. Comment deletion candidates: 0. Restored comments: 0. MUST KILL refactor targets: none. No lint, TypeScript, or coverage suppressions found in scoped source/domain/tests/helper files.

Reviewed changed application files: `index.html`; `src/client/{App.tsx,PreferenceQuestion.tsx,ResearchResults.tsx,WebResearch.tsx,main.tsx,styles.css,theme-provider.tsx,useConversation.ts}`; `src/domain/{contracts.ts,preferences.ts,shopping.ts}`; `tests/e2e/{chat-first.spec.ts,chat-screenshots.spec.ts,research-shopping.spec.ts}`; `tests/unit/conversation.test.ts`; `.agents/skills/verify-research-shopping/scripts/smoke.mjs`. The scoped diff's documentation/audit/artifact inventory was checked; historical architecture sketches were excluded from production dead-code judgments.

## Concrete optional deletion candidates

1. `src/client/useConversation.ts:23` — `TaskState`'s pending `key` is write-only state metadata. It is populated at lines 159, 275, and 320; consumers inspect `status`, while stale-response acceptance reads the separate `task.current.key` through `accepts` (line 144). The type property and these three state-object properties can be dropped without changing the real request-generation mechanism. This is a small cleanup, not a safety workaround; retain `begin`, `accepts`, and controller cancellation.
2. `src/client/useConversation.ts:34` — `ConversationTurn.body`'s `question: "budget"` field is write-only (assignment at line 242). `App.tsx` selects `BudgetQuestion` solely from `body.status === "question"`. Drop the redundant field if only the currently implemented budget question remains in scope. No new generalized question abstraction is needed.

Neither optional candidate is a MUST KILL: neither hides a surprising behavior, suppresses correctness checks, nor keeps a dead compatibility execution path alive.

## Justified exception and skips

- Keep `src/client/theme-provider.tsx:34`: the sole new production comment explains the intentional catch around browser-owned storage. The active `setTheme` path at lines 30–36 attempts persistence and still updates the theme when the browser rejects storage; the browser capability cannot be controlled by application code. This is an external-platform exception. Static inspection verifies the fallback path, not reproduction of private-browser storage failure; no such runtime claim is made.
- Keep real abort/generation guards in `useConversation`: these implement retained history with revocable current actions and request cancellation, rather than compatibility scaffolding.
- Keep test-held request abort handling at `tests/e2e/chat-first.spec.ts:194` and `:360`: those handlers intentionally release an already-cancelled intercepted request after the test separately observes `requestfailed`. They do not suppress an application result assertion.
- Keep reduced-motion CSS overrides and official third-party notices. No new official component source was changed in this candidate.
- Historical design-sketch comments under `.codex/pstack-runs/chat-first/` are architect artifacts, as instructed, and were not flagged as production dead code.
- Root checkout status showed no working-tree changes under `docs/`, `.audit/`, or `artifacts/`; its unrelated package/skill changes were not reviewed.

## Evidence and limits

Commands: exact base/head `git diff --stat`, `--name-only`, and scoped `git diff`; scoped `rg` comment/suppression/workaround searches; nearby source reads; cross-reference searches for pending keys, question fields, and request handlers; root `git status --short`; candidate `git rev-parse HEAD`.

No repository/application writes, Git mutations, environment-file reads, live provider calls, GitHub actions, test runs, or browser runs were performed. No accepted finding requires an architect sketch or constraint encoding. No generic rewrite is recommended.
