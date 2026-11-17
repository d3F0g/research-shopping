# Research requests

Users describe a shopping objective and receive a short fixture shortlist, a relevant clarification, or an honest no-match result.

## Sub-features

- `research.typed` submits the request form.
- `research.examples` submits each visible example request.
- `research.ambiguity` asks for the missing product category.
- `research.no-match` preserves impossible hard limits.

## How to get to it (user POV)

Open the home page. Type in the request box and choose **Research options**, or choose one of the three example buttons. After a result, type a follow-up in the same box. Examples then live behind the **Example requests** disclosure; open it before choosing another example.

## Driving it with Playwright

Preconditions: A fresh context at the web base URL passes doctor.

- Submit a typed request with `await page.getByLabel('Start with the outcome, not a model number.').fill('Wireless headphones for long flights, under S$500')` and `await page.getByRole('button', { name: 'Research options' }).click()`. Require the **Your shortlist** heading, at least one `.product-card`, visible sample prices, and the budget control set to `500`.
- Drive the first example with `await page.getByRole('button', { name: /Wireless headphones for long flights, under S\$500/ }).click()`. The smoke helper executes this entry point and records its actual response.
- In a fresh session, submit `Something good for work`. Require **One thing to clarify** and no `.product-card`.
- Choose the example matching `/Noise cancelling headphones under S\$100/`. Require **No sample option meets these limits**, no product cards, and the preserved budget of `100`.
- Drive the laptop example matching `/A light laptop for writing and travel/`. Require the **Product type** value `laptops` and relevant fixture results or an explicit limitation.

## Recorded activity

The app uses a complete JSON response, with no token stream. Before a response arrives, require no recorded activity. Capture the actual POST `/api/turn` response, open the button named `Recorded activity · ${payload.toolActivity.length} outcomes`, and compare every visible provider/outcome with that payload. A clarification has an empty array and no activity control. Do not assert fabricated stages, durations, or a complete execution audit.

## Gotchas

- Only headphones and laptops are supported. Unsupported categories or requirements need an honest limitation or clarification.
- Typing a follow-up hides the previous result. Use the new response as the proof, not a stale card.
- The header and footer identify fixture mode. No clock or screenshot date makes the catalog current evidence.
