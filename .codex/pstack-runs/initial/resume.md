# Resume engineering work

The original fixture-backed milestone was implemented and independently verified. Its historical proof is retained under artifacts/security-review/. The user then required an official shadcn/ui and AI Elements frontend migration and retry of GitHub CI publication. Continue from ../frontend-standard/plan.md and ../frontend-standard/architecture.md for the current acceptance scope.

Current application PR20 is https://github.com/d3F0g/research-shopping/pull/20 on feat/research-shopping-ready, stacked on architecture PR6. Both remain unmerged. The active workflow .github/workflows/ci.yml passed automatic pull_request and push runs on5b3aaa5. Issue19 is closed. No credentials, global Git settings, merge, or deployment were changed.

The integrated frontend application candidate is `a3163a2`. It uses official Base UI Nova primitives and AI Elements patterns, with actual recorded provider metadata, a scoped CLI dependency security patch, and visible/editable inferred Portability. Independent Sol review passed desktop/mobile exploration and110 unit/API plus20 browser journeys, build/typecheck and zero-vulnerability audits. See docs/frontend-standard.md and artifacts/frontend-standard/ for exact-commit proof. Root's original-checkout smoke also passed with cleanup. Final publication uses the same PR20 and requires automatic CI on its latest head.

Synthetic SG/SGD data, bounded parsing, tab-local state, and the historical live-provider HTTP429 remain limitations. The project verification skill is .agents/skills/verify-research-shopping/SKILL.md. Test servers must be cleaned by owned process identity. No future monitoring or timed wake is armed.
