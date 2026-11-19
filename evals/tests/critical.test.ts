import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { offlineNetwork } from "../network";
import { grade, safeSourceUrl, literalMoney } from "../assertions";
import { material } from "../inputs/materials";
import { loadDataset } from "../dataset";
import { summarize, compareReports, makeReport } from "../report";
import type { Json, Observation, Scenario } from "../contracts";

const scenario: Scenario = { id: "control", revision: 1, category: "budget-currency", title: "Power bank", actions: [{ kind: "message", text: "Find a power bank under SGD40" }, { kind: "message", text: "Thanks" }], provider: "powerbank", expectedBehavior: ["SGD40 maximum remains; local thanks costs nothing"], milestones: [{ after: 0, requirements: [{ kind: "budget", maximum: 40, currency: "SGD" }, { kind: "calls", minimum: 1, maximum: 1 }, { kind: "clarifications", maximum: 0 }] }, { after: 1, requirements: [{ kind: "preserve", from: 0, fields: ["budget"] }, { kind: "calls", minimum: 0, maximum: 0 }] }], review: { status: "author-drafted", reference: "Infrastructure control" } };
function object(value: Json | undefined): Record<string, Json> { return value as Record<string, Json>; }
let original: Observation;
test("normal app actually calls the local SDK and carries authoritative preferences", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    original = await observe(scenario, material("powerbank"), guard);
    assert.equal(original.turns.length, 2);
    assert.equal(original.turns[0]!.providerCalls, 1);
    assert.equal(original.turns[1]!.providerCalls, 0);
    assert.equal(original.cleanup, true);
    assert.equal(original.applicationError, null);
    assert.deepEqual(grade(scenario, original).filter((item) => item.status === "fail"), []);
  } finally { guard.close(); }
});
for (const [name, mutate, check] of [
  ["lost budget", (value: Observation) => { value.turns[0]!.finalPreferences.budget!.amount = 400; }, "budget:"],
  ["invented price", (value: Observation) => { const products = object(value.turns[0]!.response!.research).products as Json[]; object(object(products[0]).price).amount = 1; }, "price-attribution:"],
  ["unsafe link", (value: Observation) => { const sources = object(value.turns[0]!.response!.research).sources as Json[]; object(sources[0]).url = "javascript:alert(1)"; }, "safe-source-urls"],
  ["fabricated product", (value: Observation) => { const products = object(value.turns[0]!.response!.research).products as Json[]; object(products[0]).name = "Invented product"; }, "fabricated-products"],
  ["clarification loop", (value: Observation) => { value.turns[0]!.response!.kind = "clarification"; }, "clarifications:"],
  ["duplicate dispatch", (value: Observation) => { value.turns[0]!.providerCalls = 2; }, "bounded-dispatch:"],
] as const) test(`critical gate detects ${name}`, () => {
  const broken = structuredClone(original);
  mutate(broken);
  assert(grade(scenario, broken).some((item) => item.id.startsWith(check) && item.status === "fail" && item.critical));
});
test("brand polarity cannot pass from a brand token alone", () => {
  const modified = structuredClone(original);
  modified.turns[0]!.finalPreferences.criteria = [{ id: "criterion-1", wording: "Only Sony products", strength: "hard" }];
  const exclusion: Scenario = { ...scenario, milestones: [{ after: 0, requirements: [{ kind: "criterion", includes: "Sony", strength: "hard", meaning: "exclude" }] }] };
  assert.equal(grade(exclusion, modified).find((item) => item.id.startsWith("criterion:"))!.status, "fail");
});
test("offline network rejects a real provider destination before dispatch", async () => {
  const guard = offlineNetwork();
  try {
    await assert.rejects(fetch("https://api.exa.ai/answer"), /denied network destination/);
    assert.equal(guard.snapshot().externalRequests, 0);
    assert.equal(guard.snapshot().denied.length, 1);
  } finally { guard.close(); }
});
test("offline network refuses redirects from an owned local server", async () => {
  const server = createServer((_request, response) => { response.writeHead(302, { location: "https://api.exa.ai/answer" }); response.end(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const guard = offlineNetwork();
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  guard.allow(origin);
  try { await assert.rejects(fetch(origin), /refuses redirects/); }
  finally { guard.close(); server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
test("unsafe source destinations are rejected independently", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,hello", "https://user:pass@example.com", "http://example.com", "https://127.0.0.1/foo", "https://localhost/foo", "https://[::1]/foo"]) assert.equal(safeSourceUrl(url), false);
  assert.equal(safeSourceUrl("https://fixture.example.com/product"), true);
});
test("dataset retains sixty unique multi-turn independent drafts and twelve categories", async () => {
  const dataset = await loadDataset();
  assert.equal(dataset.scenarios.length, 60);
  assert.equal(new Set(dataset.scenarios.map((row) => row.category)).size, 12);
  assert(dataset.scenarios.every((row) => row.actions.length >= 2 && row.milestones.length > 0 && row.expectedBehavior.length > 3));
  assert.deepEqual(dataset.scenarios[0]!.actions, [{ kind: "message", text: "I want to buy a powerbank that costs around $30-40" }, { kind: "message", text: "SGD" }]);
});
test("unknown scores and blocked evidence cannot become a product pass", () => {
  const summary = summarize([]);
  assert.equal(summary.metrics["research-usefulness"]!.rate, null);
  assert.equal(summary.metrics["unnecessary-clarification-rate"]!.rate, null);
});
test("comparison refuses changed assertions or expectations", async () => {
  const baseline = await makeReport([], "dataset");
  const same = structuredClone(baseline);
  assert.equal(compareReports(baseline, same).compatible, true);
  same.implementationHashes.grading = "weakened-check";
  assert.equal(compareReports(baseline, same).compatible, false);
});
test("a repeated operation does not reach the SDK twice", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const result = await observe({ id: "duplicate", provider: "powerbank", actions: [scenario.actions[0]!, { kind: "repeat-research" }] }, material("powerbank"), guard);
    assert.equal(result.turns[0]!.providerCalls, 1);
    assert.equal(result.turns[1]!.providerCalls, 0);
    assert.equal(result.turns[1]!.response!.reason, "duplicate");
  } finally { guard.close(); }
});
test("cancellation reaches the local SDK response", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    const result = await observe({ id: "cancel", provider: "slow", actions: [{ kind: "cancel", text: "Find a power bank under SGD40" }] }, material("slow"), guard);
    assert.equal(result.turns[0]!.cancelled, true);
    assert(result.events.some((event) => event.kind === "provider-aborted"));
    assert.equal(result.cleanup, true);
  } finally { guard.close(); }
});

test("literal money accepts sentence punctuation without accepting numeric continuations", () => {
  assert.equal(literalMoney("Synthetic price is SGD 60.", "SGD", 60), true);
  assert.equal(literalMoney("Synthetic price is SGD 60.50.", "SGD", 60.5), true);
  assert.equal(literalMoney("Synthetic price is SGD 60.5.", "SGD", 60.5), true);
  assert.equal(literalMoney("Synthetic price is SGD 600.", "SGD", 60), false);
  assert.equal(literalMoney("Synthetic price is SGD 60.50.", "SGD", 60), false);
  assert.equal(literalMoney("Synthetic price is SGD 60.501.", "SGD", 60.5), false);
  assert.equal(literalMoney("Synthetic price is USD 60.", "SGD", 60), false);
  assert.equal(literalMoney("Synthetic price is $60.", "SGD", 60), false);
  assert.equal(literalMoney("Synthetic price is SGD 1,060.50.", "SGD", 1060.5), true);
  assert.equal(literalMoney("Synthetic price is SGD 6,0.", "SGD", 60), false);
});
