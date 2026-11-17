# Product selection

Selecting an eligible product resolves its identity server-side and displays a manufacturer product link with the fixture price and stock caveat.

## Sub-features

- `selection.identity` keeps the selected product and handoff URL aligned.
- `selection.disclosure` shows the merchant hostname and sample-data limits.
- `selection.policy` rejects unsafe, unavailable, or ineligible selections.
- `selection.restart` begins a new search from the handoff.

## How to get to it (user POV)

Choose **Select this product** on a shortlist card. The resulting panel offers **Open manufacturer product page** and **Start a new search**.

## Driving it with Playwright

Preconditions: A fresh supported request has an eligible result.

- Record the first card's product name, then `await page.getByRole('button', { name: 'Select this product' }).first().click()`. Require a handoff with the same identity and the **Open manufacturer product page** link.
- Observe the real `/api/select` response and compare its `productUrl` to `await page.getByRole('link', { name: 'Open manufacturer product page' }).getAttribute('href')`. Require the displayed **Merchant host** to match that HTTPS destination. The smoke helper checks response equality without opening the destination.
- Require **Sample price · fixture only** and the caveat that sample price and stock were not checked live.
- Choose `await page.getByRole('button', { name: 'Start a new search' }).click()`. Require no handoff, an empty budget, and the initial workspace.
- Run the API boundary and domain tests with `npm test` for unsafe URL forms, rejected identities, and unavailable products. A rejected selection must not become a clickable handoff.

## Gotchas

- Do not place orders or enter checkout. Opening a merchant page is outside the smoke helper's local proof.
- URL policy approval does not prove reachability, current price, inventory, delivery, or variant correctness.
- An unavailable fixture may be excluded before the user can select it. Record that absence and use the actual API tests for rejection proof.
