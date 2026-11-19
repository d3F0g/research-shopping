import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { crossContractScorecard, assessmentTransitions } from "../scorecard";
import { caseResult, makeReport, validateReport, compareReports, type AnyReport } from "../report";
import { hash } from "../hash";
import { offlineNetwork } from "../network";
import { scenarioMaterial } from "../inputs/materials";
import { fixedIntentInput, scenarioIntentInput } from "../inputs/intent";
import { loadDataset } from "../dataset";
import type { Check, RunReport } from "../contracts";
import type { RunReport as FrozenReport } from "../frozen-v2/contracts";
let baseline: FrozenReport;
let candidate: RunReport;
before(async () => {
  baseline = JSON.parse(await readFile(new URL("../../artifacts/product-evals/baseline-v1/report.json", import.meta.url), "utf8"));
  const { scenarios } = await loadDataset();
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const cases = [];
    for (const scenario of scenarios) {
      const material = scenarioMaterial(scenario.provider, scenario.id);
      cases.push(caseResult(scenario, material, await observe(scenario, material, guard)));
    }
    candidate = await makeReport(cases, scenarios);
  } finally { guard.close(); }
});
test("frozen v2 revalidates through static code while embedded source remains inert", () => {
  validateReport(baseline);
  const inert = structuredClone(baseline);
  inert.implementationInputs.grading[0]!.text = 'throw new Error("Captured source must never execute")';
  inert.implementationHashes.grading = hash(inert.implementationInputs.grading);
  inert.implementationHashes.suite = hash({ grading: inert.implementationHashes.grading, adapter: inert.implementationHashes.adapter, datasetHash: inert.datasetHash });
  validateReport(inert);
  const forged = structuredClone(baseline);
  forged.cases[0]!.checks[0]!.status = forged.cases[0]!.checks[0]!.status === "pass" ? "fail" : "pass";
  assert.throws(() => validateReport(forged), /Invalid report integrity/);
  assert.throws(() => validateReport({ ...baseline, assertionVersion: "3.0.0" }), /Unsupported report schema/);
});
test("cross-contract bridge binds sixty rows, immutable requirements and both complete report digests", async () => {
  const result = await crossContractScorecard(baseline, candidate);
  assert.equal(result.rows.length, 60);
  assert.equal(result.baseline.digest, hash(baseline));
  assert.equal(result.candidate.digest, hash(candidate));
  assert.equal(result.incomparableInputs.length, 0);
  assert(result.pairedAssessed.denominator > 0);
  assert(result.assertionChanges.lostAssessment.length > 0);
  assert(result.scenarioChanges.failedToUnassessed.every((id) => !result.scenarioChanges.newlyPassing.includes(id)));
  assert(result.rows.every((row) => row.sharedRequirements.every((item) => item.hash.length === 64 && item.gradingHashes.before === baseline.implementationHashes.grading)));
  assert.equal(compareReports(baseline, candidate).compatible, false);
  assert.equal(compareReports(baseline, candidate).notComparable.length, 60);
});
test("cross-contract bridge rejects forged hashes and honestly changed or partial contracts", async () => {
  for (const mutate of [(value: RunReport) => { value.cases[0]!.expectationHash = "forged"; }, (value: RunReport) => { value.implementationHashes.adapter = "forged"; }, (value: RunReport) => { value.cases[0]!.material.sha256 = "forged"; }]) {
    const bad = structuredClone(candidate); mutate(bad);
    await assert.rejects(crossContractScorecard(baseline, bad), /Invalid report integrity/);
  }
  const partial = await makeReport(candidate.cases.slice(0, 59), candidate.datasetContracts);
  await assert.rejects(crossContractScorecard(baseline, partial), /exact full case coverage/);
  const contracts = structuredClone(candidate.datasetContracts);
  contracts[0]!.expectedBehavior.push("Changed expectation");
  const changed = await makeReport(contracts.map((contract) => caseResult(contract, candidate.cases.find((row) => row.id === contract.id)!.material, null, "Synthetic missing execution")), contracts);
  await assert.rejects(crossContractScorecard(baseline, changed), /unchanged sixty/);
  await assert.rejects(crossContractScorecard(baseline, { ...candidate, schemaVersion: 9 } as unknown as AnyReport), /Unsupported report schema/);
});
test("changed research material is visible and excluded from comparable transition counts", async () => {
  const cases = structuredClone(candidate.cases);
  const row = cases[0]!;
  const material = structuredClone(row.material);
  material.provenance.push("Different research composition");
  cases[0] = caseResult(row.contract, material, null, "Synthetic missing execution");
  const changed = await makeReport(cases, candidate.datasetContracts);
  const scorecard = await crossContractScorecard(baseline, changed);
  assert.deepEqual(scorecard.incomparableInputs, [row.id]);
  assert.equal(scorecard.rows[0]!.assertionChanges, null);
  assert(!scorecard.assertionChanges.failedToUnassessed.some((item) => item.scenarioId === row.id));
});
test("assertion transitions distinguish regressions, discovered failures and lost assessment", () => {
  const check = (id: string, status: Check["status"]): Check => ({ id, turn: 0, status, critical: true, expected: "fixed", observed: null, evidence: [] });
  const transitions = assessmentTransitions([check("regress", "pass"), check("discover", "blocked"), check("lost", "fail"), check("improve", "fail"), check("same", "fail")], [check("regress", "fail"), check("discover", "fail"), check("lost", "blocked"), check("improve", "pass"), check("same", "fail"), check("new", "pass")]);
  assert.deepEqual(transitions.regressions.map((row) => row.key), ["0/regress"]);
  assert.deepEqual(transitions.criticalRegressions.map((row) => row.key), ["0/regress"]);
  assert.deepEqual(transitions.newlyObservedFailures.map((row) => row.key), ["0/discover"]);
  assert.deepEqual(transitions.failedToUnassessed.map((row) => row.key), ["0/lost"]);
  assert.deepEqual(transitions.newlyPassing.map((row) => row.key), ["0/improve"]);
  assert.deepEqual(transitions.newlyAssessedPasses.map((row) => row.key), ["0/new"]);
  assert.deepEqual(transitions.stillFailing.map((row) => row.key), ["0/same"]);
  const downgraded = assessmentTransitions([check("critical", "pass")], [{ ...check("critical", "fail"), critical: false }]);
  assert.equal(downgraded.criticalRegressions.length, 1);
});

test("alternate and missing interpretation treatments cannot enter comparable improvement counts", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const contract = candidate.datasetContracts[0]!;
    const original = candidate.cases[0]!;
    const authored = await scenarioIntentInput(contract);
    for (const intent of [null, fixedIntentInput(authored.turns, "Separate custom-control treatment")]) {
      const observed = await observe(contract, original.material, guard, { intent });
      const cases = [...candidate.cases];
      cases[0] = caseResult(contract, original.material, observed);
      const changed = await makeReport(cases, candidate.datasetContracts);
      const result = await crossContractScorecard(baseline, changed);
      assert.deepEqual(result.incomparableInputs, [contract.id]);
      assert.equal(result.rows[0]!.researchMaterial.equal, true);
      assert.equal(result.rows[0]!.interpretationTreatment.comparable, false);
      assert.equal(result.rows[0]!.assertionChanges, null);
      assert(!result.scenarioChanges.newlyPassing.includes(contract.id));
      assert(!result.assertionChanges.newlyPassing.some((row) => row.scenarioId === contract.id));
    }
    const absentCases = [...candidate.cases];
    absentCases[0] = caseResult(contract, original.material, null, "Explicit missing-execution control");
    const absent = await crossContractScorecard(baseline, await makeReport(absentCases, candidate.datasetContracts));
    assert.equal(absent.rows[0]!.interpretationTreatment.observedMode, "not-executed");
    assert.equal(absent.rows[0]!.strictVerdicts.v5, "blocked");
    assert.equal(absent.rows[0]!.assertionChanges, null);
  } finally { guard.close(); }
});
