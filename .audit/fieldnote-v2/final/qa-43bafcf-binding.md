# Independent metadata binding. PASS.

The goal is to preserve the independently verified Fieldnote behavior while making Playwright's pull-request metadata collection bounded. Reviewed final head is `43bafcf9e3d113a2a0ccc01c9baf7377def6d3ef`. Prior independently runtime-reviewed head is `e0b7317f4bd00ce49141229943279e0da357cdbc`, against product base `9d2a3c5e336a6652ec6b02e0c3deff6617fb7d11`.

**PASS for this metadata-only delta and binding.** The only non-evidence change is one line in `playwright.config.ts`, `captureGitInfo: { commit: true, diff: false }`. No test assertion, selector, skip, timeout, retry, worker, browser, provider or application configuration was changed. The second commit adds proof only. The earlier independent functional/visual verdict in `review-e0b7317.md` carries to this exact final application tree, with every limitation retained.

## Exact identity checks

I read the complete scoped Git delta. Git object identities match between the prior independent head, the final head and the local metadata runtime evidence commit `91c92b2750cbbdc4bdaaa197ddd59bb0d1a8660c`.

| Path | Shared tree or blob |
| --- | --- |
| `src` | `e1d7c10c59e1251216e3ba99c0a55c5157109fd9` |
| `tests` | `34fcff169cc5c133a48f7c6a8a011cf07633a683` |
| `evals` | `dce0f3ae33d2a1abcf5d6f98c9e7a71c724686e5` |
| `.agents` | `2ff71d237e681ab17a0cda8caa25ebd1ea3108f7` |
| `package.json` | `ceacd3a814a308492036dd00147892a3e0a39195` |
| `package-lock.json` | `3dffbdc5b18c3ec533264aa6a293d0a3cda9d524` |

Final and metadata-runtime `playwright.config.ts` both have blob `90c22216c9c4afc794eb0c820e517afa289a5be7`. The prior config blob is `d792efe09abb2727b09f6f4c6e574151dc3e6c9f`. The complete change is one insertion, zero deletions. Workflow files are unchanged from the independently reviewed head.

Independent machine-readable assertions are in `artifacts/fieldnote-v2/qa/metadata-43bafcf/binding.json` in this QA worktree. I did not check out or modify application code to produce this binding.

## Evidence inspected

I read `artifacts/fieldnote-v2/ci-metadata/proof.json`, `playwright-report.json`, `browser-run.txt`, `typecheck.txt`, `hosted-failure.txt`, `diff-size.json`, `notes.txt`, the installed-source excerpts, and both reproduction scripts in `/Users/josiahwong/Documents/research-shopping-v2`.

The supplied hosted log records `RangeError: Invalid string length` in Playwright's stdout concatenation before browser launch. The recorded bounded measurement reports a 778,617,084-byte PR-base patch, with separately decoded chunk characters exceeding the recorded V8 maximum string length. I inspected the counter implementation; it counts and hashes chunks without allocating the complete patch string. I did not rerun that large measurement and do not present it as a fresh independent measurement.

The preserved installed Playwright 1.65.1 primary source shows CI enables optional diff capture by default, `gitDiff` collects `git diff <PR base> HEAD`, and truncation occurs only after `spawnAsync` has collected stdout into a string. The supported independent commit/diff flags prevent that optional collection while preserving commit and PR metadata. This matches the one-line correction and does not bypass behavioral verification.

I independently parsed and asserted the actual local PR-like runtime report. All **8 expected browser tests passed**, with **zero skipped, unexpected, flaky, retried or errored results**. Typecheck and browser exits are 0. The report retains the exact run commit and intended PR base. `metadata.gitCommit` is present and `metadata.gitDiff` is absent. The test names cover all three viewport journeys, preference editing, active-research lifecycle and held-evidence behavior. The runtime proof records preserved historical artifacts and owned-port cleanup.

The runtime evidence was produced at `91c92b2`, whose application, tests, dependencies and Playwright config exactly match final `43bafcf`. This is an explicit blob-bound reuse of recorded runtime evidence, not a claim that I reran the suite at the final metadata commit. No heavy unaffected suite was rerun for this narrow review.

## Commands used

```sh
git diff --name-status e0b7317 43bafcf
git diff e0b7317 43bafcf -- playwright.config.ts
git rev-parse e0b7317:src 43bafcf:src 91c92b2:src
git rev-parse e0b7317:tests 43bafcf:tests 91c92b2:tests
git rev-parse 91c92b2:playwright.config.ts 43bafcf:playwright.config.ts
git diff --name-only 91c92b2 43bafcf -- src tests evals .agents package.json package-lock.json playwright.config.ts .github
git diff --name-only 5cfe620 43bafcf -- . ':!artifacts/fieldnote-v2/ci-metadata/**'
```

The additional local Node assertion read the preserved runtime JSON, required all eight result objects to pass with retry 0 and no errors, checked exact metadata SHA/base and absence of gitDiff, and asserted the tree/blob identities above.

## Scope limits

This local macOS PR-like run is not hosted Linux CI success. Its synthetic `GITHUB_RUN_ID=0` remains explicitly synthetic. Root must inspect the actual final PR checks. The prior independent QA limits still apply, including the inconclusive 60-case result of 11 passed, 48 blocked and one unsupported; reporting-only semantic calibration; and unestablished genuine Exa usefulness, current merchant information and authorization. This metadata change does not resolve those external or evaluative limits.

No application/test/eval/skill edits, private environment access, real provider call, ledger or database access, production operation, GitHub mutation, push or merge occurred. Prove It Works led to examining actual runtime result objects, and Explain the Number kept the recorded patch measurement distinct from my independent identity and report assertions.
