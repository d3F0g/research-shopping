# Dynamic budget range and local runtime correction

The user wants the actual running app to accept `Necklaces between 1k to 2k`. Preserve the open product description and both price bounds. No paid call, accounting reset, fixture fallback or merge safeguard bypass is authorized by this correction.

## Bug fix workflow

1. Reproduce it yourself on the matching surface through the applicable Codex browser, computer-use, terminal, or project verification skill (Non-negotiables).
2. Binary-search the cause.
3. Plan the fix.
4. Verify on the same surface.
5. Stage the commits so the failing repro lands before the fix in git history.
6. Run **Opening a PR**.

Opening updates existing PR #38; it does not create a duplicate. The primary live product gate and Issue #42 remain open.

## Reproduction and decisions

The original checkout at main9d2a3c5 contains the exact rejection text. The initial servers were running from that checkout; they exited before the new task's first browser attempt. That connection-refused trace remains under `/tmp/research-shopping-live/range-fix/`. Root then launched owned old-main servers with Exa disabled and reproduced the exact rejection through Chromium at the same localhost ports. The result and screenshots are in `red-old-runtime/`. The shared ledger hash did not change.

The dynamic branch accepts the product text but fails to extract the range. It has only a maximum budget. Two read-only pstack sketches map the domain and UI callers. A free-text minimum criterion would depend on AI status and cannot enforce the floor. Select optional `minimum` beside `amount` as maximum, validate the interval, and enforce both bounds deterministically. Retain exact currency, variant, price-condition and uncertainty guards. Recognize ranges before single amounts; measurements and product names do not become budgets.

The preference editor must round-trip the floor through unrelated and upper-only edits. Conflicting bounds remain pending. Preserve frozen v3 history before current v4 changes; historical turns remain read-only. Do not create another current parser or quote-recovery engine.

## Ownership

One implementation owner owns application and necessary test changes in `/Users/josiahwong/Documents/research-shopping-budget-range`, based on36813ad. Root owns docs, integration, GitHub and actual local process/checkout handoff. Reviewers own independent runtime/visual and security/integration verification. No worker reads the real environment, key, shared ledger or database. Luna is unavailable; implementation uses the recorded inheritance fallback. Design roles use configured Astra and Sol. No model-family-diversity claim applies.

## Throughput checkpoint

- Reproduce old browser rejection and dynamic null budget. Done.
- Ground two small interval designs and editor/history hazards. Done.
- Commit cheap failing regression before implementation. Owner a94e712.
- Implement interval, current-version/history boundary, editor and deterministic eligibility as one coherent unit.
- Independently verify exact candidate with fake-key SDK/Hono, adverse/positive intervals, original browser request, other product type, desktop and short mobile screenshots.
- Update PR #38 and complete actual CI. Do not merge while primary live acceptance/accounting remain blocked.
- Switch the original local checkout to a dedicated reviewed preview branch at the exact candidate, preserving pre-existing lockfile hashes and all untracked files. Main's branch ref remains unchanged. Restart known owned servers at5173/3000 from that checkout with the existing stopped shared ledger.
- Verify the exact request through the running normal app. Require necklaces, minimum1000, maximum2000, visible currency and honest quota limitation, zero new provider attempts and unchanged ledger. Leave this verified local preview running and record its launch/stop details.
