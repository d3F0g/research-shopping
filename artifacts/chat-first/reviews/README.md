# Independent review evidence

These are bounded reports and raw logs from the independent pstack reviewers. Reports name the commits they actually reviewed. The application source and tests did not change after db4d800. Later metadata bindings compare executable files before applying those source verdicts.

- [Runtime and visual source review](qa/source-report.md), [integration binding](qa/integration-binding.md) and [publication binding](qa/publication-binding.md).
- [Unit/API log](qa/unit-api.log), [build/typecheck log](qa/build-typecheck.log) and [43-browser log](qa/e2e.log).
- [Manual outcomes](qa/final-manual-results.json), [recovery outcomes](qa/final-recovery-results.json), [layout metrics](qa/layout-results.json) and [layout trace](qa/layout-trace.zip).
- [Security review](security/security-review.md), [167-test log](security/unit-api.txt), [20-browser security log](security/browser-security.txt) and [extra-probe outcomes](security/extra-probes.json).
- [Current audit](security/audit-current.json) and [base audit](security/audit-base.json). Both contain the same inherited tooling findings. This is not a clean-audit claim.
- [Cross-model decision-trail review](trail-review.md).

The full temporary review directories retain additional scripts, traces and screenshots on the development host. This committed subset preserves the verdicts, package checks, hostile-input outcomes and corrected mobile layout. Earlier failed observation probes are explained in the source reports rather than represented as application defects.

The trail review asked for durable raw evidence; this directory addresses that item. Its model-diversity note remains valid. Candidate A and its design judge both used gpt-6-astra, while B used host inheritance. Independent-agent design scores do not prove model diversity. Actual runtime and security checks remain separately documented.

The user must review the screenshot gallery and confirm the design direction before merge. No reviewer verdict or green CI check replaces that product approval.
