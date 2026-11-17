# Hard limits and preferences

Users can edit hard constraints separately from flexible priorities and change them within the same session.

## Sub-features

- `preferences.budget` changes or clears the budget and validates positive amounts.
- `preferences.filters` edits region, excluded brands, and required features.
- `preferences.category` resets category-specific options with a visible explanation.
- `preferences.presentation` adapts use case, priorities, and answer length.

## How to get to it (user POV)

Use **Set the boundaries** beside the request box. After research, edit fields and choose **Update comparison**. Follow-up requests can also change preferences.

## Driving it with Playwright

Preconditions: Research the first headphone example and retain its result as the before state.

- Lower the cap with `await page.getByLabel('Maximum budget amount').fill('200')`, then `await page.getByRole('button', { name: 'Update comparison' }).click()`. Observe that every returned offer is SGD and at most 200, with the hard budget preserved.
- Use `await page.getByRole('button', { name: 'Clear budget cap' }).click()` and update again. Require an empty **Maximum budget amount**, not a hidden old limit.
- Fill `page.getByLabel('Brands to exclude', { exact: false })` with `Sony`, update, and require no Sony result. Use `page.getByLabel('Wireless', { exact: true }).check()` for a required feature and verify every candidate meets it.
- Select `laptops` with `page.getByLabel('Product type').selectOption('laptops')`. Require laptop feature options, a visible note for removed headphone assumptions when applicable, and no stale headphone result.
- Use `page.getByLabel('Budget currency').selectOption('USD')` and `page.getByLabel('Offer region').selectOption('US')`. Update and require regional/currency limits to remain explicit. Do not compare SGD amounts numerically with USD.
- Use `page.getByLabel('Answer length', { exact: false }).selectOption('expanded')`, update, and compare the visible answer with the concise state. Change a flexible priority through its checkbox and verify the next response respects the unchanged hard limits.
- Fill budget `0`. Require an alert and disabled **Update comparison**. Clear the cap to recover.

## Gotchas

- Editing preferences invalidates the current shortlist before the next request. Capture both the edit and the replacement result.
- The first selected flexible priority has the most influence. It cannot override hard limits.
- An unsupported hard requirement remains unresolved until the user changes it or chooses **Drop this requirement**.
