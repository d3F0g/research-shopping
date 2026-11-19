import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { historicalReportArchive } from "../../history-fieldnote-v2/archive";
import { historicalReportDigest } from "../../history-fieldnote-v2/report";
import { initialConversation, type TurnResponse } from "../../../src/domain/conversation";
import { loadDataset } from "../../dataset";
import { hash, materialPayloadHash } from "../../hash";
import { summarize } from "../../frozen-v4/report";
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
  assert.throws(() => validateReport(counts), /archive digest/);
  const provenance = structuredClone(old);
  provenance.cases.find((row: RunReport["cases"][number]) => row.observation?.rawTurns.length).observation.rawTurns[0].after.intent.productDescription = "Fixture invented historical state";
  assert.throws(() => validateReport(provenance), /archive digest/);
  const implementation = structuredClone(old);
  implementation.implementationInputs.grading[0].text += "\n";
  assert.throws(() => validateReport(implementation), /archive digest/);
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


test("archived Fieldnote reports reject forged grading and self-consistent hash changes", async () => {
  const original: RunReport = JSON.parse(await readFile("artifacts/fieldnote-v2/conversation-polish/full60/report.json", "utf8"));
  validateReport(original);
  const mutations: Array<[string, (report: RunReport) => void]> = [
    ["erased checks", (report) => { for (const row of report.cases) row.checks = []; }],
    ["all-pass checks", (report) => { for (const row of report.cases) for (const check of row.checks) check.status = "pass"; }],
    ["invented check", (report) => { report.cases[0]!.checks.push({ id: "fixture-invented", turn: null, status: "pass", critical: true, expected: true, observed: true, evidence: [] }); }],
    ["expected value", (report) => { report.cases[0]!.checks[0]!.expected = "Fixture forged expectation"; }],
    ["observed value", (report) => { report.cases[0]!.checks[0]!.observed = "Fixture forged observation"; }],
    ["evidence references", (report) => { report.cases.flatMap((row) => row.checks).find((check) => check.evidence.length)!.evidence = []; }],
    ["material provenance", (report) => {
      const row = report.cases[0]!;
      row.material.provenance.push("Fixture forged provenance");
      row.material.sha256 = materialPayloadHash(row.material);
      row.materialHash = hash(row.material);
      if (row.observation) row.observation.material = structuredClone(row.material);
    }],
    ["embedded grader", (report) => {
      report.implementationInputs.grading[0]!.text += "\nFixture forged grader";
      report.implementationHashes.grading = hash(report.implementationInputs.grading);
      report.implementationHashes.suite = hash({ grading: report.implementationHashes.grading, adapter: report.implementationHashes.adapter, datasetHash: report.datasetHash });
    }],
  ];
  for (const [name, mutate] of mutations) {
    const value = structuredClone(original);
    mutate(value);
    for (const row of value.cases) row.verdict = !row.observation ? "blocked" : row.checks.some((check) => check.status === "fail") ? "fail" : row.checks.some((check) => check.status === "blocked") ? "blocked" : row.checks.some((check) => check.status === "unsupported") ? "unsupported" : "pass";
    value.summary = summarize(value.cases);
    assert.notEqual(hash(value), hash(original), name);
    assert.throws(() => validateReport(value), Error, name);
  }
});


test("the closed historical inventory authenticates every pinned archived payload", async () => {
  assert.equal(historicalReportArchive.sourceCommit, "33fadc7e3cfde2207528adb32b650287e758d343");
  assert.equal(historicalReportArchive.reports.length, 13);
  for (const entry of historicalReportArchive.reports) {
    const bytes = await readFile(entry.path);
    const blob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    assert.equal(blob, entry.blob, entry.path);
    const report = JSON.parse(bytes.toString("utf8"));
    assert.equal(historicalReportDigest(report), entry.sha256, entry.path);
    validateReport(report);
    report.runId = "fixture-unknown-historical-report";
    assert.throws(() => validateReport(report), /archive digest/, entry.path);
  }
});

test("the actual archived V3 report is authenticated without V4 regrading", async () => {
  const { execFileSync } = await import("node:child_process");
  const { additionalArchivedReports } = await import("../../history-fieldnote-v2/archive");
  const entry = additionalArchivedReports.find((item) => item.archive.endsWith("owner-ccfb87c-checkpoint.tar.gz"))!;
  const bytes = await readFile(entry.archive);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.archiveSha256);
  const report = JSON.parse(execFileSync("tar", ["-xOf", entry.archive, entry.member], { encoding: "utf8", maxBuffer: 40_000_000 }));
  assert.equal(historicalReportDigest(report), entry.sha256);
  validateReport(report);
  report.cases[0].checks = [];
  assert.throws(() => validateReport(report), /archive digest/);
});
