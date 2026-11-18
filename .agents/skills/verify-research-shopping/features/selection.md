# Product selection

Selecting a current eligible product resolves its identity server-side and adds a safe manufacturer handoff to the conversation. The sample price and stock caveat remain explicit.

## Drive selection

Use the current actionable recommendation turn. Record its selected product identity. Observe the actual POST `/api/select` response, then require the visible manufacturer link to equal that response's exact `productUrl`. The displayed identity and merchant host must match the same handoff.

Require HTTPS without userinfo or a nonstandard port. The link opens safely with the existing new-tab attributes. Match its full accessible name or use a non-exact match because it includes the new-tab suffix. The smoke helper compares the link with the actual response and never opens the external destination.

Require visible fixture price and the limitation that price and stock were not checked live. The handoff belongs to its originating conversation turn. Earlier messages must remain rather than being replaced by a separate dashboard panel.

After changing preferences or beginning newer work, historical cards must not authorize selection under old constraints. Require their obsolete actions to be disabled, or require the explicitly supported revalidation path to use current accepted preferences. Never trust an old offer or link as fresh selection authority.

Use the actual new-chat/reset control after handoff. Require an empty conversation and default shopping preferences while preserving the theme selection.

## Boundary proof

Run domain and API tests for unsafe URL forms, wrong product identity, unavailable products and hard-limit rejection. Inject malformed successful handoff payloads only at the selection boundary and require no clickable unsafe destination. Preserve exact identity/destination checks when changing UI selectors.

Do not place orders or enter checkout. URL-policy acceptance does not prove destination reachability, current price, inventory, delivery or variant correctness. Record unavailable products excluded before selection and use actual boundary tests for their rejection proof.
