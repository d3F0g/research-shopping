# GitHub Actions verification

The active workflow is [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). It triggers on both `push` and `pull_request`, including updates to application PR20. Its `verify` job uses read-only repository access, Node22, and npm11.

The job installs dependencies from the lockfile, runs TypeScript checking, unit/API tests, the production build, Chromium installation, and Playwright journeys. Browser artifacts upload even after a failure. Actual run results and event metadata must be inspected before claiming success.

The initial OAuth credential lacked workflow scope and rejected activation. The user subsequently updated permission and authorized retrying publication. No credential or global Git configuration is changed by this task. [Issue19](https://github.com/d3F0g/research-shopping/issues/19) tracks successful hosted activation.

[Application PR20](https://github.com/d3F0g/research-shopping/pull/20) remains unmerged while the mandatory shadcn/ui and AI Elements refactor and independent visual QA are completed.
