# Fieldnote V2 architecture

Fieldnote keeps conversation state in Hono and uses one native Exa Answer operation for each explicit research request. Exa is the sole external AI research and structured-answer provider. There is no application OpenAI API, Codex-auth inference, local interpreter dependency, runtime catalog or category registry.

## State and ownership

`src/domain/conversation.ts` defines current intent, typed pending questions, immutable message snapshots and prepare/research inputs. `turn-reducer.ts` owns accepted changes. Complete user wording and raw hard groups stay visible to research. Unsupported compound edits remain pending rather than partly changing preferences. The server interprets text; the client sends messages or explicit contextual edits.

Budget minimum, maximum and currency are separate fields. Currency clarification retains its identity, original request and both numeric bounds. Presentation changes and held evidence actions do not dispatch research. The server resolves displayed product order and recomputes recommendation eligibility under current requirements.

`src/server/conversations.ts` owns guest sessions and prepared operations. Operations bind the owning session, epoch and immutable research intent. Claiming is atomic. Duplicates join or replay rather than reserve twice. Requirement changes, Stop and New chat invalidate publication. Presentation-only changes preserve valid in-flight work.

```mermaid
flowchart LR
  UI [Official chat components] --> Prepare [Validated Hono prepare]
  Prepare --> State [Authoritative conversation reducer]
  State --> Held [Free held-evidence reply]
  State --> Pending [Typed material clarification]
  State --> Prepared [Owned prepared operation]
  Prepared --> Quota [Persistent conservative admission]
  Quota --> Exa [One Exa Answer SDK request]
  Exa --> Evidence [Source and price boundary]
  Evidence --> Eligibility [Server recommendation eligibility]
  Eligibility --> Snapshot [Immutable response snapshot]
  Snapshot --> UI
```

## Evidence

`src/server/exa-research.ts` validates native output and binds observations to retained safe citation URLs and literal source text. Each support retains the exact native excerpt and expanded complete context with offsets. Truncation and missing completeness cannot gain certainty through native quotations. Identity, request relevance, hard criteria, attributes and observed prices remain separate assessments.

The server computes eligibility. Unknown hard fit is not satisfied. Budgeted choices require qualifying exact-variant observed money, explicit requested currency, both bounds and resolved conditions. Known negative, conflicting and conditional context remains material. Source-based model interpretation is labeled separately from deterministic provenance checks and merchant verification.

The server orders by eligibility and supported flexible-preference coverage. Equal or incomparable coverage stays a tie. Native prose cannot override computed eligibility. Stock, delivery and current merchant offers remain unknown without an authorized merchant integration. Safe source navigation does not prove merchant authorization.

## Costs and cancellation

`research-executor.ts` combines the actual SDK request with the unchanged conservative quota contract. Admission is persistent before dispatch. Unknown cost retains its reservation and stops the program. Cancellation reaches the SDK transport and response body. A returned known provider cost is recorded even if publication is cancelled. No automatic retry, fixture fallback or allowance renewal occurs. Local exposure limits are not provider balance or a provider-enforced spending cap.

Issue #42 remains externally blocked. Automated development, CI and evaluations use owned loopback transports and isolated accounting doubles. The original key, ledger, grant and historical unknown charges are outside this rebuild's writes.

## Optional accounts

Better Auth and PostgreSQL preserve reviewed authentication and transaction mechanics from PR #41. `workspace-store.ts` locks actual sessions and account-owned rows, validates after lock waits and claims durable operations before provider work. Research runs outside transactions. Publication checks ownership, session, epoch, operation and request identity. Replay receipts do not promise exactly-once external billing.

V2 adds a separate workspace table. Existing migrations and historical workspace rows remain intact. Stored current state and immutable responses have bounded versioned schemas. Retention is30 days, at most 50 whole turns and256 KiB. Account outage never silently writes to a guest. Immediate cross-process transport cancellation remains limited; durable publication fencing is still enforced.

## Frontend and evaluation

React composes unmodified official shadcn components and AI Elements. Neutral official tokens, default dark mode, persistent theme, minimal header, centered history and a compact composer define the layout. Transport phases reflect actual requests rather than simulated streaming. Contextual editing and recommendations remain inside the conversation.

All sixty independent scenarios and historical reports are preserved. `evals/v2/` observes actual Hono and SDK loopback traffic and mechanically projects current state for unchanged assertions. Raw current responses remain beside the projection. Exact native excerpts and complete contexts have separate checks. Semantic entailment and live usefulness are not inferred from quote containment, green CI or synthetic responses.

The [decision record](../.codex/pstack-runs/fieldnote-v2/architecture.md) compares the alternatives and identifies reused, adapted and retired components. The final V2 PR stays unmerged for the designated user review.
