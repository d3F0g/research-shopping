# Enable the authorized manual research allowance

The user explicitly approved bounded manual testing on 19 November 2026 in Asia/Singapore. The approved amount is US$0.50 of additional reserved usage while retaining the uncertain charge and every existing record. This overrides the earlier reconciliation-only stop for this specific bounded manual continuation. It does not reconcile the unknown charge, authorize automated paid tests, replenish earlier proof allowances, or satisfy live product acceptance.

## Workflow

1. how over the affected subsystem.
2. architect for parallel design exploration.
3. Write the throughput checkpoint.
4. Delegate code-writing to an isolated owner and review the diff.
5. Verify on the matching surface.
6. Integrate small ordered commits.
7. If the design is contested, interrogate before shipping.
8. Update the existing PR.

## Grounding and design decision

The quota module owns the filesystem lock, persistent reservation-before-dispatch and settlement. Normal composition is development-only. Default admission refuses the stopped ledger or any uncertainty. The current ledger has eight attempts, seven settled costs totaling US$0.045, and one unknown charge retaining US$0.05 reserved. Its eight conservative reservations total US$0.40, below the existing US$2 global allowance. Provider balance remains unknown.

Two independent designs were considered. An embedded v2 ledger grant keeps atomic ownership but requires a ledger migration and changes its bytes during activation. A separate private grant preserves the exact original ledger and leaves the existing v1 record shape unchanged. Select the separate grant. All parsing, eligibility, locking and accounting remain owned by the quota module. Keep a small private operator CLI, not a browser administration API.

The grant binds the canonical ledger path, complete baseline attempt-prefix hash and count, and exact baseline null-cost uncertain IDs. It records approval provenance and the reviewed commit. Its maximum ceilings are ten additional attempts and US$0.50 of additional conservative reservations. Consumption derives from the existing ledger suffix, never a resettable grant counter. Default behavior remains stopped without the explicit development-server grant path. A new uncertain or excessive-cost attempt blocks further admission. Existing duplicate, one-pending, forty-attempt and US$2 protections remain independent.

The ledger's stopped flag and all existing attempts remain intact. Grant creation must not reserve an attempt or construct a provider. Creation is exclusive/idempotent and cannot silently overwrite or renew the allowance. A configured missing, corrupt or mismatched grant fails closed. Prefix edits, reordering or truncation deny admission. Local files cannot prevent a privileged operator from rolling back both snapshots; do not claim that boundary. This is an operational manual-testing allowance, not authentication of a human caller.

## Throughput checkpoint

- Blocking first steps. Record the user's approval and select the grant shape before code. Do not activate before exact-head independent QA/security and CI pass.
- Independent workstreams. One owner implements quota, composition, operator CLI and tests in an isolated worktree. Root owns policy/docs, integration, GitHub and actual local activation. Independent reviewers own their checks and evidence.
- Shared mutable state. Retain one original ledger across live worktrees. Quota owns its lock and derives all admission under that lock. Workers never read or mutate the real ledger, environment or credentials. Root alone publishes the private grant.
- Smallest safe decomposition. One implementation owner keeps grant parsing, creation, inspection and accounting consistent. The CLI imports quota only. No new paid provider, credential, HTTP grant endpoint, production integration or frontend redesign is needed.

## Verification and activation

Use local substitutes for automated checks, including meaningful grant exhaustion across restarts, no refund, original-record preservation, missing/corrupt/wrong grant, global caps, pending/concurrent requests, new uncertainty, revocation, cancellation and zero-write inspection. Verify actual HTTP/browser composition with fake-key loopback where appropriate.

Root will first deliver the reviewed source to the original preview without discarding user changes. Then, with the owned server quiescent, publish the grant through the quota-owned operator procedure against an expected original ledger hash. Add only a nonsecret grant-path setting to the existing ignored development environment, preserving credentials. Inspect actual eligibility through the same quota policy without reserving or dispatching. Require the original ledger hash and all eight records to remain unchanged. Start the exact reviewed app and leave the full allowance for the user's manual submissions.

Update AGENTS.md, engineering workflow, Exa usage documentation, PR #38 and Issue #42 to distinguish this authorized manual continuation from billing reconciliation. Main stays unchanged and PR #38 stays unmerged until genuine live product acceptance is independently established. No production deployment or automatic paid demonstration is authorized here.
