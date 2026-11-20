# Issue 56 verifier handoff

Preserve the full history acceptance checks while testing account restoration after the browser has received its own account data.

Issue https://github.com/d3F0g/research-shopping/issues/56. Candidate `44d2ec292f49dadda80a7ca58897808a7fcbbb44`. Cherry-pick red `3525db9177d66af0b77831b9ca9e884aceef7305`, then fix `44d2ec292f49dadda80a7ca58897808a7fcbbb44`, onto root's current metadata tip. Only `scripts/verify-evidence-history.ts` differs from fd1. No application, UI, evidence or persistence code changed.

## Observed failure and bounded explanation

Read-only inspection of Actions run 44538025566, job 135608558957, and artifact 14535714416 confirmed the unchanged five-second `SGD 868.00` assertion failed after mobile page reload. Desktop restart passed. The separate control API had already returned the complete saved workspace. The CI artifact contains no post-reload browser response timing or DOM capture, so its exact cause and latency remain unproven.

One unmodified owned local baseline passed. A controlled browser regression then applied 5500 ms network latency only to the page's `/api/account` request. It failed the same five-second amount assertion. The diagnostic DOM was the initial empty/loading view with Send disabled. Events showed page loaded and account requests started, with no account response or page error before assertion failure. This proves a synchronization gap in the verifier. The control API response does not establish that the browser has received its separate bootstrap response.

## Fix and retained assertions

The verifier registers the browser's GET `/api/account` response observation before reload. It requires HTTP 200, a signed-in result and exact equality with the complete saved workspace. Only then does it start the original five-second amount rendering assertion. No timeout changed. There is no sleep, retry, skipped assertion, fixture fallback or app workaround.

The delayed mobile bootstrap remains a durable network regression. New failure JSON records account request/response/failure events, page errors and bounded rendered text. A failure screenshot is retained before normal owned cleanup. Successful reload records retain the response/validation timeline without headers or cookies.

All prior checks remain. The verifier still uses owned temporary PostgreSQL and actual Hono/Better Auth/SDK loopback composition. It verifies literal old V2/V3 messages, a new V4 catalog observation, the source amount, native condition labels, literal quotations, responsive bounds, stale-action rejection, no stale SDK dispatch, account isolation and PostgreSQL/API restart.

## Exact-head verification

At `44d2ec2`, `npm run verify:evidence:history` passed both 1440px and 390px journeys and recorded cleanup true. On mobile, page load was recorded at 1795097589817 and the browser account response at 1795097595341, approximately 5.5 seconds later. Exact workspace validation and the original rendering assertion then passed.

`npm run test:e2e` passed all 10 ordinary browser tests. `npm run typecheck` passed. Broader application/eval/PG suites were not repeated because only verifier sequencing and diagnostics changed.

Evidence is under `artifacts/fieldnote-v4/history-reload-ci-red/` and `artifacts/fieldnote-v4/history-reload-ci-fix/`. The red evidence was captured from the working tree subsequently committed as 3525db9, with its exact source diff retained. The green proof pins exact head 44d2ec2. Current history screenshots remain under `artifacts/fieldnote-v4/history-browser/`. A scope manifest proves the only changed tracked file. Tracked files are clean; untracked controlled evidence remains for root to archive.

No private file, environment file, key, existing database, grant or live provider was accessed. No paid call or GitHub mutation occurred. Owned runtime and browser processes completed cleanup. Root owns integration, new CI inspection and acceptance.

Fix Root Causes moved the assertion boundary to the browser data that rendering actually depends on. Prove It Works required the controlled failing browser case, unchanged assertions, exact saved data and successful owned restart proof. The original CI latency is an inference, not established by this controlled reproduction.
