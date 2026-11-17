# Session and recovery

Preferences stay within the current tab. Reset clears the workspace, and failures or late responses must not replace newer intent.

## Sub-features

- `session.reset` clears preferences, results, and handoff.
- `session.isolation` keeps independent browser contexts separate.
- `recovery.failure` offers useful retry behavior without fabricated results.
- `recovery.stale` ignores responses invalidated by a reset or newer edit.

## How to get to it (user POV)

Use **Reset session** in the header or **Start a new search** after selection. Retry appears after a failed request. Open another independent browser context to begin a separate session.

## Driving it with Playwright

Preconditions: Use the running fixture service. Failure or stale-response checks may delay or fail requests at the existing `/api/turn` or `/api/select` network boundary.

- Research a product, then `await page.getByRole('button', { name: 'Reset session' }).click()`. Require no `.product-card`, no handoff link, empty **Maximum budget amount**, and an empty request box.
- Create two independent contexts with `browser.newContext()`. Research headphones with a budget in one. Require the second context to remain at its initial state. Reset the first and require no change in the second.
- Fail `/api/turn` requests with `await page.route('**/api/turn', route => route.abort('failed'))`. Submit a real request. Require the visible error and **Retry**, no fabricated cards, and retained editable preferences. Use `await page.unroute('**/api/turn')`, choose **Retry**, and require an actual successful response.
- Delay a real `/api/turn` response through a route handler. Submit a request, then reset or edit the budget before allowing the response through. Require the late response to leave the reset or edited state intact. Capture the trace showing the order of actions.
- Delay a real `/api/select` response. Type a new request or choose **Reset session** while selection is pending. Release the old response and require no stale handoff or merchant link.
- Give actionable feedback in the request box and submit it. Require the relevant preference change while preserving hard limits. For feedback without a direction, require a targeted clarification.

## Gotchas

- Client state is in memory. Reload starts a new state and does not prove reset behavior.
- A mocked successful result cannot establish discovery behavior. Use failure injection only for the error or ordering case being tested.
- Remove route handlers and close every context created by the journey. Keep traces and screenshots.
