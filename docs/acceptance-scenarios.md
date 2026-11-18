# Reproducible acceptance scenarios

Run these through the visible UI and API. The automated suite must assert the observable result, not just that an internal function ran. Fixture runs prove development behavior only.

| Scenario | User action | Required result |
| --- | --- | --- |
| Dark first visit | Open a fresh browser context with light OS preference | Show a minimal dark chat without filters or an empty-results panel. |
| Theme persistence | Toggle light/dark and refresh | Retain the selected theme independently of tab-local conversation state. |
| Ordinary message | Send Hi or Thanks | Append an ordinary assistant message without research cards or lost constraints. |
| Optional preference | Receive a missing-budget card and choose Skip | Continue without inventing a cap or repeating the question in that context. |
| Clear intent | Ask for noise-cancelling headphones within a named budget and currency | Show eligible sample options, decisive tradeoff, and explicit fixture disclosure. |
| Ambiguous intent | Ask for something good for work without a category | Ask one question that materially affects discovery. |
| Budget change | Follow results with a lower budget | Replace the active budget, preserve other preferences, exclude ineligible products from the new answer, and retain earlier message snapshots. |
| Constraint removal | Remove the budget limit | Clear the constraint without a repeated budget question or hidden filtering. |
| Excluded brand | Exclude a displayed brand | Remove that brand before ranking. |
| Changed category | Change headphones to laptops or monitors | Reset category-specific assumptions and show relevant results or a stated capability limit. |
| Region/currency change | Change market and currency | Avoid numeric comparison between currencies and disclose missing regional evidence. |
| Impossible constraints | Use a budget below all eligible products or require an unsupported specification | Return no-match or a clarification; never silently relax the requirement. |
| Unavailable product | Choose a product with sample unavailable status | Do not present it as an available verified purchase. |
| Conflicting sources | Open evidence with competing claims | Show conflict, source references, and fixed observation times. Do not turn conflict into a confident reason. |
| Dissatisfaction | Reject a recommendation and name a desired improvement | Adapt that preference. Ask a targeted question only when the feedback gives no actionable direction. |
| Detail adaptation | Request a shorter or more detailed answer | Change presentation length without changing factual support. |
| Tool failure | Inject discovery or merchant failure through the adapter boundary | Show useful error/retry behavior without invented replacement data. |
| Selection | Select an eligible product | Resolve its ID server-side and show the exact approved merchant hostname and HTTPS destination. |
| Session isolation | Use two independent browser contexts | Keep preferences, result state, and reset separate. |
| Stale request | Overlap turns or reset during a request | Prevent late responses from overwriting newer state. |
| Mobile use | Complete the journey at 390px width | Keep controls, expanded evidence and selection readable while history scrolls and the bottom composer stays usable. |
| Keyboard use | Complete core actions using keyboard controls | Preserve visible focus, labels, and operable disclosures. |
| HTTP attacks | Send foreign origins, malformed JSON, wrong media types, large bodies, and unsafe links | Reject the boundary violation without state mutation or secret-bearing errors. |

## Evidence standard

Capture the user action and resulting state. Save browser screenshots, test reports, API observations, and the reviewed commit. A current app timestamp is not a current product observation. A valid URL structure does not prove the merchant page is still reachable or has current inventory. Link reachability needs a separate check, and blocked or redirected pages stay labeled as such.
