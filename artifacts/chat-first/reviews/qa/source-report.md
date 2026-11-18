# Independent chat redesign QA

The user wants a polished minimal chat assistant with contextual preferences, retained conversation history, and preserved fixture research capabilities. The rendered source candidate meets that direction. Verdict is PASS WITH NOTES for source commit db4d80011a60b14b4045125d21c6765d86f0a004 against base 151fa506f58f4171add9f5efd684da809ee3248f. User screenshot approval is still required before merge.

Reviewed in the clean detached /Users/josiahwong/Documents/research-shopping-chat-qa worktree. This reviewer did not author or modify application files. Generated evidence is under /tmp/research-shopping-chat/independent-qa/final. No GitHub mutations were made.

## Evidence

- npm 11.6.2 ci installed the lockfile dependencies.
- EXA_RESEARCH_ENABLED=false npm test passed all 167 unit and API tests in 6 files. See unit-api.log.
- EXA_RESEARCH_ENABLED=false npm run build passed its tsc typecheck and Vite build. See build-typecheck.log.
- EXA_RESEARCH_ENABLED=false PLAYWRIGHT_API_PORT=7373 PLAYWRIGHT_WEB_PORT=5373 npm run test:e2e -- --trace on --output=/tmp/research-shopping-chat/independent-qa/final/playwright-results passed all 43 browser tests. See e2e.log and playwright-results/.last-run.json, which records status passed and no failed tests.
- Independent manual.mjs-derived journeys passed five groups. Recovery journeys passed four groups. See final-manual-results.json, final-recovery-results.json, manual.log, traces, and numbered screenshots.
- final-layout.mjs passed measured 390px and 320px evidence widths, actual keyboard citation preview, source-link keyboard focus, touch-sized citation and jump controls, and measured jump-to-bottom. See layout-results.json and layout-trace.zip.

## Acceptance observations

At desktop 1440 by 900 and mobile 390 by 844, the empty screen is a minimal centered composer with two compact suggestions. It has no permanent filters, pre-chat preference form, oversized empty-results panel, or introductory scroll. First visit renders dark despite OS light preference. Body backgrounds measured rgb(24, 24, 24) in dark and rgb(250, 250, 250) in light. Both selections persist after reload.

Hello and Thanks render plain assistant messages. Ambiguity produces category choices inside the conversation. The optional budget card has quick choices, a custom amount, and Skip budget. The skipped question does not recur. Already known budget is not reasked.

Natural budget and category changes preserve prior exchanges. Measured requests progress through headphones under SGD 500, under SGD 200, and laptops under SGD 2000. The final request retains laptop category and SGD 2000 cap, while incompatible headphone required features are cleared. Old recommendations remain readable but lose active selection and preference-edit actions.

Recommendations, evidence, comparisons, and citation previews remain inside assistant messages. Fixture claims, sample prices, and stock retain visible synthetic-data labels and fixed fixture dates. Expanded evidence now occupies 328 of 358 pixels at width 390, and 258 of 288 pixels at width 320. The previous checkpoint's 190-pixel narrow-column defect is fixed. Screenshots evidence-open-390.png and evidence-open-320.png show the result.

The mobile history actually moves. Wheel input changed scrollTop from 0 to 450, while composer y stayed 755.40625. A native CDP touch swipe moved history by 197 pixels on the final run. The 320-pixel layout has no document horizontal overflow. The composer remains usable after scrolling. Jump-to-latest is 44 by 44 pixels and reaches measured remaining scroll 0.

Keyboard Tab reaches the composer with a 3-pixel solid outline. Shift+Enter inserts a newline and Enter sends. Actual Tab into a citation opens its preview. Citation target measures 91.3125 by 44 pixels. Source links retain visible 3-pixel focus and the expected safe manufacturer destination. Programmatic focus alone did not open the preview. This was an observation-method error and is not a user-facing failure.

An invalid budget draft preserves the accepted SGD 500 constraint after the editor closes. A valid SGD 100 cap returns a compact no-matches answer. One injected request abort exposes Retry and returns real fixture results on retry without duplicating the turn. Reset during a delayed real response prevents stale results returning. Independent browser contexts retain separate messages and preferences. Product selection returns the exact allowed Sony manufacturer URL with noopener, inspected without external navigation.

The complete browser suite also passed dissatisfaction, provider/error response boundaries, malformed activity metadata, merchant-link rejection, stale selection cancellation, source transport cancellation, optional explicit Exa-boundary behavior, compact excerpts, and historical action ownership.

## Notes and limits

No unresolved blocking visual or runtime defect remains in this source candidate. This QA verdict is not the user's visual approval and does not authorize merge before that approval.

Fixture mode does not establish current prices, current inventory, real product specifications, source-page reachability, live Exa retrieval, production behavior, every assistive technology, or iOS Safari virtual-keyboard behavior. All runs disabled Exa, and no live key, external page, or credential file was read or copied.

The build reports an existing bundle-size warning. Dependency installation reports 12 high audit findings. Independent security review owns their assessment. No package files changed in this source diff.

The E2E shell wrapper hit zsh's readonly variable named status after the tests finished. Playwright's own durable result and summary both report all 43 passed. The tracked artifact directory was restored and git status verified clean afterward. Both reserved ports were verified free. Only the reviewer's own server process group was stopped.

Final integration metadata, docs, and verification-skill commit still require delta binding before this source verdict becomes a verdict on that exact integration head.

## Principles applied

Prove It Works changed the review from build-based inference to direct UI observation, actual response handling, measured colors, scroll positions, repeatable scripts, and inspected screenshots. It also changed the citation investigation from a presumed defect to a corrected actual-keyboard test.

Experience First changed acceptance at the checkpoint. The broad interaction flow passed, but the narrow expanded mobile evidence was rejected until the repaired layout was measured and inspected.
