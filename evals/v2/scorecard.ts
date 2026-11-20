import { loadDataset } from "../dataset";
import { currentScenarioMaterial } from "./materials";
import { hash } from "../hash";
import { validateReport, type AnyReport } from "./report";
import type { RunReport } from "./contracts";

export async function crossContractScorecard(baseline: AnyReport, candidate: RunReport) {
  validateReport(baseline); validateReport(candidate);
  if (![2, 3, 4].includes(baseline.schemaVersion) || candidate.schemaVersion !== 5) throw new Error("V2 bridge requires an explicit historical report and the V2 report contract");
  const dataset = await loadDataset();
  const canonical = dataset.scenarios;
  if (dataset.originalSha256 !== "c452827b9aa87bc0b47c3e9a4cc6427a42bbf0303539bc2c09a2093ed754cb8f" || canonical.length !== 60 || hash(canonical) !== hash(baseline.datasetContracts) || hash(canonical) !== hash(candidate.datasetContracts)) throw new Error("V2 bridge requires the unchanged sixty original scenario contracts");
  const ids = canonical.map((row) => row.id).sort();
  for (const report of [baseline, candidate]) if (hash(report.cases.map((row) => row.id).sort()) !== hash(ids)) throw new Error("V2 bridge requires complete unchanged scenario coverage");
  const rows = canonical.map((contract) => {
    const before = baseline.cases.find((row) => row.id === contract.id)!;
    const after = candidate.cases.find((row) => row.id === contract.id)!;
    const material = currentScenarioMaterial(contract.provider, contract.id);
    if (after.materialHash !== hash(material) || hash(after.material) !== hash(material)) throw new Error(`Changed V2 research material for ${contract.id}`);
    if (before.scenarioHash !== after.scenarioHash || before.expectationHash !== after.expectationHash) throw new Error(`Changed public actions or expectations for ${contract.id}`);
    const sameMaterial = before.materialHash === after.materialHash;
    const requirements = contract.milestones.flatMap((milestone) => milestone.requirements.map((requirement, index) => {
      const id = `${requirement.kind}:${milestone.after}:${index}`;
      return { id, turn: milestone.after, requirementHash: hash(requirement), before: before.checks.find((check) => check.id === id && check.turn === milestone.after)?.status ?? "not-observed", after: after.checks.find((check) => check.id === id && check.turn === milestone.after)?.status ?? "not-observed" };
    }));
    return { id: contract.id, category: contract.category, scenarioHash: after.scenarioHash, expectationHash: after.expectationHash, actionsHash: hash(contract.actions), material: { before: before.materialHash, after: after.materialHash, equal: sameMaterial }, treatment: { before: "interpretation" in baseline.configuration ? baseline.configuration.interpretation : "Historical parser with no recorded interpretation treatment", after: candidate.configuration.interpretation, interpreterSupplied: false }, strictVerdicts: { before: before.verdict, after: after.verdict }, sharedNormativeRequirements: requirements, unassessed: { before: before.checks.filter((check) => ["blocked", "unsupported"].includes(check.status)), after: after.checks.filter((check) => ["blocked", "unsupported"].includes(check.status)) }, semantic: { before: before.semantic, after: after.semantic }, comparableNormativeInputs: sameMaterial };
  });
  const paired = rows.filter((row) => row.comparableNormativeInputs).flatMap((row) => row.sharedNormativeRequirements.map((item) => ({ scenarioId: row.id, ...item })));
  const assessed = (status: string) => status === "pass" || status === "fail";
  const requirementTransitions = {
    newlyPassing: paired.filter((item) => item.before === "fail" && item.after === "pass"),
    regressions: paired.filter((item) => item.before === "pass" && item.after === "fail"),
    stillFailing: paired.filter((item) => item.before === "fail" && item.after === "fail"),
    newlyAssessedPasses: paired.filter((item) => !assessed(item.before) && item.after === "pass"),
    newlyObservedFailures: paired.filter((item) => !assessed(item.before) && item.after === "fail"),
    lostAssessment: paired.filter((item) => assessed(item.before) && !assessed(item.after)),
    failedToUnassessed: paired.filter((item) => item.before === "fail" && !assessed(item.after)),
  };
  const jointlyAssessed = paired.filter((item) => assessed(item.before) && assessed(item.after));
  const pairedAssessed = { denominator: jointlyAssessed.length, beforePassed: jointlyAssessed.filter((item) => item.before === "pass").length, afterPassed: jointlyAssessed.filter((item) => item.after === "pass").length, label: "Unchanged normative requirements assessed in both distinct application contracts. Descriptive only." };
  const binding = (report: AnyReport) => ({ digest: hash(report), schemaVersion: report.schemaVersion, adapterVersion: report.adapterVersion, assertionVersion: report.assertionVersion, implementationHashes: report.implementationHashes, application: report.application, configuration: report.configuration, summary: report.summary });
  return { schemaVersion: 1, bridge: "fieldnote-historical-v2-descriptive-1.0.0", datasetHash: dataset.hash, datasetBytesHash: dataset.originalSha256, baseline: binding(baseline), candidate: binding(candidate), rows, requirementTransitions, pairedAssessed, unchangedInputs: rows.filter((row) => row.comparableNormativeInputs).length, differentHistoricalMaterial: rows.filter((row) => !row.comparableNormativeInputs).map((row) => row.id), interpretation: "Descriptive comparison across distinct application and evaluator contracts. No causal NLU, model-quality, semantic usefulness or live discovery claim is supported. No interpretation proposals are supplied to V2.", gradingChanges: ["V2 full-intent assertion binds the actual authoritative V2 intent, not a renamed historical projection.", "V2 eligibility derives budget fit from supported exact-variant prices, explicit currency, conditions and both optional numeric bounds. The historical independent provider budget assessment is not invented.", "All original milestone expectations and remaining frozen assertions execute unchanged. Missing accepted requirements and unsupported behavior retain their actual failures."], browser: { status: "separate-unassessed", reason: "The deterministic report cannot establish UI quality. Inspect the independent browser proof." }, semantic: { status: "not-run", reason: "Packet-bound independent judgments and human calibration remain separate." }, acceptance: candidate.summary.acceptance };
}
export function scorecardMarkdown(scorecard: Awaited<ReturnType<typeof crossContractScorecard>>) {
  return ["# Historical to Fieldnote V2 comparison", "", scorecard.interpretation, "", `Unchanged normative input sets ${scorecard.unchangedInputs}/60. Historical material differences ${scorecard.differentHistoricalMaterial.length}.`, "", "| Report | Passed | Failed | Blocked | Unsupported | Critical failures |", "| --- | ---: | ---: | ---: | ---: | ---: |", ...[scorecard.baseline, scorecard.candidate].map((report) => `| ${report.adapterVersion} | ${report.summary.passed} | ${report.summary.failed} | ${report.summary.blocked} | ${report.summary.unsupported} | ${report.summary.criticalFailures} |`), "", "Semantic usefulness and browser quality remain unassessed by this comparison.", "", ...scorecard.gradingChanges.map((item) => `- ${item}`), ""].join("\n");
}
