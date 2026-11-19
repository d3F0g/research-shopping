# Independent architecture review

Reviewer architecture_crossjudge, gpt-6-astra xhigh. Read-only design review of architecture.md and audit documents; no implementation/runtime review claimed. Selected A as simpler viable direction. Conditional verdict required two changes.

1. One atomic prepared-operation record binds server owner, conversation epoch, active operation and immutable research request. Concurrent duplicate dispatch cannot reserve twice. Cancellation/reset/logout invalidate late publication. Unknown costs are not retried after restart. General state revision cannot abandon valid paid work on a presentation-only edit.
2. Held comparison names snapshot and displayed IDs/order. Historical snapshots retain original eligibility, but current best selection recomputes eligibility under current requirements without provider cost. Unknown evidence stays unknown and old actions remain inactive.

Root added these semantics to architecture.md and assigned implementation/tests. Exact code review remains required.
