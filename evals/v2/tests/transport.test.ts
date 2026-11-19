import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { material, scenarioMaterial } from "../../inputs/materials";
import { offlineNetwork } from "../../network";
import type { Json, Scenario } from "../../frozen-v4/contracts";
import { materialPayloadHash } from "../../hash";
import { grade } from "../assertions";
import { caseResult, makeReport, validateReport } from "../report";

const observe = async (...args: Parameters<typeof import("../adapter")["observe"]>) => (await import("../adapter")).observe(...args);
const ownedApplication = async (...args: Parameters<typeof import("../adapter")["ownedApplication"]>) => (await import("../adapter")).ownedApplication(...args);

const scenario = (messages: string[]): Scenario => ({ id: "synthetic-http-control", revision: 1, category: "recovery-safety", title: "Synthetic HTTP controls", provider: "supported", actions: messages.map((text) => ({ kind: "message", text })), expectedBehavior: ["Exercise actual public HTTP and SDK transport without paid traffic"], milestones: [], review: { status: "author-drafted", reference: "Synthetic transport control. No live relevance claim." } });
test("adapter boundary imports no expected milestone or interpretation proposal input", async () => {
  const source = await readFile(new URL("../adapter.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /inputs\/(?:intent|controls)|dataset\/|\.milestones|expectedBehavior|\.propose\(/);
});
test("real HTTP currency answer resumes original request and both bounds once", async () => {
  const guard = offlineNetwork();
  try {
    const contract = scenario(["I want to buy a powerbank around $30-40.", "SGD"]);
    const observation = await observe(contract, scenarioMaterial("supported", "FN-CU-001"), guard);
    assert.equal(observation.applicationError, null);
    assert.equal(observation.turns[0]!.providerCalls, 0);
    assert.equal(observation.turns[1]!.providerCalls, 1);
    assert.deepEqual(observation.rawTurns[1]!.after.intent.budget, { minimum: 30, maximum: 40, currency: "SGD" });
    assert.match(observation.rawTurns[1]!.after.intent.productDescription, /powerbank/i);
    assert.equal(observation.interpretation.invocations, 0);
    const checks = grade(contract, observation);
    assert.equal(checks.find((item) => item.id === "research-query-intent:1")!.status, "pass");
    assert.equal(checks.find((item) => item.id === "sdk-answer-path:1")!.status, "pass");
    validateReport(await makeReport([caseResult(contract, observation.material, observation)], [contract]));
    const changed = structuredClone(observation);
    const provider = changed.events.find((item) => item.kind === "provider-request")!;
    (provider.body as { body: { query: string } }).body.query = "a different objective";
    assert.equal(grade(contract, changed).find((item) => item.id === "research-query-intent:1")!.status, "fail");
  } finally { guard.close(); }
});
test("retrieval query oracle binds every authoritative field and rejects missing or stale data", async () => {
  const guard = offlineNetwork();
  try {
    const contract = scenario(["I want to buy a powerbank around $30-40.", "SGD"]);
    const observation = await observe(contract, scenarioMaterial("supported", "FN-CU-001"), guard);
    const intent = observation.rawTurns[1]!.after.intent;
    assert.ok(intent.budget);
    const expected = {
      productDescription: intent.productDescription,
      budget: intent.budget,
      requirements: intent.requirements.map(({ text, strength }) => ({ text, strength })),
      region: intent.region,
    };
    const provider = observation.events.find((event) => event.kind === "provider-request")!;
    const payload = provider.body as { body: { query: string; systemPrompt: string } };
    assert.deepEqual(JSON.parse(payload.body.query), expected);
    const changes: unknown[] = [
      intent.productDescription,
      { ...expected, productDescription: "a different objective" },
      { ...expected, budget: { maximum: 40, currency: "SGD" } },
      { ...expected, budget: { minimum: 30, maximum: 40 } },
      { ...expected, budget: { ...expected.budget, maximum: 100 } },
      { ...expected, budget: { ...expected.budget, currency: "USD" } },
      { ...expected, requirements: [] },
      { ...expected, requirements: expected.requirements.map((row) => ({ ...row, text: "Different mandatory requirement" })) },
      { ...expected, requirements: expected.requirements.map((row) => ({ ...row, strength: "flexible" })) },
      { ...expected, region: "US" },
      { productDescription: expected.productDescription, budget: expected.budget, requirements: expected.requirements },
      { ...expected, staleField: "old request" },
    ];
    for (const query of changes) {
      const mutated = structuredClone(observation);
      const event = mutated.events.find((item) => item.kind === "provider-request")!;
      (event.body as { body: { query: string } }).body.query = JSON.stringify(query);
      assert.equal(grade(contract, mutated).find((item) => item.id === "research-query-intent:1")!.status, "fail");
    }
    const stalePrompt = structuredClone(observation);
    const event = stalePrompt.events.find((item) => item.kind === "provider-request")!;
    (event.body as { body: { systemPrompt: string } }).body.systemPrompt = "No current intent";
    assert.equal(grade(contract, stalePrompt).find((item) => item.id === "research-query-intent:1")!.status, "fail");
    assert.equal(grade(contract, observation).find((item) => item.id === "research-query-intent:1")!.status, "pass");
  } finally { guard.close(); }
});
test("prepared identity retries cache actual research and ordinary messages spend nothing", async () => {
  const guard = offlineNetwork();
  const app = await ownedApplication(material("powerbank"), guard);
  try {
    await app.session();
    const operationId = randomUUID();
    const input = { phase: "prepare", operationId, message: "Find a powerbank under SGD 40" };
    const prepared = await app.request(input);
    assert.equal(prepared.kind, "prepared"); if (prepared.kind !== "prepared") return;
    const repeated = await app.request(input);
    assert.equal(repeated.kind, "prepared"); if (repeated.kind !== "prepared") return;
    assert.equal(prepared.preparedId, repeated.preparedId);
    assert.equal(app.providerCalls, 0);
    await app.request({ phase: "research", preparedId: prepared.preparedId });
    await app.request({ phase: "research", preparedId: prepared.preparedId });
    await app.request({ phase: "prepare", operationId: randomUUID(), message: "Thanks" });
    assert.equal(app.providerCalls, 1);
    assert.equal(app.events.filter((item) => item.kind === "admission").length, 1);
    assert.equal(app.events.filter((item) => item.kind === "settlement").length, 1);
  } finally { await app.close(); guard.close(); }
});
test("late SDK settlement remains bound to its originating HTTP attempt after a new turn", async () => {
  const guard = offlineNetwork();
  const app = await ownedApplication(material("slow"), guard);
  try {
    await app.session(); app.setTurn(0);
    const prepared = await app.request({ phase: "prepare", operationId: randomUUID(), message: "Find a powerbank under SGD 40" });
    assert.equal(prepared.kind, "prepared"); if (prepared.kind !== "prepared") return;
    const pending = app.request({ phase: "research", preparedId: prepared.preparedId });
    while (!app.providerCalls) await new Promise((resolve) => setTimeout(resolve, 5));
    app.setTurn(1); await app.request({ phase: "prepare", operationId: randomUUID(), message: "Hi" });
    await pending;
    const request = app.events.find((item) => item.kind === "provider-request")!;
    for (const event of app.events.filter((item) => ["provider-response", "settlement"].includes(item.kind))) { assert.equal(event.turn, 0); assert.equal(event.attemptId, request.attemptId); }
  } finally { await app.close(); guard.close(); }
});
test("cancellation reaches actual SDK body and cannot publish late recommendations", async () => {
  const guard = offlineNetwork();
  const app = await ownedApplication(material("slow"), guard);
  try {
    await app.session();
    const prepared = await app.request({ phase: "prepare", operationId: randomUUID(), message: "Find a powerbank under SGD 40" });
    assert.equal(prepared.kind, "prepared"); if (prepared.kind !== "prepared") return;
    const controller = new AbortController();
    const pending = app.request({ phase: "research", preparedId: prepared.preparedId }, controller.signal);
    while (!app.providerCalls) await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort(); await assert.rejects(pending);
    await app.cancel();
    const deadline = Date.now() + 1000;
    while (!app.events.some((item) => item.kind === "provider-aborted") && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(app.events.some((item) => item.kind === "provider-aborted"), true);
    assert.equal((await app.session()).state.messages.some((item) => item.research), false);
    const settlement = app.events.find((item) => item.kind === "settlement");
    assert.ok(settlement);
    assert.equal((settlement.body as Record<string, Json>).cost, null);
  } finally { await app.close(); guard.close(); }
});
test("provider failure and missing configuration never select synthetic fallback", async () => {
  for (const kind of ["error", "missing-config", "timeout", "empty"] as const) {
    const guard = offlineNetwork();
    try {
      const input = material("powerbank");
      if (kind === "missing-config") input.id = "missing-config";
      if (kind === "error") { input.status = 500; input.body = { error: "Synthetic provider error" }; }
      if (kind === "timeout") { input.id = "timeout"; input.delayMs = 1000; }
      if (kind === "empty") input.body = material("empty").body;
      input.sha256 = materialPayloadHash(input);
      const observed = await observe(scenario(["Find a powerbank under SGD 40"]), input, guard);
      assert.equal(observed.applicationError, null);
      assert.equal(observed.turns[0]!.response!.kind, "research-unavailable", kind);
      assert.equal(observed.turns[0]!.response!.research, undefined);
      assert.equal(observed.rawTurns[0]!.after.intent.budget!.maximum, 40);
      assert.equal(observed.network.externalRequests, 0);
    } finally { guard.close(); }
  }
});
test("unsafe citations and conditional prices remain adverse to recommendation", async () => {
  for (const recipe of ["hostile-source", "conditional-price", "bare-currency", "variant-mismatch"] as const) {
    const guard = offlineNetwork();
    try {
      const contract = scenario(["Find a powerbank under SGD 40"]);
      const observed = await observe(contract, scenarioMaterial(recipe, "FN-CU-001"), guard);
      const response = observed.rawTurns[0]!.response;
      if (response?.kind !== "research") continue;
      assert.ok(response.research.sources.every((source) => source.url.startsWith("https://")));
      assert.equal(response.research.choice, null);
      const mutated = structuredClone(observed);
      const research = mutated.turns[0]!.response!.research as Record<string, Json>;
      (research.sources as Record<string, Json>[])[0]!.url = "javascript:alert(1)";
      assert.equal(grade(contract, mutated).find((item) => item.id === "safe-source-urls")!.status, "fail");
    } finally { guard.close(); }
  }
});
test("native quotations stay distinct from complete context and mutations fail provenance", async () => {
  const guard = offlineNetwork();
  try {
    const contract = scenario(["Find binoculars for birdwatching under USD 250"]);
    const observed = await observe(contract, scenarioMaterial("mixed-fit", "FN-RT-002"), guard);
    const response = observed.rawTurns[0]!.response;
    assert.equal(response?.kind, "research"); if (response?.kind !== "research") return;
    const span = response.research.products[0]!.identity.support[0]!;
    assert.ok(span.context.text.includes(span.literal.text));
    assert.ok(span.context.start <= span.literal.start && span.context.end >= span.literal.end);
    assert.ok(span.context.text.length > span.literal.text.length);
    const projected = observed.turns[0]!.response!.research as Record<string, Json>;
    const identity = (projected.products as Record<string, Json>[])[0]!.identity as { support: { quote: string }[] };
    assert.equal(identity.support[0]!.quote, span.literal.text);
    if (span.origin.kind !== "provider") throw new Error("Expected provider support");
    span.origin.reportedQuote = "Synthetic invented native quotation";
    assert.equal(grade(contract, observed).find((item) => item.id === `native-complete-provenance:${response.research.products[0]!.id}`)!.status, "fail");
  } finally { guard.close(); }
});

test("whitespace bindings preserve actual native reports and expose the historical representation gap", async () => {
  const { catalogMaterial } = await import("../../../tests/helpers/v3-catalog-material");
  const { initialConversation } = await import("../../../src/domain/conversation");
  const { ResearchSnapshotSchema } = await import("../../../src/domain/research");
  const native = catalogMaterial(initialConversation().intent);
  const input = { ...material("powerbank"), id: "fixture-catalog-whitespace", label: "Fixture catalog whitespace format only", body: JSON.parse(JSON.stringify(native)) as Json };
  input.sha256 = materialPayloadHash(input);
  const guard = offlineNetwork();
  try {
    const contract = scenario(["Find sunglasses between SGD800 and1000"]);
    const observed = await observe(contract, input, guard);
    const response = observed.rawTurns[0]!.response;
    assert.equal(response?.kind, "research"); if (response?.kind !== "research") return;
    const product = response.research.products[0]!;
    assert.equal(product.price, null);
    assert.equal(product.priceObservation?.amount, 868);
    assert.equal(product.priceObservation?.reportedConditionsResolved, false);
    assert.equal(response.research.choice, null);
    const checks = grade(contract, observed);
    assert.equal(checks.find((check) => check.id === `native-complete-provenance:${product.id}`)!.status, "pass");
    assert.equal(checks.find((check) => check.id === `quote-containment:${product.id}`)!.status, "blocked");
    const projected = observed.turns[0]!.response!.research as Record<string, Json>;
    const identity = (projected.products as Record<string, Json>[])[0]!.identity as { support: { quote: string }[] };
    assert.equal(identity.support[0]!.quote, native.answer.products[0]!.identity.support[0]!.quote);
    const mutated = structuredClone(observed);
    const raw = mutated.rawTurns[0]!.response;
    if (raw?.kind !== "research") throw new Error("Expected current fixture");
    const support = raw.research.products[0]!.identity.support[0]!;
    support.origin = { kind: "provider", reportedQuote: support.literal.text, match: "literal" };
    assert.equal(ResearchSnapshotSchema.safeParse(raw.research).success, true);
    assert.equal(grade(contract, mutated).find((check) => check.id === `native-complete-provenance:${product.id}`)!.status, "fail");
    support.origin = { kind: "source-context" };
    assert.equal(grade(contract, mutated).find((check) => check.id === `native-complete-provenance:${product.id}`)!.status, "fail");
    const cuts = structuredClone(observed);
    const cut = cuts.rawTurns[0]!.response;
    if (cut?.kind !== "research") throw new Error("Expected current fixture");
    cut.research.sources[0]!.originalLength++;
    assert.equal(grade(contract, cuts).find((check) => check.id === `native-complete-provenance:${product.id}`)!.status, "fail");
    assert.equal(observed.network.externalRequests, 0);
    assert.equal(observed.cleanup, true);
  } finally { guard.close(); }
});

test("current provenance accepts equivalent object and JSON-string SDK answers", async () => {
  const { catalogMaterial } = await import("../../../tests/helpers/v3-catalog-material");
  const { initialConversation } = await import("../../../src/domain/conversation");
  const { validCurrentProvenance } = await import("../provenance");
  const native = catalogMaterial(initialConversation().intent);
  const guard = offlineNetwork();
  try {
    for (const answer of [native.answer, JSON.stringify(native.answer)]) {
      const input = { ...material("powerbank"), id: "fixture-answer-encoding", body: JSON.parse(JSON.stringify({ ...native, answer })) as Json };
      input.sha256 = materialPayloadHash(input);
      const observed = await observe(scenario(["Find fixture sunglasses between SGD800 and1000"]), input, guard);
      const response = observed.rawTurns[0]!.response;
      assert.equal(response?.kind, "research");
      if (response?.kind !== "research") throw new Error("Expected fixture comparison");
      const product = response.research.products[0]!;
      assert.equal(validCurrentProvenance(response.research, product, input.body), true);
      for (const invalid of ["{", "null", "[]", "{}", " ".repeat(128001) + JSON.stringify(native.answer)]) {
        assert.equal(validCurrentProvenance(response.research, product, { ...native, answer: invalid } as unknown as Json), false);
      }
      assert.equal(observed.network.externalRequests, 0);
      assert.equal(observed.cleanup, true);
    }
  } finally { guard.close(); }
});

test("V4 catalog observations preserve raw row context and native claims independently", async () => {
  const { catalogMaterial } = await import("../../../tests/helpers/v3-catalog-material");
  const { initialConversation } = await import("../../../src/domain/conversation");
  const { projectExaAnswer } = await import("../../../src/server/exa-research");
  const { validCurrentProvenance } = await import("../provenance");
  const intent = { ...initialConversation().intent, productDescription: "Fixture sunglasses", budget: { currency: "SGD", maximum: 1000 } };
  const native = catalogMaterial(intent);
  native.answer.products[0]!.identity.support[0]!.quote = "Fixture Meridian Sunglasses - Silver";
  native.citations[0]!.text += "\n\nNew Silver colorway\n\nSGD 999\n\nFor Gold only.";
  const result = projectExaAnswer(native, intent);
  if (result.status !== "ready") throw new Error("Expected fixture source observation");
  const product = result.research.products[0]!;
  const body = JSON.parse(JSON.stringify(native)) as Json;
  assert.equal(validCurrentProvenance(result.research, product, body), true);
  const mutations: Array<(item: typeof product) => void> = [
    (item) => { item.priceObservation!.amount = 999; },
    (item) => { item.priceObservation!.row.context.text = item.priceObservation!.row.literal.text; },
    (item) => { item.priceObservation!.row.literal.start++; },
    (item) => { Object.assign(item.priceObservation!, { variant: "Silver" }); },
    (item) => { item.priceObservation!.reportedConditionsResolved = true; },
    (item) => { item.priceObservation!.reportedConditions = ["Fixture invented eligibility condition"]; },
    (item) => { item.priceObservation!.reportedAssessment.status = "contradicted"; },
    (item) => { item.priceObservation!.reportedAssessment.rationale = "Fixture invented rationale"; },
    (item) => { item.priceObservation!.reportedAssessment.support[0]!.origin = { kind: "source-context" }; },
    (item) => { item.priceObservation!.reportedAssessment.support[0]!.origin = { kind: "provider", reportedQuote: item.priceObservation!.row.literal.text, match: "literal" }; },
  ];
  for (const mutate of mutations) {
    const changed = structuredClone(product);
    mutate(changed);
    assert.equal(validCurrentProvenance(result.research, changed, body), false);
  }
});
