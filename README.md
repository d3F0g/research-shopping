# Research + Shopping

Fieldnote is a chat-first shopping assistant with fixture-backed comparisons and optional development-only Exa web context. It supports headphones and laptops in the Singapore sample catalog. Prices, availability, and product claims are labeled as synthetic data. The app does not read live inventory or place orders.

## Run the app

Use Node.js 22.12 or newer. Use npm 11. The host npm 8 resolver crashed during the first dependency install.

```sh
npx --yes npm@11.6.2 ci
npm run dev
```

Open `http://127.0.0.1:5173`. The API listens on `http://127.0.0.1:3000`.

First visits use dark mode. Use the theme toggle to persist light or dark mode. Messages and shopping preferences stay in this tab until refresh. Select **New chat** to clear the conversation and preferences; the theme remains selected.

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

The deterministic parser understands a small set of product categories and constraints. The fixture catalog covers headphones and laptops in SGD for Singapore. US requests return an explicit limitation. Optional Exa web research returns source context separately from the sample catalog. The demo has no current merchant offers, shipping checks, saved account profile, payment, or order placement.

## GitHub Actions CI

The workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs automatically on pushes and pull requests. It installs dependencies, checks TypeScript, runs unit/API tests, builds the frontend, runs Chromium journeys, and uploads browser evidence. See [CI documentation](docs/ci.md) and the actual PR checks for execution results.

## Frontend standard

The conversation uses official shadcn/ui and AI Elements patterns with retained messages, contextual preference cards, a bottom composer, centralized themes, local Geist typography, concise product rows, expandable comparisons, safe citations and actual recorded provider outcomes. See [frontend architecture and provenance](docs/frontend-standard.md) and the [desktop/mobile screenshot gallery](artifacts/chat-first/gallery.md). The user approved PR #33's design. Routine changes follow the autonomous merge gates in AGENTS.md; future human design reviews require an explicitly designated milestone.

## Exa web context

The API development process can read `EXA_API_KEY` from the ignored root `.env`. Use the explicit web-context action after a sample shortlist appears. Exa sources never change synthetic prices, stock, ranking, or merchant handoff. Production composition stays disabled. See [Exa setup and verification](docs/exa-research.md).
