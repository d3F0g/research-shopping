# Activate the proposed verification workflow

GitHub rejected publication of `.github/workflows/ci.yml` because the existing OAuth credential lacks `workflow` scope. The tested application PR therefore contains the same definition as [proposed-ci.yml](proposed-ci.yml), where it is inactive. No credential, permission, or global Git setting was changed.

After the user approves suitable workflow-capable access, review the definition and copy it to `.github/workflows/ci.yml`. The workflow installs dependencies with npm11, runs typecheck, unit/API tests, build, Chromium browser tests, and uploads browser artifacts. Observe a successful actual run before claiming GitHub CI verification.

[Issue19](https://github.com/d3F0g/research-shopping/issues/19) tracks activation. Local and independent checks remain reproducible through [verification.md](verification.md) and the project verification skill.
