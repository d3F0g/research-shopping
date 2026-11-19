# Capability gaps and delivery gates

The P0 rows record the original automated fixture milestone. Normal development now uses Exa research; these synthetic catalogs and offers are confined to explicit automated tests. The current research and merchant boundaries are described in [Application architecture](architecture.md). A documented API is not evidence of working access.

| Priority | Capability | First implementation | Verification | Tracker |
| --- | --- | --- | --- | --- |
| P0 | Intent and preferences | Typed session preference patches, explicit category limits, hard constraints and flexible priorities | Ambiguous request, lower budget, excluded brand, category/region change | #1 |
| P0 | Discovery and relevance | Deterministic fixture discovery behind a replaceable interface | Eligible products only, no silent constraint relaxation | #1 |
| P0 | Specifications and sources | Claim-level fixture evidence with unknown/conflicting states | Conflict is disclosed and cannot become a confident reason | #1 |
| P0 | Comparison and recommendation | Constraint filtering before scoring, concise rationale and tradeoff | Recommendation changes with preferences; no match is explicit | #1 |
| P0 | Price and availability | Labeled sample offers with fixed timestamps | No sample price or stock is described as current or verified | #1 |
| P0 | Selection and merchant link | Product-ID selection, safe HTTPS exact-host link policy | Selected identity matches handoff; unsafe links rejected | #1 |
| P0 | Failure recovery | Bounded adapters and explicit failure outcomes | Failed/stale tools cannot fabricate replacements | #1 |
| P0 | Conversation and adaptation | Session-scoped preferences, reset, concise/expanded presentation | Multiple turns, dissatisfaction, independent sessions | #1 |
| P0 | UI and usability | Responsive React comparison, accessible native controls and disclosures | Desktop/mobile browser journeys and screenshots | #1 |
| P0 | Security and observability | Loopback, HTTP boundary validation, safe links, bounded logs and state | Runtime boundary tests and independent security review | #1 |
| P0 | Engineering system | Native subagents, isolated owner worktree, independent reviewers, durable issues | Exact-commit review and tested pull request | #1 |
| P1 | Live web research | Normal Exa discovery with model-specific quotations, source links, observed prices and persistent admission limits | Independent runtime/security/visual checks and bounded genuine retrieval; useful comparison acceptance remains tracked | #2, #35 |
| P1 | Live merchant data | Provider-independent verification interface; real adapters await authorized provider/store access | Genuine exact-variant, currency, region, price and availability proof; page excerpts cannot satisfy it | #2, #36 |
| P1 | Durable personalization | Authentication and PostgreSQL when shared durable state is needed | Restart retention, ownership, deletion, migrations | #3 |
| P2 | Language and evidence coverage | Bounded preference and source-evidence vocabulary with an independent corpus | Ambiguity, negative constraints, unsupported requests and cross-source conflicts; no arbitrary-language claim | #4 |
| P2 | Broader categories | Add sourced specifications and reviewed relevance corpus | Cross-category and unsupported-category evaluations | #4 |
| Out of scope | Payments and order placement | No payment processing or automated purchases | Normal research exposes source links only | #2 |

## External dependencies

The user confirmed that no authorized eBay, Shopify or Best Buy integration is configured. Do not repeatedly request access. Continue Exa research and independently executable work while recording merchant verification as an external dependency.

[eBay Buy access requirements](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) depend on the API and entitlement. [Shopify Storefront search](https://shopify.dev/docs/api/storefront/latest/queries/search) covers a configured shop. Public reachability alone does not establish permitted merchant use or working regional offers. The detailed [merchant evaluation](../.codex/pstack-runs/live-research/merchant-evaluation.md) records documentation evidence and its limits.

Exa is the primary live product research API. Its returned page observations retain source links and complete quotations. A retrieval timestamp does not prove page freshness, stock, delivery or a current price. The initial Exa credit constraint is US$10; automated tests use local substitutes and spend no credits. Follow the orchestrator's separately recorded bounded live-proof allowance and never reset the shared ledger.

## Product principles as acceptance criteria

| Principle | Observable behavior |
| --- | --- |
| Understand first | A supported clear request produces useful results; an ambiguous request gets one relevant question. |
| Define preferences | Hard constraints and flexible priorities remain in structured session state and are editable through contextual conversation controls. |
| Research and plan ahead | Results include source status, tradeoffs, and uncertainty before merchant selection. |
| Front-load | A short answer and primary recommendation precede detailed evidence. |
| No scrolling blobs | Small comparisons and disclosure controls replace long generated essays. |
| Per-user adaptation | Budget, feedback, and detail preferences affect subsequent turns in that session. |
| Restraint | One response per request, no unsolicited notifications or repeated progress messages. |
