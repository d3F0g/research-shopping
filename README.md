# Research + Shopping

Fieldnote is a chat-first product research assistant. Normal development requests use Exa to discover products and retrieve source-linked specifications and page-observed prices. Prices remain unverified observations. Stock, delivery and merchant offers are not verified. The app does not place orders or process payments.

## Run the app

Use Node.js 22.12 or newer. Use npm 11. The host npm 8 resolver crashed during the first dependency install.

```sh
npx --yes npm@11.6.2 ci
npm run dev
```

Keep `EXA_API_KEY` in the ignored root `.env` and configure one absolute `EXA_RESEARCH_LEDGER_PATH` shared by all live checkouts. See [Exa setup](docs/exa-research.md). Missing configuration returns an honest unavailable response. It never substitutes sample products.

Open `http://127.0.0.1:5173`. The API listens on `http://127.0.0.1:3000`.

First visits use dark mode. Use the theme toggle to persist light or dark mode. Guest messages and preferences stay in this tab until refresh. Optional local accounts restore private saved history and preferences. Select **New chat** to clear the conversation and preferences; the theme remains selected. See [saved conversations](docs/personalization.md) for account setup, deletion and retention.

## Verify changes

```sh
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright run starts a separate API and UI on loopback ports 3163 and 5273. It does not reuse an existing server. Set `PLAYWRIGHT_API_PORT` and `PLAYWRIGHT_WEB_PORT` to choose different ports. Successful desktop and mobile screenshots go to `artifacts/screenshots`. Playwright traces, videos, and failure screenshots go to `artifacts/playwright-results`.

## Local ports

Set `API_PORT` to change the Hono port. `PORT` is the API fallback. Set `WEB_PORT` to change the Vite port. Set `VITE_API_PORT` to point Vite at the API. Both services bind to `127.0.0.1`.

## Limits

The deterministic preference parser currently supports headphones and laptops with bounded constraints. Unsupported requirements remain explicit. Exa can return cached content; retrieval time does not establish page freshness or a current price. No authorized merchant API is configured, so live merchant verification remains open in [Issue #36](https://github.com/d3F0g/research-shopping/issues/36). The app has no verified merchant offers, shipping checks, payment or order placement. Optional authenticated history uses an explicitly configured local PostgreSQL database. Synthetic catalogs are restricted to automated tests.

## GitHub Actions CI

The workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs automatically on pushes and pull requests. It installs dependencies, checks TypeScript, runs unit/API tests, builds the frontend, runs Chromium journeys, and uploads browser evidence. See [CI documentation](docs/ci.md) and the actual PR checks for execution results.

## Frontend standard

The conversation uses official shadcn/ui and AI Elements patterns with retained messages, contextual preference cards, a bottom composer, centralized themes, local Geist typography, concise product rows, expandable comparisons, safe citations and actual recorded provider outcomes. See [frontend architecture and provenance](docs/frontend-standard.md) and the [desktop/mobile screenshot gallery](artifacts/chat-first/gallery.md). The user approved PR #33's design. Routine changes follow the autonomous merge gates in AGENTS.md; future human design reviews require an explicitly designated milestone.

## Exa research

A submitted research request makes at most one bounded Exa search. Ordinary replies, source disclosures and comparisons of held evidence make no paid requests. A durable local allowance protects development usage; it is not the Exa account balance or a provider-enforced charge cap. Production composition stays disabled. See [Exa setup and verification](docs/exa-research.md).
