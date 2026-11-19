# Evidence gap follow-up

User goal: preserve approved UI, correct actual evidence/price/relevance failures and continue to merge PR53 after all gates. Issue55. Source e81b890. No automated paid calls. Current user manual grant only.

## Bug-fix playbook steps

1. Reproduce it yourself on the matching surface through the applicable Codex browser, computer-use, terminal, or project verification skill (Non-negotiables). Don't hand the repro to the user. A debug or instrumentation protocol that says to ask the user does not override this. You drive the instrumented runtime. Ask the user only with a stated, specific reason the real verification surface cannot reach the target, and only after driving it as far as it goes. Won't reproduce directly, force it: synthesize the trigger, tighten conditions, or instrument until it fires.
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with `how` over the affected subsystem and the **why** skill for regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Drive a long or stubborn hunt with a Codex heartbeat automation or bounded monitor loop. Confirm the surviving *mechanism* with runtime evidence before the step-3 architect/interrogate fan-out.
3. Plan the fix. If it crosses a function boundary, `architect` first. Delegate implementation to a subagent using your configured bug-fix model (default `gpt-6-luna`) with a specific scope. Review the diff.
4. Verify on the same surface. The original repro now passes. "Inconclusive" or wrong-surface is not a pass. Flag it. Unit tests show branch behavior, not bug absence.
5. Stage the commits so the failing repro lands before the fix in git history. See the **tdd** skill for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear.
   This is the canonical **sequence-verifiable-units** principle skill, the failing test first and the fix on top.
6. Run **Opening a PR**.



## Throughput checkpoint

One isolated application owner investigates and writes. One independent architecture judgment reviews boundary choices in parallel. Root owns official Exa references, ledger, GitHub and integration. Once a clean candidate exists, independent QA and security run in separate worktrees. Preserve current user server on3190/5290 until an intentional verified restart.

## Task checks

- [x] Preserve screenshot facts and user approval; issue55 opened.
- [x] Verify current PR/main and remaining manual allowance read-only.
- [x] Reproduce local SDK/Hono validation and positive source-evidence cases.
- [x] Choose typed private diagnostics, then evidence3 binding after actual captured-source diagnosis and two fresh independent designs.
- [x] Commit red tests then fix initial binding; current independent review findings need another red/fix round.
- [ ] Exact-head offline QA/security, desktop/mobile UI preservation and full60 eval.
- [x] Capture one authorized human submission privately; root replays it offline with zero new provider calls.
- [ ] Reconcile known defects, inspect CI, merge approved PR53 under normal safeguards.

Original raw live response was not retained. A fabricated replay cannot prove its failure cause. Current global source completeness, whole-paragraph binding and narrow price grammar are hypotheses for conservative downgrades. Two completed human calls are documented only as billing status, not product acceptance.

At579ec53 root replay retains identity and observed SGD868 with conditions unresolved and money-only complete-fit unknown. Independent reviews found three additional blockers. Suffix/bare money can pass full-fit evidence, whitespace-equivalent or bare-variant target rows can be hidden as peers, and a frozen report reader accepts forged recorded checks. Merge remains held while these are fixed and reviewed. The original uncaptured invalid-schema response remains unproven.
