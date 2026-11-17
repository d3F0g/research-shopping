# Autonomous merging policy and PR6/PR20 shipping

The user authorizes protected-branch PR merging when CI, independent QA/security, blocking-defect, and GitHub policy gates pass. Production deployment, destructive operations, sensitive credential changes, and security-critical permission changes remain excluded.

## Shipping steps

1. **Resolve the forge, then verify each PR independently before it lands.** GitHub CLI (`gh`) is the default. If `command -v origin` succeeds and Origin can resolve the repository, use `origin pr` for every PR operation. Otherwise stay on `gh` and record the fallback. Never require Graphite (`gt`). One verifier per PR, each a Codex subagent in an explicit worktree, runs the change the way a user would with the available browser, computer-use, terminal, or project verification skill, parent against head, and posts `PASS`, `PASS+NOTES`, or `FAIL` on that PR. Only a verdict from an agent that did not write the code counts, because an author checks what it meant to build. Green CI and an approving bot review are not verdicts, because neither runs the change as a user would.
2. **Land only the contiguous verified run rooted at the bottom.** Walk up from the lowest unmerged PR and stop at the first one without `PASS` or `PASS+NOTES`. The PRs below it are the run, and the top one is the ceiling. A verified PR above an unverified one waits, because it cannot land without the code below it. One whose branch neither holds nor needs that code can move onto trunk and land on its own. It needs a fresh verdict first, because its old one ran with that code beneath it and trunk does not have it.
3. **Re-check that the verdicts still describe the code.** A verdict covers a patch, and a chain rebase moves every PR above it to a new SHA without failing any check. Compare `git patch-id` at the verdict SHA with the current head before trusting an older verdict. When the patches differ only in tests, docs, or lint config, a lane's result stands if what it ran builds the same at both SHAs apart from noise. Noise is a difference that also shows up between two builds of the verdict SHA, or an embedded commit SHA. Report each kind of noise with its files, so a reader can check the call. The change itself still gets fresh checks and a review, because the old verdict never saw it. A lane with no build output, such as a dev server, cannot show this, so rerun it, and re-verify anything else that drifted.
4. **Land bottom-up, one PR at a time.** Skip the upstream squash/rewrite procedure for this stack because preserving PR6 ancestry avoids force-pushing the shared application branch. Before each merge, fetch trunk and confirm the lowest verified PR targets it. Use a GitHub native merge commit with the expected reviewed head. Confirm merged state before retargeting PR20 to main. Compare the child patch and rerun affected review and CI. If a shared-branch rewrite becomes necessary, stop and report it rather than force-pushing. Auto-merge can be armed only for a reviewed current head with all non-CI gates satisfied and all remaining required checks enforced by GitHub. This repository currently has no branch rules, so root waits for CI before using a pinned native merge.
5. **Leave the stack alone while it lands.** Step 4's move of the next PR is the only change to a branch or base, because a merge lands whatever its branch and base hold at that moment, verdict or not. On GitHub, use `scripts/watch-pr/watch-pr --queued-stack --stack-prs <bottom>` only for an event wake, then read `gh pr view <pr> --json state,mergedAt,mergeStateStatus,statusCheckRollup,autoMergeRequest`. Neither the watcher’s READY nor its queued WAITING state proves a merge; require `mergedAt` or `state: MERGED`. Continue with a bounded monitor or a verified Codex heartbeat under CODEX.md until the ceiling has actually merged. On Origin, re-read the current PR with `origin pr view <pr> --checks` each time `origin pr checks <pr> --watch` returns, until the ceiling reads merged. A base that moves to trunk when its parent merges is expected, not damage to repair. If a merge stalls, find out why before you change anything.
6. **Stop at the ceiling.** Extending the run takes new verdicts, so it is a new pass through step 1.

## Swarm phases

1. Frame
2. Fan out
3. Aggregate
4. Report

## Throughput checkpoint

Root updates the repository policy and handles all GitHub mutations. Three independent reviewers partition architecture QA, application QA/policy behavior, and security for both PRs. They use explicit detached worktrees and exact candidate commits. Their reports go outside the candidate worktrees so review does not drift. Root reviews their evidence, records per-PR verdicts, and lands only the verified run from PR6 through PR20. No reviewer merges or fabricates GitHub approvals.

## Forge and topology

Origin CLI is unavailable; GitHub CLI is the supported pstack fallback. Babysit uses check mode for the architecture/docs frontier, then drive for application CI. Root alone owns the stack. PR6 targets main; PR20 targets docs/architecture and includes PR6. Native merge commits are allowed. Preserve ancestry when landing PR6 to avoid a force-push/rebase of the reviewed application patch. Retarget PR20 to main only after PR6 is confirmed merged. Reinspect its patch, mergeability, policies and CI afterward. No branch deletion is needed.

## Acceptance

AGENTS.md and project orchestration define the standing five-gate merge authorization. Both PRs receive independent QA and security verdicts on their actual patches. No blocking defects or required review remains. GitHub receives no admin bypass, fake approval, protection edits, or credential changes. After landing, root synchronizes main by fast-forward only and checks the main push workflow. A genuine blocker is reported without weakening safeguards.
