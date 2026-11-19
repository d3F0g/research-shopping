# Hard limits and preferences

The current editor accepts an open product description, Required and Flexible criteria, budget bounds, currency, market, and answer length. The server interprets messages and accepts explicit edits. Category menus and known-brand selectors are not current controls.

## Contextual questions

Submit a shopping request without a budget. Exercise the optional budget form through **Apply budget** and, in a separate conversation, **Skip budget**. Require accepted values or an explicit skip without inventing a budget. A complete request with a stated budget must not ask for it again. A generic skip must never clear an unresolved hard requirement.

## Edit accepted preferences

Open the current answer's preference disclosure. Require one mounted editor, readable mobile fields, visible keyboard focus, and the accepted values. Close it through its actual control without losing earlier messages.

- Edit the open product description and a criterion. Preserve each unchanged criterion's identity and Required or Flexible strength.
- Save a budget range. Change only its maximum and require the minimum to remain. Remove the minimum explicitly and require only that bound to disappear.
- Change currency or market. Require the accepted response to preserve unrelated criteria. Never treat SGD and USD as interchangeable.
- Change answer length or a Flexible criterion. Require all unrelated hard requirements and budget bounds to remain.
- Enter zero or a minimum above the maximum. Click **Save preferences**. Require an alert and unchanged accepted state. Save stays clickable so validation can explain the error. Recover with a valid value or explicit removal.
- After a valid save, inspect the accepted response and require no provider request. Use **Compare options** explicitly to research the edited intent.

Use natural follow-up messages for supported changes. After `under S$200`, require the accepted cap and retained previous exchanges. Do not replay old request wording when applying editor changes.

## Safety and proof

Editing cancels obsolete work without erasing completed history. Flexible preferences cannot override a hard requirement. Unknown hard fit remains unresolved. Scope fields and cards to the current editor and assistant turn.

Use `tests/e2e/budget-range.spec.ts` for actual HTTP and SDK loopback range handling. Use `tests/e2e/dynamic-shopping.spec.ts` for response-injected editor validation and immutable snapshots. Both use synthetic evidence and establish no live offers. Legacy fixture category and priority rules remain API and domain regression checks, unreachable through the current composer.
