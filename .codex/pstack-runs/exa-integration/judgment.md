# Independent cross-judge: Exa dev/test integration

## Recommendation

Use design A as the base. It gives the cleaner boundary for this product: fixture recommendations finish first, then a shopper explicitly requests separate web context. It keeps the Exa call and transient state local to an outcome-owned component, preserves offline `createApp()` behavior, and is more precise about cancellation and redacted provider output. This judgment is based on the candidate texts and read-only inspection of commit `9656f213068ca3a2f566070ed9ca0a64d91d32fe`; it does not claim runtime or live-service verification.

Candidate B independently describes the same endpoint architecture, but its late receipt of the root's preference for A means that overlap is not independent confirmation. The recommendation here rests on the implementation details below.

## Scores

| Criterion | A | B | Evidence and reason |
| --- | ---: | ---: | --- |
| Truth separation from fixture commerce | 5 | 5 | Both keep Exa sources out of `Claim`, `Offer`, ranking, and merchant selection. The current contracts restrict claims to fixture/manufacturer evidence, and `shopping.ts` enforces the exact approved manufacturer URL. A is especially explicit about keeping fixture labels visible. |
| Explicit paid action and UI lifecycle/race ownership | 5 | 4 | Both trigger only from a click after a recommendation. A spells out immediate double-click suppression, request-generation checks across success/catch/finally, abort-on-unmount, and why existing outcome clearing unmounts the component. B's keyed panel is sound for outcome replacement, but the sketch does not state the same in-flight retry/double-click and stale-completion guards. |
| Actual SDK cancellation and secret isolation | 4 | 5 | Both put the key and SDK on the server and pass cancellation to the Exa SDK. A matches the installed three-argument `search(query, options, requestOptions)` form, uses SDK `signal` plus `timeout` through body consumption, and silences SDK warnings. B's `AbortSignal.any` also reaches the SDK's fetch signal. B explicitly gates production composition and its proposed relative path resolves to the verified original-checkout root-level `.env`; A leaves production gating implicit. |
| Current canonical Exa request shape | 5 | 5 | Both use the natural-language query, `objective`, and nested `contents: { highlights: true }`; both omit unnecessary search parameters. This agrees with the installed Exa skill's recommended request. The installed `exa-js` declaration confirms the SDK cancellation options belong in the third argument, not the search payload. |
| Maintainability and testability | 5 | 4 | A keeps the Exa wire shape inside one adapter, defines parsed request/response contracts, preserves the offline app factory, and specifies local HTTP tests that exercise SDK cancellation and redacted logs. B has the same useful boundaries and injectable test seam, but omits warning suppression and is less explicit about response truncation and race tests. A's additional public-source URL restrictions should be kept only to the extent they represent a navigation policy; no server-side URL fetch is proposed. |
| **Total** | **24/25** | **23/25** | Scores reflect design completeness, not tested behavior. |

## Grafts and policy resolutions

1. **Add B's explicit production-off composition rule to A.** Compose Exa only in an explicitly designated development process with the private `root.env` loaded by the API command. Keep the default and production composition disabled even if `EXA_API_KEY` happens to exist. Make local dev set its environment explicitly rather than treating an unset environment as development. Tests should inject a fake operation and never load the file. This resolves production-off without weakening offline test behavior.
2. **Report all live integrations truthfully and keep fixture verification offline.** Keep `mode: "fixture"` to describe commerce. Set `liveIntegrations: true` when Exa is enabled, and add a clearly named `webResearch: "enabled" | "disabled"` capability so clients can distinguish it from commerce. With Exa disabled, health retains `liveIntegrations: false`; tests and the fixture verification helper must explicitly disable Exa. Add assertions for both disabled and enabled configurations. The helper's current requirement that health report `liveIntegrations: false` is a fixture-only check, not a reason to misreport a development process where live Exa is active.

Use the verified original-checkout root-level `.env` path in the API development command, without opening or printing the credential file. B's `../research-shopping/.env` path is consistent if the implementation checkout is the sibling `research-shopping-exa`; keep it only if that relative relationship remains true. Do not add the Exa search to `/api/turn`; doing so would either delay the useful fixture answer or charge before the accepted shortlist exists.

## Source checks

- `src/domain/contracts.ts` and `src/domain/shopping.ts` support the strict fixture claim / merchant-link boundary described by both candidates.
- `src/server/app.ts` injects dependencies into `createApp()`, defaults to fixture providers, and currently reports `{ status: "ok", mode: "fixture", liveIntegrations: false }` from health. Its request logger currently classifies unknown routes, so the separate research route must be added deliberately.
- `tests/api/app.test.ts` has an exact assertion for the offline health object. The verification skill and its smoke script also require `liveIntegrations: false` on the fixture helper. Keep those checks by explicitly disabling Exa in those contexts, and add a separate enabled-capability health case where `mode` remains `fixture` and `liveIntegrations` is true.
- `src/client/App.tsx` clears `outcome` on prompt/preference/draft edits, invalid budget input, turn submission, and reset. The render path switches away from `Results` during loading and handoff. This grounds A's outcome-owned component lifecycle, provided the new component is nested under the recommendation outcome branch.
- Installed `exa-js@2.28.0` declares `search(query, options, requestOptions)` with `signal` and `timeout`; its request implementation passes the resolved signal to `fetch` and consumes JSON before disposing the timeout. A's direct SDK timeout option is therefore the clearest way to bound network plus body consumption. Design B's composed abort signal is also a real cancellation path, not merely `Promise.race`.
- The installed Exa search reference allows `objective` for a search serving a larger task, recommends `contents.highlights: true`, and says other request fields need an explicit task reason. Both candidates meet that shape without `numResults`, filters, freshness fields, or content modes.

No `.env` or `root.env` file was read. No code, tests, live Exa request, or runtime behavior was changed or run.

## Principles that changed this judgment

- **Experience First** favored the explicit post-shortlist click: the shopper gets the useful fixture answer before choosing a potentially paid request.
- **Model the Domain** favored a distinct web-research response and panel state, rather than adding Exa data to fixture claims or tool activity.
- **Boundary Discipline** favored server-side key ownership, adapter parsing, and a separate source-link policy.
- **Foundational Thinking** favored using existing outcome invalidation as the lifecycle boundary rather than adding another App-level revision/state family.
- **Test Behavior, Not Implementation** changed the health recommendation to preserve observable offline behavior and test disabled and enabled capability through the API contract.
- **Prove It Works** keeps SDK/body cancellation and mounted Node disconnect behavior as required runtime checks; source inspection alone does not establish them.
- **Minimize Reader Load** favored one outcome-owned UI owner and one Exa adapter that contains query, timeout, projection, and redaction policy.
- **Laziness Protocol** rejected B's hard-coded env path and avoided adding a second automatic search path or global research cache.
