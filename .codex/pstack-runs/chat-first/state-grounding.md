# Chat state grounding

The goal is a dark-default, chat-first Fieldnote with actual conversation history, natural followups, and contextual cards. The smallest safe change keeps the existing shopping contracts and adds an explicit client transcript. Natural acknowledgments also need a domain change. A visual rewrite alone retains the current parser trap.

Grounded at `151fa506f58f4171add9f5efd684da809ee3248f`. No repository files changed. No environment files or live Exa requests were read or used.

## Current types and flow

- `src/domain/contracts.ts:37` defines `Preferences`. `hard` holds nullable category and budget, region, excluded brands, required features, and nullable `pendingConstraint`. `soft` holds use case, ordered priorities, and concise or expanded response length. Defaults are no category or budget, SG, value priority, and concise output.
- `src/domain/preferences.ts:36` clones previous preferences and extracts a limited, deterministic grammar from the newest message. There is no model, transcript, or conversation context. Supported followups include `under 300`, `exclude Sony`, `better battery life`, `shorter`, and `more details`.
- Unknown remainder sets sticky `hard.pendingConstraint`. Future neutral requests remain blocked until explicit removal or reset. The parser applies recognized changes even when the same message later needs clarification.
- Category changes clear all required features, priorities, and use case. Budget, excluded brands, region, response length, and unresolved constraints remain. Features in the new message are then extracted for the new category. `src/domain/preferences.ts:73`.
- Bare feature mentions generally become hard requirements. Explicit preference language and `better`, `longer`, or `lighter` can become soft priorities. Generic dissatisfaction asks which dimension should improve. `src/domain/preferences.ts:142-189`.
- `src/domain/shopping.ts:124` applies preference extraction before providers. Clarifications have no provider activity. Eligibility enforces every hard limit before ranking. Only supported claims can satisfy features. Conflicts and unknown claims cannot.
- Concise mode returns at most three candidates and three reasons per candidate. Expanded mode allows five. Both have a short `answer`; there is no ordinary conversational answer result. `src/domain/shopping.ts:70,145-154`.
- `src/client/App.tsx:75` stores preferences, one `lastMessage`, one `outcome`, and one selection. Every draft edit clears the visible answer. New turns replace prior turns. Reset clears everything. There is no local storage, server session, cookie, transcript, or reload persistence.

## Exact client API contracts

| Call | Request | Parsed response |
| --- | --- | --- |
| `runTurn(message, preferences, signal)` | `POST /api/turn`, `{ message, preferences }` | `TurnResponse` |
| `selectProduct(productId, preferences, signal)` | `POST /api/select`, `{ productId, preferences }` | `SelectionResult` |
| `researchShortlist(request, signal)` | `POST /api/research`, `{ productIds, preferences }` | `WebResearchResponse` |

`TurnResult` is a union of `clarification`, `recommendations`, `no-match`, and `error`. All carry preferences and notes, except error preferences can be null. Recommendations add `answer` and one to five candidates. Clarification adds a reason of category, constraint, feedback, or currency. `TurnResponse` adds bounded `toolActivity`, containing actual provider and outcome pairs. `src/domain/contracts.ts:139-170`.

`SelectionResult` is either handoff or the existing error result. Handoff includes trusted product identity, offer, validated product URL, and limitation text. The browser additionally checks requested product identity and exact catalog destination. `src/client/api.ts:36-60`.

`WebResearchResponse` is `disabled`, `unavailable` with bounded reason, or `ready` with retrieval time, bounded safe source excerpts, and truncation flag. It is a separate contract from fixture claims and commerce. Product IDs are unique, one to five, and must exist in the catalog. `src/domain/web-research.ts:41-88`, `src/server/app.ts:146`.

The server strictly rejects unknown input keys. Messages are 1 to 2,000 characters. All POST bodies have a 16,384-byte bound. JSON media type, encoding, Host, and Origin checks apply. Adding full history to requests would require a deliberate contract change and quickly conflicts with this bound. `src/server/app.ts:19-26,69-117`.

## Minimal typed model

Keep the current `Preferences` as the active session state. Replace the latest-exchange fields with a bounded transcript that preserves each accepted response and its request snapshot. One possible client shape is below.

```ts
type ConversationTurn = {
	id: string;
	message: string;
	requestPreferences: Preferences;
} & (
	| { status: "pending" }
	| { status: "complete"; response: TurnResponse }
	| { status: "failed"; error: string }
	| { status: "cancelled" }
);

type Conversation = {
	preferences: Preferences;
	turns: ConversationTurn[];
};
```

A completed response is sufficient to derive its text and optional cards. Cards belong only to recommendation responses and can stay behind a contextual disclosure. A current request's status is transport state, not simulated streaming. Store a handoff against its originating turn if it remains visible in history. Use stable turn IDs for request correlation, disclosure IDs, and retry.

History can remain local to the current tab with the current API. This does not establish refresh or cross-device persistence. Do not send synthetic historical exchanges to the server or reconstruct history from the latest preferences.

For ordinary messages, add a small explicit result variant such as `{ kind: "message", message, preferences, notes }` before the provider path. Recognize a bounded set of greetings and acknowledgments without setting `pendingConstraint`. Do not turn arbitrary unknown text into an acknowledgment. Unsupported requirements must still block. Explanation and product-reference questions need either explicit typed context or an honest limitation.

A bare numeric reply is ambiguous under today's API. If the design asks a budget question, model an awaited slot separately from `hard.pendingConstraint` and send only that typed context through a validated request extension. Otherwise quick replies can submit complete existing phrases such as `under SGD 300`. A bare `yes` must never implicitly clear an unresolved hard constraint.

## Runtime observations and integration risks

A direct local fixture-engine probe used established `headphones under SGD500` preferences.

| Followup | Observed result |
| --- | --- |
| `hi`, `thanks`, `yes`, `300`, `why?` | Constraint clarification and sticky pending constraint. |
| `under 300`, `battery life`, `shorter`, `more details` | Recommendations with the expected updated preferences. |
| `what about laptops?` | Category becomes laptops, then unknown words create a pending constraint. |
| `I want a phone` | Honest unsupported constraint. Existing headphone category remains. |

The current form submits `outcome ? "" : input`, relying on `editInput` clearing the outcome. A transcript rewrite must always submit the actual draft. `src/client/App.tsx:501-506`.

Preserve revision and abort checks for turn and selection responses. Draft changes, preference changes, newer requests, and reset must suppress stale responses. Preserve submitted message snapshots for retries without duplicating a successful exchange.

`WebResearch` aborts only when unmounted today. Keeping historical turns mounted removes that protection. Explicitly cancel or invalidate in-flight research on the same edit, reset, and handoff boundaries. Completed historical sources can remain attached to their original turn without becoming evidence for the current shortlist. Keep explicit paid-action clicks and duplicate-request suppression. `src/client/WebResearch.tsx:46-81`.

Selection from a historical card must call `selectProduct` with current active preferences. Never make its old offer or link the authority for a fresh handoff. The server rechecks identity, supported constraints, stock, and the approved exact destination. Repeated `Results` instances also need unique heading and disclosure IDs.

## Verification to preserve

`npm test -- tests/unit/shopping.test.ts tests/api/app.test.ts` passed 110 tests locally. This establishes the current fixture domain and HTTP behavior. No browser verification ran in this investigation.

Keep the assertions for budget replacement and removal, region and currency mismatch, exclusions, category change, unsupported requirement persistence, generic dissatisfaction, response length, conflicting evidence, provider errors and timeouts, safe handoffs, inert instructions, session isolation, strict inputs, and private bounded logs.

The existing browser suite additionally covers stale turns, cancelled selections, interrupted-request recovery, optional Exa explicit clicks and retry, stale web-source suppression, safe source links, keyboard disclosures, responsive overflow, and visible focus. Adapt selectors to the final official component semantics without deleting those behaviors. Add real journeys for multiple retained exchanges, ordinary acknowledgments, short answers to the actual question, current constraints when selecting old cards, and reset removing transcript and pending work.

Every historical price, claim, and stock label remains visibly fixture data with fixed observation times. Live excerpts retain their separate contract and limitations. Neither source references nor retrieval timestamps prove inventory. No order or payment action belongs in this change.

## Files read

`src/domain/contracts.ts`, `src/domain/preferences.ts`, `src/domain/shopping.ts`, `src/domain/web-research.ts`, `src/server/app.ts`, `src/client/api.ts`, `src/client/App.tsx`, `src/client/ResearchResults.tsx`, `src/client/WebResearch.tsx`, `tests/unit/shopping.test.ts`, `tests/api/app.test.ts`, selected assertions in `tests/e2e/research-shopping.spec.ts`, `package.json`, `docs/architecture.md`, `docs/security-model.md`, and `docs/capability-gaps.md`.

Model the Domain shaped the typed transcript recommendation. Boundary Discipline keeps new intent context in validated contracts and current constraints authoritative at selection. Both principle leaf skills were read during this investigation.
