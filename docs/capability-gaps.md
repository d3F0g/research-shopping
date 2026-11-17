# Capability gaps and delivery gates

These findings came from parallel architecture, shopping-capability, and security assessments. A provider's documented API is not evidence of working access in this application.

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
| P1 | Live web research | Add credential-gated search provider retaining citations | Live smoke evidence with retrieval dates and exact cited URLs | #2 |
| P1 | Live merchant data | Approved eBay access or configured Shopify store; refresh on selection | Exact variant, currency, region, price and stock checks | #2 |
| P1 | Durable personalization | Authentication and PostgreSQL when shared durable state is needed | Restart retention, ownership, deletion, migrations | #3 |
| P1 | General language understanding | Structured model extraction behind provider boundary | Schema validation plus realistic semantic evaluations | #4 |
| P2 | Broader categories | Add sourced specifications and reviewed relevance corpus | Cross-category and unsupported-category evaluations | #4 |
| P2 | Cart handoff | Supported merchant cart only after product-link journey | Exact variant, quantity and region; no order placement | #2 |

## External dependencies

[eBay production access](https://developer.ebay.com/api-docs/buy/static/buy-requirements.html) requires approval. [Shopify Storefront search](https://shopify.dev/docs/api/storefront/latest/queries/search) covers a configured shop. [Google Merchant API](https://developers.google.com/merchant/api/guides/products/overview) manages a merchant's catalog. None supplies an unrestricted shopping connector merely because its documentation is public.

[OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search) can supply research citations. Citations do not prove inventory. [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) can enforce output shape, but factual claims still require evidence.

## Product principles as acceptance criteria

| Principle | Observable behavior |
| --- | --- |
| Understand first | A supported clear request produces useful results; an ambiguous request gets one relevant question. |
| Define preferences | Hard constraints and flexible priorities remain visible and editable. |
| Research and plan ahead | Results include source status, tradeoffs, and uncertainty before merchant selection. |
| Front-load | A short answer and primary recommendation precede detailed evidence. |
| No scrolling blobs | Small comparisons and disclosure controls replace long generated essays. |
| Per-user adaptation | Budget, feedback, and detail preferences affect subsequent turns in that session. |
| Restraint | One response per request, no unsolicited notifications or repeated progress messages. |
