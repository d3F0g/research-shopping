# Run Fieldnote product evaluations

Use the repository's Node.js 22 and npm 11 environment. Run these commands from the evaluation checkout. All routine commands use fixed synthetic local inputs and block external research traffic. They do not load the private environment or use the persistent research ledger.

Install Chromium before infrastructure tests or browser journeys if it is absent. The integrity tests include a real responsive-layout check.

```sh
npx playwright install chromium
```

## Capture a run

```sh
npm run eval:test
npm run eval:typecheck
npm run eval -- --out artifacts/product-evals/current --issue-drafts
```

Read `summary.md`, `report.json`, the per-case `.trace.json` files and `issue-drafts.md` in the output directory. Each result pins the application and evaluator revisions, data hashes, actual transcript, returned preferences, observed SDK calls and independent assertions. Source and price provenance remain visibly synthetic. Inspect unassessed counts alongside assessed rates.

The default `--gate report` exits successfully when the runner completes, even if product acceptance fails. `--gate critical` exits with code 1 for observed critical failures. `--gate all` requires complete assessed acceptance. Infrastructure errors exit with code 2. CI initially enforces detector sensitivity tests and reports product results. A green reporting job does not approve product release.

To reproduce one case, use its exact identifier.

```sh
npm run eval -- --case FN-CU-001 --out artifacts/product-evals/powerbank
```

For a historical application revision, first integrate that source in your isolated checkout. Pass its full SHA with `--application-commit`. The evaluator rejects a claimed revision whose `src` tree differs from the working application. Preserve the recorded evaluator revision and hashes too.

## Inspect actual browser behavior

```sh
npm run eval:browser -- --out artifacts/product-evals/browser --mode report
npm run verify:offline
```

The browser runner starts owned Vite, Hono and fake-key SDK loopback transport on ephemeral local ports. Read `proof.json`, screenshots, traces and `server.log`. Inspect desktop and mobile images. `--mode strict` fails on assessed product failures. `--mode smoke` drives the smaller normal-app verification subset and fails if it cannot complete.

The project [verification skill](../.agents/skills/verify-research-shopping/SKILL.md) owns app-driving recipes, health checks, evidence and cleanup. Dataset grading and semantic scoring remain separate. Current image support and genuine live research require explicit coverage rather than inferred passes.

## Compare unchanged expectations

```sh
npm run eval:compare -- --baseline artifacts/product-evals/baseline-v1/report.json --candidate artifacts/product-evals/current/report.json --out artifacts/product-evals/comparison
```

The same-contract comparison validates bound contracts, material, checks and summary, and requires matching adapter and grading inputs. Embedded evaluator source is audit data and is never executed. This consistency check does not cryptographically authenticate execution. Never relabel a historical report or regenerate the frozen baseline to obtain compatibility.

Read `comparison.json` for newly passing cases, newly failing cases, unchanged failures and critical regressions. Changed dataset, requirement, grading, adapter or material hashes make cases incompatible. Do not rename or weaken an expectation to claim improvement. A same-application comparison proves comparison mechanics, not product progress.

## Compare the frozen v4 baseline with v5

The frozen v4 report retains schema 2 and assertion contract 2.0.0. Current v5 reports use schema 3 and assertion contract 3.0.0. Use the explicit cross-contract bridge rather than weakening the same-contract comparator.

```sh
npm run eval -- --out artifacts/product-evals/candidate-v5 --application-commit fd9d13793342cdd7e37686b09ae6c9ffd88bb69f --issue-drafts
npm run eval:scorecard -- --baseline artifacts/product-evals/baseline-v1/report.json --candidate artifacts/product-evals/candidate-v5/report.json --out artifacts/product-evals/comparison-v4-v5
```

Both reports must contain all sixty unchanged cases, expectations, actions and matching research material. Each report is validated separately. The scorecard retains original verdicts and distinguishes newly passing, still failing, pass-to-fail regressions, newly observed failures and lost assessment. Read per-case supplied-interpretation limitations as well as aggregate counts.

The v5 lane supplies independently authored synthetic intent proposals through the public interpreter interface. It uses actual application state reduction, Hono requests and Exa SDK loopback transport, with zero OpenAI HTTP requests. Fixed proposals are not genuine model recordings. The v4/v5 comparison therefore describes different interpretation treatments. A newly passing technical assertion cannot establish better live understanding, tool selection, product discovery or useful recommendations. Separate fake-key transport controls exercise the production OpenAI boundary with isolated synthetic receipts.

The original baseline, dataset and milestones stay byte-for-byte unchanged. Keep legacy failures caused by changed product policy, such as proactive no-budget research, in the frozen scorecard and discuss their interpretation separately. Never edit expectations to turn those results green.

## Obtain an independent semantic judgment

```sh
npm run eval:judge -- export --report artifacts/product-evals/current/report.json --out artifacts/product-evals/judge --limit 6
```

Give an evaluator only `packets.json`. Keep `private-manifest.json` and calibration reference scores away from the judge. The packet includes the rubric, anonymized observed conversations and supporting passages. Do not use the product implementation author as its judge. Record the reviewer identity and how independence was established.

Return all eight dimensions for every exported packet. Use explicit not-observable status with a null score when the packet cannot support a judgment. Import the independent output.

```sh
npm run eval:judge -- import --packets artifacts/product-evals/judge/packets.json --manifest artifacts/product-evals/judge/private-manifest.json --judgments artifacts/product-evals/judge/independent-judgments.json --out artifacts/product-evals/judge/imported
```

Read `semantic-report.json` for scores, rationales, uncertainty and calibration disagreements. The four author references are pending human review. Scores remain reporting-only. A small demonstration sample is not an estimate of all sixty cases or current market usefulness.

## Keep live evaluation blocked until authorized

`npm run eval:live` refuses dispatch. An authorization artifact can exercise bounded authorization preflight, but automated integration with the stopped persistent ledger remains unimplemented and unverified. No automated paid request is enabled. The existing manual-testing continuation cannot authorize this mode. Fresh explicit automated authorization and independently verified accounting are prerequisites for future live execution.

## Track an observed defect

Search existing GitHub issues before using an issue draft. Include the scenario ID, exact application and suite revision, expected and observed behavior, command and evidence. Keep product fixes with their application owner. Current examples link to issues 39, 43, 44 and 46. Keep original failed traces after a fix, then reverify against the updated application.
