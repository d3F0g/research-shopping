# Mobile resize measurement

Base cancellation candidate `9a85ff1a04ac3bc2081c24785d854149a1116bdc`.
Updated candidate `b05887bb54b94457b3238966adc04cf8a50ea1d8`.
Only `tests/e2e/research-shopping.spec.ts` changed, with one line after the desktop-to-mobile resize.

The comparison journey now waits for the browser render frame before measuring overflow. Both original strict document/body width assertions remain unchanged. There is no arbitrary sleep, polling retry, CSS change, or assertion tolerance.

A separate local browser probe reproduced the timing in three fresh pages. All three measured document width881 with viewport390 immediately after `setViewportSize`. Each measured document/body390 after the next animation frame. The registered resize-event sample preceded that frame and also measured390. Raw observations are `resize-observations.json`; `reproduce-frame.mjs` reproduces the probe against an owned fixture instance on8073.

The independent QA report separately established the same behavior on exact base1cf12b2 in five runs and cancellation candidate9a85ff1 in twenty runs. This edit synchronizes the observation with resized layout rather than concealing a persistent mobile defect.

Commands from the cancellation worktree:

```sh
PLAYWRIGHT_API_PORT=6073 PLAYWRIGHT_WEB_PORT=8073 npm run test:e2e -- --grep 'opens comparison and source disclosures' --repeat-each=20 --output=/tmp/research-shopping-live/cancellation-resize-owner/repeat
node /tmp/research-shopping-live/cancellation-resize-owner/reproduce-frame.mjs
PLAYWRIGHT_API_PORT=6073 PLAYWRIGHT_WEB_PORT=8073 npm run test:e2e -- --output=/tmp/research-shopping-live/cancellation-resize-owner/full
npm run typecheck
git diff --check
```

Results were20/20 comparison repetitions,43/43 full Chromium journeys, passing typecheck and diff whitespace. Logs are adjacent under `/tmp/research-shopping-live/cancellation-resize-repeat.log`, `cancellation-resize-full.log`, and `cancellation-resize-typecheck.log`. Tests ran the exact working-tree content then committed asb05887b. No application source, dependencies, credentials, or environment files changed. The package browser command explicitly disabled Exa. There were no live product-provider calls.

Inspected the actual mobile probe screenshot. The390px layout and source card fit, with readable fixture labels and composer. The generated tracked desktop screenshot was preserved in this evidence directory before restoring only that run-generated file toHEAD. Pre-existing untracked `artifacts/cancellation-owner/` remains intact. Both owned ports6073 and8073 were verified free after the run.

Fix Root Causes changed the fix from UI overflow suppression to observation synchronization. Test Behavior, Not Implementation kept the strict rendered-width contract. Laziness Protocol kept the change at one affected resize transition. Prove It Works required the actual browser probe, repetitions and complete browser suite.

Root owns independent delta review, CI, push and merge. No GitHub writes or merges occurred here.
