import { ADAPTER_VERSION, ASSERTION_VERSION, categories, type CaseResult, type Check, type Metric, type RunReport, type ScenarioContract, type Material, type Observation } from "./contracts";
import { validateInterpretation } from "./interpretation-integrity";
import { grade } from "./assertions";
import { hash, materialPayloadHash } from "../hash";

const implementationPaths = {
  grading: ["assertions.ts", "contracts.ts", "hash.ts", "dataset.ts", "dataset/milestones.ts", "report.ts", "interpretation-integrity.ts"],
  adapter: ["adapter.ts", "network.ts", "inputs/materials.ts", "inputs/intent.ts", "inputs/intent-proposals.v1.json", "inputs/intent-proposals.v2.json", "inputs/public-conversations.v1.json"],
} as const;
function interpretationMode(cases: CaseResult[]): RunReport["configuration"]["interpretationMode"] {
  const modes = new Set(cases.flatMap((row) => row.observation ? [row.observation.interpretation.mode] : []));
  return !modes.size ? "unexecuted" : modes.size > 1 ? "mixed" : modes.has("fixed-proposals") ? "fixed-fallback" : "local-only";
}
function adapterPaths(mode: RunReport["configuration"]["interpretationMode"]) {
  return mode === "local-only" ? implementationPaths.adapter.filter((path) => !path.endsWith(".json")) : [...implementationPaths.adapter];
}
function metric(checks: Check[]): Metric {
  const assessed = checks.filter((check) => check.status === "pass" || check.status === "fail");
  const passed = assessed.filter((check) => check.status === "pass").length;
  return { passed, assessed: assessed.length, unassessed: checks.length - assessed.length, rate: assessed.length ? passed / assessed.length : null };
}
export function summarize(cases: CaseResult[]): RunReport["summary"] {
  const checks = cases.flatMap((item) => item.checks);
  const failureCount = checks.filter((check) => check.status === "fail" && check.critical).length;
  const categoryMetrics = Object.fromEntries(categories.map((category) => {
    const rows = cases.filter((item) => item.category === category);
    const assessed = rows.filter((item) => item.verdict === "pass" || item.verdict === "fail");
    const passed = assessed.filter((item) => item.verdict === "pass").length;
    return [category, { passed, assessed: assessed.length, unassessed: rows.length - assessed.length, rate: assessed.length ? passed / assessed.length : null }];
  }));
  const select = (prefixes: string[]) => metric(checks.filter((check) => prefixes.some((prefix) => check.id.startsWith(prefix))));
  return { total: cases.length, executed: cases.filter((item) => item.execution === "executed").length, passed: cases.filter((item) => item.verdict === "pass").length, failed: cases.filter((item) => item.verdict === "fail").length, blocked: cases.filter((item) => item.verdict === "blocked").length, unsupported: cases.filter((item) => item.verdict === "unsupported").length, infrastructureErrors: cases.filter((item) => item.execution === "infrastructure-error").length, criticalFailures: failureCount, criticalScenarios: cases.filter((item) => item.checks.some((check) => check.critical && check.status === "fail")).length, observedTurns: cases.reduce((sum, item) => sum + (item.observation?.turns.length ?? 0), 0), observedClarifications: cases.reduce((sum, item) => sum + (item.observation?.turns.filter((turn) => ["question", "clarification"].includes(String(turn.response?.kind))).length ?? 0), 0), categories: categoryMetrics, metrics: {
    "conversational-task-success": { passed: 0, assessed: 0, unassessed: cases.length, rate: null },
    "deterministic-case-contract": { passed: cases.filter((item) => item.verdict === "pass").length, assessed: cases.filter((item) => item.verdict === "pass" || item.verdict === "fail").length, unassessed: cases.filter((item) => item.verdict === "blocked" || item.verdict === "unsupported").length, rate: cases.some((item) => item.verdict === "pass" || item.verdict === "fail") ? cases.filter((item) => item.verdict === "pass").length / cases.filter((item) => item.verdict === "pass" || item.verdict === "fail").length : null },
    "unnecessary-clarification-rate": { passed: 0, assessed: 0, unassessed: cases.reduce((sum, item) => sum + (item.observation?.turns.filter((turn) => ["question", "clarification"].includes(String(turn.response?.kind))).length ?? 0), 0), rate: null },
    "hard-constraint-preservation": select(["budget", "criterion", "preserve", "hard-criterion", "hard-choice"]),
    "citation-price-attribution": select(["safe-source", "source-provenance", "quote-containment", "price-attribution", "price-conditions", "adverse-evidence"]),
    "research-call-restraint": select(["calls", "bounded-dispatch", "research-after"]),
    "research-usefulness": { passed: 0, assessed: 0, unassessed: cases.length, rate: null },
    "product-relevance": { passed: 0, assessed: 0, unassessed: cases.length, rate: null },
    "user-experience": { passed: 0, assessed: 0, unassessed: cases.length, rate: null },
  }, acceptance: cases.some((item) => item.verdict === "fail" || item.execution === "infrastructure-error") ? "fail" : cases.some((item) => item.verdict !== "pass") ? "inconclusive" : "pass" };
}
export function caseResult(contract: ScenarioContract, material: Material, observation: Observation | null, error?: string): CaseResult {
  const checks = observation ? grade(contract, observation) : [];
  if (observation && material.provenance.some((value) => value.startsWith("Input suitability gap"))) checks.push({ id: "provider-material-suitability", turn: null, status: "blocked", critical: false, expected: "Matching independently fixed product evidence", observed: "Current input lacks a matching product profile; relevance and recommendation usefulness cannot be assessed", evidence: [] });
  if (observation?.interpretation.limitations.length) checks.push({ id: "interpretation-input-coverage", turn: null, status: "blocked", critical: false, expected: "Exact independently supplied interpretation and unambiguous prior criterion binding", observed: observation.interpretation.limitations, evidence: observation.events.filter((event) => event.kind === "input-limitation").map((event) => event.sequence) });
  const verdict = !observation ? "blocked" : checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "blocked") ? "blocked" : checks.some((check) => check.status === "unsupported") ? "unsupported" : "pass";
  return { id: contract.id, category: contract.category, contract, material, scenarioHash: hash(contract), expectationHash: hash({ expectedBehavior: contract.expectedBehavior, milestones: contract.milestones, criterionChanges: contract.criterionChanges ?? [] }), materialHash: hash(material), expectedBehavior: contract.expectedBehavior, execution: observation ? "executed" : "infrastructure-error", verdict, observation, checks, semantic: { status: "not-run", reason: "Independent judge unavailable in deterministic execution. Human calibration pending.", scores: null }, reproduction: `npm run eval -- --case ${contract.id} --out artifacts/product-evals/reproduce-${contract.id}`, ...(error === undefined ? {} : { error }) };
}
export function validateReport(report: RunReport): void {
  if (report?.schemaVersion !== 4 || report.assertionVersion !== ASSERTION_VERSION || report.adapterVersion !== ADAPTER_VERSION) throw new Error("Unsupported report schema or assertion semantics. Use explicit frozen v2/v3 or current v4 contracts.");
  try {
    if (!Array.isArray(report.datasetContracts) || hash(report.datasetContracts) !== report.datasetHash || new Set(report.datasetContracts.map((item) => item.id)).size !== report.datasetContracts.length) throw new Error("dataset contract hash mismatch");
    for (const kind of ["grading", "adapter"] as const) {
      const inputs = report.implementationInputs[kind];
      const expectedPaths = kind === "adapter" ? adapterPaths(report.configuration.interpretationMode) : implementationPaths[kind];
      if (inputs.length !== expectedPaths.length || inputs.some((input, index) => input.path !== expectedPaths[index] || typeof input.text !== "string" || input.text.length > 1_000_000) || hash(inputs) !== report.implementationHashes[kind]) throw new Error(`${kind} implementation input hash mismatch`);
    }
    if (report.implementationHashes.suite !== hash({ grading: report.implementationHashes.grading, adapter: report.implementationHashes.adapter, datasetHash: report.datasetHash })) throw new Error("suite hash mismatch");
    if (new Set(report.cases.map((item) => item.id)).size !== report.cases.length) throw new Error("duplicate case IDs");
    for (const row of report.cases) {
      const contract = report.datasetContracts.find((item) => item.id === row.id);
      if (!contract || hash(contract) !== hash(row.contract)) throw new Error(`${row.id} contract does not match dataset`);
      if (row.material.sha256 !== materialPayloadHash(row.material)) throw new Error(`${row.id} material payload hash mismatch`);
      if (row.observation) {
        const observed = row.observation;
        validateInterpretation(observed, report);
        if (observed.scenarioId !== row.id || hash(observed.material) !== hash(row.material)) throw new Error(`${row.id} observation material mismatch`);
        if (observed.turns.length > contract.actions.length || observed.turns.some((turn, index) => turn.index !== index || hash(turn.action) !== hash(contract.actions[index]))) throw new Error(`${row.id} observed actions mismatch`);
      } else if (!row.error) throw new Error(`${row.id} infrastructure error requires a recorded error`);
      const recomputed = caseResult(contract, row.material, row.observation, row.error);
      if (hash(row) !== hash(recomputed)) throw new Error(`${row.id} case hashes, expectations, checks or verdict differ from deterministic grading`);
    }
    if (hash(report.summary) !== hash(summarize(report.cases))) throw new Error("summary differs from deterministic grading");
    if (report.configuration.interpretationMode !== interpretationMode(report.cases)) throw new Error("interpretation composition differs from observations");
    if (report.configuration.exaCreditsConsumed !== 0 || report.configuration.openAIHttpRequests !== 0 || report.configuration.ollamaHttpRequests !== 0) throw new Error("offline report cannot claim paid execution");
  } catch (error) { throw new Error(`Invalid report integrity. ${error instanceof Error ? error.message : String(error)}`); }
}
