# Research + Shopping engineering

The product ends at a recommendation and merchant product link. Payments, order placement, credential changes, production deployment, destructive operations, and protected-branch merges require the user's authorization where applicable.

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

GitHub Issues are the durable defect tracker. Resolve a defect only after reproducing, fixing, and reverifying it. Opening a PR does not authorize merging it.

## Mandatory frontend architecture

All frontend development uses official [shadcn/ui](https://ui.shadcn.com/docs) and the appropriate official [AI Elements](https://ui.shadcn.com/docs/ai-elements). This is an architectural requirement. Use the official registry/CLI and documented patterns, with provenance recorded in the repository. Do not replace the primitives with handmade lookalikes.

Compose product cards, comparisons, preference controls, dialogs, and progressive disclosure from shadcn/ui. Use official AI Elements for conversational messages, prompt input, citations, and tool activity. Streaming displays must reflect actual transport events; do not simulate streaming, reasoning, or tool progress. Source references remain safe manufacturer links for synthetic fixture claims.

Keep design tokens centralized, with consistent typography, spacing, contrast, focus indicators, and responsive layouts. Prefer concise answers and compact comparisons with expandable evidence. All essential controls and disclosures stay readable and keyboard-operable on desktop and mobile.

Delegate implementation and independent visual QA through pstack. Verify real browser journeys and desktop/mobile screenshots after frontend changes. Preserve behavioral/security assertions when changing selectors for official component semantics. Update PR20 rather than opening a duplicate feature PR. Do not merge until mandatory frontend acceptance and independent QA pass.
