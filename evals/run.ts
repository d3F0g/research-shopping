import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
import { hash } from "./hash";
import { offlineNetwork } from "./network";
import { loadDataset } from "./dataset";
import { grade } from "./assertions";
import { scenarioMaterial } from "./inputs/materials";
import { makeReport, summaryMarkdown, compareReports } from "./report";
import type { CaseResult, RunReport } from "./contracts";

const { values } = parseArgs({ options: { out: { type: "string", default: "artifacts/product-evals/current" }, case: { type: "string" }, "application-commit": { type: "string" }, gate: { type: "string", default: "report" }, baseline: { type: "string" }, candidate: { type: "string" }, compare: { type: "boolean" }, "issue-drafts": { type: "boolean" } }, strict: true });
if (!["report", "critical", "all"].includes(values.gate!)) throw new Error("Use --gate report, critical or all");
const output = resolve(values.out!);
await mkdir(output, { recursive: true });
if (values.compare) {
  if (!values.baseline || !values.candidate) throw new Error("Comparison requires --baseline and --candidate report paths");
  const baseline = JSON.parse(await readFile(values.baseline, "utf8")) as RunReport;
  const candidate = JSON.parse(await readFile(values.candidate, "utf8")) as RunReport;
  if (baseline.schemaVersion !== 1 || candidate.schemaVersion !== 1) throw new Error("Unsupported report schema");
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
      const common = { id: scenario.id, category: scenario.category, scenarioHash: hash({ id: scenario.id, revision: scenario.revision, actions: scenario.actions, expectedBehavior: scenario.expectedBehavior, provider: scenario.provider }), expectationHash: hash(scenario.milestones), materialHash: input.sha256, expectedBehavior: scenario.expectedBehavior, semantic: { status: "not-run" as const, reason: "Independent judge unavailable in deterministic execution. Human calibration pending.", scores: null }, reproduction: `npm run eval -- --case ${scenario.id} --out artifacts/product-evals/reproduce-${scenario.id}` };
      try {
        const observation = await observe({ id: scenario.id, actions: scenario.actions, provider: scenario.provider }, input, guard);
        const checks = grade(scenario, observation);
        if (input.provenance.some((value) => value.startsWith("Input suitability gap"))) checks.push({ id: "provider-material-suitability", turn: null, status: "blocked", critical: false, expected: "Matching independently fixed product evidence", observed: "Current input lacks a matching product profile; relevance and recommendation usefulness cannot be assessed", evidence: [] });
        const verdict = checks.some((check) => check.status === "fail") ? "fail" as const : checks.some((check) => check.status === "blocked") ? "blocked" as const : checks.some((check) => check.status === "unsupported") ? "unsupported" as const : "pass" as const;
        cases.push({ ...common, execution: "executed", verdict, observation, checks });
        await writeFile(join(output, `${scenario.id}.trace.json`), JSON.stringify(observation, null, 2));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cases.push({ ...common, execution: "infrastructure-error", verdict: "blocked", observation: null, checks: [], error: message });
      }
    }
  } finally { guard.close(); }
  const report = await makeReport(cases, dataset.hash, values["application-commit"]);
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
