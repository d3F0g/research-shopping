# Engineering workflow

The orchestrator owns scope, contracts, GitHub issues, and final verification. An application owner implements in an isolated worktree. QA and security reviewers inspect a named commit independently. A new code change invalidates the affected review verdict until rechecked.

Project custom agents live in `.codex/agents/`. The three TOML definitions define implementation, QA, and security roles. Models and efforts are omitted so pstack role choices passed at spawn remain authoritative. `.codex/config.toml` allows three child threads. The current host can impose a lower limit. Reload the project to discover new roles. Custom agent instructions inherit the parent's permissions and do not create a separate sandbox. See the [official subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents).

The installed pstack role settings in `~/.codex/pstack-models.md` guide this run. Explicit host-supported model choices and bounded briefs are recorded in the run ledger. If a configured model is unavailable, record the fallback before using inheritance. Historical initial architecture candidates used Astra and Luna, with Sol assessing security capabilities. Current runs record their actual assignments and host fallbacks in the run ledger. Do not infer a current model assignment or model-family diversity from that historical record.

## Loop

The user approved the chat-first design in PR #33, satisfying issue #30's visual-approval milestone. Routine development now proceeds autonomously through implementation, independent QA/security, CI and merge. Request approval only for production deployments, sensitive operations or explicitly designated design-review milestones. A future milestone pauses merging only when the user designates it; ordinary frontend work retains independent visual QA and screenshot requirements.

1. Plan a checkable behavior and name its data shape.
2. Delegate to an owner with exact worktree, branch, paths, and success evidence.
3. Implement the smallest complete behavior and commit verified units.
4. Test core behavior, HTTP boundaries, and actual browser journeys.
5. Independently review the candidate commit.
6. Create issues for reproducible defects and capability gaps.
7. Resolve defects in scope and reverify the changed behavior.
8. Open a tested pull request and apply the autonomous merge gates in AGENTS.md.
9. Merge eligible PRs in dependency order, synchronize trunk, and verify final CI.

The repository is private. Issues are assigned to its owner because ephemeral Codex workers have no durable GitHub identity. Issue bodies and the run ledger record worker responsibility. The orchestrator has standing authorization to merge completed PRs when every gate in AGENTS.md passes. Production deployment, destructive operations, sensitive credential changes, and security-critical permission changes require separate authorization. Credentials stay outside source control.

## Land a verified PR or stack

1. Resolve the repository, trunk, current PR heads, and dependency order. Inspect branch protection, rulesets, required checks, required reviews, and unresolved threads. Do not treat admin access as permission to bypass a gate.
2. Obtain separate independent QA and security verdicts for each PR's patch. Reviewers name the base and head commits and the checks they actually ran. A passing build or bot approval cannot replace runtime QA. For docs-only changes, verify the affected documents and configuration without claiming nonexistent runtime checks.
3. Reconcile verdicts with the current candidate. If the patch changes, rerun affected review and tests. Documentation-only drift still requires review and configured CI. No unresolved blocking defect can be deferred to enable merging.
4. Merge the lowest verified PR targeting trunk. Use native auto-merge or the repository's supported stack mechanism when appropriate. Arm it only after independent reviews and non-CI gates pass, and only when GitHub enforces all remaining required checks. Otherwise wait for those checks before merging. Use an expected head SHA where supported. Preserve ancestry for dependent PRs when possible. Never pass an admin-bypass flag or fabricate a GitHub review.
5. Read GitHub back to confirm the merge and resulting trunk commit. Retarget the next dependent PR to trunk after its parent lands. Compare its patch and recheck mergeability, review policies, and CI before landing it. An auto-merge request or queue entry is not a completed merge.
6. Fetch trunk and fast-forward the local branch. Do not discard a dirty working tree or unrelated local commits. Verify final trunk CI on its exact SHA and report merged PRs, independent verdicts, and any blocker.

When required approval cannot be obtained through the available legitimate reviewers, report the blocker. Independent agent verdicts are engineering evidence; they do not impersonate another GitHub account or satisfy a platform-required approval by themselves. Do not change access, branch protections, token scopes, or workflow permissions to unblock a merge.

The standing policy is repository-scoped. Historical run plans retain the authorization boundary at the time they were written; AGENTS.md governs future tasks. Root owns GitHub mutations so only one coordinator controls a stack.

## Initial tracking

- [Milestone #1](https://github.com/d3F0g/research-shopping/issues/1) covers the functioning vertical slice.
- [Live integration #2](https://github.com/d3F0g/research-shopping/issues/2) covers research and merchant providers.
- [Durable personalization #3](https://github.com/d3F0g/research-shopping/issues/3) covers authentication and PostgreSQL.
- [Coverage #4](https://github.com/d3F0g/research-shopping/issues/4) covers more categories and semantic evaluations.

Git operations in this run use the authenticated GitHub CLI helper per command because the host's default helper could not access the new private repository. No global credential configuration changed.

## Live research program

Exa is the primary development research provider. Fixture catalogs are confined to explicit automated-test composition. Research observations and unverified page prices cannot become verified merchant offers. The absence of authorized merchant API access is an external dependency. Record it in Issue #36 and keep Issue #2 open until real merchant proof satisfies its acceptance criteria. Do not repeatedly request the same unavailable access.

Cancellation is merged. The active product milestone replaces the fixed-category admission pipeline with dynamic product descriptions, identified criteria and a source-based comparison/recommendation. It updates existing PR #38. Auth expansion remains dependent; adding a finite list of categories is not the coverage architecture. The original evidence remains in `.codex/pstack-runs/live-research/`; the current decision and work sequence are in `.codex/pstack-runs/dynamic-shopping/`.

A green technical suite does not waive failed product acceptance. Require genuine normal-app journeys across varied needs, including a product class outside earlier examples, useful distinct alternatives, attributable specifications/prices, explicit hard-constraint outcomes, justified conditional choice and safe product links. Keep source synthesis, literal quotations and merchant verification separate. A source-only result or an unresolved hard fit is a documented failed shopping outcome, not success by test or source count.

Use small live allowances recorded before calls, preserve the shared persistent ledger and every failed proof, and stop on unexpected error/charge. Tests use explicit substitutes and must not spend credits. An API-only prototype resolves an endpoint risk but is not application acceptance. Do not iterate indefinitely on offline source-pattern tests while product usefulness is unproven.

Current intent and response/evidence schemas evolve independently of exact frozen historical request/question/response snapshots. Unknown hard compliance cannot authorize a confident match. Review changed trust boundaries and preserve meaningful adverse behavior when replacing the provider contract; unused legacy suites cannot stand in for current verification.

Each unit retains independent QA/security, actual CI and the same merge gates. Standing autonomy continues after a requested checkpoint unless the user explicitly keeps work paused. Production deployment and changes to sensitive credentials or security-critical permissions remain outside routine merge authorization.
