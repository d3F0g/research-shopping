# Product source links and unavailable selection

Current normal research exposes **View product source**. It has no product-selection or merchant-handoff control. Normal `POST /api/select` returns HTTP 409 because verified merchant selection is unavailable. Record browser handoff as unreachable with this prerequisite, not as a passing selection journey.

## Drive source navigation checks

Scope the product article to its assistant turn. Match **View product source** to the exact validated source URL in the response. Require HTTPS, no credentials or unsafe destination, and `noopener noreferrer` for a new tab. Keep observed-price, unknown stock, and delivery limitations visible. Do not open external destinations merely to complete the local check.

Require no **Select this product** button or invented merchant offer. After a preference change, old results remain evidence snapshots and cannot initiate research under obsolete constraints. Use **New chat** and require the old conversation to disappear while the theme remains.

## Legacy boundary proof

`tests/api/app.test.ts` and `tests/unit/shopping.test.ts` preserve synthetic fixture selection coverage. Check exact product identity, full manufacturer destination, unavailable products, hard constraints, and unsafe URL rejection there. The current composer cannot drive that legacy API composition.

Keep malformed source response and unsafe-link rejection in normal browser tests. A safe research URL does not prove merchant authorization, reachability, current price, inventory, delivery, or exact variant availability. Do not place orders or enter checkout.
