# Exa web context architecture

## Problem

The current ResearchProvider admits synthetic catalog claims tied to exact manufacturer URLs. It cannot honestly absorb arbitrary live web excerpts. The user requested Exa development/test integration with a private existing .env key. No app-side LLM or tool loop exists.

## Usage

A completed recommendation renders an outcome-owned web context panel. Its button is the sole paid request trigger. It calls POST /api/research with the accepted productIds and preferences. The route calls one optional server-injected WebResearch operation. Source titles, public HTTPS links and plain highlights display in a distinct source disclosure. Disabled, empty, failure and timeout states leave the fixture recommendation usable.

## Shape

Use design-a.md as the base. Separate shared WebResearch request/response schemas from Claim/Offer/TurnResult. A discriminated response describes disabled, unavailable and ready results; a local component state union describes idle/loading/response/connection-error. No SDK wire types or key cross the server boundary. Canonical product names derive from valid catalog IDs; task objective derives from the accepted shopping context. The adapter owns query construction, SDK transport, strict bounded result projection and sanitized errors.

The Exa call is search(query,{objective,contents:{highlights:true}},{signal,timeout}). Installed exa-js2.28.0 supports the third-argument actual cancellation/deadline. Do not send extra modes, counts, domain/category filters, freshness, summary or synthesized output options. Source results do not update fixture prices, stock, ranking, claims or merchant destinations.

## Synthesis decision

Root selects the explicit endpoint/component shape from candidateA. CandidateB independently evaluated the same two structural alternatives, then received a late pointer to A's preference, so agreement is not counted as blind corroboration. Graft B's production-off composition and accurate live capability health. Use existing .env filename through an API-only development command, never a hard-coded machine path. The independent available cross-judge scored A24/25 andB23/25, recommended A with those same two grafts, and found no material conflict. This is a source-based design verdict; runtime verification remains required.

A request is triggered only by the event handler, never an effect under StrictMode. The panel is mounted only for an accepted recommendation. It aborts on unmount and guards generation/controller identity before accepting a completion. Existing outcome clearing handles prompt, budget, brands, category, reset, retry and new turn invalidation. Prefer this ownership over duplicating App's revisions/controllers. Ensure selection/handoff and same-shortlist follow-ups cannot retain stale context. Use actual cancellation through Hono req.raw.signal and SDK request options, not Promise.race around live work.

## Development configuration and health

Root .env is ignored/untracked and chmod600. Only the API development process loads .env using Node's supported env-file mechanism. Compose live Exa only for explicit NODE_ENV=development or test, when the key exists and EXA_RESEARCH_ENABLED is not false. The API development command sets its development environment explicitly. Undefined and production environments remain disabled. Default createApp() is offline regardless of host environment. Existing fixture tests, Playwright and smoke helper explicitly disable live composition so the supplied development key never causes paid CI/test calls. No VITE key, GitHub secret, credential rotation or production deployment. Health distinguishes fixture commerce from the configured optional web capability; do not keep liveIntegrations:false when live search is actually enabled.

## UI and evidence

Use existing official shadcn primitives and AI Elements Sources/Inline Citation patterns. Place the compact optional action near the useful answer, with concise source previews and progressive disclosure. Labels explain retrieved web context, possible cache age and lack of price/stock verification. Render all provider text through normal React escaping. Use validated public HTTPS links with no credentials and no local/private destinations, noopener/noreferrer, no automatic page opens or external image requests. Keep current synthetic fixture disclosure and truthful provider activity unchanged.

## Verification

Meaningful deterministic tests cover exact SDK request body, actual upstream network/body abort, mounted HTTP disconnect, disabled/error/empty/malformed/unsafe results, response limits and log privacy; injected provider tests need no .env. Preserve all110 unit/API and20 browser assertions. Add real desktop/mobile source/citation journeys, no mount/StrictMode paid call, double-click suppression, explicit retry, edits/reset/stale completion and unchanged safe handoff. Independent QA and security review the exact commit. Root performs a bounded actual Exa call through project code using the existing key, scans staged/tracked blobs and built assets for the actual value without printing it, and verifies CI before an eligible native merge.
