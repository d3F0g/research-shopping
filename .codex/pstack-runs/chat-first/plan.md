# Chat-first redesign run

## Goal and delivery boundary

Replace the dashboard with a minimal dark-first shopping conversation. Preserve research, comparisons, evidence, safe handoff, explicit Exa actions and fixture limitations. Deliver a new PR with hosted checks and inspected screenshots. Do not merge or enable auto-merge until the user reviews screenshots and confirms the design direction.

Base151fa506f58f4171add9f5efd684da809ee3248f. Worktree /Users/josiahwong/Documents/research-shopping-chat. Branch feat/chat-first. Tracking issue30. Original checkout user changes remain untouched.

## Figure-it-out checklist

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame
- [x] Phase B: Design the workflow
- [ ] Phase C: Run the loop
- [ ] Phase D: Keep the audit trail
- [ ] Phase E: Verify and hand back

## Designed phases

1. Ground current session/domain and frontend independently. Capture the old interface through the actual fixture app.
2. Compare two whole conversation designs. Select one typed model and clear ownership before implementation.
3. Implement append-only user/assistant messages, current shopping context and contextual preferences. Keep transport/cancellation boundaries and delete dashboard presentation.
4. Implement official dark-first theme and minimal responsive chat layout. Verify the real empty and conversational states before polishing.
5. Adapt the fixture helper and behavioral tests. Retain security assertions and expand history/theme/inline-preference/composer coverage.
6. Run independent visual/runtime QA and security reviews on a named candidate. Fix concrete defects and repeat affected checks.
7. Publish a fresh PR, inspect automatic CI, and present desktop/mobile screenshots for the required human design approval. Leave the PR unmerged.

## Throughput checkpoint

One application owner owns source/tests/package files in its own worktree; root owns docs, policy and tracking in the integration worktree. A verification owner updates the skill/helper in a separate worktree after the UI contract is stable. Read-only reviewers pin candidate commits. Initial scope is the small React shell, result/preference composition, session-followup logic only where necessary, one theme provider, and browser/verification assertions. Three child slots bound parallelism. No backend rewrite or LLM integration is planned.

## Acceptance predicate

Actual 1440px desktop and390px mobile screenshots demonstrate a dark first visit, minimal empty state, ordinary messages, inline contextual preferences, preserved earlier turns, concise recommendations and bottom composer. Light/dark toggles persist through refresh. No permanent filters, large prechat form or empty-results panel remains. Existing domain/API/security tests and adapted browser journeys pass. Independent visual QA explicitly rejects dashboard structure. CI passes. User screenshot approval remains pending at delivery.
