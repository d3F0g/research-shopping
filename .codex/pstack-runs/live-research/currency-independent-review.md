# Independent currency alias correction review

The goal is to retain accepted budgets and give specific currency guidance for unsupported amounts, while preserving supported SGD/USD changes and browser preference controls.

**PASS for this scoped currency delta.** All four previously failing aliases now satisfy their unchanged expectations. No blocking behavioral or security defect was found in the reviewed delta. This does not approve Issue4, production, a merge or the 26 unmet corpus cases.

## Exact candidate and provenance

Reviewed `3b1c9643f91c48d2461d7449263bea26b5d5bcca` against `a0416124babcbdaec063da89dde06ca535aa5f5c`. The only changed files are `src/domain/preferences.ts` and `tests/unit/preferences.test.ts`. All runtime targets were inside this review's own immutable `pinned-3b1c964` Git archive. The author checkout was used only to read Git objects and existing installed dependencies. It was never the source target for this review's runtime checks.

`pinned-source-manifest.json` pins the archive and both files. Preferences SHA-256 is `ee98bdb9693cb160202ef24aebca3c30ba18c53ca00db0292b0f3121b116f033`. Focused tests SHA-256 is `8ccd7e79921be8700c0e6ef25f330905fc08a281436ddab81e214e19b681c95a`.

All 1,408 inventoried prior proof files remain byte-identical, including the earlier BLOCK, original 64 inputs and the previous mutable-checkout evidence with its recorded limitation. Those older browser artifacts were not rerun or relabeled.

## Behavioral evidence

| Check | Observed result | Evidence |
| --- | --- | --- |
| Original independent scenarios | 64/64 pass. Original input definitions and assertion block are identical. | `currency-probes.json`, `sixty-four.log` |
| Earlier additional controls | 56/56 pass. ALL/TRY/TOP, whitespace, compact/code positions, embedded model words, 32 GB, mixed currencies, pending constraints, nonbudget edits and SG/US defaults remain correct. | `fresh-currency-checks.json` |
| New alias boundary matrix | 52/52 pass through parser and actual Hono/SDK boundary. Covers all four names in compact/spaced prefix/suffix form, uppercase, singular euro/pound, embedded words, standalone names, mixed supported amounts and existing pending constraints. | `alias-boundaries.json` |
| Original five unsafe suffix pairs | 5/5 fixed. CHF/HKD/CNY/₹/₩ retain SGD300 and return currency clarification with zero SDK calls and no reservation. Original base63/cf78 responses are preserved unchanged beside candidate responses. | `paired-five-corrections.json` |
| Whole candidate unit/API suite | 629/629 across 18 files, including 81 focused preference tests. | `unit.log` |
| Typecheck | Exit 0. | `typecheck.log`, `commands.json` |
| Mandatory corpus | All 61 execute. 35 PASS, 26 RED. Inventory and red set match reviewed a041612. All six currently supported SDK/Hono controls pass. | `runs/2026-11-18T06-43-51.973Z-3b1c9643f91c/summary.json` |

The previously failing exact messages `under 200euros`, `under 200pounds`, `under 200yen` and `under 200ringgit` now return `reason: currency`. Their accepted budget, exclusions and required features remain intact. Unsupported and embedded-word requests make zero SDK calls and create no quota reservation. Supported positive controls make actual SDK requests to an owned loopback server, so rejecting every request cannot pass these checks.

The change reuses the four existing name aliases inside the same complete amount-token boundary as runtime currency codes. It restores their specific clarification without extending the vocabulary or introducing conversion. Full-source review confirms that staged budget application, first-error precedence, sticky pending constraints and retained nonbudget edits remain unchanged from a041612.

## Browser evidence and compatibility limit

Installed Chromium `159.0.8154.6` loaded the shared preference module under Node `v22.20.0`. The actual browser submitted SGD300, rejected zero in the preference editor, changed to USD250, and submitted CHF plus all four compact aliases. Each unsupported request retained USD250 and did not increase the SDK request count beyond the two supported actions.

`browser-proof.json` and `browser-trace.zip` preserve the actual responses and actions. `desktop-preferences.png` at 1440×1000 and `mobile-preferences.png` at 390×844 were visually inspected. The current clarification and budget controls are readable, the composer remains visible, and no horizontal overflow was observed. There were no page errors or unexpected page-network requests.

`Intl.supportedValuesOf` exists in the tested browser and returned 159 currency codes. The module still requires that API at import. This verifies the installed Chromium/Node path only. It does not establish compatibility with older engines or every currency spelling, nor does it certify complete frontend/history behavior.

## Harness integrity, security and cleanup

No oracle, acquisition fixture, evaluation predicate or package file differs from reviewed 63eb515. Canonical corpus hash remains `fd51c69151c384ff80f6d97ccd3910bf90fdcf011451005c3112542556ca84da`. The replay hash is `9af80e6f0bcf3597699e1b8d3b8764ad68bf07d66048b90fc53b953b1309d429` because copied `report.ts` redirects output and records the immutable archive pin instead of querying a mutable checkout. `replay-instrumentation.diff` exposes those changes and the owned test/cache paths. No criterion or expectation changed.

Fresh static review found zero added comments, suppressions, fallback workarounds, dependencies, permission changes, executable user input or new network sinks. The new regex vocabulary combines trusted runtime currency codes with the existing fixed aliases. No additional blocking security issue was found in this narrow change.

`commands.json` records every command, immutable working directory, environment-name allowlist and exit code. Execution used the offline guard, fake SDK keys, owned loopback services and new temporary ledgers. No real provider, acquisition, paid call, credential file, existing database or GitHub access occurred. All owned services closed; browser/API ports were rebound successfully. Only this review's temporary test ledgers were removed. No repository files were edited.

## Principles and remaining work

**Test Behavior, Not Implementation** kept all 64 original inputs and predicates unchanged. **Prove It Works** required the immutable archive, actual Hono/SDK requests and real browser preference controls. **Explain the Number** kept the passing currency checks separate from the 26 future application failures. **Model the Domain** directed review toward the shared currency token and staged budget state, without demanding a larger vocabulary or currency conversion.

The currency blockers are closed at this exact head. The 25 future semantic corpus cases, monitor-category switch, broader narrative/preview and capacity acceptance, full browser/history work, PostgreSQL mixed history, final application QA/security and CI remain outside this approval.
