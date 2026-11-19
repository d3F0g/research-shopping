import type { Check, CaseResult, ScenarioContract } from "./contracts";
import { validateReport, type AnyReport } from "./report";
import { hash } from "./hash";
import { INTENT_TAPE_SHA256 } from "./inputs/intent";
import { loadDataset } from "./dataset";

export type Assessment = Check["status"] | "not-observed";
export type Transition = { key: string; before: Assessment; after: Assessment; critical: boolean };
const key = (check: Check) => `${check.turn ?? "case"}/${check.id}`;
const assessed = (status: Assessment) => status === "pass" || status === "fail";
export function assessmentTransitions(before: Check[], after: Check[]) {
  const previous = new Map(before.map((check) => [key(check), check]));
  const current = new Map(after.map((check) => [key(check), check]));
  if (previous.size !== before.length || current.size !== after.length) throw new Error("Duplicate assertion identity");
  const transitions: Transition[] = [...new Set([...previous.keys(), ...current.keys()])].sort().map((id) => ({ key: id, before: previous.get(id)?.status ?? "not-observed", after: current.get(id)?.status ?? "not-observed", critical: Boolean(current.get(id)?.critical || previous.get(id)?.critical) }));
  return {
    newlyPassing: transitions.filter((item) => item.before === "fail" && item.after === "pass"),
    newlyAssessedPasses: transitions.filter((item) => !assessed(item.before) && item.after === "pass"),
    stillFailing: transitions.filter((item) => item.before === "fail" && item.after === "fail"),
    regressions: transitions.filter((item) => item.before === "pass" && item.after === "fail"),
    newlyObservedFailures: transitions.filter((item) => !assessed(item.before) && item.after === "fail"),
    lostAssessment: transitions.filter((item) => assessed(item.before) && !assessed(item.after)),
    failedToUnassessed: transitions.filter((item) => item.before === "fail" && !assessed(item.after)),
    criticalRegressions: transitions.filter((item) => item.critical && item.before === "pass" && item.after === "fail"),
    transitions,
  };
}
const counts = (checks: Check[]) => ({ passed: checks.filter((check) => check.status === "pass").length, failed: checks.filter((check) => check.status === "fail").length, unassessed: checks.filter((check) => !assessed(check.status)).length, assessed: checks.filter((check) => assessed(check.status)).length });
function requirements(contract: ScenarioContract, row: { checks: Check[] }) {
  return contract.milestones.flatMap((milestone) => milestone.requirements.map((requirement, index) => {
    const id = `${requirement.kind}:${milestone.after}:${index}`;
    const check = row.checks.find((item) => item.id === id && item.turn === milestone.after);
    return { key: `requirement/${milestone.after}/${index}`, hash: hash(requirement), status: check?.status ?? "blocked", assertion: id };
  }));
}
export async function crossContractScorecard(baseline: AnyReport, candidate: AnyReport) {
  validateReport(baseline);
  validateReport(candidate);
  if (baseline.schemaVersion !== 2 || baseline.adapterVersion !== "normal-v4.1" || !(candidate.schemaVersion === 3 && candidate.adapterVersion === "normal-v5.1-authored-intent" || candidate.schemaVersion === 4 && candidate.adapterVersion === "normal-v5.2-local-fixed-fallback")) throw new Error("This bridge accepts frozen v4 report v2 against the explicit authored-intent v3 or local-first v4 report contracts only");
  const localFirst = candidate.schemaVersion === 4;
  const canonical = (await loadDataset()).scenarios;
  if (canonical.length !== 60 || hash(baseline.datasetContracts) !== hash(canonical) || hash(candidate.datasetContracts) !== hash(canonical)) throw new Error("Cross-contract comparison requires the unchanged sixty canonical scenario contracts");
  const ids = canonical.map((row) => row.id).sort();
  for (const report of [baseline, candidate]) {
    if (hash(report.cases.map((row) => row.id).sort()) !== hash(ids)) throw new Error("Cross-contract comparison requires exact full case coverage");
  }
  const rows = canonical.map((contract) => {
    const before = baseline.cases.find((row) => row.id === contract.id)!;
    const after = candidate.cases.find((row) => row.id === contract.id)!;
    if (before.scenarioHash !== after.scenarioHash || before.expectationHash !== after.expectationHash || hash(before.contract.actions) !== hash(after.contract.actions)) throw new Error(`Changed public actions or normative expectations for ${contract.id}`);
    const sameResearchMaterial = before.materialHash === after.materialHash;
    const interpretation = after.observation?.interpretation;
    const expectedTreatment = interpretation?.mode === "fixed-proposals" && interpretation.inputHash === INTENT_TAPE_SHA256;
    const interpretationTreatment = { expectedMode: "fixed-proposals", expectedHash: INTENT_TAPE_SHA256, observedMode: interpretation?.mode ?? "not-executed", observedHash: interpretation?.inputHash ?? null, comparable: expectedTreatment, rationale: expectedTreatment ? "Validated immutable v2 scenario proposals supplied at the declared boundary" : "Expected interpretation treatment was not executed. This row cannot support a comparable improvement or regression claim." };
    const comparableTechnicalInputs = sameResearchMaterial && expectedTreatment;
    const sharedRequirements = requirements(contract, after).map((item, index) => ({ ...item, before: requirements(contract, before)[index]!.status, after: item.status, comparability: "unchanged-normative-requirement-under-different-interpretation-composition", rationale: "Requirement, actions and grading rule meaning are unchanged. Supplied v5 interpretation prevents a causal NLU comparison.", gradingHashes: { before: baseline.implementationHashes.grading, after: candidate.implementationHashes.grading } }));
    return {
      id: contract.id, category: contract.category, scenarioHash: after.scenarioHash, expectationHash: after.expectationHash,
      actionsHash: hash(contract.actions), researchMaterial: { before: before.materialHash, after: after.materialHash, equal: sameResearchMaterial },
      comparableTechnicalInputs, interpretationTreatment,
      strictVerdicts: { v4: before.verdict, v5: after.verdict },
      technicalAssertions: { v4: counts(before.checks), v5: counts(after.checks) },
      sharedRequirements,
      assertionChanges: comparableTechnicalInputs ? assessmentTransitions(before.checks, after.checks) : null,
      interpretation: after.observation?.interpretation ?? null,
      interpretationRoutes: after.observation?.turns.map((turn) => ({ turn: turn.index, handling: "intentHandling" in turn ? turn.intentHandling : "historical-not-recorded" })) ?? [],
      unassessed: { v4: before.checks.filter((check) => !assessed(check.status)), v5: after.checks.filter((check) => !assessed(check.status)) },
      expectationDebt: contract.milestones.flatMap((milestone) => milestone.requirements.flatMap((requirement, index) => {
        const check = after.checks.find((item) => item.id === `${requirement.kind}:${milestone.after}:${index}`);
        const turn = after.observation?.turns[milestone.after];
        return requirement.kind === "calls" && requirement.maximum === 0 && check?.status === "fail" && turn?.response?.kind === "research" && turn.finalPreferences.budget === null
          ? [{ assertion: check.id, label: "Possible frozen optional-budget timing debt. Original failure retained; adjudication is separate.", observed: check.observed }] : [];
      })),
    };
  });
  const comparable = rows.filter((row) => row.comparableTechnicalInputs);
  const scenarioTransition = (from: CaseResult["verdict"], to: CaseResult["verdict"]) => comparable.filter((row) => row.strictVerdicts.v4 === from && row.strictVerdicts.v5 === to).map((row) => row.id);
  const named = (name: Exclude<keyof ReturnType<typeof assessmentTransitions>, "transitions">) => comparable.flatMap((row) => row.assertionChanges![name].map((item) => ({ scenarioId: row.id, ...item })));
  const paired = comparable.flatMap((row) => row.assertionChanges!.transitions.filter((item) => assessed(item.before) && assessed(item.after)));
  const pairedAssessed = { denominator: paired.length, v4: { passed: paired.filter((item) => item.before === "pass").length, failed: paired.filter((item) => item.before === "fail").length }, v5: { passed: paired.filter((item) => item.after === "pass").length, failed: paired.filter((item) => item.after === "fail").length }, label: "Same assertions assessed in both reports under different interpretation composition. Conditional technical comparison only." };
  const reportBinding = (report: AnyReport) => ({ digest: hash(report), schemaVersion: report.schemaVersion, adapterVersion: report.adapterVersion, assertionVersion: report.assertionVersion, application: report.application, implementationHashes: report.implementationHashes, configuration: report.configuration, summary: report.summary });
  return {
    schemaVersion: 2, bridge: "fieldnote-v4-v5-descriptive-2.0.0", datasetHash: hash(canonical),
    baseline: reportBinding(baseline), candidate: reportBinding(candidate),
    interpretation: "Descriptive conditional technical comparison. V4 used its parser; v5 uses the declared interpretation composition, with independently authored synthetic operations only where its supplied optional boundary runs. This cannot establish a causal model-quality or NLU improvement, live discovery, relevance or shopping usefulness.",
    compositionDifferences: [localFirst ? "V4 normal-v4.1 parser preparation versus v5 local-first parsing and typed controls, with fixed proposals only when the application invokes its optional interpreter." : "Historical v5 authored-intent lane invokes fixed proposals without the newer local shopping parser.", localFirst ? "provider-request, providerCalls, bounded-dispatch and research-after-prepare count Exa research only. Optional interpretation events are separate. Main OpenAI and Ollama HTTP counts are zero." : "provider-request, providerCalls, bounded-dispatch and research-after-prepare count Exa research only. They do not measure combined OpenAI and Exa paid usage. Interpretation invocation events are separate.", "V5 preserves typed pending questions and client question IDs, and uses a distinct fresh research operation ID.", "V5 can research a useful objective without the old optional-budget gate. Frozen timing expectations remain unchanged.", localFirst ? "Main OpenAI and Ollama HTTP counts are zero. Actual Ollama adapter controls use a separate fake loopback server, with no model installation or inference." : "Historical v5 OpenAI HTTP requests were zero; its former adapter controls remain historical evidence."],
    rows,
    candidatePreparationHandling: Object.fromEntries(["local", "synthetic-fallback", "unavailable", "not-prepared", "historical-not-recorded"].map((kind) => [kind, rows.flatMap((row) => row.interpretationRoutes).filter((route) => route.handling === kind).length])),
    pairedAssessed,
    totals: { v4: counts(baseline.cases.flatMap((row) => row.checks)), v5: counts(candidate.cases.flatMap((row) => row.checks)) },
    scenarioChanges: {
      newlyPassing: comparable.filter((row) => row.strictVerdicts.v4 !== "pass" && row.strictVerdicts.v5 === "pass").map((row) => row.id),
      stillFailing: scenarioTransition("fail", "fail"), regressions: scenarioTransition("pass", "fail"),
      newlyObservedFailures: comparable.filter((row) => ["blocked", "unsupported"].includes(row.strictVerdicts.v4) && row.strictVerdicts.v5 === "fail").map((row) => row.id),
      failedToUnassessed: comparable.filter((row) => row.strictVerdicts.v4 === "fail" && ["blocked", "unsupported"].includes(row.strictVerdicts.v5)).map((row) => row.id),
      lostAssessment: comparable.filter((row) => assessed(row.strictVerdicts.v4) && !assessed(row.strictVerdicts.v5)).map((row) => row.id),
    },
    assertionChanges: { newlyPassing: named("newlyPassing"), newlyAssessedPasses: named("newlyAssessedPasses"), stillFailing: named("stillFailing"), regressions: named("regressions"), newlyObservedFailures: named("newlyObservedFailures"), lostAssessment: named("lostAssessment"), failedToUnassessed: named("failedToUnassessed"), criticalRegressions: named("criticalRegressions") },
    incomparableInputs: rows.filter((row) => !row.comparableTechnicalInputs).map((row) => row.id),
    acceptance: candidate.summary.acceptance,
  };
}
export function scorecardMarkdown(scorecard: Awaited<ReturnType<typeof crossContractScorecard>>) {
  const count = (value: ReturnType<typeof counts>) => `${value.passed}/${value.failed}/${value.unassessed}`;
  return ["# Fieldnote v4 and v5 scorecard", "", scorecard.interpretation, "", `V4 report digest ${scorecard.baseline.digest}. V5 report digest ${scorecard.candidate.digest}.`, "", `Original strict scenarios. V4 executed ${scorecard.baseline.summary.executed}/${scorecard.baseline.summary.total}, ${scorecard.baseline.summary.passed} passed, ${scorecard.baseline.summary.failed} failed, ${scorecard.baseline.summary.blocked} blocked, ${scorecard.baseline.summary.unsupported} unsupported, ${scorecard.baseline.summary.infrastructureErrors} infrastructure errors. V5 executed ${scorecard.candidate.summary.executed}/${scorecard.candidate.summary.total}, ${scorecard.candidate.summary.passed} passed, ${scorecard.candidate.summary.failed} failed, ${scorecard.candidate.summary.blocked} blocked, ${scorecard.candidate.summary.unsupported} unsupported, ${scorecard.candidate.summary.infrastructureErrors} infrastructure errors.`, `Critical v5 failures ${scorecard.candidate.summary.criticalFailures}. Critical pass-to-fail assertion regressions ${scorecard.assertionChanges.criticalRegressions.length}. Technical scenario acceptance ${scorecard.acceptance}.`, "", `Paired assessed denominator ${scorecard.pairedAssessed.denominator}. V4 ${scorecard.pairedAssessed.v4.passed} pass/${scorecard.pairedAssessed.v4.failed} fail. V5 ${scorecard.pairedAssessed.v5.passed} pass/${scorecard.pairedAssessed.v5.failed} fail. ${scorecard.pairedAssessed.label}`, "", "Assertion counts are passed/failed/unassessed. Missing assessments never become passes. See JSON for exact requirement bindings, all assertion transitions, supplied interpretations and limitations.", "", "| Scenario | Original v4 verdict | Original v5 verdict | V4 assertions | V5 assertions | Comparable declared inputs |", "| --- | --- | --- | --- | --- | --- |", ...scorecard.rows.map((row) => `| ${row.id} | ${row.strictVerdicts.v4} | ${row.strictVerdicts.v5} | ${count(row.technicalAssertions.v4)} | ${count(row.technicalAssertions.v5)} | ${row.comparableTechnicalInputs} |`), "", "## Composition limits", "", ...scorecard.compositionDifferences.map((item) => `- ${item}`), "", `Incomparable input or treatment rows ${scorecard.incomparableInputs.length}. Newly passing assertions ${scorecard.assertionChanges.newlyPassing.length}. Still failing assertions ${scorecard.assertionChanges.stillFailing.length}. Pass-to-fail regressions ${scorecard.assertionChanges.regressions.length}. Newly observed failures ${scorecard.assertionChanges.newlyObservedFailures.length}. Failed-to-unassessed ${scorecard.assertionChanges.failedToUnassessed.length}.`, ""].join("\n");
}
