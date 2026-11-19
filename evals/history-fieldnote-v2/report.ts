import { summarize } from "../frozen-v4/report";
import type { CaseResult, Observation, RunReport } from "../frozen-v4/contracts";
import { hash, materialPayloadHash } from "../hash";

type HistoricalObservation = Observation & { rawInitialState: unknown; rawTurns: { index: number; before: unknown; after: unknown; response: unknown }[] };
type HistoricalCase = Omit<CaseResult, "observation"> & { observation: HistoricalObservation | null };
export type HistoricalFieldnoteReport = Omit<RunReport, "schemaVersion" | "cases" | "configuration"> & { schemaVersion: 5; cases: HistoricalCase[]; configuration: Omit<RunReport["configuration"], "interpretationMode"> & { interpretationMode: "local-only" } };
const paths = {
  grading: ["v2/assertions.ts", "v2/contracts.ts", "v2/projection.ts", "v2/report.ts", "frozen-v4/assertions.ts", "frozen-v4/contracts.ts", "frozen-v4/report.ts", "hash.ts", "dataset.ts", "dataset/milestones.ts"],
  adapter: ["v2/adapter.ts", "v2/projection.ts", "v2/contracts.ts", "network.ts", "inputs/materials.ts"],
};
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid historical report object");
  return Object.fromEntries(Object.entries(value));
};
function validateTransport(observation: HistoricalObservation): void {
  if (observation.rawTurns.length !== observation.turns.length) throw new Error("Historical raw turn coverage mismatch");
  const initial = observation.events.find((event) => event.kind === "app-response");
  if (!initial || hash(object(object(initial.body).body).state) !== hash(observation.rawInitialState)) throw new Error("Historical initial state differs from transport");
  const attempts = new Map(observation.events.filter((event) => event.kind === "app-request").map((event) => [event.attemptId, event]));
  if (attempts.size !== observation.events.filter((event) => event.kind === "app-request").length) throw new Error("Duplicate historical attempt identity");
  for (const [index, event] of observation.events.entries()) {
    if (event.sequence !== index + 1 || !Number.isFinite(event.elapsedMs) || event.elapsedMs < 0) throw new Error("Invalid historical event sequence");
    if (["reset", "cancelled"].includes(event.kind)) continue;
    const request = attempts.get(event.attemptId);
    if (!event.attemptId || !request || request.turn !== event.turn) throw new Error("Historical event has no matching attempt");
    if (["admission", "settlement", "provider-request", "provider-response", "provider-aborted"].includes(event.kind) && object(request.body).phase !== "research") throw new Error("Historical research event has wrong owner");
    if (event.kind === "provider-response" && (object(event.body).materialHash !== observation.material.sha256 || object(event.body).materialId !== observation.material.id)) throw new Error("Historical provider material differs from transport");
  }
  for (const [index, turn] of observation.turns.entries()) {
    const raw = observation.rawTurns[index]!;
    if (raw.index !== index || turn.index !== index || hash(raw.before) !== hash(index === 0 ? observation.rawInitialState : observation.rawTurns[index - 1]!.after)) throw new Error("Historical state chain is inconsistent");
    const terminal = observation.events.filter((event) => event.turn === index && event.kind === "app-response").at(-1);
    const body = terminal ? object(terminal.body).body : null;
    if (raw.response && hash(raw.response) !== hash(body)) throw new Error("Historical response differs from actual transport");
    if (hash(object(raw.response ?? body).state) !== hash(raw.after)) throw new Error("Historical accepted state differs from transport");
    if (turn.providerCalls !== observation.events.filter((event) => event.turn === index && event.kind === "provider-request").length) throw new Error("Historical provider count differs from transport");
  }
  const interpretation = observation.interpretation;
  if (interpretation.mode !== "unavailable" || interpretation.invocations !== 0 || interpretation.openAIHttpRequests !== 0 || interpretation.ollamaHttpRequests !== 0) throw new Error("Historical offline composition mismatch");
}

export function validateHistoricalFieldnoteReport(report: HistoricalFieldnoteReport): void {
  if (report.schemaVersion !== 5 || report.adapterVersion !== "fieldnote-v2-http-1.0.0" || !["fieldnote-v2-grounded-1.0.0", "fieldnote-v2-grounded-1.1.0"].includes(report.assertionVersion)) throw new Error("Unknown historical Fieldnote report contract");
  if (hash(report.datasetContracts) !== report.datasetHash || new Set(report.datasetContracts.map((row) => row.id)).size !== report.datasetContracts.length) throw new Error("Historical dataset hash mismatch");
  for (const kind of ["grading", "adapter"] as const) {
    const inputs = report.implementationInputs[kind];
    if (hash(inputs.map((input) => input.path)) !== hash(paths[kind]) || inputs.some((input) => typeof input.text !== "string" || input.text.length > 1_000_000) || hash(inputs) !== report.implementationHashes[kind]) throw new Error("Historical implementation hash mismatch");
  }
  if (report.implementationHashes.suite !== hash({ grading: report.implementationHashes.grading, adapter: report.implementationHashes.adapter, datasetHash: report.datasetHash })) throw new Error("Historical suite hash mismatch");
  if (new Set(report.cases.map((row) => row.id)).size !== report.cases.length) throw new Error("Duplicate historical cases");
  for (const row of report.cases) {
    const contract = report.datasetContracts.find((entry) => entry.id === row.id);
    if (!contract || hash(contract) !== hash(row.contract) || row.scenarioHash !== hash(contract) || row.expectationHash !== hash({ expectedBehavior: contract.expectedBehavior, milestones: contract.milestones, criterionChanges: contract.criterionChanges ?? [] })) throw new Error("Historical case contract hash mismatch");
    if (row.material.sha256 !== materialPayloadHash(row.material) || row.materialHash !== hash(row.material)) throw new Error("Historical material hash mismatch");
    const observation = row.observation;
    if (observation) {
      if (observation.scenarioId !== row.id || hash(observation.material) !== hash(row.material) || observation.turns.length > contract.actions.length || observation.turns.some((turn, index) => hash(turn.action) !== hash(contract.actions[index]))) throw new Error("Historical observation provenance mismatch");
      validateTransport(observation);
    } else if (!row.error) throw new Error("Historical infrastructure failure has no evidence");
    if (row.checks.some((check) => !["pass", "fail", "blocked", "unsupported"].includes(check.status) || typeof check.critical !== "boolean" || check.evidence.some((sequence) => !observation?.events.some((event) => event.sequence === sequence)))) throw new Error("Invalid historical check references");
    const verdict = !observation ? "blocked" : row.checks.some((check) => check.status === "fail") ? "fail" : row.checks.some((check) => check.status === "blocked") ? "blocked" : row.checks.some((check) => check.status === "unsupported") ? "unsupported" : "pass";
    if (row.verdict !== verdict || row.execution !== (observation ? "executed" : "infrastructure-error")) throw new Error("Historical verdict differs from recorded checks");
  }
  if (hash(report.summary) !== hash(summarize(report.cases))) throw new Error("Historical summary differs from recorded checks");
  if (report.configuration.interpretationMode !== "local-only" || report.configuration.exaCreditsConsumed !== 0 || report.configuration.openAIHttpRequests !== 0 || report.configuration.ollamaHttpRequests !== 0) throw new Error("Historical offline accounting mismatch");
}
