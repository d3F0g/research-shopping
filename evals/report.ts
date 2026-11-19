import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ADAPTER_VERSION, ASSERTION_VERSION, DATASET_VERSION, categories, type CaseResult, type Check, type Metric, type RunReport, type ScenarioContract, type Material, type Observation } from "./contracts";
import { grade } from "./assertions";
import { hash, materialPayloadHash } from "./hash";

const implementationPaths = {
  grading: ["assertions.ts", "contracts.ts", "hash.ts", "dataset.ts", "dataset/milestones.ts", "report.ts"],
  adapter: ["adapter.ts", "network.ts", "inputs/materials.ts"],
} as const;
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
async function sourceHash(directory: string): Promise<string> {
  const files: string[] = [];
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) await walk(next); else files.push(next);
    }
  }
  await walk(directory);
  const contents = await Promise.all(files.sort().map(async (path) => [path, hash(await readFile(path, "utf8"))]));
  return hash(contents);
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
  const verdict = !observation ? "blocked" : checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "blocked") ? "blocked" : checks.some((check) => check.status === "unsupported") ? "unsupported" : "pass";
  return { id: contract.id, category: contract.category, contract, material, scenarioHash: hash(contract), expectationHash: hash({ expectedBehavior: contract.expectedBehavior, milestones: contract.milestones, criterionChanges: contract.criterionChanges ?? [] }), materialHash: hash(material), expectedBehavior: contract.expectedBehavior, execution: observation ? "executed" : "infrastructure-error", verdict, observation, checks, semantic: { status: "not-run", reason: "Independent judge unavailable in deterministic execution. Human calibration pending.", scores: null }, reproduction: `npm run eval -- --case ${contract.id} --out artifacts/product-evals/reproduce-${contract.id}`, ...(error === undefined ? {} : { error }) };
}
export function validateReport(report: RunReport): void {
  if (report?.schemaVersion !== 2 || report.assertionVersion !== ASSERTION_VERSION) throw new Error("Unsupported report schema or assertion semantics. Regenerate a version 2 report.");
  try {
    if (!Array.isArray(report.datasetContracts) || hash(report.datasetContracts) !== report.datasetHash || new Set(report.datasetContracts.map((item) => item.id)).size !== report.datasetContracts.length) throw new Error("dataset contract hash mismatch");
    for (const kind of ["grading", "adapter"] as const) {
      const inputs = report.implementationInputs[kind];
      if (inputs.length !== implementationPaths[kind].length || inputs.some((input, index) => input.path !== implementationPaths[kind][index] || typeof input.text !== "string" || input.text.length > 1_000_000) || hash(inputs) !== report.implementationHashes[kind]) throw new Error(`${kind} implementation input hash mismatch`);
    }
    if (report.implementationHashes.suite !== hash({ grading: report.implementationHashes.grading, adapter: report.implementationHashes.adapter, datasetHash: report.datasetHash })) throw new Error("suite hash mismatch");
    if (new Set(report.cases.map((item) => item.id)).size !== report.cases.length) throw new Error("duplicate case IDs");
    for (const row of report.cases) {
      const contract = report.datasetContracts.find((item) => item.id === row.id);
      if (!contract || hash(contract) !== hash(row.contract)) throw new Error(`${row.id} contract does not match dataset`);
      if (row.material.sha256 !== materialPayloadHash(row.material)) throw new Error(`${row.id} material payload hash mismatch`);
      if (row.observation) {
        const observed = row.observation;
        if (observed.scenarioId !== row.id || hash(observed.material) !== hash(row.material)) throw new Error(`${row.id} observation material mismatch`);
        if (observed.turns.length > contract.actions.length || observed.turns.some((turn, index) => turn.index !== index || hash(turn.action) !== hash(contract.actions[index]))) throw new Error(`${row.id} observed actions mismatch`);
      } else if (!row.error) throw new Error(`${row.id} infrastructure error requires a recorded error`);
      const recomputed = caseResult(contract, row.material, row.observation, row.error);
      if (hash(row) !== hash(recomputed)) throw new Error(`${row.id} case hashes, expectations, checks or verdict differ from deterministic grading`);
    }
    if (hash(report.summary) !== hash(summarize(report.cases))) throw new Error("summary differs from deterministic grading");
    if (report.configuration.exaCreditsConsumed !== 0) throw new Error("offline report cannot claim paid execution");
  } catch (error) { throw new Error(`Invalid report integrity. ${error instanceof Error ? error.message : String(error)}`); }
}
export async function makeReport(cases: CaseResult[], datasetContracts: ScenarioContract[], applicationCommit?: string): Promise<RunReport> {
  const datasetHash = hash(datasetContracts);
  const commit = git("rev-parse", "HEAD");
  const appCommit = applicationCommit ?? commit;
  if (!/^[a-f0-9]{40}$/.test(appCommit)) throw new Error("Application commit must be a full SHA");
  if (git("diff", appCommit, "--", "src").length) throw new Error("The claimed application commit differs from the current src tree");
  const implementationInputs = {
    grading: await Promise.all(implementationPaths.grading.map(async (path) => ({ path, text: await readFile(new URL(path, import.meta.url), "utf8") }))),
    adapter: await Promise.all(implementationPaths.adapter.map(async (path) => ({ path, text: await readFile(new URL(path, import.meta.url), "utf8") }))),
  };
  const grading = hash(implementationInputs.grading);
  const adapter = hash(implementationInputs.adapter);
  return {
    implementationInputs, implementationHashes: { grading, adapter, suite: hash({ grading, adapter, datasetHash }) },
    schemaVersion: 2, datasetContracts, createdAt: new Date().toISOString(), runId: hash({ time: Date.now(), commit }).slice(0, 24), datasetVersion: DATASET_VERSION, datasetHash, assertionVersion: ASSERTION_VERSION, adapterVersion: ADAPTER_VERSION,
    application: { commit: appCommit, tree: git("rev-parse", `${appCommit}:src`), dirty: git("status", "--porcelain", "--", "src").length > 0, sourceHash: await sourceHash("src") },
    suite: { commit, dirty: git("status", "--porcelain", "--", "evals", "package.json", ".github/workflows/product-evals.yml").length > 0 },
    configuration: { provider: "Actual exa-js SDK against fixed synthetic loopback HTTP responses", model: null, exaCreditsConsumed: 0, composition: "Normal Hono research mode with isolated in-memory quota double. No .env or shared ledger." },
    cases, summary: summarize(cases), limitations: ["Offline synthetic provider inputs do not establish real Exa discovery, live product relevance, current prices, stock or merchant authorization.", "No raw original current-schema Exa answer recordings were available. Historical excerpts are not presented as genuine answer replays.", "Semantic scores remain absent until a separately supplied independent judge returns packet-bound judgments. Human calibration is pending.", "Criterion-presence checks establish structured strength and literal phrases, with explicit brand polarity where specified. They do not establish complete semantic equivalence or entailment.", "Application commit and source hash are external execution provenance. Reports do not cryptographically authenticate execution, and embedded evaluator source is never executed.", "Browser acceptance is a separate artifact; deterministic transport runs do not establish UI quality.", "Unsupported capabilities and blocked evidence remain outside assessed denominators. Observed failures retain their original expectations."] };
}
export function summaryMarkdown(report: RunReport): string {
  const s = report.summary;
  const lines = ["# Fieldnote product evaluation", "", `Application ${report.application.commit}. Dataset ${report.datasetVersion}. Assertion contract ${report.assertionVersion}.`, "", `Executed ${s.executed}/${s.total}. Passed ${s.passed}. Failed ${s.failed}. Blocked ${s.blocked}. Unsupported ${s.unsupported}. Infrastructure errors ${s.infrastructureErrors}.`, `Critical assertion failures ${s.criticalFailures} across ${s.criticalScenarios} scenarios. Product acceptance ${s.acceptance}.`, "", "Synthetic offline input. Exa credits consumed 0. These results do not establish real shopping usefulness.", "", "| Category | Passed | Assessed | Unassessed | Rate |", "| --- | ---: | ---: | ---: | ---: |", ...Object.entries(s.categories).map(([category, value]) => `| ${category} | ${value.passed} | ${value.assessed} | ${value.unassessed} | ${value.rate === null ? "not assessed" : `${(value.rate * 100).toFixed(1)}%`} |`), "", "## Observed failures", ""];
  for (const item of report.cases.filter((item) => item.verdict === "fail" || item.execution === "infrastructure-error")) {
    lines.push(`- ${item.id}. ${item.checks.filter((check) => check.status === "fail").map((check) => check.id).join(", ") || item.error}. Reproduce with \`${item.reproduction}\`.`);
  }
  lines.push("", "## Limits", "", ...report.limitations.map((item) => `- ${item}`), "");
  return lines.join("\n");
}
export function compareReports(baseline: RunReport, candidate: RunReport) {
  validateReport(baseline);
  validateReport(candidate);
  const compatible = baseline.datasetVersion === candidate.datasetVersion && baseline.datasetHash === candidate.datasetHash && baseline.assertionVersion === candidate.assertionVersion && baseline.adapterVersion === candidate.adapterVersion && baseline.implementationHashes.grading === candidate.implementationHashes.grading && baseline.implementationHashes.adapter === candidate.implementationHashes.adapter;
  const result = { compatible, capabilityTransitions: [] as { id: string; from: string; to: string }[], newlyPassing: [] as string[], newlyFailing: [] as string[], regressionCount: 0, unchangedFailures: [] as string[], criticalRegressions: [] as string[], notComparable: [] as string[], added: [] as string[], removed: [] as string[] };
  for (const row of candidate.cases) {
    const old = baseline.cases.find((item) => item.id === row.id);
    if (!old) { result.added.push(row.id); continue; }
    if (!compatible || old.scenarioHash !== row.scenarioHash || old.expectationHash !== row.expectationHash || old.materialHash !== row.materialHash) { result.notComparable.push(row.id); continue; }
    if (old.verdict !== row.verdict && (["blocked", "unsupported"].includes(old.verdict) || ["blocked", "unsupported"].includes(row.verdict))) result.capabilityTransitions.push({ id: row.id, from: old.verdict, to: row.verdict });
    if (old.verdict !== "pass" && row.verdict === "pass") result.newlyPassing.push(row.id);
    if (old.verdict !== "fail" && row.verdict === "fail") result.newlyFailing.push(row.id);
    if (old.verdict === "fail" && row.verdict === "fail") result.unchangedFailures.push(row.id);
    if (row.checks.some((check) => check.critical && check.status === "fail" && !old.checks.some((previous) => previous.id === check.id && previous.status === "fail"))) result.criticalRegressions.push(row.id);
  }
  result.removed = baseline.cases.filter((row) => !candidate.cases.some((item) => item.id === row.id)).map((row) => row.id);
  result.regressionCount = result.newlyFailing.length;
  return result;
}
