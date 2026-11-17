---
name: verify-research-shopping
description: Launch and verify the Fieldnote Research + Shopping fixture web app through its real browser UI after UI, API, preference, evidence, or merchant-link changes.
---

# Verify Research + Shopping

Read the [feature map](features/README.md), then choose the journeys affected by the change. This app ends at a manufacturer product link. Fixture runs cannot establish current specifications, prices, stock, delivery, or merchant-page reachability.

## Launch

Run from the project checkout with Node.js 22.12 or newer. Install dependencies with `npx --yes npm@11.6.2 ci` if needed. The original host npm 8 resolver failed during setup. If Chromium is absent, run `npx playwright install chromium`.

```sh
.agents/skills/verify-research-shopping/scripts/smoke.mjs
```

The helper finds the checkout from its own path. It refuses occupied ports, then launches the repository's `npm run dev` with API port 3173 and web port 5283. It needs no credentials, database, migrations, or seed command. The checked-in fixture catalog supplies the initial data. The helper explicitly sets `EXA_RESEARCH_ENABLED=false`, so a local development key never activates Exa during this fixture run. Set `VERIFY_API_PORT` and `VERIFY_WEB_PORT` to two unused ports when necessary.

For a separate worktree, pass `--project-dir /absolute/checkout`. The helper loads Playwright from that checkout's installed modules. Set `VERIFY_ARTIFACT_DIR` to place its evidence outside that worktree.

## Doctor

The helper performs a read-only `GET /api/health` through the web proxy. Require `status` equal to `ok`, `mode` equal to `fixture`, and `liveIntegrations` equal to `false`, and `webResearch` equal to `disabled`. It then requires the visible `FIXTURE MODE` marker and the `Product research workspace` region. A listening socket alone is insufficient.

For an already owned helper instance, inspect its health without changing state.

```sh
curl --fail --silent http://127.0.0.1:5283/api/health
```

Do not drive an unknown instance. The helper checks both ports before launch and records the PID it starts. Its `proof.json` records the commit and worktree status. A dirty run is evidence about that working tree, not proof of its commit alone.

## Drive

The smoke helper drives the first example request, checks the returned fixture candidates against the SGD 500 hard budget, opens evidence, captures 1440px and 390px layouts, and selects a product. It compares the visible handoff URL with the actual selection response. It records unexpected external browser requests as a failure and does not open the manufacturer link.

For broader coverage, run the existing package scripts.

```sh
npm test
npm run test:e2e -- --trace on --output=artifacts/verification-skill/full-suite
```

`playwright.config.ts` starts its own API and web servers on ports 3163 and 5273 and refuses to reuse another instance. Override them with `PLAYWRIGHT_API_PORT` and `PLAYWRIGHT_WEB_PORT`. Read `tests/e2e` before choosing a focused `--grep` run. A focused run does not prove omitted map entries.

For exploratory browser checks, use the exact Playwright handles in the matching feature file. Use independent browser contexts for session isolation. Report unmet fixture preconditions as failures or skips with the attempted action.

## Evidence

Smoke evidence survives under `artifacts/verification-skill/<UTC-run>/`, or `VERIFY_ARTIFACT_DIR`. Keep `proof.json`, `server.log`, `trace.zip`, and the numbered screenshots together. The trace records the user action and resulting DOM. Screenshots show initial state, desktop results, mobile results with evidence open, and merchant handoff.

Require `result` equal to `passed` and `cleanup` equal to `true`. Inspect screenshots for clipping and readable controls. The helper's overflow assertion does not establish visual quality, keyboard usability, every mapped feature, or merchant allowlist rejection. Use browser journeys and the boundary tests for those claims. `npm test` includes API and domain tests. A passing build alone does not establish runtime behavior.

Fixtures are the app's current provider boundary. Do not substitute mocked UI responses for the core research journey. Failure injection may use the existing network/provider boundary, with the injected response identified in the report. Observe the actual result rather than trusting a mode name.

## Cleanup

The helper closes its browser and terminates only the process group it created. It checks that both ports are free before writing `cleanup: true`. It preserves every evidence file. Playwright's package suite owns and stops its `webServer` instance.

After any failed run, inspect `proof.json` and `server.log`. If the helper itself was forcibly terminated before cleanup, verify the recorded `serverPid` still identifies that run before terminating its process group. Never kill by process name or remove evidence to free a port.

Keep this map aligned with controls and tests as the app changes. Use `$maintain-verification-skill` when that installed workflow is available.

For the optional live Exa capability, follow [web-context verification](features/web-research.md). A fixture smoke pass does not establish actual Exa retrieval. Never supply a private key to CI or a browser.
