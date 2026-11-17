# Independent security review

The goal is a minimal dark-first shopping conversation that preserves safe research, preferences, evidence and manufacturer handoff. Verdict is PASS WITH NOTES for the reviewed application scope. No blocking security regression was found. This is not a formal GitHub approval, CI verdict, visual approval, production assessment or merge authorization.

## Candidate and scope

- Base is `151fa506f58f4171add9f5efd684da809ee3248f`.
- Reviewed head is `38f75c271ba5396950b1fe37892350497ac15709` in the detached worktree `/Users/josiahwong/Documents/research-shopping-chat-security`.
- Reviewer is the independent security and cross-model trail agent, configured by root as `gpt-6.1-sol`. No application files or GitHub state were changed.
- Application scope includes `src/client/App.tsx`, `useConversation.ts`, `PreferenceQuestion.tsx`, `ResearchResults.tsx`, `WebResearch.tsx`, `theme-provider.tsx`, theme bootstrap and the changed domain turn/preference contracts. Existing request, source, merchant and Exa boundaries were read to assess the new callers.
- The worktree was clean before and after the tests. The source is frozen at the author's `db4d800` according to the root brief. A later documentation/gallery-only commit requires explicit diff binding before this verdict applies to it.

## Checks and evidence

Commands ran from the reviewed worktree unless a different directory is stated. Node was `v22.20.0`. npm was explicitly pinned to `11.6.2` for install, test, build and audit.

1. `npx --yes npm@11.6.2 ci --ignore-scripts` passed. See `npm-ci.txt`.
2. `EXA_RESEARCH_ENABLED=false npx --yes npm@11.6.2 test` passed all 167 tests across six unit/API files. See `unit-api.txt`. Existing Exa SDK tests use a local HTTP substitute and literal `fake-key`, as verified in `tests/api/exa-research.test.ts:25-83`. No live Exa request or private environment file was needed.
3. `npx --yes npm@11.6.2 run build` passed typecheck and Vite build. See `build.txt`. Existing Rollup annotation and bundle-size warnings remain nonsecurity notes.
4. `PLAYWRIGHT_API_PORT=3193 PLAYWRIGHT_WEB_PORT=5303 EXA_RESEARCH_ENABLED=false npx --yes npm@11.6.2 run test:e2e -- tests/e2e/research-shopping.spec.ts tests/e2e/chat-first.spec.ts --grep 'unsupported requirements|stops an actual|revokes historical|aborts source|late result|successful handoff|pending selection|browser contexts|activity|web context|safe web excerpts|unsafe source|discards pending web|double-click' --trace on --output=/tmp/research-shopping-chat/security/playwright` passed 20 targeted Chromium journeys. See `browser-security.txt` and `playwright/` for traces.
5. `node /tmp/research-shopping-chat/security/extra-probes.mjs` passed four independent browser probes against an owned local fixture instance on API `3195` and web `5305`. User message markup and the new assistant `message` variant rendered as inert text. A 401-character assistant message was rejected at the response boundary. Blocked localStorage retained a dark default and a usable light toggle. See `extra-probes.json`, the rerunnable script and `extra-probes-server.txt`. Cleanup was verified.
6. Fresh `npx --yes npm@11.6.2 audit --json` for the candidate and `npx --yes npm@11.6.2 audit --package-lock-only --json` for base package files extracted with `git show` both exited 1 and reported 12 high findings, zero critical, moderate or low findings. See `audit-current.json` and `audit-base.json`. Both manifests and lockfiles are byte-identical. The package-lock SHA-256 is `56a1f50923d70606848883f34fd2f32cb93121a894f9c404daf2762641bea313`.
7. Static scans found no application `dangerouslySetInnerHTML`, `innerHTML`, dynamic evaluation, browser Exa SDK import or credential reference. Built JS contained none of the literal markers `exa-js`, `EXA_API_KEY`, `api.exa.ai` or `fake-key`. This is a targeted inspection, not a general secret-scanning claim.

## Findings and rationale

No blocking finding was reproduced.

### N1. Inherited high-severity dependency finding remains open

The fresh audit attributes all 12 affected-package findings to one underlying advisory, `GHSA-fc5q-39xc-vjpf`, "picomatch vulnerable to ReDoS through single-branch repeated extglobs", CWE-1333, CVSS 7.5. Installed vulnerable copies are `picomatch@4.0.7` and `micromatch`'s nested `picomatch@2.3.2`. `npm ls picomatch --all` resolves these through shadcn tooling, Vite, Vitest, fdir and tinyglobby. The audit result is identical for the base lockfile. Root identifies existing issue #27 as the durable tracker. This review did not verify that issue's current state or close it.

Current reachability assessment is bounded and inferred from code inspection. The application does not import or invoke picomatch or glob compilation. Shopper messages and preferences flow into fixed parser regular expressions and validated shopping requests. Untrusted research text is rendered as React text. Vite's picomatch callers compile configuration filters, source glob expressions and `server.fs.deny` patterns, then match paths. The project's Vite configuration supplies the fixed `**/artifacts/**` ignore pattern and binds to `127.0.0.1` at `vite.config.ts:12-18`. No inspected request path makes shopper text, source text or a URL into a glob pattern. Representative installed call sites are `node_modules/vite/dist/node/chunks/config.js:1498-1514` and `:35915-35919`; `tinyglobby/dist/index.mjs:217-218` compiles its supplied pattern list.

This is a real inherited tooling risk. It is nonblocking for this redesign because there is no dependency change or newly reachable pattern input in scope. The verdict does not waive it, prove the dependency safe under arbitrary configuration, or authorize production exposure. Do not report a clean audit.

### Retained protections verified

- Server HTTP limits, strict preference/request keys, host/origin policy, generic errors and response parsing remain intact. All HTTP boundary tests passed in `unit-api.txt`; no server source changed in the candidate diff.
- The new `message` result is bounded by `src/domain/contracts.ts:140-146` and parsed by `src/client/api.ts:31-33`. `src/domain/preferences.ts:37-47` recognizes exact whole-message acknowledgments. Mixed messages continue through the constraint parser. The seven acknowledgment cases retain unresolved requirements in `tests/unit/conversation.test.ts:10-34`; mixed constraints are covered at `:44-54` and the browser journey at `tests/e2e/chat-first.spec.ts:146`.
- The active turn owns selection, preferences and explicit web research. `src/client/useConversation.ts:112-145` aborts transport and clears task identity. Turn, selection and source completions check that identity at `:167`, `:284` and `:332`. Typing, editing and reset revoke old action authority. Retry uses its saved request and only the current retryable origin at `:405-411`. Independent browser evidence includes actual `requestfailed` cancellation, late completion suppression, reset isolation, old handoff revocation, and explicit research/double-click behavior.
- Exact identity checks remain in `src/domain/merchant-links.ts:28-37` and `src/client/api.ts:54-59`. All four tampered successful handoffs were rejected before a merchant link appeared. Approved host alone does not authorize an invented path or different product name or ID.
- Fixture citations project only an approved exact product URL at `src/client/ResearchResults.tsx:64-88`. Web research URLs pass `WebResearchResponseSchema` in `src/client/api.ts:86-88` and the existing public HTTPS policy in `src/domain/web-research.ts:16-38`. Unsafe source responses were rejected. Titles, excerpts, user messages and the new ordinary reply use React text nodes. New independent XSS probes passed.
- The only new persistent value is the enum-like theme preference. `src/client/theme-provider.tsx:15-36` reads only `light` as light, treats all other values as dark, catches storage failures, and applies only a typed light/dark class. Conversation state remains in the tab's React state. The denied-storage browser probe passed.
- Fixture prices, stock and claims retain visible fixture labels. Web excerpts stay separate and do not prove inventory. Provider activity comes from validated response events, and pending wording describes an actual request rather than token streaming or simulated reasoning. Targeted browser activity tests passed.
- The legacy browser file retained 25 direct test declarations plus the four-case handoff loop, yielding 29 journeys. The old modal filter test became an inline editor test, which matches the removal of the modal. Security assertions for URLs, product identity, source text, malformed activity, cancellations and isolation remained in the diff. See `security-assertions.diff`.

## Limits and merge gate

The 20 targeted browser tests are independent security verification, not a claim to have rerun the full 43 browser suite. Independent QA owns the full runtime and desktop/mobile visual verdict. No merchant page was opened, no real inventory or live web retrieval was established, and no production deployment was assessed. The local fixture instance and local SDK substitute establish only their explicit contracts. CI checks, branch protection, GitHub review state and the final PR remain root-owned.

The user explicitly requires the PR to stay unmerged with auto-merge off until screenshot review and design confirmation. This security verdict does not override that gate.

## Principles that changed review decisions

- Boundary Discipline focused hostile-input probes at response parsing, URL projection and theme storage rather than adding redundant internal guards.
- Prove It Works required independent unit/API, build, actual browser cancellation and hostile-markup evidence rather than accepting the implementation summary.
- Test Behavior, Not Implementation selected observable link revocation, request abort, displayed inert text and rejected malformed responses rather than assertions on the hook's private fields.
- Minimize Reader Load led the review to trace one active task and its origin through all three asynchronous request types before accepting retained history.

## Trail review

Pending the final documentation/gallery candidate and the scoped root transcript. The initial log has three decision rows, so it does not yet establish the implementation, mobile evidence correction, final verification or handback. Root is preparing the append-only end-of-run entries and transcript slice for the separate cross-model audit.

## Final candidate binding

The security verdict is also bound to final candidate `99a09138de9df3b09766160ea60ad9220e5776d9` after a narrow delta review from `38f75c271ba5396950b1fe37892350497ac15709`. `git diff --exit-code 38f75c271ba5396950b1fe37892350497ac15709 99a09138de9df3b09766160ea60ad9220e5776d9 -- src tests package.json package-lock.json index.html vite.config.ts playwright.config.ts tsconfig.json` exited 0. The seven changed paths are the audit log, three run reports, screenshot gallery and two helper offline-reproduction JSON records. I read that delta. No application, dependency, test, transport, URL or credential handling changed. The detached worktree now points to `99a09138de9df3b09766160ea60ad9220e5776d9`. The tests above ran on `38f75c2`, whose executable application/test/config content is identical to this final head. No repeat application run was needed for these documentation-only additions. The final transcript audit remains pending.

A further direct check recomputed SHA-256 for all 45 source paths named in `artifacts/chat-first/application/manifest.json` at final head `99a09138de9df3b09766160ea60ad9220e5776d9`. All 45 matched. This independently binds the manifest's application source to the reviewed final candidate. It does not verify screenshot capture chronology or actual image content.

## Publication head binding

The security PASS WITH NOTES is finally bound to publication head `7a27a2768f558aad4fc8388d91667c0fe6feb67a` against base `151fa506f58f4171add9f5efd684da809ee3248f`. I checked out that exact head and inspected the complete 25-path delta from `99a0913`. It adds documentation, audit updates and integrated-smoke PNG/trace/proof artifacts. No application, test, dependency, index, configuration or verification-helper path changed. The targeted executable-content diff exited 0. The proof truthfully records actual runtime commit `99a0913`, a clean worktree, passed result and successful cleanup. The documentation now correctly distinguishes unsupported-constraint package tests from the separate manual scripts. The previously run application checks bind to this unchanged executable content; this is not a claim to have rerun them on the metadata commit. Private actual-key scanning and hosted CI remain root-owned, separate gates.
