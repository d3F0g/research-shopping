# Candidate B: message-first conversation

## Caller usage

The user sees a quiet, dark chat with one question, a compact composer and two example prompts. Sending text appends a user message and an assistant reply. Recommendations, questions and handoff stay inside that reply. Later requests retain everything already said.

```tsx
const chat = useConversation();
<Conversation messages={chat.messages} activeMessageId={chat.activeMessageId} onAction={chat.act} />
<Composer value={chat.draft} onChange={chat.edit} onSubmit={chat.send} />
```

```ts
chat.send("Headphones for flights under SGD 500");
chat.act({ kind: "answer", messageId, patch: { budget: { amount: 300, currency: "SGD" } } });
chat.act({ kind: "select", messageId, productId });
```

## Data shape

Use one ordered array of role messages, rather than paired turn snapshots or an event-sourcing framework. The assistant message ID owns its pending work and eventual content. Completed content never changes. A current action owner is explicit.

```ts
type RequestSnapshot = { text: string; preferences: Preferences };
type AssistantBody =
  | { kind: "pending" }
  | { kind: "reply"; response: TurnResponse }
  | { kind: "failed"; text: string; retry: RequestSnapshot }
  | { kind: "cancelled" };
type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; body: AssistantBody; handoff?: Handoff };
type ConversationState = {
  messages: ChatMessage[];
  preferences: Preferences;
  draft: string;
  editor: PreferenceDraft | null;
  epoch: number;
  activeMessageId: string | null;
};
type ChatAction =
  | { kind: "answer"; messageId: string; patch: PreferencePatch }
  | { kind: "skip"; messageId: string; slot: OptionalSlot }
  | { kind: "select"; messageId: string; productId: ProductId }
  | { kind: "research"; messageId: string }
  | { kind: "retry"; messageId: string };
```

`useConversation` owns state and transport leases. Its private reducer accepts correlated completion events. Renderers receive read-only messages and one action callback. AbortControllers live in refs, never in transcript state. No second map, copied active response or synchronized result list is needed.

## State and effects

- `send(text)` snapshots the actual draft and accepted preferences, cancels earlier work, advances `epoch`, appends two stable message records, then calls the existing turn API. Only its matching epoch and assistant ID can replace the pending body. Accepted response preferences become current preferences.
- Editing cancels pending turn, selection and web research immediately. It preserves completed transcript content and invalidates actions. A cancelled pending body says only that the request stopped. Typing does not erase a completed reply.
- A new response is the only eligible action owner. Older recommendations remain readable with evidence and comparison disclosures, but selection, retry and paid research controls are disabled or omitted. They say "Earlier shortlist" once, rather than repeating warnings on every card.
- A handoff is attached to its owning assistant message after the existing fresh server check and exact identity/URL validation. Starting selection cancels source work. Old offers or URLs are never sent as authority.
- Each action carries `messageId`; reject it unless it matches the current owner. Every request captures the epoch. Reset advances it, aborts owned controllers and empties transcript/preferences/drafts. Late completions cannot repopulate history.
- Replace WebResearch's unmount-only cancellation with an explicit lease key or `active` plus `epoch`. Completed sources remain attached to their original reply. Abort must reach the actual fetch. Never initiate paid research from rendering or an effect.
- Retry replaces only the current failed assistant body, using its original text/preferences snapshot. It does not append a duplicate successful user exchange.

## Conversational preference policy

Extract expressed values before deciding what is missing. Keep existing hard-constraint validation authoritative. Missing category produces a compact assistant question with two category choices. Those choices submit a complete existing phrase, not an ambiguous bare token.

Budget is optional. When absent and useful for a broad shortlist, show one small inline card with quick caps, a custom amount and "Skip budget". Skipping continues without inventing a cap. Never ask again after a budget exists or after the user skipped it for this recommendation context. Keep skip state scoped to this context, not a permanent preference.

A question answer applies its typed preference patch immediately and appends a readable user message such as "Keep it under SGD 300" before requesting refreshed recommendations. An optional "Edit preferences" disclosure on the latest response reuses the controlled editor. It is not shown before a request and never becomes a permanent form.

Add a bounded ordinary-message result to the domain response union before provider work. Exact greetings and acknowledgments return plain text while preserving all constraints. Strip known conversational wrappers around recognized requests such as "what about laptops?". Unknown requirements still produce clarification; "yes" never clears an unresolved constraint. No LLM or invented product expertise is added.

## Composition and visual design

Use actual installed MessageScrollerProvider, MessageScrollerViewport, MessageScrollerItem, Message, Bubble and InputGroup. Their official AI Elements composition provides the chat, not a custom imitation. Render Results as the assistant body without dashboard headers. Card, Badge, Collapsible, Table, Trace and safe citation components retain their current jobs.

The app is one `100dvh` flex column. A 56px header contains Fieldnote, a subtle fixture marker, new-chat and theme buttons. The middle viewport owns vertical scrolling. All flex ancestors use `min-height:0`. The reading column is at most760px with24px side space,16px on mobile. The bottom composer is outside the scroller, uses44px controls and safe-area padding, and never overlays a message.

The empty state is unboxed and centered vertically above the composer. It contains "What are you looking for?" and two short suggestions. No results placeholder, page intro, sidebar or footer panel exists. During conversation the greeting disappears. Assistant text has no enclosing bubble border; user text uses a quiet rounded surface. Product cards are compact horizontal rows on desktop and stacked rows on mobile. Show one sentence, sample price, useful tradeoff and actions. Detail remains collapsed.

Tokens use charcoal surfaces and an understated sage accent. Dark background `#171918`, surface `#222623`, foreground `#eff2ef`, muted foreground `#a5afa8`, border `#39423b`, accent `#b8d7c0`. Light background `#fafbf9`, surface `#f0f3ef`, foreground `#202923`, muted foreground `#58655c`, border `#d5ddd6`, accent `#315e43`. Use the existing local Geist font. Body text is15px, desktop empty heading28px, metadata12px. Respect reduced motion.

Implement the official Vite ThemeProvider pattern with `defaultTheme="dark"`, a validated light/dark localStorage value and a real accessible toggle. Default root tokens are dark so first paint never inherits OS-light styling. Theme persists across refresh; conversation stays tab-memory only. Update `theme-color` with the active palette.

## Module map

- `App.tsx` composes header, transcript and composer. `useConversation.ts` owns transcript, current preferences, reducer and request correlation.
- `Conversation.tsx` renders role messages and dispatches typed actions. `ResearchResults.tsx` retains pure cards/evidence/comparison/handoff with per-message IDs and explicit actionability.
- `PreferencePanel.tsx` remains the full optional editor. A small `PreferenceQuestion` presents only the current missing question.
- `WebResearch.tsx` exposes explicit activity invalidation. The existing API module keeps parsing and safe handoff policy.
- `theme-provider.tsx`, `main.tsx`, `styles.css` and `index.html` own theme and layout. Domain contracts/preferences/shopping add only bounded ordinary-message/category-phrasing behavior.

## Tradeoffs and verification

Message-first storage matches the rendered reading order and leaves room for later tool-only replies without a paired-turn wrapper. It adds one reducer/hook, but avoids replay, event storage, a server transcript API or a parallel latest-result state. Current-only actions trade convenience for unambiguous eligibility. The user can request refreshed options to act on an older idea.

Verify real multi-turn history, ordinary acknowledgments, category and optional-budget cards, natural budget replacement, invalid drafts, reset/retry, inactive historical controls, stale turn/selection/source suppression, exact safe handoff and fixture/source separation. Inspect1440px and390px viewport screenshots in dark/light, including persisted theme, empty chat, open inline card, two turns, evidence and mobile scrolling with composer visible. Keep existing domain/API/security assertions. Independent visual QA must explicitly reject the old dashboard. Open a new PR and await user screenshot approval before merging.

`design-b.html` is a static layout proposal. It does not establish component provenance, real app behavior or runtime acceptance. Model the Domain led to explicit role messages and action ownership. Experience First led to an unboxed empty state and contextual controls.
