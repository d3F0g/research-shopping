# Research lifecycle

V2 uses POST `/api/turn` twice for a shopping request. `phase: prepare` validates and stores intent. A prepared identifier authorizes `phase: research`. Ordinary messages, clarification answers that remain incomplete, held comparisons, and presentation changes do not spend a provider call.

Use the explicit `tests/helpers/browser-server.ts` composition for automation. It runs Hono, conversation state, executor, Exa SDK, and normalization against owned loopback HTTP. Fixture data stays visibly labeled. The helper counts `/api/test-stats` before and after actions. Those are local substitute calls, never paid usage.

Verify a complete unfamiliar product request can progress without a fixed catalog gate. A hard requirement missing evidence remains unknown. Both budget bounds, currency, conditions, variant, identity, relevance, and hard-fit evidence govern eligibility. A real product alone does not prove a suitable recommendation.

Keep provider-error, empty, invalid-response, timeout, missing configuration, cancellation, quota, duplicate dispatch, and stale preparation cases distinct. No error path may select a fixture. Tests for the actual SDK use local HTTP transports. Check `tests/api/v2-exa.test.ts` and `tests/api/v2-app.test.ts` for the current covered branches.

Activity reflects pending HTTP work. Complete JSON is not token streaming or reasoning. Preserve the failed request and accepted intent with honest recovery and no automatic retry. Live usefulness requires separately authorized genuine Exa evidence and independent product QA.
