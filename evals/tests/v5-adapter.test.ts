import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { defaultIntent, type PrepareTurnRequest } from "../../src/domain/contracts";
import { offlineNetwork } from "../network";
import { loadDataset } from "../dataset";
import { material } from "../inputs/materials";
import { controlIntent } from "../inputs/controls";
import { fixedIntentInput, scenarioIntentInput, validateTape, InputCoverageError, type IntentTurn } from "../inputs/intent";
import { hash } from "../hash";
import { grade } from "../assertions";
import type { Json } from "../contracts";
const object = (value: Json) => value as Record<string, Json>;
const request = (message: string): PrepareTurnRequest => ({ phase: "prepare", operationId: randomUUID(), message, preferences: defaultIntent() });

test("independent tape binds every public message and span without reading private expectations", async () => {
  const raw = await readFile(new URL("../inputs/intent-proposals.v2.json", import.meta.url), "utf8");
  const dataset = await loadDataset();
  const tape = validateTape(raw, dataset.scenarios);
  assert.equal(tape.conversations.length, 60);
  assert.equal(tape.conversations.flatMap((row) => row.turns).length, 140);
  const changed = structuredClone(dataset.scenarios);
  changed[0]!.actions[0] = { kind: "message", text: "A different product request" };
  assert.throws(() => validateTape(raw, changed), /public action mismatch/);
  assert.throws(() => validateTape(raw + "\n", dataset.scenarios), /byte hash mismatch/);
  const duplicate = JSON.parse(raw);
  duplicate.conversations[1] = duplicate.conversations[0];
  const duplicateRaw = JSON.stringify(duplicate);
  assert.throws(() => validateTape(duplicateRaw, dataset.scenarios, createHash("sha256").update(duplicateRaw).digest("hex")), /scenario coverage/);
  const source = await readFile(new URL("../inputs/intent.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /(?:parseBudget|updateIntent|tests\/helpers|loadDataset|milestones)/);
});
test("fixed inputs reject missing rows, mismatched messages and malformed spans without fallback", async () => {
  const input = fixedIntentInput([{ turnIndex: 0, message: "lamp", proposal: { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: 4, text: "lamp" } }] } }], "Synthetic boundary control");
  assert.throws(() => input.propose(1, request("lamp")), InputCoverageError);
  assert.throws(() => input.propose(0, request("chair")), InputCoverageError);
  assert.throws(() => fixedIntentInput([{ ...input.turns[0]!, proposal: { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: 3, text: "lamp" } }] } }], "Malformed"), /Malformed fixed interpretation span/);
  await assert.rejects(scenarioIntentInput({ id: "absent", actions: [{ kind: "message", text: "lamp" }], provider: "supported" }), /No fixed interpretation/);
});
test("v5 client carries complete typed question identity, returned preferences and separate operation IDs", async () => {
  const scenario = (await loadDataset()).scenarios.find((row) => row.id === "FN-CU-001")!;
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const result = await observe(scenario, material("powerbank"), guard);
    const question = result.turns[0]!.finalPreferences.pendingChange!;
    assert.equal(question.kind, "money");
    assert.equal(question.originalRequest, scenario.actions[0]!.kind === "message" ? scenario.actions[0]!.text : "");
    assert.equal(question.missingSlot, "currency");
    assert.deepEqual(question.draft, { amount: 40, minimum: 30, currency: null });
    const requests = result.events.filter((event) => event.kind === "app-request").map((event) => object(event.body));
    assert.equal(requests[1]!.questionId, question.id);
    assert.equal(hash(requests[1]!.preferences), hash(result.turns[0]!.finalPreferences));
    assert.notEqual(requests[2]!.operationId, requests[1]!.operationId);
    assert.equal(result.interpretation.invocations, 1);
    assert.equal(result.interpretation.openAIHttpRequests, 0);
    assert.equal(result.turns[1]!.providerCalls, 1);
    assert.equal(result.events.filter((event) => event.kind === "provider-request").length, 1);
    assert(!grade(scenario, result).some((check) => check.status === "fail"));
    const unavailable = await observe(scenario, material("powerbank"), guard, { intent: null });
    assert.equal(unavailable.turns[0]!.response!.reason, "intent-unavailable");
    assert.equal(unavailable.interpretation.mode, "unavailable");
    assert.equal(unavailable.turns.reduce((sum, turn) => sum + turn.providerCalls, 0), 0);
    assert.equal(unavailable.finalPreferences.productDescription, "");
    assert(grade(scenario, unavailable).some((check) => check.status === "fail"));
  } finally { guard.close(); }
});
test("a repeat reuses its actual research identity and reset cannot revive it", async () => {
  const scenario = { id: "wire-repeat", provider: "powerbank", actions: [{ kind: "message" as const, text: "Find a power bank under SGD40" }, { kind: "repeat-research" as const }] };
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const result = await observe(scenario, material("powerbank"), guard, { intent: controlIntent(scenario) });
    const requests = result.events.filter((event) => event.kind === "app-request").map((event) => object(event.body));
    assert.notEqual(requests[0]!.operationId, requests[1]!.operationId);
    assert.equal(requests[1]!.operationId, requests[2]!.operationId);
    assert.equal(result.turns[1]!.response!.reason, "duplicate");
    const reset = { ...scenario, actions: [scenario.actions[0]!, { kind: "reset" as const }, { kind: "repeat-research" as const }] };
    const cleared = await observe(reset, material("powerbank"), guard, { intent: controlIntent(reset) });
    assert.match(cleared.applicationError!, /Cannot repeat/);
    assert.equal(cleared.finalPreferences.productDescription, "");
    assert.equal(cleared.events.filter((event) => event.kind === "provider-request").length, 1);
  } finally { guard.close(); }
});
test("symbolic removals bind only one literal prior criterion and preserve the authored tape", () => {
  const message = "Remove waterproof requirement";
  const row: IntentTurn = { turnIndex: 1, message, proposal: { disposition: "research", actions: [{ kind: "remove-criterion", source: { start: 0, end: message.length, text: message }, id: "@symbolic-0" }] }, symbolicTargets: [{ actionIndex: 0, targetWording: "must be waterproof" }] };
  const input = fixedIntentInput([row], "Synthetic symbolic binding control");
  const value = request(message);
  assert.throws(() => fixedIntentInput([row], "Absent target").propose(1, value), /0 prior literal matches/);
  value.preferences.criteria.push({ id: "criterion-1", wording: "waterproof", strength: "hard", origin: { kind: "message", text: "must be waterproof" } });
  const result = input.propose(1, value);
  assert.deepEqual(result.bindings, [{ actionIndex: 0, targetWording: "must be waterproof", criterionId: "criterion-1" }]);
  assert.equal(hash(row), hash(input.turns[0]));
  assert.equal((row.proposal.actions[0] as { id: string }).id, "@symbolic-0");
  value.preferences.criteria.push({ ...value.preferences.criteria[0]!, id: "criterion-2" });
  assert.throws(() => fixedIntentInput([row], "Ambiguous target").propose(1, value), /2 prior literal matches/);
  assert.throws(() => input.propose(1, value), /already consumed/);
});
test("stale questions bypass supplied interpretations and do not dispatch research", async () => {
  const guard = offlineNetwork();
  try {
    const { ownedApplication } = await import("../adapter");
    const scenario = (await loadDataset()).scenarios[0]!;
    const app = await ownedApplication(material("powerbank"), guard, { intent: await scenarioIntentInput(scenario) });
    try {
      const first = await app.request(request("I want to buy a powerbank that costs around $30-40"));
      app.setTurn(1);
      const result = await app.request({ ...request("SGD"), preferences: first.preferences, questionId: "stale-question" });
      assert.equal(result.kind, "message");
      assert.equal(hash(first.preferences), hash(result.preferences));
      assert.equal(app.interpretation().invocations, 1);
      assert.equal(app.providerCalls, 0);
    } finally { await app.close(); }
  } finally { guard.close(); }
});
test("opposite brand proposals retain their polarity through the actual application", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    for (const wording of ["No Sony products", "Only Sony products"]) {
      const message = `Find headphones. ${wording}`;
      const scenario = { id: "polarity", provider: "supported", actions: [{ kind: "message" as const, text: message }] };
      const input = fixedIntentInput([{ turnIndex: 0, message, proposal: { disposition: "research", actions: [{ kind: "start-request", source: { start: 5, end: 15, text: "headphones" } }, { kind: "add-criterion", source: { start: 17, end: message.length, text: wording }, strength: "hard" }] } }], "Synthetic polarity pair");
      const result = await observe(scenario, material("empty"), guard, { intent: input });
      assert.equal(result.finalPreferences.criteria[0]!.wording, wording);
      assert.equal(result.finalPreferences.criteria[0]!.strength, "hard");
    }
  } finally { guard.close(); }
});
