# Evidence and uncertainty

This page describes the explicit legacy fixture regression composition. It does not describe normal development product scope or establish live product behavior. Use [Exa product research](web-research.md) for the dynamic normal interface.

Each result keeps synthetic claims, unknowns, conflicting observations, and manufacturer references behind an evidence disclosure.

## Sub-features

- `evidence.disclosure` opens and closes claim details.
- `evidence.fixture` labels claims and fixed observation dates.
- `evidence.conflict` shows disagreements without turning them into confident recommendation reasons.
- `evidence.references` distinguishes contextual manufacturer links from claim verification.

## How to get to it (user POV)

Research a supported category and open **Evidence and limits** within a product card.

## Driving it with Playwright

Preconditions: Submit a supported headphone request and scope the journey to its assistant turn. Its Sony WH-CH720N fixture has conflicting battery observations and unknown delivery and sound-quality claims in `src/server/fixtures.ts`.

- Within that turn, open the first card's **Evidence and limits** disclosure. Require the visible synthetic fixture explanation and claim-state labels. The smoke helper covers this entry point.
- In the intended assistant turn, target the Sony WH-CH720N card by its product heading. Open its evidence and require **CONFLICTING SAMPLE CLAIMS**, both battery observations, their source names, and fixed synthetic timestamps. Compare the same card's reason list and require that the conflicting claim is not a confident reason.
- For an unknown claim, require **UNKNOWN** and its explanatory note. The fixture precondition must actually include an unknown claim.
- Inspect the links named **Manufacturer reference/model page**. Require HTTPS approved manufacturer destinations and the statement that they do not verify the fixture claims, price, stock, or delivery. Do not open links merely to complete the local journey.
- Use the card's **Model reference** citation trigger before expanding details. Focus or hover `getByRole('button', { name: /Preview reference/ })` and require contextual source information. On touch, evidence exposes persistent safe source links without relying on hover.
- Open that turn's comparison control with Enter. Require an actual comparison table. At 390px, any horizontal table scrolling must remain inside its container; the document must fit the viewport.
- Capture the expanded disclosure at 390px width and require readable text with no horizontal clipping.

## Gotchas

- A manufacturer reference is contextual. It does not substantiate a synthetic observation.
- A missing conflict or unknown fixture is an unmet journey precondition. Do not replace that check with a supported-claim screenshot.
- The smoke screenshot opens only the first card. It does not establish every claim state or all external URL rejections.
