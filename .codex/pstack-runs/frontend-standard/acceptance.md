# Frontend acceptance

Historical run record. The later user-authorized merge policy in AGENTS.md supersedes this record's no-merge boundary. Current shipping work is tracked in .codex/pstack-runs/autonomous-merge/plan.md.

Application candidate `a3163a20a5398b9f3c3064b7cb87bf4094de6f8d` passed independent final QA. The UI owner implemented official shadcn/ui and current AI Elements patterns; a separate metadata owner preserved the core result union and exposed bounded actual outcomes. Independent Sol review replaced unavailable Astra review after quota exhaustion; no acceptance requirement was dropped.

- Official registry manifest: artifacts/frontend-standard/provenance/registry-manifest.json; all21 hashes checked,5 independently refreshed.
- Broad visual/cleanup review: artifacts/frontend-standard/independent/review.md at804adae.
- Final source delta: artifacts/frontend-standard/final-delta/review.md at a3163a2;110 unit/API,20 browser,build/typecheck,audits0,1440px/390px keyboard and Sheet journeys.
- Integrated helper: artifacts/frontend-standard/integrated-smoke/proof.json; passed with owned cleanup and explicit worktree status.
- The minimatch override affects only the CLI chain; actual CLI commands and application bundle comparison pass.
- Portability omission reproduced before fix; real editor now exposes and removes it without relaxing hard constraints.

The active workflow runs automatically on push and pull_request. Root alone publishes to the existing PR20 and inspects final-head CI jobs and uploaded evidence. No merge, deployment, credential changes, or stack retargeting. Fixture/live-provider limits remain in docs/verification.md.

Hosted frontend publication `cba0d46` passed automatic PR run44115694396 and push run44115677362, each110 unit/API plus20 browser tests. Evidence upload is confirmed. Metadata is retained under artifacts/ci/frontend-*.json. Later documentation-only heads still receive the automatic gate; latest PR20 checks are authoritative.
