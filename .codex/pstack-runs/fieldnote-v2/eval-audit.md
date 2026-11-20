# Evaluation integration audit

Source PR 47 head f865939c669153943e77af3870e54c10daad6750. Independent read-only audit validated all four historical reports and their 60 canonical contracts. No new provider traffic.

| Lane | Pass | Fail | Blocked | Unsupported | Critical | Dispatches |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Frozen v4 | 0 | 34 | 25 | 1 | 37 | 59 |
| First v5 | 4 | 37 | 18 | 1 | 52 | 29 |
| Local v5 with synthetic fallback | 5 | 36 | 18 | 1 | 49 | 31 |
| Local v5 without interpreter | 1 | 50 | 8 | 1 | 94 | 2 |

Each report executes 60 cases and 140 turns. These are recorded technical outcomes, not newly executed V2 results or usefulness proof. Preserve every tracked eval/artifact file, frozen baseline and unchanged expectations. Add versioned V2 adapter/report bridge. Current comparator hardcodes v4/v5 and cannot silently compare altered adapters.

Keep real normal HTTP and Exa SDK loopback observations, in-memory quota, immutable HTTP-attempt correlation and raw events. Mechanical field projections may not invent state, proof or accepted criteria. No interpreter tapes enter normal V2 composition.

Frozen milestones intentionally leave semantic/browser and unsupported-currency checks unassessed. V2 can remain blocked on those expectations even after objective failures are fixed. Report separately identified new capability checks.

Confirmed canonical hashes are recorded by eval owner in preservation manifest. Original dataset c452827b9aa87bc0b47c3e9a4cc6427a42bbf0303539bc2c09a2093ed754cb8f. Frozen baseline a9577869cd991fdd4713ef4bc5a6a5842b1d5839282d7e4a18a404cab2a32a56.
