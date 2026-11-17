# Independent design judgment

Scope: read-only comparison of the brief, original user request, grounding, both design documents, static HTML source and rubric. No runtime or visual acceptance is claimed. Configured cross-family check could not run because the exact parent family and configured Luna pool were unavailable; this is the explicitly assigned available Astra review seat.

| Criterion (0–5) | A | B | Rationale |
| --- | ---: | ---: | --- |
| Minimal actual chat composition | 5 | 5 | Both remove the dashboard and make results assistant content. A has the quieter empty state; B explicitly demonstrates retained budget changes. |
| Typed snapshots and one action owner | 5 | 3 | A captures every request and types turn-local sidecars. B lacks source/selection status in its proposed state, and keeps request snapshots only for failure. |
| Contextual preferences and constraint preservation | 4 | 4 | Both preserve hard limits and use bounded ordinary-message handling. B explicitly remembers optional skips, but does not type that state. A does not define skip-context persistence. |
| Cancellation, exact handoff and Exa boundaries | 4 | 3 | A defines task/attempt correlation, actual abort ownership and duplicate suppression. B leaves source ownership as a choice of lease or active/epoch and omits attempt correlation. Both need clearer retry/action eligibility. |
| Responsive typography, theme and composer | 4 | 4 | Both specify dark default, persisted toggle, bounded scroller and bottom composer. Their sketches undersize some controls; actual keyboard/viewport and contrast behavior remain unverified. |
| Official components and maintainability | 4 | 4 | Both reuse installed primitives and keep complete JSON transport. A has more explicit ownership; B is visually compact but its omitted sidecar model shifts complexity into implementation. |
| Total | 26/30 | 23/30 | Scores assess design specificity and suitability, not rendered acceptance. |

## Selection

Use A's turn ledger, single controller and controlled WebResearch as the implementation base. It maps directly to the existing paired request/response API and makes retained-history invalidation reviewable. A role-message array adds no required capability here; do not combine both storage models.

Graft 1 from B: remember an optional question's answer/skip within a defined recommendation context, with a small explicit typed state. Extract known values first. Ask an optional budget question only if it materially helps; do not delay every broad request for a cap. Skip preserves accepted preferences and cannot remove an unsupported hard constraint.

Graft 2 from B: use its compact product rows and clearly retained budget-change example as acceptance targets. Keep A's quieter header and readable fixture labeling. Prefer the existing Geist typography; preserve at least 16px mobile input text and adequate control targets.

## Required clarifications before implementation settles

- A's draft edit invalidates epoch, while retry requires matching epoch. Define retry eligibility using captured inputs plus an explicit current request context, not equality with the request's old epoch. Distinguish a stopped request eligible for retry from an edited request requiring a new turn.
- Neither candidate can require every action to match an owner granted only by successful responses: initial failed requests must still support retry. Separate latest retryable task eligibility from recommendation selection/research eligibility.
- Extend A's sidecar union with cancelled status or explicitly reset pending sidecars to idle on cancellation. An abort must never leave a retained message showing permanent activity.
- Completed response data is immutable; sidecar state is a separate replaceable field on that turn. Make that distinction explicit rather than claiming the entire completed turn never changes.
- Handoff start cancels source work and invalidates old attempts, but must preserve a well-defined selection context until that exact validated result arrives. Define the resulting current-action state rather than revoking every action indiscriminately.
- Keep a last accepted preference snapshot separate from invalid editor drafts. Apply must snapshot validated changes and render their readable user message; ordinary acknowledgments must preserve unresolved constraints without re-running providers.

## Rejected approaches and red flags

Reject per-turn autonomous fetching, a duplicated active-result store, event sourcing, backend transcript expansion, and generic preference patches that bypass current validation. Keep one public command boundary.

Reject B's unresolved WebResearch ownership and missing typed sidecars as implementation defaults. Its static web-context button also omits paid-action wording; production must explain the explicit Exa action before dispatch.

Reject blindly copying either sketch: both have send targets under their stated 44px goal; B uses small mobile text and reduces all historical content opacity. A's fixture completed-status is illustrative, never authority to fabricate runtime activity. Static HTML is not official-component provenance.

A's arbitrary 100-exchange cap is acceptable only as a documented local resource bound with a clear new-chat path; it must not silently prune history. Do not add new infrastructure to support it.

## Acceptance still required

One exact candidate commit must pass independent runtime QA/security and desktop/mobile visual QA. Exercise overlapping attempts, edits during each request type, stop/retry/reset, multiple retained turns, skipped questions, invalid drafts, sticky unknown constraints and stale merchant controls. Preserve exact URL/identity checks, fixture observations and source separation.

Capture first-visit dark, persisted light after refresh, empty chat, ordinary messages, inline questions, preference followups, recommendations, evidence and mobile history scrolling with composer visible. A build or these static sketches cannot establish those outcomes. The user must approve the actual PR screenshots before merging this redesign.
