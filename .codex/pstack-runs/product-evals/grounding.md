# Application grounding

Fieldnote keeps authoritative shopping intent separate from response history. The server normal composition accepts an open product description, identified hard/flexible criteria and a budget range. The UI carries accepted prepare responses forward before starting research. Evaluation must not repair that state from its own expectations.

`src/domain/contracts.ts` defines current intent version 4. `src/server/app.ts` validates actual HTTP input and normal response envelopes. `src/server/research-turns.ts` calls updateIntent or editIntent in prepare, asks material questions or returns prepared, and reserves research only in research phase. Both phases share one UUID. `src/server/exa-research.ts` uses the installed Exa SDK against an explicit base URL. The evaluation seam is an owned fake-key loopback HTTP server and an in-memory quota recorder. The actual private quota ledger is excluded.

`tests/e2e/support/actual-composition.ts` demonstrates actual Hono/Vite/SDK transport. `normal-composition.ts` instead intercepts browser API calls into Hono in process. The new browser layer must name the method it actually used.

Existing retained native fields and page excerpts are historical bounded diagnostics. They are not raw original provider responses or current market evidence. Synthetic reconstruction must retain that label. Source quote containment establishes provenance only. Independent assertions must not reuse production recommendation eligibility as their oracle.

The unchanged app passed 659 existing tests across 31 files. That run establishes engineering regression state only. No usefulness result has yet been measured.

Canonical Exa skill setup was run on 19 November 2026. Its complete output plus Answer and SDK references were read from the printed supporting directory. No SDK update or API-shape change is needed for this evaluation-only task.
