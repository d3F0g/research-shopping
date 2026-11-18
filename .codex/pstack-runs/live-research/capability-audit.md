# Issue 2 live capability audit

The user wants genuine product research and merchant offers without repeating the Exa context integration from PR 28.
This read-only audit inspected commit `1cf12b2cb5468872365d825751dee532bc4f9d5a` in `/Users/josiahwong/Documents/research-shopping-live`.
No tests, live network calls, credential reads, repository edits, or GitHub mutations occurred.

## Current data shapes

- `src/domain/contracts.ts:89` defines `DiscoveryProduct` with a branded slug ID, category, brand, model name, summary, finite feature enum, manufacturer, and product URL.
- `Product` adds `Claim[]`. Claims distinguish supported, unknown, and conflict states. Supported claims require sources. Conflict requires two or more observations.
- `Source` has ID, name, URL, kind, and `capturedAt`. Kinds are `manufacturer-reference` and `fixture-observation`. There is no separate live extraction, publication date, variant identity, or freshness contract.
- `Offer` is explicitly fixture-only. It contains product ID, merchant name, merchant host, product URL, SG or US region, positive SGD or USD price, observed timestamp, and `dataKind: fixture`.
- Offer availability accepts `sample-in-stock`, `sample-unavailable`, or `unknown`. There is no representable live in-stock offer.
- `Candidate` combines one researched product, exactly one offer, and concise reasons. There is no offer list, seller ID, offer ID, merchant listing ID, variant/configuration identity, shipping price, or offer evidence.
- `TurnRequest` contains a message and current preferences. `SelectionRequest` contains a product ID and current preferences. Neither accepts caller-supplied links or prices.
- Preferences separate hard constraints from flexible priorities. Categories are headphones and laptops. The engine currently supports SG/SGD commerce only despite US/USD schema support.
- `WebResearchResponse` is separate. It has disabled, unavailable, or ready states. Ready contains a retrieval timestamp, bounded titles/URLs/highlights, and a truncation flag. It has no product claims or offers.

## Provider contracts and current composition

- `src/domain/providers.ts` exposes `DiscoveryProvider.discover(preferences, {signal})` and `findById(productId, {signal})`.
- `ResearchProvider.research(product, {signal})` returns claims. `MerchantProvider.lookup(product, preferences, {signal})` returns one offer or null.
- `Providers` groups those three interfaces. `src/server/app.ts:35` already accepts injected providers for local substitutes or future adapters.
- Production composition still defaults to `createFixtureProviders()` at `src/server/app.ts:44`. `src/server/index.ts` supplies only the separate optional Exa operation.
- `src/server/fixtures.ts` supplies eight static products and fixed observations dated 2025-01-15. Merchant lookup returns model reference pages and sample SGD offers.
- No current provider discovers arbitrary external product identities or retrieves live merchant offers.

## Identity, evidence, filtering, and ranking

- `src/domain/catalog.ts` contains the eight exact identities and five manufacturer hostnames. The approved hosts are Sony SG, Sennheiser, Audio-Technica, ASUS, and Dell.
- `src/domain/merchant-links.ts` requires canonical HTTPS URLs with an exact approved hostname, no credentials, port, search, or fragment.
- `matchesCatalogIdentity` requires a known catalog ID plus exact name, brand, category, and product URL. `src/domain/shopping.ts:98` applies this check to discovered products and selection lookups.
- `isSafeMerchantOffer` additionally requires the offer productId to match the product ID, the offer URL to equal the manufacturer product URL, and `merchantHost` to equal that URL's hostname.
- Research sources must use that same exact approved product URL at `src/domain/shopping.ts:104`. Independent review URLs cannot enter claim evidence through this path.
- Discovery results allow at most eight products and reject duplicate IDs. Research allows at most 16 claims. These are validated provider boundaries, not unrestricted adapter hooks.
- Hard filtering requires compatible category/features, no pending constraint or excluded brand, matching region/currency, supported feature evidence, budget compliance, and sample-in-stock availability.
- A required feature counts only when exactly one matching claim is supported and the discovery feature list includes it. Unknown and conflicting evidence cannot satisfy a hard requirement.
- `rank` at `src/domain/shopping.ts:46` follows priorities lexicographically, using supported feature counts or ascending price for value. Ties use price, then product ID.
- Comfort, sound quality, and performance lack comparative measurements and do not affect ranking. The response discloses that limit.
- `select` at `src/domain/shopping.ts:162` repeats identity lookup, research, offer lookup, safety checks, and hard-constraint checks before returning a handoff.
- Client handoff validation repeats exact catalog identity and URL checks at `src/client/api.ts:58`. Removing only the server catalog check would still leave live handoffs rejected in the browser.

## Request signals and the Issue 2 cancellation gap

- Client API functions pass actual abort signals to fetch for turn, selection, and web research in `src/client/api.ts`.
- `useConversation.cancel` at `src/client/useConversation.ts:112` aborts its owned controller, invalidates its generation, revokes active actions, and marks pending task records cancelled.
- Completion handlers accept only the current request generation. Draft changes, new submissions, preference edits, stop, reset, and selection transitions prevent abandoned results from publishing.
- The shopping engine's `call` at `src/domain/shopping.ts:77` creates its own controller and timeout for each provider call. It aborts that controller on timeout and completion.
- Neither `EngineOptions` nor `turn` nor `select` accepts the incoming request signal. `/api/turn` and `/api/select` never pass `context.req.raw.signal` into the engine.
- Therefore browser abort protects UI state but does not currently cancel shopping provider work at the server. A billable live shopping adapter could continue after the shopper stops.
- The parallel per-product research/merchant operations also have independent controllers. A failure in one does not immediately abort its siblings. Each remaining operation can run until its own deadline.
- `/api/research` already forwards `context.req.raw.signal` to Exa. The separate Exa path does not share this cancellation gap.

## Existing Exa capability, already completed

- `src/server/exa-research.ts:137` implements `createExaWebResearch` with the official SDK, a query, an objective, and highlights. It uses the caller signal and a five-second transport deadline.
- `researchQuery` resolves only existing catalog IDs to model names. The objective explicitly excludes checkout, current prices, and inventory claims.
- `/api/research` also rejects IDs outside the static catalog at `src/server/app.ts:148`. It cannot discover a new product.
- Results are plain source excerpts, capped at ten sources, three highlights per source, 640 characters per highlight, and 8,192 total highlight bytes.
- The adapter validates public HTTPS links and bounds text. It does not extract verified specifications, reconcile claims, change ranking, or certify seller inventory.
- `createExaWebResearchFromEnvironment` composes only in explicit development or test mode and honors `EXA_RESEARCH_ENABLED=false`. Production composition remains disabled.
- `docs/exa-research.md` documents one explicit search action, no automatic source opening, separate fixture claims/offers, and retrieval time distinct from page freshness.
- The Issue 2 table in `docs/capability-gaps.md` predates this partial delivery. Its live-web row must not be interpreted as evidence that the Exa context feature remains unimplemented.

## Chat and frontend integration boundaries

- `src/client/useConversation.ts:27` stores a request snapshot and body, selection, and source task state for each conversation turn. Current preferences remain outside historical response snapshots.
- Only `activeTurnId` can select or request sources. Historical assistant messages retain completed results and evidence without restoring old authority.
- `submit` runs the deterministic preference parser locally for contextual budget questions. The server runs the same parser before discovery. This is not an LLM conversation or tool loop.
- `App.tsx:320` renders the separate `WebResearch` component only for a recommendation message and supplies explicit active/action state.
- `ResearchResults.tsx` owns recommendation cards, evidence, comparisons, provider outcomes, and handoff. Its labels and source-link checks are fixture-specific throughout.
- `WebResearch.tsx` already presents live excerpts separately and states that they do not establish sample facts, price, or stock. That boundary is valuable to preserve.
- Tool activity is completed provider outcome metadata returned with the JSON turn. No streaming transport exists. Existing activity cannot be presented as live incremental research progress.
- `/api/health` always reports fixture commerce mode. `liveIntegrations` currently means the separate Exa dependency is configured, not that live shopping works.

## Minimal provider-independent model gaps

These are gaps inferred from the contracts, not a complete implementation design.

- Product identity needs a validated representation that does not depend on membership in `catalog`, including an exact variant/configuration identity when an offer varies by configuration.
- Claim provenance needs an explicit live-versus-fixture distinction and claim-to-source evidence that can name safe independent research URLs. A new timestamp alone cannot establish current evidence.
- Live offers need their own honest availability states, provider/listing identity, exact product or variant association, observation provenance, region/currency semantics, and a validated merchant destination.
- Offer identity must remain distinct from research-source identity. A public search result or manufacturer model page alone cannot establish a sellable offer.
- Selection needs enough server-owned identity to re-resolve and refresh the chosen live offer while applying current constraints. Client-supplied offer data cannot become authority.
- Server and client link validation need one reviewed live merchant policy. A general public-HTTPS source validator is insufficient as a substitute for merchant identity validation.
- Shopping operations need incoming cancellation through the engine and its adapters, with tests against actual mounted transport cancellation before paid calls are possible.
- UI/API data kinds and health need to distinguish fixture commerce, live research context, and actual live commerce capabilities. Fixture assertions must remain intact for fixture responses.

## Verification evidence and outstanding facts

- Static evidence only. `.codex/pstack-runs/chat-first/verification.md:5,11` records 167 unit/API tests and 43 browser journeys from the previous chat-first work. This audit did not rerun them or certify this exact head.
- Existing shopping tests cover constraints, unknown/conflicting claims, unavailable stock, malformed providers, deadlines, exact product identity, and unsafe links at `tests/unit/shopping.test.ts`.
- Existing Exa transport tests cover caller abort, stalled body deadline, and browser-disconnect propagation through the mounted Node adapter at `tests/api/exa-research.test.ts:183-272`.
- Outstanding evidence includes any genuine live discovery, claim extraction, live offer lookup, variant match, live offer selection refresh, and shopping-provider cancellation on disconnect.
- Live merchant access remains an external dependency in `docs/capability-gaps.md`. No configured merchant provider or access grant was inspected. Exa credits do not themselves provide merchant inventory access.
