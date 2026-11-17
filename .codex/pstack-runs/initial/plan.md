# Research + Shopping engineering run

Historical run record. The later user-authorized merge policy in AGENTS.md supersedes this record's no-merge boundary. Current shipping work is tracked in .codex/pstack-runs/autonomous-merge/plan.md.

## Exit condition

A clean installation builds and launches a complete request-to-merchant vertical slice. Unit and integration tests and Playwright acceptance scenarios pass. Independent QA and security reviewers verify the final implementation. Architecture, capability gaps, agent configuration, reproducible verification skill, issue backlog, and a tested pull request are delivered. Fixture evidence remains explicitly synthetic. No production deployment, payment, order placement, credential changes, or protected-branch merge.

## Autonomous run steps

1. State the exit condition as a checkable predicate before the first iteration.
2. Pick the wake mechanism from CODEX.md.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help.
4. Address discoveries that support the goal within the authorized task.
5. Checkpoint every iteration via the show-me-your-work skill.
6. Stop when the predicate is met.

## Feature steps

1. `how` over the affected subsystem. Ground is greenfield, with no application to inspect.
2. `architect` for parallel design exploration. Two read-only architecture candidates cover functional pipeline and state-machine designs.
3. Write the throughput checkpoint as four todo items.
4. Delegate code-writing to a subagent using the configured feature model.
5. Verify on the matching surface.
6. Rebase into small, ordered commits. Stack follow-ups.
7. If the design is contested, `interrogate` before shipping.
8. Run Opening a PR.

## Throughput checkpoint

- Blocking first steps. Read the brief, verify the empty checkout, research integrations, compare two designs, and establish a shared type contract before implementation.
- Independent workstreams. Architecture and capabilities research run in parallel. After contract approval, one application owner implements. Verification and security reviews use independent agents.
- Shared mutable state. Root owns this ledger and GitHub tracking. Application owner alone writes implementation in an isolated worktree. Documentation and review artifacts have separate ownership.
- Smallest safe decomposition. A single application owner controls coupled frontend, API, and core types to avoid contract drift. Independent reviewers test the resulting artifact.

## Design rubric

Evaluate candidates on evidence honesty, complete user journey, replaceable integrations, security and failure behavior, and maintainability. Pick one base and graft useful invariants from the other.

## Swarm phases

- Frame. Return architecture candidates, capability gaps, official sources, and acceptance criteria.
- Fan out. Candidate A covers provider pipeline and research integrations. Candidate B covers state machine, UX, personalization, tests, and merchant/spec integrations.
- Aggregate. Root reads both and a separate cross-judge scores them.
- Report. Commit synthesized architecture and gap matrix.

## Runtime and resumption

This active turn uses bounded tool waits. No future monitoring or timed automation is armed. Resume from this directory and live GitHub state. Agent handles do not survive a new conversation.

## Implementation phase throughput checkpoint

- Blocking first steps. Shared schemas and the scaffold build passed at 7fe3284 before code fan-out.
- Independent workstreams. UI, package/config, and browser tests belong to application_owner. Backend, pure core, and unit/API tests belong to shopping_engine in a separate worktree.
- Shared mutable state. Both consume the committed contracts file. Only the integration owner can change it after coordinating a required deviation. Root owns docs, tracker, and trail.
- Smallest safe decomposition. Two writers now have disjoint paths. The application owner merges the tested engine branch before end-to-end verification. Verification skill authoring waits for real controls and harness.
