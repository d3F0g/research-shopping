# Product intelligence evaluation run

Goal. Independently measure Fieldnote shopping usefulness with executable, honest evaluations and an integration-ready PR. Do not change product behavior or make paid research calls.

## Workflow

- [x] Read the Principles section of the poteto-mode skill.
- [x] Phase A: Frame.
- [x] Phase B: Design the workflow.
- [ ] Phase C: Run the loop.
- [ ] Phase D: Keep the audit trail.
- [ ] Phase E: Verify and hand back.

## Eval discipline

1. Frame.
2. Set up sanitized environments.
3. Author one organic prompt.
4. Spawn N parallel candidates. skip: the candidate is the actual app, not competing implementation agents.
5. Spawn one blinded judge.
6. Verify the chain from transcripts, not self-report. skip: app requests have no agent skill chain; retain actual HTTP/provider traces instead.
7. Read every candidate output yourself.

## Execution units

1. Inspect normal research contracts and independently sketch two evaluation architectures. Independently design at least 50 versioned multi-turn cases.
2. Implement typed case, observation, assertion and report contracts. Keep scenario expectations outside the app adapter.
3. Capture the unchanged application baseline at bb51c38748b35d838b44109d72ab4dc9a9847d8c. Run offline normal composition against injected provider data. Report blocked dimensions without scores.
4. Add blinded semantic judging, calibration examples and explicit unavailable/uncalibrated statuses. No automatic paid judge or research execution.
5. Add actual browser journeys, desktop/mobile screenshots, traces, CI and comparison reports. Preserve existing checks.
6. Run final independent QA and security interrogation against the exact candidate commit. Fix infrastructure defects and reverify.
7. Maintain the existing verification skill after launching the app, with source and live coverage recorded honestly.
8. Open feat/product-evals PR, targeting the application dependency while PR 38 remains open. Hold merge until the latest application lands and integration is verified.

## Data shape

A versioned Scenario contains organic user turns, provider-input provenance and private expected assertions. An Observation contains actual response bodies, authoritative preferences, tool events and source provenance. A CaseResult pairs observations with deterministic outcomes, nullable semantic scores and explicit execution status. A RunReport pins app and suite revisions, hashes dataset inputs and separates failures, unsupported cases and blocked evidence.

## Throughput checkpoint

One application baseline, at least 50 conversations across 12 dimensions, three layers, one CI workflow, one integration PR. Three child slots. Start with two read-only design perspectives and an independent dataset designer. Consolidate implementation under one code owner. QA/security run independently after the candidate exists. Root owns docs and GitHub. The worktree is /Users/josiahwong/Documents/research-shopping-evals on feat/product-evals. No other worktree or process may be modified.

## Known boundaries

PR 38 remains open and its API can change. Main is 9d2a3c5; normal-application baseline is PR 38 head bb51c38. Application author and evaluation authors remain separate. No genuine Exa records will be fabricated. Human calibration and live usefulness may remain externally blocked. Manual allowance is not authorization for automated evaluation. The shared ledger must not be opened for mutation or reset.

## Role configuration

Configured code/swarm Luna is not exposed by this host. Use inheritance for those roles per CODEX.md. Architecture and judgment use configured gpt-6-astra with supported effort, adjusted to high for routine judgment. Pin actual role assignments and review SHAs in evidence.
