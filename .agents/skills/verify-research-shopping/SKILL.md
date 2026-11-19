---
name: verify-research-shopping
description: Launch and verify the Fieldnote chat-first Research + Shopping app through its real browser UI after conversation, theme, preference, evidence, API, or merchant-link changes.
---

# Verify Fieldnote chat

Read the [feature map](features/README.md), then choose the affected journeys. Fieldnote is a conversation with contextual shopping controls. A dashboard with official components does not satisfy this interface contract. Normal development research uses Exa product observations and source links. Merchant verification remains unavailable without authorized access. Fixtures are confined to automated verification and cannot establish real specifications, prices, stock or delivery.

## Launch an owned instance

Use Node.js 22.12 or newer. Install dependencies with `npx --yes npm@11.6.2 ci` if needed. If Chromium is absent, run `npx playwright install chromium`.

```sh
node .agents/skills/verify-research-shopping/scripts/smoke.mjs
```

The helper finds its checkout from its own path. Pass `--project-dir /absolute/checkout` for another worktree. It runs the normal browser smoke through `evals/browser/run.ts`, without dataset grading or semantic judging. Set `VERIFY_ARTIFACT_DIR` to choose the evidence directory. The runner allocates owned ephemeral ports, health-checks its normal Hono instance, and records origins and the Vite process ID in `proof.json`. Earlier `VERIFY_API_PORT` and `VERIFY_WEB_PORT` overrides no longer apply.

The child receives a small explicit environment with Exa disabled. It does not run the live server entrypoint or load a private environment file. The real Exa SDK talks only to an owned fake-key loopback provider. The v5 runner first executes actual local parsing and typed controls. Only requests delegated by the app consume fixed literal-span proposals at the optional IntentInterpreter boundary. The actual server validates and applies them. Harness-only HTTP attempt headers preserve event ownership across overlapping requests and retries without changing application bodies, operation IDs or SDK request bodies. Main-lane OpenAI and Ollama HTTP calls are zero, so this proof does not measure model understanding. Separate Ollama boundary tests use a fake loopback service without a real model or installation. No private quota ledger, account balance, database, migration, or real provider is needed. Never copy private environment files or credentials into another worktree.

## Confirm the owned normal test instance

Require `GET /api/health` to report `status: ok` and `mode: research`. The supplied provider is a synthetic local double, so normal-mode health alone does not establish a live integration. Require the runner's explicit synthetic provenance and the visible Synthetic product labels when results arrive. Do not expect the legacy Fixture data header from this normal composition.

The runner owns and closes its API, local provider, browser contexts and Vite process. Read the recorded commit and worktree status before claiming exact-commit verification. The old helper's HTTP 400 failure remains preserved in `artifacts/product-evals/baseline/verification-skill/proof.json`; the corrected launch must be rerun rather than relabeling that historical proof.

## Verify the chat contract

Legacy fixture API and domain tests exercise the frozen synthetic composition. The current composer cannot drive its recommendation or handoff responses. For normal product behavior use [Exa product research](features/web-research.md), including dynamic intent, prepare/research phases and independent live acceptance. Normal interactions never receive synthetic catalog results.

Use a fresh browser context to establish first-visit dark mode independently of the operating-system theme. Inspect desktop and mobile viewport screenshots. Require the minimal header, centered chat, readable messages and compact composer. No permanent filters, large prechat form, oversized empty-results panel or introductory scrolling may remain.

Verify light mode and dark mode through the actual toggle. Refresh after each selection and require persistence. Theme persistence does not establish conversation persistence. Conversation state remains tab-local unless the application explicitly implements durable history.

Drive an ordinary message, a missing-material-preference question and a supported shopping request. The question must appear inline in the assistant turn. Submit a useful product request without a budget and require research to start without an optional-budget form. For ambiguous money, inspect the typed pending draft, original request and question identity; answer only the missing currency and require automatic research with both bounds retained. A message that already states a budget or product description must not be asked for that fact again. Category quick choices are not current controls.

Submit a natural preference follow-up. Require the earlier user and assistant messages to remain in history, while the newest result reflects the accepted preferences. Scope result actions and assertions to their message. Historical results cannot initiate research under obsolete constraints.

Scroll the conversation at mobile size. Require the composer to remain visible and usable without hiding the current message or allowing body-level horizontal overflow. Test Enter to submit, Shift+Enter for a newline, keyboard focus and touch disclosures through the actual controls.

The smoke proof records its actual driven subset. The broader browser run also checks question identity, Enter submission, retained-history controls, session isolation and transport cancellation. Supplemental source images use intercepted local bytes and a deliberate load error. They do not change the sixty-case research inputs or prove actual image provenance. The broader [conversation and theme guide](features/chat.md) and matching package tests cover the remaining chat states. Use the [preferences](features/preferences.md), [research](features/research.md), [evidence](features/evidence.md), [selection](features/selection.md), [session](features/session-recovery.md) and [Exa research](features/web-research.md) guides for affected behaviors.

## Preserve shopping and safety

Run `npm test` for domain, API, provider and security boundaries. Run `npm run test:e2e -- --trace on --output=artifacts/verification-skill/full-suite` for the browser suite. Playwright starts fresh API and web servers on 3163 and 5273, refuses reuse, and explicitly disables Exa. Override with `PLAYWRIGHT_API_PORT` and `PLAYWRIGHT_WEB_PORT` when needed.

Keep fixture labels, fixed observation timestamps, evidence conflicts, unknown claims, safe exact-product links, budget drafts, unresolved hard constraints and session isolation. Retained history must not revive abandoned requests. Test cancellation on edits, new turns, Stop, and reset. Normal merchant handoff is unavailable. Pending indicators reflect actual HTTP work; complete JSON is not token streaming or intermediate reasoning.

Use the normal intent and response contract for browser shopping journeys. Inject failures or source stubs only at the established network/provider boundary and label that evidence. Stubbed Exa data does not prove real retrieval. Research-mode browser tests use injected provider replies and report that limitation. A separate bounded real check follows [Exa research verification](features/web-research.md).

## Keep reviewable evidence

Keep `proof.json`, server logs, `trace.zip`, and screenshots together where the runner emits them. A successful smoke requires `result: passed` and `cleanup: true`. Preserve failed proofs without relabeling them. Package browser runs have their own test results and artifacts. Inspect the actual images for contrast, clipping, density, conversational structure and composer placement. Passing overflow assertions or a build cannot establish visual quality.

Independent visual QA judges the rendered interface against the chat-first brief. The user approved PR #33's design, satisfying issue #30's screenshot-review milestone. Routine PRs return to autonomous merging after CI, independent QA/security and repository policies pass. Request design approval only for a milestone the user explicitly designates. Follow AGENTS.md for production deployments and sensitive operations.

## Clean up owned work

The runner closes its browser, API and local provider, then waits for its owned Vite process to exit before writing `cleanup: true`. SIGINT and SIGTERM preserve an interrupted failed proof and close owned resources. Check the recorded origins for remaining listeners after interruption. Preserve failed evidence and inspect its proof and server log. Before stopping a leftover process, verify that its recorded PID and command still identify this owned run. Never kill by process name or port, stop another checkout, or delete evidence to free a port.

Keep the feature map aligned with actual controls and tests after changes. A focused test selection does not prove omitted journeys.

## Run independent product evaluations

Run `npm run eval` for the versioned conversation dataset with local handling and fixed optional fallback. Run `npm run eval -- --intent-mode local-only` for all sixty cases with the optional interpreter absent. Read local, fallback and unavailable handling separately. The cross-contract bridge marks the local-only treatment incomparable to its declared fixed-fallback lane. Run `npm run eval:browser -- --out artifacts/product-evals/browser --mode report` for the broader normal browser journeys, including known product failures. Reporting mode preserves product failures without treating them as runner errors. Use `--mode strict` to require every assessed browser check to pass. The smoke subset remains an application-driving check.

Keep dataset management, semantic judgments and baseline comparison in the [evaluation guide](../../../docs/product-evaluations.md). Neither a successful smoke nor synthetic browser cards establish live shopping usefulness. No automated command may consume the manual research allowance.
