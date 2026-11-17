# Independent final delta QA

The goal is an official shadcn/ui and AI Elements frontend with independent desktop/mobile verification for existing PR20. PASS for candidate `a3163a20a5398b9f3c3064b7cb87bf4094de6f8d`. No reproducible application defect was found. No application, package, test, or documentation files were changed by this reviewer.

The candidate was checked out detached in `/Users/josiahwong/Documents/research-shopping-shadcn-qa`. A local `npx --yes npm@11.6.2 ci` refreshed its dependencies. The reviewed worktree was clean before and after verification. Artifacts reside only in this report's directory.

## Scope and source evidence

The complete comparison against independently reviewed baseline `804adae87c78f2b9cd083ceae301446f1d135379` contains 12 files. Four are application/package/test files. Eight are root-owned orchestration, AGENTS, CI documentation, or activation-evidence files. `candidate.diff` records the complete comparison.

The runtime delta adds one Portability option to the existing headphone priority registry. The package delta scopes a minimatch override to `@ts-morph/common`. The lock resolves minimatch 11.0.9 and its added dependency. The fourth code file adds one browser test for the visible priority and preserved hard constraints. Direct dependency versions and official component source files remain unchanged. App, PreferencePanel, ResearchResults, styles, domain, and server source are unchanged.

`minimatch-chain.log` shows the sole installed chain as shadcn CLI, ts-morph, @ts-morph/common, and minimatch. `bundle-delta.json` compares actual production JavaScript against the baseline build. Its only difference is the 42-character Portability registry insertion. The dependency override therefore adds no browser code. No narrating comments, lint/TypeScript suppressions, commented-out code, or compatibility paths were added in the four-file delta. Actionable cleanup findings 0. Source edits 0.

## Results

| Check | Observed result | Evidence |
| --- | --- | --- |
| npm 11 clean install | Passed, 0 reported vulnerabilities | `install.log` |
| Full Playwright suite, trace on | 20 passed | `suite.log`, `suite-results/*/trace.zip` |
| Unit/API suite | 110 passed across 2 files | `unit-api.log` |
| Typecheck and production build | Passed | `build.log` |
| Full dependency audit | 0 vulnerabilities | `audit.json` |
| Production dependency audit | 0 vulnerabilities | `audit-production.json` |
| Independent desktop and mobile keyboard journeys | Passed | `proof.json`, `desktop-trace.zip`, `mobile-trace.zip` |
| Cleanup | True, no listeners on 3673/5773 | `proof.json`, `final-listeners.txt` |
| Final QA worktree | Clean, exact candidate SHA | `final-worktree.txt`, `proof.json` |

The browser suite ran from this artifact directory using the QA checkout's installed Playwright and its unmodified configuration, with API 3673 and web 5773. The independent browser script then used those same ports after the suite released them. It started and stopped only its recorded process groups. Its final recorded server PID is 29082.

## Visual and behavioral findings

Inspected actual screenshots at desktop 1440×1000 and mobile 390×844. Results and updated results are readable without document/body horizontal overflow. Fixture labels remain visible on claims, prices, and sample stock. The mobile Sheet scrolls its editor independently and retains its heading. The hard-limit controls and priority controls fit the available width.

The starter response reports active priorities `portability` and `value`. Both appear checked, with priority badges 1 and 2 on desktop and mobile. Portability has a visible 3px keyboard focus outline. Keyboard Space removes it, then keyboard Enter updates the comparison. The actual outgoing request and actual response both preserve the entire prior hard object, including headphones, SGD 500, Singapore, wireless, empty exclusions, and no pending constraint. The resulting active priority is `value`.

The mobile update closes the Sheet. Reopening it confirms Portability remains unchecked. Thirty successive Tab actions remain inside the settled Sheet. Escape dismisses it and returns focus to the filter trigger. No unexpected external browser request or page error was observed. No manufacturer link was opened.

Screenshots include `desktop-results.png`, `desktop-portability-focus.png`, `desktop-updated.png`, `mobile-results.png`, `mobile-sheet-hard-limits.png`, `mobile-portability-focus.png`, and `mobile-updated.png`.

The broader baseline evidence at `../independent/review.md` remains applicable to unchanged source, citation safety, pending transport behavior, recorded tool metadata, comparison, errors, evidence disclosures, and registry provenance. Those full visual-state explorations and upstream registry fetches were not repeated. The full 20-test candidate suite did rerun its retained behavioral/security assertions.

Two exploratory harness attempts are retained in `attempt1` and `attempt2`. The first expected a checkbox after the mobile update had correctly closed the Sheet. The second asserted focus synchronously while the reopened Sheet was still placing focus. The final harness reopens the Sheet and awaits observable focus settling. No application change was required. The final script and proof pass.

## Limits and decisions

This verdict establishes fixture behavior at the named SHA. It does not establish live model/provider integration, current prices or inventory, manufacturer-page reachability, production deployment behavior, full WCAG conformance, hosted CI status, or permission to merge PR20. Root owns the final hosted CI and merge gates. The production build retains its existing bundle-size advisory.

Prove It Works changed the decision from relying on worker summaries to a fresh local install, full traced candidate browser run, actual transport payload comparison, compiled bundle comparison, and direct screenshot inspection. The same principle required the focus check to await the actual settled dialog state before judging it.
