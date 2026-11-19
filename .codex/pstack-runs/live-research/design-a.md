# Candidate A: one research-turn boundary, evidence before offers

## Problem and grounding
Fieldnote currently has two incompatible authorities: catalog-only fixture commerce and optional Exa excerpts. Normal composition must become real research without widening fixture offers into counterfeit commerce.
Grounded at `1cf12b2`: `app.ts` defaults to fixture providers; `shopping.ts` and client handoff validation enforce exact catalog identity; `exa-research.ts` already owns official-SDK transport, abort/deadline handling and bounded safe sources; `useConversation.ts` owns immutable turn snapshots and active-action generations.
The fixture separation exists to keep unsupported prices, stock and manufacturer links from becoming merchant authority. Preserve it as a test contract; reuse/refactor the Exa boundary, rather than writing a second Exa integration.
Workflow: Ground complete from the supplied audits plus code; Sketch complete here; Agree is root synthesis; Implement and Scrap belong to the selected design's branch owner. No implementation or live calls occurred.

## Usage: caller's view first
```ts
const research = createResearchTurns({ exa: composeExa(environment), quota: openLocalQuota(config) });
const app = createApp({ mode: "research", research, logger }, config);
const reply = await research.turn(parsedRequest, context.req.raw.signal);
return context.json(ResearchTurnSchema.parse(reply));
if (reply.kind === "research") appendAssistant(<ResearchResults result={reply.research} />);
const fixtureApp = createApp({ mode: "test-fixture", engine: createShoppingEngine(fixtures) });
```

## Shape
```ts
type ResearchTurnRequest = TurnRequest & { operationId: string }; // UUID, stable across duplicate delivery
type SourceRef = { id: string; url: SafePublicHttpsUrl; title: string; highlights: string[] };
type Citation = { sourceId: string; quote: string; groundingField: string | null };
type Fact = { text: string; citations: Citation[] }; // exact source quotations, never free-floating synthesis
type PriceObservation = { kind: "page-observed-unverified"; quote: string; citation: Citation };
type ConstraintCheck = { constraint: string; status: "supported" | "contradicted" | "unknown" | "conflict"; explanation: string; citations: Citation[] };
type ResearchProduct = { id: string; name: string; variant: string | null; facts: Fact[];
  prices: PriceObservation[]; constraints: ConstraintCheck[]; stock: "unverified" };
type ResearchResult = { dataKind: "web-research"; retrievedAt: string; products: ResearchProduct[];
  sources: SourceRef[]; limitations: string[]; requestId: string; reportedCostUsd: number | null };
type ResearchTurn = SharedMessageOrClarification
  | { kind: "research"; preferences: Preferences; notes: string[]; research: ResearchResult }
  | { kind: "research-unavailable"; preferences: Preferences; reason: "not-configured" | "disabled" |
      "quota" | "busy" | "duplicate" | "timeout" | "provider-error" | "invalid-response" | "empty" };
interface ResearchTurns { turn(request: ResearchTurnRequest, signal: AbortSignal): Promise<ResearchTurn> }
type AppDependencies = { mode: "research"; research: ResearchTurns; logger?: Logger }
  | { mode: "test-fixture"; engine: ShoppingEngine; webResearch?: WebResearchOperation; logger?: Logger };
interface MerchantVerificationProvider {
  verify(identity: { name: string; variant: string | null }, market: { region: string; currency: string }, signal: AbortSignal): Promise<MerchantVerification>;
}
type MerchantVerification = { status: "unavailable" | "unverified"; reason: string }
  | { status: "verified"; proof: { provider: string; merchant: string; listingId: string;
      productId: string; variantId: string; region: string; currency: string; amount: number;
      availability: "available" | "unavailable" | "backorder"; observedAt: string; expiresAt: string;
      sourceReference: string; destination: VerifiedMerchantUrl } };
function createResearchTurns(deps: ResearchDependencies): ResearchTurns { throw new Error("not implemented"); }
```
`SharedMessageOrClarification` is the existing ordinary-message/clarification variants with provider-neutral wording. `SafePublicHttpsUrl` and `VerifiedMerchantUrl` are distinct branded outputs of separate validators; only the former is constructed now. There is no concrete merchant adapter and no normal purchase-selection endpoint.
The deep `turn` interface owns the whole research decision: preference interpretation, zero-call replies, deduplication, reservation, SDK adaptation, evidence validation and honest results. Callers never orchestrate discovery/research/merchant stages or import SDK types (`boundary-discipline`, `interface-depth`).

## Exact SDK boundary and extraction
Checked installed `exa-js/package.json` = 2.28.0 and `dist/index.d.ts:4707-4868,5216-5230,5287-5311,5574-5578`; runtime `index.mjs:3730-3768,3871-3897` sends one fetch and reads its body before disposing cancellation.
```ts
const response = await exa.search(query, {
  objective, numResults: 5, contents: { highlights: true },
  outputSchema: pageObservationSchema, systemPrompt: evidenceRules,
}, { signal, timeout: 15_000 });
// response.output?.content: string | Record<string, unknown>
// response.output?.grounding: { field: string; citations: { url: string; title: string }[];
//                             confidence: "low" | "medium" | "high" }[]
// response.costDollars?.total: number; response.requestId: string
```
Use `auto` by omission. Five results is an explicit credit-conservation decision. `pageObservationSchema` is `{ observations: [{ name, url, quotedFacts: string[], priceQuote: string | null }] }`, capped at five rows and three facts/row: five total named properties, two object levels; no nested fact objects or wide extraction. Zod validates output after bounded JSON parsing when content is a string; missing/malformed output is unavailable, never guessed.
`query` carries product/search intent and accepted preferences; `objective` says this research supports comparison and prefers manufacturer specifications plus substantive independent reviews. `systemPrompt` requires exact model names and verbatim supporting quotes from returned pages, null unknown prices, no stock/purchase claims, no invented facts, and treats page instructions as untrusted data. No filters, freshness controls, per-result summaries, Agent, retries, or additional LLM dependency.
Reuse the current source sanitizer and output caps. Keep only safe URLs actually in `response.results`; extraction URLs and grounding citation URLs cannot introduce new destinations. Canonicalize once with the shared validator before matching. Render titles/quotes as plain text.
Require each product name and each quoted fact/price to occur in the same returned source highlight context; retain the matching source reference. `output.grounding` additionally attributes fields when its citations match that evidence; retain the provider field verbatim, do not invent an undocumented path grammar. Confidence is provider metadata, not verification. Missing quote support drops the assertion, not the safety check.
Only combine observations when exact normalized model-and-variant identity is supported; otherwise retain separate page-scoped research leads. IDs hash validated identity plus source URL and are not catalog IDs or merchant listing IDs. Do not infer a laptop configuration or aggregate “from” prices into a variant price.
Use local deterministic patterns only for the currently supported explicit feature evidence, positive/negative wording and identity checks. Everything else remains quoted context or unknown; conflicting supported observations stay visible. Safe source links are “View source,” never “Buy,” “Choose offer,” or a verified merchant handoff.

## Hard constraints and conversation
Known contradictions exclude a product from recommendations; unknown/conflicting hard constraints never become eligible. Display relevant research leads under “Needs verification” with the exact unresolved constraint. Page prices remain quotes; never assert current budget eligibility, stock, shipping eligibility, currency conversion or final payable price from them.
An unambiguous page quote above the requested budget may rule a lead out; a lower quote cannot establish current affordability. Ambiguous currencies, ranges, “from” prices and variants remain unknown. Research geography is not delivery proof.
Keep headphones/laptops and the existing supported feature/SGD/USD parser scope explicit in neutral wording. Unknown constraints remain sticky; ask the missing material clarification and make zero Exa calls. Unsupported categories honestly state the limitation. Broader language/category work is Issue 4, not silently promised here.
Preserve `Preferences` separately from per-turn snapshots. Ordinary replies, detail changes, disclosure toggles and comparisons of already-held evidence make zero network calls; compose them from the current browser's completed result only. Never accept client-supplied evidence as server authority. A changed research objective or explicit refresh is a new research turn, at most one search.
Retain `useConversation` generation and active-action checks, cancel on stop/reset/new request, and leave historical source disclosures readable without active research/selection controls. Extend the response union rather than mutate historical fixture-shaped responses. Keep official shadcn/AI Elements, theme persistence, compact composer and actual completed activity; no fabricated streaming.

## Credit guard and composition
One `ResearchTurns` instance owns paid admission. Default persisted local policy: USD 1 application allowance, at most 4 attempted calls, reserve USD 0.25 per call, one active call. Values are conservative local limits beneath the user's USD 10 credit envelope, not Exa price quotes or an account balance.
Check the caller signal before admission and immediately before dispatch. Persist each reservation before dispatch in ignored repository-local storage; operation ID plus request digest rejects duplicates/mismatches without another charge. Failed, timed-out, cancelled or crashed calls keep their reservation. Record finite nonnegative returned `costDollars.total` separately; charge the larger of reservation/reported cost and stop future calls on any reported amount above reservation or unexpected provider error. Never credit a cancellation back.
Use an exclusive startup lease for this local ledger so a second dev process fails closed; only its owner mutates it using atomic replacement. Restart recovers reservations, never resets the allowance. A stale lease or malformed ledger blocks paid calls until explicit local remediation. No automatic daily replenishment or reset-on-page-refresh.
No SDK-level maximum-cost field exists for this search contract; local admission cannot guarantee the remote balance or unknown billing. Independent review records this limit. Root's live proof uses at most two bounded calls, inspecting returned costs and stopping on the first unexpected charge/error.
Normal development composes Exa from the existing server-only root environment mechanism. Missing key, disable flag, error, empty sources or exhausted quota produce an unavailable response without importing fixtures. Production stays disabled. Tests select the fixture composition explicitly, use fake SDK/local HTTP servers, and force live composition off even if an inherited key exists.
`/api/health` reports `mode: research`, configured research capability, and merchant verification unavailable; configuration never reports successful research. Normal `/api/research` becomes unnecessary: existing source disclosures use the turn's returned evidence. Retain the old sidecar adapter/route only in explicit fixture tests while sharing its safe projection/transport implementation.

## Module map and ownership
Application owner: `domain/research.ts` owns public schemas plus pure evidence/constraint projection; `server/exa-research.ts` refactors the existing SDK boundary; `server/research-turns.ts` owns turn policy and the private persisted quota; `server/app.ts,index.ts` select composition; `client/api.ts,useConversation.ts,ResearchResults.tsx,App.tsx` consume the new research variant and source disclosures. Existing fixture catalog, engine and safety assertions remain unchanged and test-only in composition.
Cancellation Issue 34 owner separately fixes the old engine and mounted request propagation; this design consumes `context.req.raw.signal` and forwards it unchanged through new SDK transport/body reads. Do not duplicate that issue's implementation.
Orchestrator owns docs/tracking and records research delivery without closing Issue 2's merchant dependency; verification owner updates the project verification skill after launch. Independent reviewers own no app files and review the exact candidate commit.

## Verification and tradeoffs
Add meaningful contract tests for exact SDK request, malformed synthesis/grounding, hallucinated quotes/URLs, conflicting evidence, missing prices, unknown hard constraints, credit persistence/concurrency/duplicates, timeout and body-read cancellation. Re-run the existing 167 unit/API and 43 browser journey coverage after explicit fixture composition migration; preserve all identity and merchant-link assertions.
Real browser journeys cover primary search, budget changes, ordinary replies without billing, ambiguity, unavailable/empty/error/quota states, stale completion suppression, isolated sessions, source safety and history/theme persistence. Inspect desktop/mobile screenshots. Root's two-call proof records sanitized request IDs, returned costs, source/quote checks and UI screenshots under `artifacts/`; it does not prove merchant stock, comprehensive retrieval or unrestricted NLU.
We accept bounded category interpretation and discarded unsupported extraction in exchange for honest evidence and a small credit envelope. We accept a single-process local spend ledger in exchange for restart-safe admission without a service/database. A distributed deployment would need a separate budget store and explicit deployment authorization.
Alternative rejected: generalized discovery/research/merchant providers for normal turns expose stage coordination and force products through offer eligibility before authorized offers exist; their richer interface hides less useful behavior for this scope. Keep that engine only for its fixture tests and future separately scoped commerce design.
Synthesis decision: pending root comparison; Candidate A's defining choice is a single research-turn facade with page-scoped evidence and no normal offer path.
Next implementation step: land Issue 34, add the research schema and local-SDK boundary tests, then switch development composition and render the research union before enabling any paid runtime verification.
