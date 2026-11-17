# Chosen chat architecture

## Synthesis decision

Use candidate A's paired turn ledger and single conversation controller. Root initially tied the candidates at27/30 and favored B's smaller apparent interface. The independent judge selected A26/30 over B23/30 because B omits typed selection/source state and leaves ownership unresolved. That changes the assessment: explicit sidecar ownership protects retained history and avoids reconstructing cancellation rules during implementation.

Graft B's context-scoped optional-question skip state and compact product rows. Use A's visually grouped empty heading/composer and neutral charcoal treatment, while retaining the local Geist font. Prototype controls are illustrative; production targets must be at least44px and mobile input at least16px. Do not fade all historical content or fabricate completed activity.

## Implementation contract

The controller owns ordered turns, current accepted preferences, invalid editor drafts, actual pending tasks and action correlation. A turn stores its original message/request snapshot and an accepted response. Selection and source state belong to that turn but can change independently of the immutable response snapshot. Keep one active recommendation owner and a separately defined newest retryable task. A failed initial request must remain retryable.

Use discriminated pending/complete/failed/cancelled states. Edits, reset, new work and handoff start cancel the appropriate actual request and invalidate late completions. Cancelled source/selection work must leave no permanent spinner. Keep fresh selection context alive until its exact validated response arrives. Retry uses saved valid inputs and the same turn rather than duplicating successful exchanges. Do not force retry eligibility to equal an obsolete request epoch.

A single clear correlation key is sufficient. Do not add an event framework, event log, parallel active-result copy, transport schema history field, or arbitrary100-turn blocking cap. Keep functions and command types proportional to the existing app. No history is silently truncated.

WebResearch becomes a controlled presentation of turn-local source state and explicit commands, with its fetch lifetime owned by the controller. API parsing and exact-product/URL selection checks remain in api.ts. The real SDK stays server-only and untouched. New components come only from the official registry if existing components cannot serve the composition.

Structured preferences remain authoritative. Contextual required-category choices submit complete supported messages. One optional budget question can use quick choices, validated custom amount and Skip. Do not ask again for known values or a skipped question in that context. Generic skip never clears an unsupported hard constraint. Full preference editing is a user-opened inline disclosure on the current answer, never a permanent sidebar/form.

Add a bounded ordinary-message result with zero fabricated provider activity. Greetings and acknowledgments preserve all constraints and produce text, not a research card. Natural category wrappers receive explicit deterministic support; unknown hard requirements keep their blocking behavior. Do not pretend this fixture engine has an LLM or open-domain product expertise.

## Verification contract

Preserve all existing unit/API/security behavior and browser attack assertions. Scope repeated message/result IDs and selectors to their turn. New journeys prove dark first visit despite light OS preference, persisted light/dark after refresh, greeting, contextual choices/skip, two retained user/assistant exchanges with changed budget, unsupported-constraint persistence, stale historical actions, retry/reset and actual cancelled requests. Inspect1440px and390px screenshots, scrolling old history without forced jumps and the composer at the live edge. No external browser requests, live Exa calls or credential access during fixture runs.

The verification owner controls only .agents/skills/verify-research-shopping. Application owner supplies stable accessible control names and perturn scope once implemented. Root owns docs/policy/GitHub. User screenshot approval remains an explicit merge gate after the fully tested PR is reviewable.
