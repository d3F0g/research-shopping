# Development-only Exa research integration

The user requested the canonical build-with-exa skill, the existing root .env key kept private, and a functional project integration. The npx skill output is retained locally at /tmp/research-shopping-exa-skill-output.txt. Supporting references resolve from /var/folders/w2/wt271srd07ndwbnvm1_ty8t40000gn/T/skills-use-VxtExL/build-with-exa. Root read the entire generated instruction output plus search, SDK and prompting references.

## Feature steps

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
   - **Smallest safe decomposition.** If one worker is best, name why.
4. Delegate code-writing to a subagent using your configured feature model (default `gpt-6-luna`) with a specific scope (file paths, named data shape and its organizing structure per **principle-model-the-domain**, a state machine over scattered booleans, a table/registry over branching, a typed model over repeated shape assumptions, chosen before the delegate writes logic, and success criteria). Review its diff yourself. When the implementation admits multiple valid shapes (error handling, abstraction layer, test structure), delegate via the **arena** skill instead so the runners surface the alternatives and the cross-judge guards the pick. Mandatory: no skip-with-reason escape, and Laziness Protocol does not override it (the gain is review separation, not lines saved). You can spawn a subagent even though you are one. "The app is small" and "a subagent cannot spawn one" are both wrong. A subagent forbidden to spawn satisfies this by owning the diff directly with the same review separation. No "standing by" reply that waits on a nested agent. Comments per **Comments**. Surgical edits, re-ground against the source for upstream-derived files. Port shared-primitive improvements to all consumers and verify each. Commit liberally.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass. Flag it.
6. Rebase into small, ordered commits. Stack follow-ups.
   Use the **sequence-verifiable-units** principle skill, building, verifying, and committing each small unit before the next.
7. If the design is contested, `interrogate` before shipping.
8. Run **Opening a PR**.

Code-coupled work (one feature, one migration) goes to a single owner with the checkpoint inline. That owner fans out internally after the blocking phase. Parent-level fan-out is for slices that produce independent artifacts (audits, cross-subsystem investigations, competing experiments). Rewrite the checkpoint at phase boundaries. Spawn a fresh owner rather than chaining interrupts.

## Architecture phases

1. Ground
2. Sketch
3. Agree
4. Implement
5. Scrap

## Arena phases

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Throughput checkpoint

- Blocking first steps. Read canonical Exa skill and actual project boundaries; verify the key exists without disclosing it, and keep it ignored. Choose a typed live-source contract independently of synthetic Claim/Offer schemas. Resolve SDK cancellation against the installed latest source before implementing.
- Independent workstreams. Parallel read-only designs precede a single coupled feature owner. Root owns orchestration/docs/GitHub and controlled live verification. Independent QA and security review the final candidate separately.
- Shared mutable state. The user's original checkout has pre-existing package-lock and untracked skill changes, which stay untouched. Feature work uses feat/exa-web-research in a separate worktree. Root owns docs; the owner owns application/package/tests only. No secret is copied into Git or client code.
- Smallest safe decomposition. One owner integrates server adapter, HTTP contract and official-component UI because their data/lifecycle semantics are coupled. Default offline tests remain deterministic; real Exa verification is a bounded explicit development action.

## Acceptance

Install current exa-js with npm11. Use /search, auto/default mode, contents.highlights:true and objective because search serves the shopping research task. No arbitrary category/domain/count/freshness/summary controls. Display source highlights as untrusted web context, never proof of synthetic price/stock or an altered merchant handoff. No LLM exists; add no fake chat model/system prompt. Document canonical tool/prompt requirements for a future actual LLM integration. Server-only .env loading; no VITE key, GitHub secret upload, credential rotation, production deployment or key output.

Require actual runtime integration, missing-key/failed/timeout/abort behavior, URL/response validation, budget/fixture safety, responsive shadcn/AI Elements citations and disclosures, independent QA/security, passing hosted CI and final-main verification before eligible autonomous merge. Preserve user changes and all existing assertions.

## Model availability

The configured Astra architecture/judgment seat reached quota earlier in this session. Its design seat uses host inheritance as the documented fallback. The other design seat and code owner use configured Luna. Root remains responsible for synthesis, with an independent available cross-judge.
