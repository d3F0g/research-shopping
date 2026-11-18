# Chat-first architecture grounding

## Overview

Fieldnote currently presents a single shopping exchange inside a dashboard. The chat-first redesign should replace that composition with a dark-default conversation, retained exchanges, a bottom composer, optional preferences, and contextual recommendation cards. The domain already separates hard eligibility from flexible ranking, and the frontend already contains official shadcn and AI Elements compositions with registry provenance.

This synthesis is grounded at `151fa506f58f4171add9f5efd684da809ee3248f` through the state and UI explorer reports. The root verified the baseline smoke helper and inspected its dashboard screenshots. That evidence establishes the existing baseline; it does not accept the future chat candidate.

## Key Concepts

- **Active preferences:** `Preferences.hard` holds category, budget, region, exclusions, required features, and unresolved constraints. `Preferences.soft` holds use case, priorities, and response length. Hard constraints filter eligibility; soft preferences rank eligible products.
- **Conversation turn:** A new client record should associate a stable ID, submitted message, request preference snapshot, pending/completed/failed/cancelled status, and accepted response. History records what happened; current preferences govern new actions.
- **Response:** `TurnResult` currently supports clarification, recommendations, no-match, and error. `TurnResponse` adds actual completed provider outcomes. Ordinary conversational responses require an explicit domain variant and bounded intent handling.
- **Handoff:** Selection is a fresh server check of a catalog product against current preferences and inventory fixtures. The client also validates identity and the exact approved destination before displaying a merchant link.
- **Web context:** Optional Exa excerpts have their own contract and explicit action. They are separate from synthetic product claims, prices, stock, and manufacturer references.

## How It Works

`App` currently owns preferences, drafts, one `lastMessage`, one `outcome`, one selection, abort controllers, and revision counters. Editing or submitting removes the displayed result. Replace the single-exchange fields with bounded tab-local history while keeping active preferences and request invalidation explicit. The existing API needs no transcript field for visual history; it remains stateless and has strict schemas and a 16,384-byte body bound.

A submission captures the actual composer text and accepted preferences, creates its turn record, and calls `runTurn`. The server extracts deterministic preference changes before invoking fixture providers. Missing or unsupported constraints produce clarification without provider activity. Eligible products are ranked; concise output returns at most three candidates, expanded output at most five. Accepted responses update the active preferences and their originating turn. Retries should preserve the submitted snapshot and avoid duplicate successful exchanges.

The composer must always submit its current draft. The existing `outcome ? "" : input` expression depends on clearing the result while typing and is unsuitable for retained history. Editing invalid drafts must continue blocking submission while preserving the last accepted budget. Category changes must preserve the existing cleanup and explanation behavior.

Render each completed response inside its assistant message. Show its useful answer first, then contextual cards and optional comparison, evidence, and recorded activity. Reuse the installed message-scroller, message, bubble, input-group, card, disclosure, citation, and trace compositions. Remove dashboard wrappers and the permanent preference column; reuse the controlled preference editor inside an optional disclosure. Centralized CSS tokens provide the dark default. Restore a constrained scrolling viewport and `min-height: 0` through its flex ancestors; current CSS overrides the scroller to visible overflow.

Keep pending indicators tied to real HTTP activity. Complete JSON transport cannot establish token streaming or intermediate reasoning/tool steps. Returned provider activity can appear only after its response arrives.

Ordinary greetings and acknowledgments need bounded recognition before provider execution. Today `hi`, `thanks`, `yes`, and `why?` become sticky unresolved constraints. A safe message result preserves existing preferences, including unresolved hard constraints; arbitrary unknown text must still receive honest clarification. Bare numeric answers require validated awaited-slot context, or quick replies should submit complete supported phrases such as `under SGD 300`.

History changes cancellation ownership. Existing turn and selection revision checks must still reject responses after edits, newer work, reset, or cancellation. `WebResearch` currently aborts only on unmount, so retained components need an explicit active/revision boundary or inert completed snapshots. Source requests must abort on the same relevant boundaries and cannot attach late results to a newer turn.

Choose historical action ownership explicitly. The simplest design disables stale historical actions and permits actions only on the current eligible turn. If historical selection is retained, it must revalidate using current preferences; an old offer or URL is never authority for a new handoff. Attach handoffs and completed source excerpts to their originating turn. Reset removes all transcript content and cancels all pending work.

## Where Things Live

| Path | Role |
| --- | --- |
| `src/client/App.tsx` | Session state, request revisions, actions, page and conversation composition. |
| `src/client/PreferencePanel.tsx` | Controlled preference fields, drafts, and keyboard-operable editing. |
| `src/client/ResearchResults.tsx` | Answer rendering, fixture cards, evidence, comparisons, activity, handoff. |
| `src/client/WebResearch.tsx` | Explicit source request, cancellation, retry, safe excerpts, disclosures. |
| `src/client/api.ts` | Strict response parsing and additional safe selection identity checks. |
| `src/domain/contracts.ts`, `preferences.ts`, `shopping.ts` | Typed boundaries, deterministic intent extraction, eligibility and ranking. |
| `src/server/app.ts`, `src/domain/web-research.ts` | Validated HTTP boundary and separate live excerpt contract. |
| `src/client/components/ui/`, `styles.css`, `index.html` | Official primitives, centralized tokens, layout and theme metadata. |
| `docs/frontend-standard.md`, `artifacts/frontend-standard/provenance/` | Official component provenance and composition requirements. |
| `tests/e2e/research-shopping.spec.ts`, `.agents/skills/verify-research-shopping/` | Browser behavior assertions and runtime evidence workflow. |

## Gotchas

- Repeated results, handoffs, and source panels duplicate fixed heading IDs and break global selectors. Use turn-scoped IDs and selectors while preserving all behavioral and security assertions.
- Unknown requirements remain sticky until explicitly removed. Friendly messages, a bare `yes`, or category changes must never silently relax them. Natural-language category phrasing is currently limited.
- Every historical claim, offer, price, and availability label remains visibly fixture data with its fixture observation time. New retrieval timestamps do not establish current inventory. Safe manufacturer links remain synthetic claim references.
- The direct smoke helper does not itself disable Exa despite its skill documentation; `npm run verify:offline` does. The verification owner should set the child flag directly and assert `health.webResearch === "disabled"` after the app launches.
- Existing unit/API grounding passed 110 tests. Preserve budget removal/replacement, unsupported constraints, dissatisfaction, conflicts, provider failure, safe handoffs, strict inputs, and session isolation. Retained history does not establish durable or cross-device persistence.
- Candidate acceptance requires real multi-turn browser journeys, ordinary messages, stale-action and source cancellation checks, retry/reset behavior, and desktop/mobile viewport screenshots showing the composer while history scrolls. Full-page screenshots and a passing build cannot establish those interactions.
- Independent QA and security must review the exact candidate commit. Frontend acceptance includes independent visual QA. No payment, order placement, production deployment, credential change, or repository safeguard change belongs in this scope.
