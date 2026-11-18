---
name: verify-research-shopping
description: Launch and verify the Fieldnote chat-first Research + Shopping app through its real browser UI after conversation, theme, preference, evidence, API, or merchant-link changes.
---

# Verify Fieldnote chat

Read the [feature map](features/README.md), then choose the affected journeys. Fieldnote is a conversation with contextual shopping controls. A dashboard with official components does not satisfy this interface contract. The product ends at a manufacturer link. Fixtures cannot establish current specifications, prices, stock, delivery, or merchant-page reachability.

## Launch an owned instance

Use Node.js 22.12 or newer. Install dependencies with `npx --yes npm@11.6.2 ci` if needed. If Chromium is absent, run `npx playwright install chromium`.

```sh
node .agents/skills/verify-research-shopping/scripts/smoke.mjs
```

The helper finds its checkout from its own path and loads Playwright from that checkout. Pass `--project-dir /absolute/checkout` for a separate worktree. It refuses occupied ports, then starts `npm run dev` with API port 3173 and web port 5283. Override these with distinct unused `VERIFY_API_PORT` and `VERIFY_WEB_PORT` values. Set `VERIFY_ARTIFACT_DIR` to choose the evidence directory.

The helper itself forces `EXA_RESEARCH_ENABLED=false` in its child environment. It needs no key, database, migrations, or seed command. Never copy a private environment file into another worktree or supply a real key to CI or the browser.

## Confirm the instance

Require `GET /api/health` to report `status: ok`, `mode: fixture`, `liveIntegrations: false`, and `webResearch: disabled`. Then require the visible fixture marker and conversation region. A listening socket alone is insufficient.

Do not drive an unknown instance. The helper records the PID it starts, candidate commit and worktree status. A dirty run proves that working tree, not its commit alone. A separate read-only health request is safe only after ownership is known.

## Verify the chat contract

Use a fresh browser context to establish first-visit dark mode independently of the operating-system theme. Inspect desktop and mobile viewport screenshots. Require the minimal header, centered chat, readable messages and compact composer. No permanent filters, large prechat form, oversized empty-results panel or introductory scrolling may remain.

Verify light mode and dark mode through the actual toggle. Refresh after each selection and require persistence. Theme persistence does not establish conversation persistence. Conversation state remains tab-local unless the application explicitly implements durable history.

Drive an ordinary message, a missing-material-preference question and a supported shopping request. The question must appear inline in the assistant turn. Quick choices must apply immediately. Optional questions need a skip action. A message that already states a budget or category must not be asked for that fact again.

Submit a natural preference follow-up. Require the earlier user and assistant messages to remain in history, while the newest result reflects the accepted preferences. Scope result actions and assertions to their message. Historical offers cannot authorize a new handoff under old constraints.

Scroll the conversation at mobile size. Require the composer to remain visible and usable without hiding the current message or allowing body-level horizontal overflow. Test Enter to submit, Shift+Enter for a newline, keyboard focus and touch disclosures through the actual controls.

The smoke helper records its driven subset. The broader [conversation and theme guide](features/chat.md) and matching package tests cover the remaining chat states. Use the [preferences](features/preferences.md), [research](features/research.md), [evidence](features/evidence.md), [selection](features/selection.md), [session](features/session-recovery.md) and [web-context](features/web-research.md) guides for affected behaviors.

## Preserve shopping and safety

Run `npm test` for domain, API, provider and security boundaries. Run `npm run test:e2e -- --trace on --output=artifacts/verification-skill/full-suite` for the browser suite. Playwright starts fresh API and web servers on 3163 and 5273, refuses reuse, and explicitly disables Exa. Override with `PLAYWRIGHT_API_PORT` and `PLAYWRIGHT_WEB_PORT` when needed.

Keep fixture labels, fixed observation timestamps, evidence conflicts, unknown claims, safe exact-product links, budget drafts, unresolved hard constraints and session isolation. Retained history must not revive abandoned requests. Test cancellation on edits, new turns, reset and handoff. Pending indicators reflect actual HTTP work; complete JSON is not token streaming or intermediate reasoning.

Use real fixture responses for the core shopping journey. Inject failures or source stubs only at the established network/provider boundary and label that evidence. Stubbed Exa data does not prove real retrieval. A separate live check follows [web-context verification](features/web-research.md).

## Keep reviewable evidence

Keep `proof.json`, `server.log`, `trace.zip` and screenshots together. Require `result: passed` and `cleanup: true`. Inspect the actual images for contrast, clipping, density, conversational structure and composer placement. Passing overflow assertions or a build cannot establish visual quality.

Independent visual QA judges the rendered interface against the chat-first brief. The user approved PR #33's design, satisfying issue #30's screenshot-review milestone. Routine PRs return to autonomous merging after CI, independent QA/security and repository policies pass. Request design approval only for a milestone the user explicitly designates. Follow AGENTS.md for production deployments and sensitive operations.

## Clean up owned work

The helper closes its browser and terminates only the process group it created. It checks that both ports are free before writing `cleanup: true`. Preserve failed evidence and inspect its proof and server log. If the helper was forcibly terminated, verify its recorded PID still identifies the owned run before stopping its process group. Never kill by process name or delete evidence to free a port.

Keep the feature map aligned with actual controls and tests after changes. A focused test selection does not prove omitted journeys.
