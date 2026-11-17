# Use Exa for product context

Fieldnote can retrieve web source highlights for a completed sample shortlist. The optional action uses Exa search. The sample catalog, prices, stock, ranking, claims, and manufacturer handoff stay synthetic. Retrieved excerpts do not establish current offers or verify sample facts.

## Run with a private development key

Use Node.js 22.12 or newer and npm 11. The API development command reads the repository-root `.env` through Node's environment-file mechanism. Keep your existing `EXA_API_KEY` in that ignored file. Do not overwrite an existing `.env`, prefix the key with `VITE_`, paste it into a prompt, or add it to GitHub secrets for this feature. A fresh checkout can use `.env.example` as a guide without copying any real key into source control.

```sh
npx --yes npm@11.6.2 ci
npm run dev
```

Submit a supported shopping request. After the sample shortlist appears, choose its web-context search action. The request sends catalog model names and the accepted shopping preferences to Exa. Source titles, public HTTPS links, and plain highlights appear separately from fixture evidence. Open a disclosure for more context. No source page opens automatically.

Only explicit `NODE_ENV=development` or `test` can compose Exa. The API development command sets development mode; an unset environment or production mode keeps the adapter disabled even if a key exists. Set `EXA_RESEARCH_ENABLED=false` to disable it explicitly. Tests and the fixture verification helper set this override and inject local substitutes. They never require the real key or call Exa.

Health keeps `mode: fixture` for commerce and reports whether the separate web capability is configured. `liveIntegrations` is true when Exa is enabled. Configuration is not proof that a search succeeded; use an actual response to establish that.

## Retrieval behavior

The server uses the official `exa-js` SDK. The initial integration resolves 2.28.0. One button action starts one search invocation. It sends a semantic query, a task objective, and `contents: { highlights: true }`. It does not set domain/category filters, result counts, freshness controls, summaries, or synthesized-output options. This follows the canonical build-with-exa guidance for a search-results-first interface.

The API key stays in the server process. The endpoint accepts a bounded shortlist context, not a caller-supplied API URL, credential, or Exa options object. The SDK receives the incoming request signal and a bounded transport deadline, so disconnect and timeout cancel network work. The UI aborts stale work on edits, reset, new results, or handoff. A missing key, empty response, or provider failure leaves the sample comparison usable.

Highlights may come from cached pages. A retrieval timestamp records this search, not the publication time, a live crawl, or an inventory observation. Source links are untrusted external context. Safe-link validation permits public HTTPS destinations without credentials; it does not certify a publisher or turn the link into a verified merchant offer. The browser renders titles and excerpts as text, never source HTML or executable instructions.

## Follow the canonical Exa skill

For Exa API changes, fetch and read the current skill output before editing call shapes.

```sh
npx skills use "https://github.com/exa-labs/agent-skills" --skill "build-with-exa"
```

Read its complete output. Resolve relative references against the supporting-files directory printed by that run. Use the skill rather than remembered API options. The current feature uses `/search`; no Agent, Monitor, Webset, Answer, or OpenAI-compatible endpoint is needed for this interface.

The app currently has no LLM, system prompt, or model tool loop. If a future feature gives an LLM web search, prefer the SDK tool helpers and require both `query` and `objective`. Pass the model's objective unchanged. The required objective description is:

> Goal for this search turn; say which documents should rank first, which should be excluded, and what specific facts or figures to pull from them.

Add this exact sentence to the existing model system prompt, replacing `web_search` with the actual tool name:

> Call web_search before answering unless you're certain the answer can't have changed since your training cutoff.

Keep the rest of that system prompt. Do not add an unused prompt or a model dependency to the current deterministic application.

## Verify safely

Run the normal package checks and project fixture verification skill. Those paths explicitly disable live composition. Adapter tests use a local HTTP service and a fake key to exercise the actual SDK transport, including disconnect and body-read cancellation. Browser tests inject source responses and check the explicit action, safe disclosures, stale/reset behavior, and desktop/mobile layouts.

A real development verification uses the existing private environment and a bounded explicit action through this project's API. Keep the key out of command arguments, response evidence, logs, traces, client builds, commits, and CI. Retain only sanitized result metadata and inspected UI screenshots. A successful live search establishes retrieval/authentication, not live merchant offers or broader language coverage.

The local leak-check tool can scan reachable Git objects, compressed traces, built assets, and an optional evidence directory without printing the key. Run it after building with the private development environment loaded. CI does not need this private-key check.

```sh
node --env-file=.env .codex/pstack-runs/exa-integration/verify-no-secret.mjs
```

## Current dependency advisory

The current full audit reports12 propagated high package findings from one inherited picomatch ReDoS advisory. Base and Exa candidate have the same finding set; no finding originates in exa-js. The primary [GHSA-fc5q-39xc-vjpf advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) currently lists no patched release. [Issue27](https://github.com/d3F0g/research-shopping/issues/27) tracks compatible remediation and actual untrusted-pattern reachability. Do not suppress this audit or represent earlier zero-audit installation records as the current result. The independent security verdict is required before shipping.
