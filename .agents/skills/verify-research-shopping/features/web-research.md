# Optional Exa web context

Users explicitly request web source excerpts after a fixture shortlist. Those sources never become sample claims, prices, offers, ranking inputs, or merchant destinations.

## Preconditions

The normal fixture verification helper and browser suite set `EXA_RESEARCH_ENABLED=false`. They require no private key and make no Exa requests. For deterministic UI checks, inject only the `/api/research` response at its network boundary and label that evidence as simulated provider data. Adapter tests separately exercise the real SDK against local HTTP sockets.

A real service check is a separate development action using the private root `.env`, explicit development mode, and an owned fresh API/web instance. Do not print the key, put it in command arguments, copy it to another checkout, read it from the browser, or upload it to GitHub. Health must report `mode: fixture`, `liveIntegrations: true`, and `webResearch: enabled`. This proves configuration only; a successful actual source response proves retrieval.

## Drive the browser

1. Submit a complete supported headphone request and identify its current actionable assistant turn. Before any web action, require zero POST requests to `/api/research`.
2. Within that turn, choose `getByRole('button', { name: 'Search the web for context', exact: true })`. Require one request with the current catalog product IDs and preferences. No client key or raw Exa options are sent.
3. On a ready response, open the source-count disclosure with `getByRole('button', { name: /web sources?/ })`. Inspect source titles, HTTPS destinations and plain excerpts. The displayed retrieval time is not page freshness or a verified offer observation.
4. Use representative ten-source results with long excerpts. The initial view stays compact; additional sources and full excerpts require explicit controls. Check keyboard and touch activation, text wrapping and body-level overflow at 1440px and 390px. Do not open external pages merely to complete a local test.
5. While a delayed source request is pending, edit valid and invalid budgets, a brand draft, the prompt, or reset/new-turn state. Require actual cancellation and no late result attached to another or invalidated turn. Completed historical sources may remain as attributed snapshots. Check one request per action despite double click/StrictMode. Starting a handoff cancels pending source work. A cancelled task must not remain spinning when its historical message stays mounted.
6. Exercise disabled, empty, timeout, invalid response and connection-failure states. The sample comparison and selection remain usable. A retry must require another explicit action.
7. Compare the same turn’s product-card contents before and after web retrieval. Select a product and require the visible **Open manufacturer product page** link to equal the actual `/api/select` response. Its accessible name includes the new-tab suffix; use a non-exact name match or the complete accessible name.

## Trust and evidence

Malformed or unsafe source URLs must fail response parsing or be omitted by the adapter. Cover credentials, non-HTTPS schemes, loopback, IP literals, and local/reserved hosts. Do not broaden the exact manufacturer URL policy for fixture claims or offers. Render source text through ordinary React escaping. Observe unexpected external browser requests as a failure.

Keep the candidate SHA, working-tree state, API response status, source count, unmodified sample-card proof, screenshots, trace, and owned-server cleanup. A harness failure is not a successful full journey. Preserve failed attempts with their diagnosis. Never present stubbed browser data as real Exa evidence. Use sanitized source metadata, not raw provider errors or credentials.

The source and HTTP tests are in `tests/unit/web-research.test.ts`, `tests/api/web-research.test.ts`, and `tests/api/exa-research.test.ts`. The main Chromium suite includes the Exa browser journeys. Run full package checks when the contract or lifecycle changes.
