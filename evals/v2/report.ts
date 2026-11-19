import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Material, ScenarioContract } from "../frozen-v4/contracts";
import { validateReport as validateV2 } from "../frozen-v2/report";
import type { RunReport as V2 } from "../frozen-v2/contracts";
import { validateReport as validateV3 } from "../frozen-v3/report";
import type { RunReport as V3 } from "../frozen-v3/contracts";
import { summarize, validateReport as validateV4 } from "../frozen-v4/report";
import type { RunReport as V4 } from "../frozen-v4/contracts";
import { hash, materialPayloadHash } from "../hash";
import { grade } from "./assertions";
import { projectIntent, projectResponse } from "./projection";
import { ADAPTER_VERSION, ASSERTION_VERSION, type CaseResult, type Observation, type RunReport } from "./contracts";

export type AnyReport = V2 | V3 | V4 | RunReport;
const paths = {
  grading: ["v2/assertions.ts", "v2/contracts.ts", "v2/projection.ts", "v2/report.ts", "frozen-v4/assertions.ts", "frozen-v4/contracts.ts", "frozen-v4/report.ts", "hash.ts", "dataset.ts", "dataset/milestones.ts"],
  adapter: ["v2/adapter.ts", "v2/projection.ts", "v2/contracts.ts", "network.ts", "inputs/materials.ts"],
};
const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
export function caseResult(contract: ScenarioContract, material: Material, observation: Observation | null, error?: string): CaseResult {
  const checks = observation ? grade(contract, observation) : [];
  if (observation && material.provenance.some((value) => value.startsWith("Input suitability gap"))) checks.push({ id: "provider-material-suitability", turn: null, status: "blocked", critical: false, expected: "Matching independently fixed product evidence", observed: "Current input lacks a matching product profile; relevance and recommendation usefulness cannot be assessed", evidence: [] });
  const verdict = !observation ? "blocked" : checks.some((check) => check.status === "fail") ? "fail" : checks.some((check) => check.status === "blocked") ? "blocked" : checks.some((check) => check.status === "unsupported") ? "unsupported" : "pass";
  return { id: contract.id, category: contract.category, contract, material, scenarioHash: hash(contract), expectationHash: hash({ expectedBehavior: contract.expectedBehavior, milestones: contract.milestones, criterionChanges: contract.criterionChanges ?? [] }), materialHash: hash(material), expectedBehavior: contract.expectedBehavior, execution: observation ? "executed" : "infrastructure-error", verdict, observation, checks, semantic: { status: "not-run", reason: "Independent semantic judgment and human calibration are pending.", scores: null }, reproduction: `npm run eval -- --case ${contract.id} --out artifacts/product-evals/reproduce-v2-${contract.id}`, ...(error === undefined ? {} : { error }) };
}
function validateObservation(observation: Observation) {
  if (hash(observation.initialPreferences) !== hash(projectIntent(observation.rawInitialState)) || observation.rawTurns.length !== observation.turns.length) throw new Error("Initial state projection or raw turn coverage mismatch");
  const initialResponse = observation.events.find((event) => event.kind === "app-response");
  if (!initialResponse || hash((initialResponse.body as { body?: { state?: unknown } }).body?.state) !== hash(observation.rawInitialState)) throw new Error("Initial state differs from actual session response");
  if (observation.events.some((event, index) => event.sequence !== index + 1 || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0)) throw new Error("Invalid transport event sequence");
  const attempts = new Map(observation.events.filter((event) => event.kind === "app-request").map((event) => [event.attemptId, event]));
  if (attempts.size !== observation.events.filter((event) => event.kind === "app-request").length) throw new Error("Duplicate originating HTTP attempt");
  for (const event of observation.events) {
    if (["reset", "cancelled"].includes(event.kind)) continue;
    const origin = attempts.get(event.attemptId);
    if (!event.attemptId || !/^[a-f0-9-]{36}$/.test(event.attemptId) || !origin || origin.turn !== event.turn) throw new Error("Event differs from originating HTTP attempt");
    const request = origin.body as Record<string, unknown>;
    if (["admission", "settlement", "provider-request", "provider-response", "provider-aborted"].includes(event.kind) && request.phase !== "research") throw new Error("Research lifecycle belongs to non-research attempt");
    if (["admission", "settlement"].includes(event.kind)) {
      const prepared = observation.events.find((item) => item.kind === "app-response" && (item.body as { body?: { preparedId?: unknown } }).body?.preparedId === request.preparedId);
      const submission = prepared ? attempts.get(prepared.attemptId) : undefined;
      if (!submission || (event.body as Record<string, unknown>).operationId !== (submission.body as Record<string, unknown>).operationId) throw new Error("Quota operation differs from originating prepared submission");
    }
  }
  const interpretation = observation.interpretation;
  if (interpretation.mode !== "unavailable" || interpretation.inputHash !== null || interpretation.invocations !== 0 || interpretation.openAIHttpRequests !== 0 || interpretation.ollamaHttpRequests !== 0 || interpretation.suppliedTurns.length || interpretation.consumedTurns.length || interpretation.unconsumedTurns.length || interpretation.limitations.length || observation.events.some((event) => event.kind.startsWith("interpreter"))) throw new Error("V2 cannot supply interpretation proposals or make inference calls");
  for (const [index, turn] of observation.turns.entries()) {
    const raw = observation.rawTurns[index]!;
    if (raw.index !== index || turn.index !== index || hash(turn.initialPreferences) !== hash(projectIntent(raw.before)) || hash(turn.finalPreferences) !== hash(projectIntent(raw.after)) || hash(turn.response) !== hash(projectResponse(raw.response))) throw new Error("Reported grading projection differs from actual V2 state");
    if (hash(raw.before) !== hash(index === 0 ? observation.rawInitialState : observation.rawTurns[index - 1]!.after)) throw new Error("Conversation state chain differs from previous turn");
    const terminal = observation.events.filter((event) => event.turn === index && event.kind === "app-response").at(-1);
    if (raw.response && (!terminal || hash((terminal.body as Record<string, unknown>).body) !== hash(raw.response))) throw new Error("Raw final response differs from HTTP response");
    const actualState = raw.response?.state ?? (terminal?.body as { body?: { state?: unknown } } | undefined)?.body?.state;
    if (hash(actualState) !== hash(raw.after)) throw new Error("Accepted state differs from actual terminal HTTP state");
    const expectedHandling = ["reset", "repeat-research"].includes(turn.action.kind) ? "not-prepared" : "local";
    if (turn.intentHandling !== expectedHandling || turn.providerCalls !== observation.events.filter((event) => event.turn === index && event.kind === "provider-request").length) throw new Error("Turn handling or provider count differs from transport");
  }
  const last = observation.rawTurns.at(-1)?.after ?? observation.rawInitialState;
  if (hash(observation.finalPreferences) !== hash(projectIntent(last))) throw new Error("Final state projection mismatch");
}
export function validateReport(report: AnyReport): void {
  if (report.schemaVersion === 2) { validateV2(report); return; }
  if (report.schemaVersion === 3) { validateV3(report); return; }
  if (report.schemaVersion === 4) { validateV4(report); return; }
  if (report.schemaVersion !== 5 || report.adapterVersion !== ADAPTER_VERSION || report.assertionVersion !== ASSERTION_VERSION) throw new Error("Unsupported evaluation contract");
  if (hash(report.datasetContracts) !== report.datasetHash || new Set(report.datasetContracts.map((row) => row.id)).size !== report.datasetContracts.length) throw new Error("Dataset contract mismatch");
  for (const kind of ["grading", "adapter"] as const) {
    const inputs = report.implementationInputs[kind];
    if (hash(inputs.map((item) => item.path)) !== hash(paths[kind]) || inputs.some((item) => typeof item.text !== "string" || item.text.length > 1_000_000) || hash(inputs) !== report.implementationHashes[kind]) throw new Error(`${kind} implementation binding mismatch`);
  }
  if (report.implementationHashes.suite !== hash({ grading: report.implementationHashes.grading, adapter: report.implementationHashes.adapter, datasetHash: report.datasetHash })) throw new Error("Suite hash mismatch");
  if (new Set(report.cases.map((row) => row.id)).size !== report.cases.length) throw new Error("Duplicate case IDs");
  for (const row of report.cases) {
    const contract = report.datasetContracts.find((item) => item.id === row.id);
    if (!contract || hash(contract) !== hash(row.contract) || row.material.sha256 !== materialPayloadHash(row.material)) throw new Error("Case contract or material mismatch");
    if (row.observation) {
      const observation = row.observation;
      validateObservation(observation);
      if (observation.scenarioId !== row.id || hash(observation.material) !== hash(row.material) || observation.turns.length > contract.actions.length || observation.turns.some((turn, index) => hash(turn.action) !== hash(contract.actions[index]))) throw new Error("Observed scenario or actions mismatch");
    } else if (!row.error) throw new Error("Infrastructure error requires its actual error");
    if (hash(row) !== hash(caseResult(contract, row.material, row.observation, row.error))) throw new Error("Checks or verdict differ from deterministic grading");
  }
  if (hash(report.summary) !== hash(summarize(report.cases))) throw new Error("Summary differs from grading");
  if (report.configuration.interpretationMode !== "local-only" || report.configuration.exaCreditsConsumed !== 0 || report.configuration.openAIHttpRequests !== 0 || report.configuration.ollamaHttpRequests !== 0) throw new Error("V2 offline composition mismatch");
}
async function sourceHash(directory: string): Promise<string> {
  const files: string[] = [];
  async function walk(path: string) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const next = join(path, entry.name);
      if (entry.isDirectory()) await walk(next); else files.push(next);
    }
  }
  await walk(directory);
  return hash(await Promise.all(files.sort().map(async (path) => [path, hash(await readFile(path, "utf8"))])));
}
export async function makeReport(cases: CaseResult[], datasetContracts: ScenarioContract[], applicationCommit = git("rev-parse", "HEAD")): Promise<RunReport> {
  if (!/^[a-f0-9]{40}$/.test(applicationCommit) || git("diff", applicationCommit, "--", "src").length) throw new Error("Claimed application commit differs from current src");
  const datasetHash = hash(datasetContracts);
  const implementationInputs = { grading: await Promise.all(paths.grading.map(async (path) => ({ path, text: await readFile(new URL(`../${path}`, import.meta.url), "utf8") }))), adapter: await Promise.all(paths.adapter.map(async (path) => ({ path, text: await readFile(new URL(`../${path}`, import.meta.url), "utf8") }))) };
  const grading = hash(implementationInputs.grading), adapter = hash(implementationInputs.adapter);
  const commit = git("rev-parse", "HEAD");
  return { schemaVersion: 5, createdAt: new Date().toISOString(), runId: hash({ time: Date.now(), commit }).slice(0, 24), datasetVersion: "1.0.0", datasetContracts, datasetHash, assertionVersion: ASSERTION_VERSION, adapterVersion: ADAPTER_VERSION, implementationInputs, implementationHashes: { grading, adapter, suite: hash({ grading, adapter, datasetHash }) }, application: { commit: applicationCommit, tree: git("rev-parse", `${applicationCommit}:src`), dirty: git("status", "--porcelain", "--", "src").length > 0, sourceHash: await sourceHash("src") }, suite: { commit, dirty: git("status", "--porcelain", "--", "evals", "package.json", ".github/workflows/product-evals.yml").length > 0 }, configuration: { provider: "Actual exa-js SDK against unchanged fixed synthetic loopback responses", model: null, exaCreditsConsumed: 0, composition: "Normal V2 Hono HTTP, server-owned cookie session, prepare then research by stable preparedId, isolated in-memory quota and immutable HTTP attempt correlation. No private environment or persistent ledger.", interpretation: "Actual V2 deterministic operations only. No proposal tape, optional interpreter or model inference.", interpretationMode: "local-only", openAIHttpRequests: 0, ollamaHttpRequests: 0 }, cases, summary: summarize(cases), limitations: ["All sixty original public conversations, milestones and research materials remain frozen. Historical reports keep their original schemas and identities.", "V2 raw state and HTTP outputs are retained. The mechanical projection renames requirement text and budget maximum for historical normative checks without inventing accepted constraints or evidence.", "The full-intent request assertion binds actual accepted V2 intent. V2 choice eligibility checks literal supported identity, request and hard requirements plus numeric bounds and price conditions; it does not manufacture the old provider budget assessment.", "Synthetic materials establish conditional deterministic behavior, never live discovery, real product relevance, current prices, stock, merchant authorization or shopping usefulness.", "Literal quote containment establishes provenance, not semantic entailment. Provider source-based assessments remain interpretations.", "No interpreter is supplied. This differs from the historical fixed-proposal treatment and forbids causal model-quality claims.", "Semantic judgment and human calibration are not run. Browser acceptance is assessed separately and cannot be inferred from HTTP checks.", "Execution provenance is recorded but not cryptographically authenticated. Embedded evaluator source is never executed.", "Blocked and unsupported checks remain outside assessed denominators. Frozen failures are retained."] };
}
export function compareReports(baseline: AnyReport, candidate: AnyReport) {
  validateReport(baseline); validateReport(candidate);
  const compatible = baseline.schemaVersion === candidate.schemaVersion && baseline.datasetHash === candidate.datasetHash && baseline.datasetVersion === candidate.datasetVersion && baseline.adapterVersion === candidate.adapterVersion && baseline.assertionVersion === candidate.assertionVersion && baseline.implementationHashes.adapter === candidate.implementationHashes.adapter && baseline.implementationHashes.grading === candidate.implementationHashes.grading;
  return { compatible, notComparable: candidate.cases.filter((row) => { const before = baseline.cases.find((item) => item.id === row.id); return !compatible || !before || before.scenarioHash !== row.scenarioHash || before.expectationHash !== row.expectationHash || before.materialHash !== row.materialHash; }).map((row) => row.id), added: candidate.cases.filter((row) => !baseline.cases.some((item) => item.id === row.id)).map((row) => row.id), removed: baseline.cases.filter((row) => !candidate.cases.some((item) => item.id === row.id)).map((row) => row.id) };
}
export function summaryMarkdown(report: RunReport): string {
  const s = report.summary;
  return [`# Fieldnote V2 product evaluation`, "", `Application ${report.application.commit}. Dataset ${report.datasetVersion}. Contract ${report.assertionVersion}.`, "", `Executed ${s.executed}/${s.total}. Passed ${s.passed}. Failed ${s.failed}. Blocked ${s.blocked}. Unsupported ${s.unsupported}. Infrastructure errors ${s.infrastructureErrors}.`, `Critical assertion failures ${s.criticalFailures} across ${s.criticalScenarios} scenarios. Deterministic acceptance ${s.acceptance}.`, "", "Synthetic local SDK transport. Exa credits 0. Interpreter calls 0. Semantic and browser quality remain unassessed here.", "", ...report.cases.filter((row) => row.verdict === "fail").map((row) => `- ${row.id}. ${row.checks.filter((check) => check.status === "fail").map((check) => check.id).join(", ")}.`), "", "## Limits", "", ...report.limitations.map((item) => `- ${item}`), ""].join("\n");
}
