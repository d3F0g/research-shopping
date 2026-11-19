import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { offlineNetwork } from "./network";
import { loadDataset } from "./dataset";
import { scenarioMaterial } from "./inputs/materials";
import { makeReport, summaryMarkdown, compareReports, caseResult, validateReport } from "./report";
import type { CaseResult, RunReport } from "./contracts";

const { values } = parseArgs({ options: { out: { type: "string", default: "artifacts/product-evals/current" }, case: { type: "string" }, "application-commit": { type: "string" }, gate: { type: "string", default: "report" }, baseline: { type: "string" }, candidate: { type: "string" }, compare: { type: "boolean" }, "issue-drafts": { type: "boolean" } }, strict: true });
if (!["report", "critical", "all"].includes(values.gate!)) throw new Error("Use --gate report, critical or all");
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
if (values.compare) {
  if (!values.baseline || !values.candidate) throw new Error("Comparison requires --baseline and --candidate report paths");
  const baseline = JSON.parse(await readFile(values.baseline, "utf8")) as RunReport;
  const candidate = JSON.parse(await readFile(values.candidate, "utf8")) as RunReport;
  const comparison = compareReports(baseline, candidate);
  await writeFile(join(output, "comparison.json"), JSON.stringify(comparison, null, 2));
  console.log(JSON.stringify(comparison));
  if (!comparison.compatible || comparison.notComparable.length || comparison.added.length || comparison.removed.length) process.exitCode = 2;
} else {
  const dataset = await loadDataset();
  const selected = values.case ? dataset.scenarios.filter((scenario) => scenario.id === values.case) : dataset.scenarios;
  if (!selected.length) throw new Error(`Unknown scenario ${values.case}`);
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cases.push(caseResult(scenario, input, null, message));
      }
    }
  } finally { guard.close(); }
  const report = await makeReport(cases, dataset.scenarios, values["application-commit"]);
  validateReport(report);
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  await writeFile(join(output, "summary.md"), summaryMarkdown(report));
  if (values["issue-drafts"]) {
    const drafts = report.cases.filter((item) => item.verdict === "fail").map((item) => `# ${item.id} product evaluation failure\n\nApplication ${report.application.commit}. Dataset ${report.datasetVersion}. Category ${item.category}.\n\nExpected\n\n${item.expectedBehavior.map((value) => `- ${value}`).join("\n")}\n\nObserved\n\n${item.checks.filter((check) => check.status === "fail").map((check) => `- ${check.critical ? "Critical" : "Major"} ${check.id}. Expected ${JSON.stringify(check.expected)}. Observed ${JSON.stringify(check.observed)}.`).join("\n")}\n\nReproduce with \`${item.reproduction}\`. Evidence is ${item.id}.trace.json in this report directory. Search existing issues before filing. No GitHub mutation or paid request was performed.\n`);
    await writeFile(join(output, "issue-drafts.md"), drafts.join("\n---\n\n"));
  }
  console.log(JSON.stringify({ artifact: join(output, "report.json"), ...report.summary }));
  if (report.summary.infrastructureErrors) process.exitCode = 2;
  else if (values.gate === "critical" && report.summary.criticalFailures || values.gate === "all" && report.summary.acceptance !== "pass") process.exitCode = 1;
}
