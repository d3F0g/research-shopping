# Final cancellation QA and security delta

The goal is to stop abandoned shopping requests from consuming provider work while preserving strict mobile layout verification. Independent final QA passes `b05887bb54b94457b3238966adc04cf8a50ea1d8` against base `1cf12b2cb5468872365d825751dee532bc4f9d5a`. Security delta review also passes. No blocking finding was identified in this scope.

## Reviewed scope

The detached QA checkout was clean before switching from previously reviewed `9a85ff1a04ac3bc2081c24785d854149a1116bdc` to the final candidate. The only subsequent commit adds one requestAnimationFrame wait immediately after the comparison journey changes from desktop to mobile width. The document and body width assertions retain their original strict viewport bound. There is no sleep, retry, tolerance, CSS suppression, or application change.

The complete `src` tree hash is `455f7308f8dabb1d1f0ace5a99a5bc46fe9c4455` on both commits. Package files, mounted cancellation tests and domain cancellation tests are unchanged. The previous independent full QA report and security report were read, and their unchanged application coverage remains applicable. This review does not claim that their 181-test/full-43-journey runs were newly executed on the final head.

Prior candidate/base instrumentation establishes that the immediate 881-pixel measurement occurred before the browser resize event. Every sampled resize event and subsequent frame measured 390 pixels. The new line waits for that actual rendering stage before observing layout. It does not hide a rendered overflow or weaken the contract.

## Independent checks on the final head

- `npm test -- tests/unit/shopping.test.ts tests/api/shopping-cancellation.test.ts` passed all 82 tests. These include five mounted client-disconnect cases and an actual upstream HTTP response body closing before its provider deadline. See `mounted-and-domain.log`.
- `PLAYWRIGHT_API_PORT=6173 PLAYWRIGHT_WEB_PORT=8173 npm run test:e2e -- --grep 'opens comparison and source disclosures' --repeat-each=10 --trace on --output=/tmp/research-shopping-live/cancellation-final-qa/e2e` passed all 10 repetitions. Each retained strict document/body overflow assertions after resize. See `e2e.log` and individual traces.
- `npm run typecheck` passed. See `typecheck.log`.
- `git diff --check 1cf12b2 HEAD` passed. Actual source tree identity and changed-file scope are recorded in `scope.json`.

The actual generated desktop citation and mobile comparison screenshots were copied into this evidence directory and visually inspected. Text, fixture labels, source disclosure, comparison columns and bottom composer remain readable at their intended viewports. The mobile page has no horizontal clipping. The comparison remains inside the conversation rather than a dashboard.

## Security delta and limits

The final delta executes only in the Playwright test. It adds no runtime capability, dependency, request data, network destination, credential access, permission, or logging. Application bytes are identical to the independently security-reviewed cancellation patch. No new security blocker is introduced. The mounted tests independently reconfirm cooperative external HTTP cancellation on the final head. This does not promise that arbitrary signal-ignoring providers can be forcibly terminated.

The previous full QA report is `/tmp/research-shopping-live/cancellation-qa/verdict.md`. The previous security report is `/tmp/research-shopping-live/cancellation-security/review.md`. Root owns final fresh Comment Sicko reconciliation, GitHub CI, branch rules, and merging. This report makes no merchant verification or live Exa retrieval claim.

The checkout is clean after verification. Owned ports 6173 and 8173 were confirmed free by binding and closing them. No source edits, external product requests, key reads, private environment-file reads, GitHub mutations or paid Exa calls occurred.

## Principles

Prove It Works required actual tests and source-tree identity instead of extending an earlier verdict by assumption. Test Behavior, Not Implementation kept strict rendered viewport bounds and actual upstream HTTP closure as the observable contracts.
