# Frozen initial application baseline

The initial normal application is bb51c38748b35d838b44109d72ab4dc9a9847d8c. The evaluator code is c2d53075cf841e6e1c0fc0d3dfe0a45d60619729. This is report schema 2, assertion contract 2.0.0 and dataset 1.0.0. It is not a measurement of the newer unmerged v5 implementation.

The root rerun executed sixty conversations and 140 turns with zero infrastructure errors. Thirty-four cases failed deterministic assertions, twenty-five remain blocked and one is unsupported. Thirty-seven critical assertion failures occur in twenty-five scenarios. No complete shopping-success or live-usefulness score is established.

`report.json` preserves complete case contracts, observations, tool events, material provenance and recomputed grading. It is compact JSON with no data removed. `summary.md` contains category denominators and failures. `browser/` preserves the actual normal browser run with all layout checks passing and the known currency and held-comparison product failures. `smoke/` preserves the passing repaired application-driving helper. Both browser runs use fixed synthetic fake-key loopback research and confirm owned cleanup.

The local full-run directory retains per-case trace files and issue drafts. The machine report includes their complete observations. Routine CI regenerates and uploads those artifacts. All inputs remain visibly synthetic; no paid research, private ledger or credential was used.

Independent final QA and security verdicts are recorded in PR 47 for their exact reviewed head. PR 47 remains held for latest-application integration after PR 38 stabilizes and lands. Human judge calibration and genuine current-contract research replay remain separate prerequisites. See the evaluation guide and upstream integration note.
