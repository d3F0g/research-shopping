# Session and recovery

The current tab owns conversation history and accepted preferences. New-chat/reset clears shopping state and cancels pending work. Explicit theme selection persists independently.

## Reset and isolation

Create a multi-turn conversation with a shortlist and handoff. Use the visible new-chat/reset control. Require no previous messages, product cards, source results or merchant link, an empty composer, default shopping preferences and the minimal chat state. The selected theme must remain unchanged.

Use two independent browser contexts. Change preferences and submit multiple turns in one. Require the other context to remain empty with its own default preferences. Reset the first and require no change in the other.

## Failure and retry

Fail `/api/turn` at its network boundary. Submit a real request and require an honest error without fabricated cards. Keep the submitted message in history. Remove the failure route, activate Retry and observe a real successful response using the saved valid request. A failed initial request must remain retryable. Retry must not duplicate a successful exchange.

Delay a real turn response. Before releasing it, edit the draft, submit a newer turn or reset. Require the old request to abort and its late completion to leave newer state authoritative. Completed earlier messages remain snapshots; cancelled tasks must not leave a permanent spinner.

Delay a real selection response. Edit the draft or reset while pending. Release the response and require no stale handoff. Repeat through the source-request boundary where affected. Retained history must not keep cancelled work alive merely because its component remains mounted.

## Feedback

Submit actionable feedback and require the relevant preference update with hard limits preserved. Generic dissatisfaction needs a targeted clarification. A friendly acknowledgment must not create or silently remove an unresolved hard constraint.

## Evidence

Keep the trace showing action order, actual requests, accepted responses, history and current state. Failure injection proves the ordering/error case only. Core discovery uses real fixtures. Remove route handlers and close contexts you create. Reload resets in-memory conversation state and is not a substitute for testing the actual reset control.
