import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { initialConversation, type TurnResponse } from "../../../src/domain/conversation";
import { loadDataset } from "../../dataset";
import { hash } from "../../hash";
import { material } from "../../inputs/materials";
import type { Scenario } from "../../frozen-v4/contracts";
import { grade } from "../assertions";
import type { Observation, RunReport } from "../contracts";
import { projectIntent, projectResponse } from "../projection";
import { caseResult, compareReports, makeReport, validateReport } from "../report";
import { crossContractScorecard } from "../scorecard";

const scenario: Scenario = { id: "synthetic-integrity-control", revision: 1, category: "recovery-safety", title: "Synthetic report sensitivity control", actions: [{ kind: "message", text: "Hi" }], provider: "powerbank", expectedBehavior: ["No paid dispatch for ordinary greeting"], milestones: [{ after: 0, requirements: [{ kind: "calls", minimum: 0, maximum: 0 }] }], review: { status: "author-drafted", reference: "Synthetic report integrity control. No runtime usefulness claim." } };
function control(): Observation {
  const before = initialConversation();
  const after = structuredClone(before);
  after.messages.push({ id: "synthetic-user", role: "user", text: "Hi" }, { id: "synthetic-assistant", role: "assistant", text: "Hello" });
  const response: TurnResponse = { kind: "message", message: "Hello", state: after };
  const attemptId = randomUUID(), sessionAttempt = randomUUID();
  return { scenarioId: scenario.id, initialPreferences: projectIntent(before), finalPreferences: projectIntent(after), rawInitialState: before, rawTurns: [{ index: 0, before, after, response }], material: material("powerbank"), turns: [{ index: 0, action: scenario.actions[0]!, initialPreferences: projectIntent(before), finalPreferences: projectIntent(after), response: projectResponse(response), intentHandling: "local", providerCalls: 0, cancelled: false }], events: [{ sequence: 1, turn: 0, attemptId: sessionAttempt, kind: "app-request", elapsedMs: 0, body: { method: "GET", path: "/api/session" } }, { sequence: 2, turn: 0, attemptId: sessionAttempt, kind: "app-response", elapsedMs: 0, body: JSON.parse(JSON.stringify({ status: 200, body: { state: before } })) }, { sequence: 3, turn: 0, attemptId, kind: "app-request", elapsedMs: 0, body: { phase: "prepare", operationId: randomUUID(), message: "Hi" } }, { sequence: 4, turn: 0, attemptId, kind: "app-response", elapsedMs: 1, body: JSON.parse(JSON.stringify({ status: 200, body: response })) }], network: { denied: [], allowedOriginCount: 2, externalRequests: 0 }, interpretation: { mode: "unavailable", inputHash: null, openAIHttpRequests: 0, ollamaHttpRequests: 0, consumedTurns: [], unconsumedTurns: [], invocations: 0, suppliedTurns: [], limitations: [] }, cleanup: true, applicationError: null };
}
async function report(): Promise<RunReport> { const observation = control(); return makeReport([caseResult(scenario, observation.material, observation)], [scenario]); }

test("all historical report contracts remain independently valid", async () => {
  for (const path of ["baseline-v1/report.json", "candidate-v5/report.json", "candidate-v5-local/report.json", "candidate-v5-local/without-interpreter/report.json"]) validateReport(JSON.parse(await readFile(`artifacts/product-evals/${path}`, "utf8")));
});
test("frozen original dataset retains sixty unchanged inputs", async () => {
  const dataset = await loadDataset();
  assert.equal(dataset.scenarios.length, 60);
  assert.equal(dataset.originalSha256, "c452827b9aa87bc0b47c3e9a4cc6427a42bbf0303539bc2c09a2093ed754cb8f");
});
test("actual raw state projects without invented hard requirements or bounds", () => {
  const state = initialConversation();
  state.intent.budget = { minimum: 30, currency: "SGD" };
  const projected = projectIntent(state);
  assert.deepEqual(projected.criteria, []);
  assert.deepEqual(projected.budget, { minimum: 30, currency: "SGD" });
  assert.equal(projected.region, null);
});
test("report validator detects fabricated state, checks, provider counts and attempt ownership", async () => {
  const original = await report();
  validateReport(original);
  const mutations = [
    (value: RunReport) => { value.cases[0]!.observation!.turns[0]!.finalPreferences.productDescription = "Invented accepted request"; },
    (value: RunReport) => { value.cases[0]!.checks[0]!.status = "fail"; },
    (value: RunReport) => { value.cases[0]!.observation!.turns[0]!.providerCalls = 1; },
    (value: RunReport) => { value.cases[0]!.observation!.events[1]!.attemptId = randomUUID(); },
    (value: RunReport) => { value.cases[0]!.observation!.events[1]!.turn = 1; },
    (value: RunReport) => { value.cases[0]!.observation!.interpretation.invocations = 1; },
    (value: RunReport) => { value.cases[0]!.observation!.rawTurns[0]!.response = null; },
  ];
  for (const mutate of mutations) { const value = structuredClone(original); mutate(value); assert.throws(() => validateReport(value)); }
});
test("same-contract comparison rejects changed grader and adapter implementation hashes", async () => {
  const before = await report();
  assert.equal(compareReports(before, before).compatible, true);
  for (const kind of ["grading", "adapter"] as const) {
    const after = structuredClone(before);
    after.implementationInputs[kind][0]!.text += "\n";
    after.implementationHashes[kind] = hash(after.implementationInputs[kind]);
    after.implementationHashes.suite = hash({ grading: after.implementationHashes.grading, adapter: after.implementationHashes.adapter, datasetHash: after.datasetHash });
    validateReport(after);
    assert.equal(compareReports(before, after).compatible, false);
  }
});
test("V2 bridge rejects incomplete or changed frozen inputs", async () => {
  const baseline = JSON.parse(await readFile("artifacts/product-evals/baseline-v1/report.json", "utf8"));
  await assert.rejects(crossContractScorecard(baseline, await report()), /unchanged sixty/);
});
test("frozen hard-requirement and bounded-dispatch assertions stay sensitive", () => {
  const observation = control();
  observation.initialPreferences.criteria.push({ id: "hard", wording: "Only Anker", strength: "hard" });
  observation.turns[0]!.providerCalls = 2;
  const checks = grade(scenario, observation);
  assert.equal(checks.find((check) => check.id === "hard-criterion-retention:0")!.status, "fail");
  assert.equal(checks.find((check) => check.id === "bounded-dispatch:0")!.status, "fail");
});

test("historical Fieldnote schema-5 reports retain read integrity without current regrading", async () => {
  const old = JSON.parse(await readFile("artifacts/fieldnote-v2/conversation-polish/full60/report.json", "utf8"));
  validateReport(old);
  const counts = structuredClone(old);
  counts.summary.passed++;
  assert.throws(() => validateReport(counts), /summary/);
  const provenance = structuredClone(old);
  provenance.cases.find((row: RunReport["cases"][number]) => row.observation?.rawTurns.length).observation.rawTurns[0].after.intent.productDescription = "Fixture invented historical state";
  assert.throws(() => validateReport(provenance), /state|transport/);
  const implementation = structuredClone(old);
  implementation.implementationInputs.grading[0].text += "\n";
  assert.throws(() => validateReport(implementation), /hash/);
});

test("frozen V2 evidence projects its actual original quotation without reinterpretation", async () => {
  const { storedResearchV2 } = await import("../../../tests/helpers/v2-stored-material");
  const research = storedResearchV2();
  const original = structuredClone(research);
  const projected = projectResponse({ kind: "research", research, state: initialConversation() })!;
  const snapshot = projected.research as Record<string, import("../../frozen-v4/contracts").Json>;
  const identity = (snapshot.products as Record<string, import("../../frozen-v4/contracts").Json>[])[0]!.identity as { support: unknown[] };
  const support = research.products[0]!.identity.support[0]!;
  assert.deepEqual(identity.support[0], { ...support, quote: support.originalQuote, start: support.originalStart, end: support.originalEnd });
  assert.deepEqual(research, original);
});
