# Candidate A

A typed functional shopping pipeline separates user preferences, discovery, research evidence, merchant offers, and presentation. `runShoppingTurn(session, input, providers, context)` returns a discriminated clarification, recommendations, no-match, or unavailable outcome. `selectProduct` refreshes offers before handing off.

Research facts and merchant offers have separate provenance. Supported, unknown, and conflicting evidence remain distinct. Fixtures have fixed capture times and explicit sample labels. Hard constraints filter before preference scoring. Session patches replace budgets and remove constraints explicitly. One bounded request pipeline is easier to test than a free-running product agent.

Suggested modules include shared runtime contracts, preferences, catalog, evidence, shopping orchestration, adapters, sessions, HTTP boundary, and React UI. Session memory is local and temporary. PostgreSQL follows authenticated durable-state requirements.

## Sources

- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developer.ebay.com/api-docs/buy/static/buy-requirements.html
- https://shopify.dev/docs/api/storefront/latest/objects/ProductVariant
- https://openai.github.io/openai-agents-js/guides/multi-agent/
- https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html
- https://hono.dev/docs/middleware/builtin/csrf

## Tradeoffs

The default fixture path can prove the complete journey without credentials. It cannot establish current prices, availability, comprehensive product coverage, or unrestricted language understanding. Live providers require separate credentialed runtime verification.
