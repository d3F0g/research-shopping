import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadDataset } from "../dataset";
import { scenarioMaterial } from "../inputs/materials";
import { offlineNetwork } from "../network";
import { caseResult, compareReports, makeReport, summaryMarkdown, validateReport } from "./report";
import type { CaseResult } from "./contracts";

const { values } = parseArgs({ options: { out: { type: "string", default: "artifacts/product-evals/v2-current" }, case: { type: "string" }, "application-commit": { type: "string" }, gate: { type: "string", default: "report" }, baseline: { type: "string" }, candidate: { type: "string" }, compare: { type: "boolean" }, "issue-drafts": { type: "boolean" }, "intent-mode": { type: "string", default: "local-only" } }, strict: true });
if (!["report", "critical", "all"].includes(values.gate!)) throw new Error("Use --gate report, critical or all");
if (values["intent-mode"] !== "local-only") throw new Error("V2 executes actual local operations only; interpretation proposals are unavailable");
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
if (values.compare) {
  if (!values.baseline || !values.candidate) throw new Error("Comparison requires --baseline and --candidate");
  const comparison = compareReports(JSON.parse(await readFile(values.baseline, "utf8")), JSON.parse(await readFile(values.candidate, "utf8")));
  await writeFile(join(output, "comparison.json"), JSON.stringify(comparison, null, 2));
  console.log(JSON.stringify(comparison));
  if (!comparison.compatible || comparison.notComparable.length || comparison.added.length || comparison.removed.length) process.exitCode = 2;
} else {
  const dataset = await loadDataset();
  const selected = values.case ? dataset.scenarios.filter((row) => row.id === values.case) : dataset.scenarios;
  if (!selected.length) throw new Error(`Unknown case ${values.case}`);
  const guard = offlineNetwork();
  const cases: CaseResult[] = [];
  try {
    const { observe } = await import("./adapter");
    for (const scenario of selected) {
      const input = scenarioMaterial(scenario.provider, scenario.id);
      try {
        const observation = await observe({ id: scenario.id, actions: scenario.actions, provider: scenario.provider }, input, guard);
        cases.push(caseResult(scenario, input, observation));
        await writeFile(join(output, `${scenario.id}.trace.json`), JSON.stringify(observation, null, 2));
      } catch (error) { cases.push(caseResult(scenario, input, null, error instanceof Error ? error.message : String(error))); }
    }
  } finally { guard.close(); }
  const report = await makeReport(cases, dataset.scenarios, values["application-commit"]);
  validateReport(report);
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(output, "summary.md"), summaryMarkdown(report));
  if (values["issue-drafts"]) await writeFile(join(output, "issue-drafts.md"), report.cases.filter((row) => row.verdict === "fail").map((row) => [`# ${row.id}`, "", `Application ${report.application.commit}. Frozen dataset ${report.datasetVersion}.`, "", ...row.checks.filter((check) => check.status === "fail").map((check) => `- ${check.critical ? "Critical" : "Major"} ${check.id}. Expected ${JSON.stringify(check.expected)}. Observed ${JSON.stringify(check.observed)}.`), "", `Reproduce with \`${row.reproduction}\`. Raw HTTP and V2 state are in ${row.id}.trace.json.`, ""].join("\n")).join("\n"));
  console.log(JSON.stringify({ artifact: join(output, "report.json"), ...report.summary }));
  if (report.summary.infrastructureErrors) process.exitCode = 2;
  else if (values.gate === "critical" && report.summary.criticalFailures || values.gate === "all" && report.summary.acceptance !== "pass") process.exitCode = 1;
}
