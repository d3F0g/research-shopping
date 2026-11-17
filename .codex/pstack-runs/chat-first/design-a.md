# Candidate A: one conversation, one actionable answer

## Usage (caller's view)
```tsx
const chat = useConversation();
<Transcript turns={chat.turns} actionableTurnId={chat.actionableTurnId} onCommand={chat.send} />
<Composer value={chat.draft} onChange={value => chat.send({ type: 'draft', value })}
  onSubmit={() => chat.send({ type: 'submit' })} onStop={() => chat.send({ type: 'stop' })} />
// An inline choice uses a complete supported phrase, retaining the current constraints.
chat.send({ type: 'reply', origin: turn.id, message: 'headphones' });
// Selection receives an ID, never an offer or URL from a historical card.
chat.send({ type: 'select', origin: turn.id, productId });
```
`useConversation` owns accepted preferences, drafts, the ordered ledger, and all network lifetimes. UI submits commands; no result component calls an API or mutates session state. Its public view contains domain responses and action availability, never fetch/AbortController objects.

## Problem
The current dashboard loses each preceding exchange and uses unmount to cancel source research. Retaining those components without changing ownership would preserve stale requests and duplicate IDs. This design replaces latest-result state with an ordered ledger and a single authority token while retaining the complete-JSON API, deterministic constraint engine, and exact handoff validator.

## Shape
```ts
type TurnId = string & { readonly __turnId: unique symbol };
type Task = 'turn' | 'selection' | 'sources';
type RequestKey = Readonly<{ turnId: TurnId; epoch: number; task: Task; attempt: number }>;
type RequestSnapshot = Readonly<{ message: string; preferences: Preferences }>;
type AsyncValue<T> = { status: 'idle' } | { status: 'pending'; key: RequestKey }
  | { status: 'complete'; value: T } | { status: 'failed'; message: string };
type Turn = Readonly<{ id: TurnId; request: RequestSnapshot }> & (
  | { status: 'pending'; key: RequestKey }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'complete'; response: TurnResponse;
      selection: AsyncValue<SelectionResult>; sources: AsyncValue<WebResearchResponse> }
);
type ConversationState = {
  turns: readonly Turn[]; preferences: Preferences; draft: string;
  preferenceDraft: PreferenceDraft; epoch: number; actionableTurnId: TurnId | null;
};
type Command =
  | { type: 'draft'; value: string } | { type: 'submit' | 'stop' | 'reset' }
  | { type: 'reply'; origin: TurnId; message: string }
  | { type: 'edit-preferences'; patch: PreferenceDraftPatch }
  | { type: 'apply-preferences'; origin: TurnId }
  | { type: 'retry'; origin: TurnId; task: Task }
  | { type: 'select'; origin: TurnId; productId: ProductId }
  | { type: 'sources'; origin: TurnId };
function useConversation(): ConversationView; // not implemented
function reduceConversation(state: ConversationState, event: Event): ConversationState; // not implemented
```
`Event` and controller maps remain private to `useConversation.ts`; the hook is the only exported execution surface. Existing `TurnResponse`, selection, and web-source domain unions remain authoritative; existing `api.ts` parses wire responses. Add `kind: 'message'` to `TurnResult` with text, preserved preferences and notes, with empty recorded activity. Do not introduce a parallel view-model version of the shopping engine. Per boundary-discipline, request validation stays server-side and strict client parsers stay intact.

## Request lifecycle and historical actions
1. Submit always snapshots the actual draft and valid accepted preferences, allocates a stable turn ID, increments epoch, aborts previous work, and appends a pending turn. Clear only the submitted composer text; never prior messages. Domain responses apply preferences only when their request key still matches.
2. Draft edits, preference edits, new turns, stop, reset, and handoff start increment epoch and abort all affected controllers. Sidecar results require matching turn, epoch, task, and attempt. Reject a response even if cancellation raced with resolution. Appending history no longer depends on unmount for cancellation.
3. Every completed response is stored on its originating turn; handoff and completed source excerpts are stored there too. Cancellation marks pending work cancelled without erasing accepted content. All accepted response snapshots remain immutable.
4. Only `actionableTurnId` may select or request sources. Any edit revokes it; the next accepted answer grants it. Historical cards retain readable comparisons/evidence but remove selection, paid-source, retry, and merchant navigation actions. One muted caption explains that another message refreshes the shortlist. A prior URL remains text, never a new merchant authority.
5. Selection starts a fresh server check using current accepted preferences and product ID; the existing exact-ID/exact-URL client validator must pass. Starting selection cancels outstanding source work. Render the accepted handoff inline, preserving recommendations above it; no automatic navigation.
6. Retry is available only for the newest failed/cancelled task whose captured inputs still match the current epoch context. It uses the saved message/preferences and the same turn ID with a new attempt; it cannot duplicate a completed exchange. If inputs changed, submit a new turn instead. Double clicks cannot create parallel retries or paid requests.
7. Reset aborts work and empties transcript/preferences/drafts. Theme alone persists. History is tab-local; show that limitation in New chat help, without a permanent disclaimer panel. Cap history at 100 exchanges: stop accepting more with a compact New chat action rather than silently pruning earlier messages.

## Contextual preferences and ordinary messages
Required clarification appears only for a missing category, unsupported hard requirement, currency problem, or an existing engine clarification. A compact Card with Field/NativeSelect or Checkbox offers only useful controls. Unknown hard constraints stay visible in the question until explicitly removed; a generic Skip must never clear them.
Optional questions use quick choices and a true Skip; skip means preserve the accepted preference and continue, not invent a value. Budget stays optional unless the user's request makes it material. Choices submit complete supported phrases (`under SGD 300`), avoiding a new awaited-slot wire contract. Do not interpret a bare number or “yes” as consent to relax a constraint.
A small “Preferences” disclosure appears beside the active recommendation's applied-constraint summary; it mounts the existing controlled editor once. Draft validation preserves the last accepted cap and blocks Apply/Submit. Apply appends an explicit preference-update user turn and runs the same command path, so updates are attributable. Category cleanup and explanations retain existing domain behavior.
Add an exact, bounded greeting/acknowledgment classifier before preference extraction. `Hi` gives “Hi. What are you looking for?”; `Thanks` gives “You're welcome.” No card or provider work. `Yes` acknowledges without changing constraints. `Why?` honestly requests the product or tradeoff to explain; unsupported free text still follows existing clarification. Recognized neutral text never clears an unresolved requirement. Support natural category wrappers only through explicit grammar and tests.

## Module map and ownership
| Module | Responsibility / owner |
| --- | --- |
| `src/client/useConversation.ts` (new) | Sole transcript, preference, controller and command owner; private reducer and event types. Application owner. |
| `src/client/App.tsx` | Thin full-height chat shell, minimal header, Theme toggle, Transcript and bottom Composer. Application owner. |
| `src/client/Conversation.tsx` (new) | MessageScroller, ordered Message/Bubble rendering, inline question and composer composition; all events through commands. Application owner. |
| `PreferencePanel.tsx` | Existing controlled editor inside contextual disclosure; no independent session state. Application owner. |
| `ResearchResults.tsx`, `WebResearch.tsx` | Render turn-local content; WebResearch becomes controlled by state/commands, with no private fetch lifetime. Stable `${turnId}-…` IDs. Application owner. |
| `theme-provider.tsx` (new), `main.tsx`, `styles.css`, `index.html` | Official Vite provider pattern, persisted dark default, semantic tokens and matching theme-color. Application owner. |
| `domain/contracts.ts`, `preferences.ts`, `shopping.ts`, `client/api.ts` | Message union, bounded intent grammar and parser support; all shopping/HTTP invariants retained. Application owner. |
| `tests/unit`, `tests/api`, `tests/e2e` | Domain intent, ledger races and browser history/action assertions. Application owner. |
| `docs/`, `AGENTS.md`, `.audit/`, `.codex/pstack-runs/` | Scope, provenance, acceptance and tracking. Root. |
| `.agents/skills/verify-research-shopping/` | Offline-safe verification workflow after launch. Verification owner. |

## Visual system and official composition
Use the installed official MessageScrollerProvider/Root/Viewport/Content/Item and Message/MessageContent/Bubble. User text uses muted Bubble; assistant content uses ghost Bubble. No surrounding “research workspace” card. InputGroup textarea/addon/button composes the bottom prompt. Card/Badge/Button hold compact products; Field/Input/NativeSelect/Checkbox hold contextual preferences; Collapsible/Table and Trace/HoverCard hold comparison, evidence, and actual completed activity. New registry components, if needed, require official CLI provenance.
Desktop: 56px header, 720px reading column, 24px side padding, 28px between turns. Conversation shell is `100dvh`, flex column with `min-height: 0`; only MessageScrollerViewport scrolls. Composer is a non-scrolling sibling with 12px bottom gap plus safe-area inset, 48–160px textarea, and opaque background. Empty state centers one short heading and composer; only two unobtrusive example prompts beneath it. No filters or initial results shell.
Mobile: 48px header, 16px gutters, full available column, 16px body type, 44px minimum control targets. Product cards stack; comparison scrolls inside its disclosure only. Composer remains visible as the transcript scrolls and respects keyboard-resized visual viewport. Preserve message-scroller jump-to-latest; scrolling upward must not force scrolling on incoming content.
Tokens: dark background `#141518`, surface `#1d1f23`, elevated `#272a30`, text `#f1f2f4`, muted `#a9adb6`, border `#343840`, focus `#a7c7ff`; light background `#fafafa`, surface `#ffffff`, elevated `#f0f1f3`, text `#202227`, muted `#626773`, border `#d9dce2`, focus `#345fc5`. Neutral primary action, 12–20px radii, 8px spacing grid, system sans. No decorative gradients or fabricated activity.
The static prototype is `design-a.html`, default empty dark; `#conversation` shows the transcript. Theme control previews both palettes. This HTML is only a design sketch; production must use official installed primitives.

## Tradeoffs accepted
- We accept frozen historical actions in exchange for obvious current authority and less cancellation complexity. Evidence remains inspectable.
- We accept bounded deterministic language in exchange for preserving the stateless API and avoiding an unrequested LLM rewrite.
- We accept a single substantial controller module in exchange for one visible owner of all invalidation rules (per single-source-of-truth); no event bus or reducer framework.

## Alternatives considered
A controller per turn isolates requests but exposes cross-turn cancellation and active-preference arbitration to App, weakening interface depth. A persisted event store could reconstruct history, but introduces migrations and multiple projections without a durable-session requirement. Neither improves this bounded redesign.

## Synthesis decision
Candidate A proposes the controller-led ledger as the base; synthesis belongs to the orchestrator. Red-flag screen: no duplicated preference writer, public transport objects, pass-through service layer, or hand-maintained derivative result store.

## Open questions and risks
Can the actual mobile viewport retain a readable composer with an open keyboard and evidence disclosure? Verify it in-browser. Will the user approve this restrained visual direction? Supply real candidate screenshots before merge, as explicitly requested. These are acceptance gates, not reasons to pause design or implementation.

## Next implementation step
Replace latest-result fields with the controller and two retained message turns, prove stale-turn/source rejection, then compose the official chat shell and run full runtime/visual/security acceptance against the exact commit.
