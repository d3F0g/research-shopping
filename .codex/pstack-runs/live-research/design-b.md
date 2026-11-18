# Candidate B: one evidence-first research turn

## Problem
Normal chat must discover real products through Exa without forcing them through the eight-product fixture catalog or pretending research pages are verified offers. Keep the old fixture engine intact for explicit automated-test composition. Existing PR28 transport/URL bounds are the foundation, not a second provider path. Grounding: capability-audit.md, merchant-evaluation.md, canonical Exa skill and search/sdks/prompting references, actual exa-js 2.28 declarations.

## Usage (caller first)
```ts
// Composition: live research is the normal development app; no key => unavailable.
const turns = createResearchTurns({ research: createExaResearchFromEnvironment(process.env), quota });
const app = createApp({ turns }); // no implicit createFixtureProviders()
// Mounted /api/turn: preference parsing, intent, research, projection happen behind one call.
const reply = await turns.respond(parsedRequest, { signal: context.req.raw.signal, sessionId });
// Automated suites deliberately opt into fixture behavior, regardless of any developer key.
const testApp = createApp({ turns: createFixtureTurns(createFixtureProviders()) });
// Client preserves the returned snapshot in the existing owned turn, guarded by generation.
if (accepts(generation)) completeTurn(turnId, reply);
```

## Shape
```ts
type Evidence = { sourceId: string; quote: string };
type PublicHttpsUrl = string & { readonly __publicHttps: unique symbol };
type ResearchRequest = TurnRequest & { turnId: string };
type ResearchTurnUnavailableReason = "disabled" | "missing-key" | "quota" | "timeout" | "provider" | "invalid" | "empty";
type ResearchSource = { id: string; title: string; url: PublicHttpsUrl; highlights: string[] };
type ResearchProduct = {
  id: string; name: string; sourceIds: string[]; facts: Evidence[];
  price: { kind: "page-observed-unverified"; quote: string; sourceId: string } | null;
  stock: "unknown";
  constraints: { key: string; state: "supported" | "unknown" | "conflict"; evidence: Evidence[] }[];
};
type ResearchSnapshot = {
  kind: "web-research"; retrievedAt: string; sources: ResearchSource[];
  products: ResearchProduct[]; limitations: string[];
};
type ResearchTurn =
  | { kind: "message"; text: string; preferences: Preferences }
  | { kind: "question"; text: string; preferences: Preferences; optional: boolean }
  | { kind: "research"; text: string; preferences: Preferences; snapshot: ResearchSnapshot }
  | { kind: "unavailable"; text: string; preferences: Preferences;
      reason: ResearchTurnUnavailableReason };
type TurnService = { respond(request: ResearchRequest, context: { signal: AbortSignal; sessionId: string }): Promise<ResearchTurn> };
type ResearchOperation = (input: { message: string; preferences: Preferences }, signal: AbortSignal)
  => Promise<ResearchSnapshot | { unavailable: ResearchTurnUnavailableReason }>;
// Future integration boundary only. No merchant scraping or dormant concrete API adapters.
type MerchantVerificationProvider = {
  verify(product: ResearchProduct, context: { region: Region; currency: Currency }, signal: AbortSignal)
    : Promise<{ state: "unavailable" } | { state: "unverified"; reason: string }
      | { state: "verified"; proof: VerifiedMerchantProof }>;
};
type VerifiedMerchantProof = {
  provider: string; listingId: string; variantId: string; region: Region; currency: Currency;
  amount: number; availability: "in-stock" | "backorder" | "unavailable" | "unknown";
  availabilityBasis: string; merchantUrl: string; observedAt: string; expiresAt: string; evidence: Evidence[];
};
```
The sketch's aliases use existing domain types; new response schemas validate every union at both API boundaries. FixtureTurnResponse remains a distinct discriminant accepted only by the explicit fixture composition; never coerce live products into fixture Product/Offer/Candidate.

## Module map and exact SDK boundary
1. `domain/research.ts` owns the response schema, pure evidence projection, constraint outcomes and source URL validation reused from `domain/web-research.ts`. No Exa imports here.
2. `server/exa-research.ts` replaces catalog-only query construction with one research operation and retains PR28 signal/deadline/text bounds. It owns SDK parsing, grounded extraction and no-retry behavior; remove the second paid shortlist-sidecar call from the normal UI.
3. `server/research-turns.ts` owns respond: updatePreferences, ordinary-message/clarification decision, one research invocation, concise deterministic answer. It hides intent and evidence rules behind the single TurnService interface (interface depth; boundary-discipline).
4. `server/research-quota.ts` owns the process-wide persistent spend ledger and reservation invariant. `server/index.ts` alone composes it with environment/key access; app.ts just validates and forwards the incoming signal. The production branch always composes disabled research.
5. `client/api.ts`, `useConversation.ts`, existing `ResearchResults.tsx`/`WebResearch.tsx` render the new discriminant inside the same AI Elements messages. Reuse shadcn cards/disclosures; no additional page, mode chooser or dashboard.

Actual exa-js 2.28 call shape (the third argument controls transport and full response body deadline):
```ts
const response = await exa.search(query, {
  type: "auto", objective, numResults: 5, contents: { highlights: true },
  systemPrompt, outputSchema,
}, { signal, timeout: 12_000 });
```
Five results is an explicit small-budget product cap. No category/domain/freshness filters, extra summary calls, Agent runs, auto-retries, or additional provider key. `query` expresses shopper intent; `objective` names comparison goals and preferred manufacturers/substantive reviews. `systemPrompt` requires exact named models, verbatim source quotes, null missing fields, no inferred price/currency/stock and no hard-constraint relaxation.
Use one small schema: `{ products: [{ name, url, factQuote, priceQuote: string|null }] }`, max three products, bounded strings. This stays within SDK maximum depth 2 / ten properties; do not build nested variants/claim tables in the extraction schema.
Installed response fields are `output?: {content: string | Record<string,unknown>; grounding: {field:string; citations:{url:string;title:string}[]; confidence:"low"|"medium"|"high"}[]}`, `results`, `requestId`, optional `costDollars`. Parse string JSON explicitly, validate all shapes and limits, never cast model output directly. `costDollars.total` is reported request cost, never account balance.

## Evidence, identity and hard constraints
Projection accepts a product/fact only if its URL is an exact canonical URL present in validated returned results, its corresponding output field has grounding citing that URL, and its normalized verbatim quote occurs in that result's returned highlights. Citation confidence alone is insufficient. Missing/malformed grounding yields sources-only research with a clear limitation; no second call.
Product IDs derive from validated source URL plus exact model name and are server-created research identities, independent of catalog IDs. Do not merge similar names or configurations. Cross-source corroboration is optional only when exact model identity is explicit; otherwise show separate observations and uncertainty.
Store price as a quotation, not a parsed Offer. Show “Page-observed price — unverified”; source retrieval time is distinct from price freshness. Stock and SG delivery remain unknown. “View source” opens only actual returned public HTTPS URLs with existing safe external-link behavior; never label this Buy/verified merchant/select.
Supported category parsing remains headphones/laptops. Unknown category or unsupported hard constraint yields an honest compact limitation/question and never inherits a previous category silently. Keep pending hard constraints sticky; do not force optional budget answers before initial research.
Supported hard feature/budget constraints need affirmative attributable evidence; unknown/conflict cannot be classified eligible. Because current price/delivery/stock lack merchant proof, show research alternatives with unresolved eligibility and no “meets all requirements” or invented price ranking. Text explains the missing evidence before any optional comparison.

## Spend ownership and repeated requests
One local server process owns a durable ignored ledger, reserves before network and admits at most one paid call at once. Fail closed if ledger is missing on restart unexpectedly, malformed or locked by another process; first explicit initialization creates it. Never derive reset from app/session reset.
Initial operational policy: max two paid calls total, reserve US$1 each, local spend ceiling US$2; retain the remaining US$8 outside this experiment. Root may widen only after inspected real costs, within the user's US$10 total. These are conservative app limits, not a claim that Exa enforces a maximum per-call charge.
Atomically persist a pending reservation before invoking SDK; settle it with validated `costDollars.total` after response. Missing cost/error/cancel/crash retains reservation and disables subsequent calls pending root inspection. Unexpected cost above reservation also latches unavailable. Never refund cancellation with unknown billing.
Use an opaque server-issued HttpOnly SameSite session cookie and client turnId (validated bounded identifier); never accept a client-selected session ID. Scope in-flight identity to session+turn and reject duplicate pending submissions; same-session completed retry returns the completed immutable snapshot, other sessions cannot retrieve it. Keep bounded session-local memory only (TTL/max turns), no global search-result cache. Shared quota state is global deliberately; evidence state is per session.
Do not automatically research on preference-editor keystrokes, source disclosure, theme change, repeated click or ordinary conversation. Material submitted research/budget changes permit one new call; formatting/detail requests reuse the completed client snapshot without claiming refreshed evidence. Existing generation/active-turn checks still revoke old actions. No client-supplied context becomes trusted server evidence.
Issue34 owns core engine cancellation; this unit depends on its verified head. New research passes mounted request signal directly to SDK and transport timeout including body reads; abort remains cancellation, never unavailable fallback or a late-publishing result.

## Synthesis decision
Independent candidate B; root fills final synthesis. This shape replaces normal research as one operation instead of pretending discovery/research/merchant stages can all be fulfilled by Exa.

## Tradeoffs accepted and alternatives
- Accept conservative, sometimes sources-only results in exchange for quotes that can be verified against returned content and trustworthy uncertainty.
- Accept a tiny initial quota in exchange for protecting remaining credit without pretending local accounting guarantees provider billing.
- Reject adapting Exa into existing DiscoveryProvider/ResearchProvider/MerchantProvider: that exposes catalog, offer and selection assumptions at every call site and requires fake merchant data to satisfy Candidate.
- Reject an agent/LLM framework: extra keys, unbounded calls and multiple orchestration layers add no value to this compact evidence projection.

## Risks and next step
Verify actual grounding field-path syntax in mocked SDK samples and root's first bounded runtime call before implementing field matching; unknown paths fail closed. Can a compact schema consistently return exact useful quotes? That is the first acceptance question, resolved by evidence rather than asking the user.
After Issue34 lands, implement the typed research discriminant and explicit fixture/live composition first, then reuse PR28 transport. Require existing 167/43 regression coverage in explicit test mode; add injected no-network research grounding/empty/error/quota/restart/duplicate/cancel/session tests. Independent QA/security inspect exact candidate, real desktop/mobile chat journeys and screenshots. Only root makes at most two bounded live runtime calls, records returned costs and stops on first unexpected charge/error; no live calls in CI. Keep Issue2 open for merchant proof; root continues P3/P4 category/evaluation scope afterward.
