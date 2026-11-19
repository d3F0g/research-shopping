import test from "node:test";
import assert from "node:assert/strict";
import { exportPackets, importJudgments, type Anchor } from "../semantic/packets";
import { dimensions } from "../../semantic/rubric";
import { caseResult, makeReport } from "../report";
import { loadDataset } from "../../dataset";
import { scenarioMaterial } from "../../inputs/materials";
import { offlineNetwork } from "../../network";
import { hash } from "../../hash";
import type { Json } from "../../frozen-v4/contracts";

const anchor: Anchor = { id: "calibration", userTurns: ["Find binoculars", "Compare the first and third"], heldEvidence: ["Synthetic A weighs 400 g. Synthetic C weighs 300 g."], observedFinalResponse: "C is lighter; other performance remains unknown.", referenceScores: Object.fromEntries(dimensions.map((dimension) => [dimension, dimension === "relevance" ? null : 3])) };
async function fixture() {
  const report = await makeReport([], []);
  const exported = exportPackets(report, 1, [anchor]);
  const raw = { schemaVersion: 1, judge: { identity: "synthetic-test-judge", provider: "local-test-double", independentOfImplementation: true, identityEvidence: "Explicit synthetic contract test, no real judge claim.", implementationAuthorIdentity: "synthetic-implementation-author", calibrationStatus: "pending-human-review" }, judgments: exported.packets.map((packet) => ({ label: packet.label, packetHash: packet.packetHash, scores: Object.fromEntries(dimensions.map((dimension) => [dimension, { status: "not-observable", score: null, rationale: "Synthetic contract test deliberately leaves this dimension unassessed.", uncertain: true }])), criticalFailures: [], overall: "uncertain" })) };
  return { ...exported, raw };
}
test("blinded packets preserve held evidence and exclude application identity", async () => {
  const { packets } = await fixture();
  assert.deepEqual(packets[0]!.supportingSources, anchor.heldEvidence);
  assert(!JSON.stringify(packets).includes("applicationCommit"));
  assert(!JSON.stringify(packets).includes("referenceScores"));
  assert(!JSON.stringify(packets).includes("calibration"));
});
test("nullable independent judgments record uncertainty and calibration disagreement", async () => {
  const { raw, packets, manifest } = await fixture();
  const result = importJudgments(raw, packets, manifest);
  assert.equal(result.status, "reporting-only");
  assert.equal(result.humanCalibration, "pending");
  assert.equal(result.uncertainVerdicts.length, 1);
  assert(result.calibrationDisagreements.length > 0);
});
test("semantic importer rejects duplicate labels, changed payload and self-grading", async () => {
  const { raw, packets, manifest } = await fixture();
  const duplicate = structuredClone(raw); duplicate.judgments.push(duplicate.judgments[0]!);
  assert.throws(() => importJudgments(duplicate, packets, manifest), /Duplicate judge labels/);
  const mutated = structuredClone(packets); mutated[0]!.materialLabel = "tampered";
  assert.throws(() => importJudgments(raw, mutated, manifest), /modified after export/);
  const self = structuredClone(raw); self.judge.identity = self.judge.implementationAuthorIdentity;
  assert.throws(() => importJudgments(self, packets, manifest), /cannot grade their own/);
});
test("semantic importer rejects unknown dimensions and omitted packets", async () => {
  const { raw, packets, manifest } = await fixture();
  const unknown = structuredClone(raw); Object.assign(unknown.judgments[0]!.scores, { inventedMetric: { status: "scored", score: 4, rationale: "Synthetic", uncertain: false } });
  assert.throws(() => importJudgments(unknown, packets, manifest));
  assert.throws(() => importJudgments(raw, [...packets, { ...packets[0]!, label: "a".repeat(24) }], manifest), /Every exported packet/);
});

test("completed research packets retain actual response prose and bind it to their hash", async () => {
  const { scenarios } = await loadDataset();
  const scenario = scenarios.find((scenario) => scenario.id === "FN-RT-002")!;
  const input = scenarioMaterial(scenario.provider, scenario.id);
  const guard = offlineNetwork();
  let observation;
  try { observation = await (await import("../adapter")).observe(scenario, input, guard); }
  finally { guard.close(); }
  const report = await makeReport([caseResult(scenario, input, observation)], [scenario]);
  const { packets, manifest } = exportPackets(report, 1);
  const packet = packets[0]!;
  const conversation = packet.conversation as Record<string, Json>[];
  const completed = observation.rawTurns.find((turn) => turn.response?.kind === "research");
  assert(completed?.response?.kind === "research");
  const assistant = conversation[completed.index * 2 + 1]!;
  assert.equal(assistant.text, completed.response.research.summary);
  assert.notEqual(assistant.text, "No completed assistant response was observed.");
  const projected = observation.turns.find((turn) => turn.index === completed.index)!;
  assert.deepEqual(assistant.products, (projected.response!.research as Record<string, Json>).products);
  const { packetHash, ...payload } = packet;
  assert.equal(packetHash, hash(payload));
  assert.equal(manifest.entries[0]!.packetHash, packetHash);
  const changed = structuredClone(payload);
  (changed.conversation as Record<string, Json>[])[completed.index * 2 + 1]!.text = "Changed synthetic response";
  assert.notEqual(hash(changed), packetHash);
});
