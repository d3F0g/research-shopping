# Mandatory frontend standard and CI activation

Historical run record. The later user-authorized merge policy in AGENTS.md supersedes this record's no-merge boundary. Current shipping work is tracked in .codex/pstack-runs/autonomous-merge/plan.md.

## Exit condition

PR20 contains active pull-request CI, official shadcn/ui primitives and appropriate official AI Elements, a documented frontend standard, concise product comparisons and safe citations, responsive accessible interactions, and independent desktop/mobile Playwright proof. All final-head hosted checks pass. No merge or deployment.

## CI drive steps

1. Declare the mode and resolve the forge before any poll. CI drive uses GitHub CLI, scoped explicitly to PR20 as requested.
2. Work the merge frontier and nothing above it. The user's explicit PR20 request overrides frontier routing; PR6 stays unmerged.
3. One babysitter per stack. Root alone monitors CI.
4. Never mutate stack topology. No retarget, rebase, force-push, or merge.
5. Order is conflicts, then review threads, then CI.
6. Trust the active forge's verdict, not a green check list. Inspect actual workflow events, steps, artifacts, and final head checks.
7. Classify CI before any retrigger. Investigate failures and permit one infrastructure retry only with evidence.
8. Review bots are triaged skeptically, always.
9. Stop at the human's line. PR remains unmerged.

## Throughput checkpoint

- Blocking first steps. Inspect live PR20, current source, official shadcn/ui and AI Elements documentation, and establish component/data boundaries.
- Independent workstreams. A mechanical CI owner activates only the reviewed workflow. A separate read-only architect audits the frontend and official patterns. Root owns AGENTS, docs, tracker, and CI monitoring.
- Shared mutable state. UI implementation owns frontend, its dependency inputs and UI tests in an isolated worktree. Any backend activity transport change receives a separate owner after a contract is agreed.
- Smallest safe decomposition. One frontend owner integrates the component system to avoid package/registry drift. Independent visual QA drives the completed app, then root verifies hosted CI at the final head.

## Acceptance

Official component provenance is recorded. Buttons, inputs, selections, dialogs, cards, comparison tables, and disclosures use shadcn/ui. Chat, prompt, citations, and tool presentations use official AI Elements patterns. No simulated model streaming or fabricated tool results. Hard constraints, source trust, safe handoffs, fixture disclosure, reset, adaptation, and stale-response protections survive. Screenshots cover desktop and mobile, including keyboard focus and overlays. Existing assertions are preserved or adapted to actual component semantics.
