# V2 continuous verification

The [application workflow](../.github/workflows/ci.yml) runs on push and pull request. It uses Node 22, npm 11, read-only repository permissions and an owned PostgreSQL 17 fixture service. Checks include typecheck, unit/API tests, build, actual PostgreSQL ownership tests, normal API/database restart, process-crash recovery, account browser journeys, normal Chromium chat journeys. The project verification skill is also run locally and by independent QA.

The [product evaluation workflow](../.github/workflows/product-evals.yml) verifies preserved Git blobs, evaluation types and integrity controls, then runs all sixty unchanged scenarios with the critical gate, the explicit baseline bridge and strict browser journeys. All provider traffic is synthetic and loopback. No private environment or billable key is used.

The account restart helper may restart only the exact CI-owned PostgreSQL service container with the corresponding fixture DSN. Local runs create their own temporary clusters. No production database or existing user service belongs in this workflow.

Read actual workflow jobs and steps on the current PR head before reporting success. Missing checks and reporting-only exit modes cannot establish acceptance. Artifacts upload after failures. Historical CI runs and evidence under `artifacts/ci/` describe their earlier candidates and do not verify V2.

The current V2 PR must remain unmerged for the user's appearance and evaluation review, even after configured checks pass.
