# Research + Shopping engineering

The product ends at a recommendation and merchant product link. Payments and order placement remain out of scope. Production deployment, destructive operations, sensitive credential changes, and security-critical permission changes require separate explicit authorization.

Use the installed pstack poteto-mode workflow for substantial engineering. Root coordinates the plan and GitHub issues. A branch owner implements in an isolated worktree. Independent QA and security agents review the exact candidate commit. Do not equate a worker's summary or passing build with runtime verification.

## Ownership

- Orchestrator owns `.codex/pstack-runs/`, `docs/`, `.audit/`, and GitHub tracking.
- Application owner owns application code, package configuration, tests, and its feature branch.
- Verification owner owns `.agents/skills/verify-research-shopping/` after the app launches.
- Reviewers do not modify application files. They report reproducible issues and evidence.

Use distinct worktrees for concurrent code writers. Never revert another worker's changes. Pin review findings to a commit. The configured role models come from `~/.codex/pstack-models.md` when available, with active-host inheritance as fallback.

## Product invariants

1. Understand the objective and ask only questions that affect the result.
2. Keep hard constraints separate from flexible preferences.
3. Research with attributable evidence and expose uncertainty.
4. Put the useful answer first.
5. Keep comparisons concise and put detail behind disclosure controls.
6. Adapt within the session when preferences or response length change.
7. Avoid redundant product notifications and progress chatter.

Every sample claim, price, and availability status must remain visibly labeled as fixture data. A current timestamp cannot turn a fixture into current evidence. Research sources do not prove inventory. Unsupported constraints and categories must produce an honest limitation or clarification. Never silently relax a hard constraint.

## Verification

Use package scripts and the project verification skill once created. Require real browser journeys and responsive screenshots, plus boundary and core-behavior tests. Cover budget changes, ambiguity, unavailable products, conflicting sources, dissatisfaction, provider errors, merchant-link policy, and session isolation. Keep evidence under `artifacts/` and document what the tests did not establish.

GitHub Issues are the durable defect tracker. Resolve a defect only after reproducing, fixing, and reverifying it. The standing merge authorization below applies to completed PRs. Opening a PR alone does not satisfy its gates.

## Mandatory frontend architecture

All frontend development uses official [shadcn/ui](https://ui.shadcn.com/docs) and the appropriate official [AI Elements](https://ui.shadcn.com/docs/ai-elements). This is an architectural requirement. Use the official registry/CLI and documented patterns, with provenance recorded in the repository. Do not replace the primitives with handmade lookalikes.

Compose product cards, comparisons, preference controls, dialogs, and progressive disclosure from shadcn/ui. Use official AI Elements for conversational messages, prompt input, citations, and tool activity. Streaming displays must reflect actual transport events; do not simulate streaming, reasoning, or tool progress. Source references remain safe manufacturer links for synthetic fixture claims.

Keep design tokens centralized, with consistent typography, spacing, contrast, focus indicators, and responsive layouts. Prefer concise answers and compact comparisons with expandable evidence. All essential controls and disclosures stay readable and keyboard-operable on desktop and mobile.

Delegate implementation and independent visual QA through pstack. Verify real browser journeys and desktop/mobile screenshots after frontend changes. Preserve behavioral/security assertions when changing selectors for official component semantics. Frontend changes require mandatory frontend acceptance and independent visual QA before merging. Future feature work follows its assigned issue and PR scope.

## Autonomous development and merging

The user authorizes fully autonomous routine development and GitHub PR merging for this repository. The orchestrator may merge completed PRs without asking for approval when every gate below passes. This standing authorization supersedes earlier project run notes that prohibited merging.

1. All required CI checks pass on the current candidate. Inspect actual workflow results and required status checks. A missing required check is a blocker. A docs-only PR with no configured required checks must record that fact rather than claim CI ran.
2. Independent QA and security reviews pass for each PR. Reviewers must not have authored the change. Record the reviewed base, head, scope, commands, and verdict. Application changes require actual runtime verification; frontend changes also require desktop and mobile visual QA.
3. No unresolved blocking defect or blocking review thread remains. Fix and reverify defects before merging. Track deferred capability gaps separately from accepted scope.
4. GitHub branch protection, rulesets, required reviews, and merge-queue policies are satisfied. Never fabricate approvals, self-approve as another reviewer, dismiss a valid required review to proceed, use an admin bypass, or weaken repository safeguards.
5. The change does not involve production deployment, destructive operations, sensitive credentials, or security-critical permission changes. These actions require separate explicit authorization. This engineering policy does not authorize changing repository access, protections, token scopes, or workflow permissions.

Root owns merge decisions and GitHub mutations. Delegated implementation and review agents do not merge unless root explicitly assigns that action within this policy. Prefer GitHub native auto-merge or a supported stack merge when GitHub enforces every required merge gate and all independent reviews pass. If platform rules do not enforce a required project check, monitor it to success before issuing the merge. Pin the verified head when the API supports it, and recheck any changed head before merging. Do not arm auto-merge before independent review is complete.

Merge dependent PRs from the lowest unmerged dependency upward. Confirm each PR targets the intended trunk before landing it. After its parent lands, update the child's base through a supported mechanism and revalidate its patch, reviews, and CI. Preserve reviewed ancestry where possible. Do not force-push shared branches or rewrite unrelated work. Stop and report genuine blockers without weakening safeguards.

Confirm GitHub reports the PR merged; enabling auto-merge or entering a queue is not completion. Fetch and fast-forward the local trunk after landing. Verify its exact commit and final CI status. Record the outcome and any remaining capability gaps. The detailed procedure is in [Engineering workflow](docs/engineering-workflow.md).
