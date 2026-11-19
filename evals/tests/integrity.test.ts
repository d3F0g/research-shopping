import test, { before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { grade, safeSourceUrl } from "../assertions";
import { controlIntent } from "../inputs/controls";
import { offlineNetwork } from "../network";
import { scenarioMaterial } from "../inputs/materials";
import { caseResult, compareReports, makeReport, summarize, validateReport } from "../report";
import { hash, materialPayloadHash } from "../hash";
import { stableComposerGeometry } from "../browser/layout";
import type { Json, Observation, Scenario, RunReport } from "../contracts";

const contract: Scenario = { id: "integrity-control", revision: 1, category: "product-relevance", title: "Independent integrity control", provider: "mixed-fit", actions: [{ kind: "message", text: "Find three binocular options for birdwatching under USD 250" }, { kind: "message", text: "Thanks" }], expectedBehavior: ["Known adverse evidence cannot become a selected fit."], milestones: [], review: { status: "author-drafted", reference: "Synthetic evaluator sensitivity control" } };
let observed: Observation;
let report: RunReport;
const object = (value: Json | undefined) => value as Record<string, Json>;
const research = (observation: Observation) => object(observation.turns[0]!.response!.research);
const products = (observation: Observation) => (research(observation).products as Json[]).map(object);
const retention = (scenario: Scenario, observation: Observation) => grade(scenario, observation).filter((check) => check.id.startsWith("hard-criterion-retention:"));
before(async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    observed = await observe(contract, scenarioMaterial("mixed-fit", "FN-RT-002"), guard, { intent: controlIntent(contract) });
    report = await makeReport([caseResult(contract, observed.material, observed)], [contract]);
  } finally { guard.close(); }
});
function withCriteria() {
  const value = structuredClone(observed);
  for (const turn of value.turns) turn.finalPreferences.criteria = [{ id: "required-wireless", wording: "Wireless support", strength: "hard" }];
  return value;
}
test("every turn retains observed hard criteria while flexible additions are allowed", () => {
  const good = withCriteria();
  good.turns[1]!.finalPreferences.criteria.push({ id: "quiet", wording: "Quiet", strength: "flexible" });
  assert(retention(contract, good).every((check) => check.status === "pass"));
  assert.deepEqual(retention(contract, good)[0]!.expected, []);
  assert.deepEqual(retention(contract, good)[1]!.expected, good.turns[0]!.finalPreferences.criteria);
  for (const replacement of [[], [{ id: "required-wireless", wording: "Wireless support", strength: "flexible" as const }], [{ id: "required-wireless", wording: "No wireless support", strength: "hard" as const }]]) {
    const bad = withCriteria();
    bad.turns[1]!.finalPreferences.criteria = replacement;
    assert.equal(retention(contract, bad)[1]!.status, "fail");
    assert.equal(retention(contract, bad)[1]!.critical, true);
  }
});
test("only independently declared user changes permit withdrawal or replacement", () => {
  for (const replacement of [[], [{ id: "wired", wording: "Wired operation only", strength: "hard" as const }]]) {
    const value = withCriteria();
    value.turns[1]!.finalPreferences.criteria = replacement;
    const explicit: Scenario = { ...contract, actions: [contract.actions[0]!, { kind: "message", text: "Remove the wireless requirement. Wired operation is fine." }], criterionChanges: [{ after: 1, priorWordingIncludes: "Wireless support", reason: "Explicit user withdrawal of wireless." }] };
    value.turns[1]!.action = explicit.actions[1]!;
    assert(retention(explicit, value).every((check) => check.status === "pass"));
    assert.equal(retention(contract, value)[1]!.status, "fail");
    const wrongTurn = { ...explicit, criterionChanges: [{ ...explicit.criterionChanges![0]!, after: 0 }] };
    assert.equal(retention(wrongTurn, value)[1]!.status, "fail");
  }
});
test("an explicit replacement exempts only the named prior criterion", () => {
  const value = withCriteria();
  value.turns[0]!.finalPreferences.criteria.push({ id: "water", wording: "Waterproof", strength: "hard" });
  value.turns[1]!.finalPreferences.criteria = [];
  const explicit = { ...contract, criterionChanges: [{ after: 1, priorWordingIncludes: "Wireless support", reason: "Explicit user removal." }] };
  assert.equal(retention(explicit, value)[1]!.status, "fail");
});
test("actual contradicted display unit cannot be relabeled supported and selected", () => {
  assert(!grade(contract, observed).some((check) => check.id.startsWith("adverse-evidence:") && check.status === "fail"));
  const bad = structuredClone(observed);
  const rejected = products(bad).find((product) => object(product.requestMatch).status === "contradicted")!;
  assert.match(String((object(productSupport(rejected.requestMatch)[0])).quote), /non-functional display model/);
  object(rejected.requestMatch).status = "supported";
  research(bad).choice = { productId: rejected.id!, reasons: [{ kind: "field", name: "identity" }] };
  assert(grade(contract, bad).some((check) => check.id === `adverse-evidence:${rejected.id}:requestMatch` && check.status === "fail" && check.critical));
});
function productSupport(value: Json | undefined) { return object(value).support as Json[]; }
test("adverse preservation covers identity, request, hard criteria, price and budget with source passages", () => {
  for (const field of ["identity", "requestMatch", "criterion", "price", "budget"] as const) {
    for (const status of ["contradicted", "conflict"] as const) {
      const good = structuredClone(observed);
      const supplied = object((object(object(good.material.body).answer).products as Json[])[1]);
      const published = products(good)[1]!;
      const upstreamAssessment = { ...object(supplied.requestMatch), status };
      const currentAssessment = { ...object(published.requestMatch), status };
      if (field === "criterion") {
        supplied.criteria = [{ criterionId: "hard-1", assessment: upstreamAssessment }];
        published.criteria = [{ criterionId: "hard-1", assessment: currentAssessment }];
      } else if (field === "price") {
        object(supplied.price).assessment = upstreamAssessment;
        object(published.price).assessment = currentAssessment;
      } else { supplied[field] = upstreamAssessment; published[field] = currentAssessment; }
      const checkId = `adverse-evidence:${published.id}:${field === "criterion" ? "criterion:hard-1" : field}`;
      assert.equal(grade(contract, good).find((check) => check.id === checkId)!.status, "pass");
      for (const mutate of [(assessment: Record<string, Json>) => { assessment.status = "supported"; }, (assessment: Record<string, Json>) => { assessment.support = []; }]) {
        const bad = structuredClone(good);
        const product = products(bad)[1]!;
        const assessment = field === "criterion" ? object(object((product.criteria as Json[])[0]).assessment) : field === "price" ? object(object(product.price).assessment) : object(product[field]);
        mutate(assessment);
        assert.equal(grade(contract, bad).find((check) => check.id === checkId)!.status, "fail");
      }
    }
  }
});
test("supported and unknown inputs do not acquire invented adverse failures or eligibility", () => {
  const valid = structuredClone(observed);
  const checks = grade(contract, valid);
  assert(!checks.some((check) => check.id.startsWith("adverse-evidence:synthetic-fieldglass-1:") && check.status === "fail"));
  const unknown = products(valid)[2]!;
  assert.equal(object(unknown.requestMatch).status, "unknown");
  assert(!checks.some((check) => check.id.startsWith(`adverse-evidence:${unknown.id}:`)));
  research(valid).choice = { productId: unknown.id!, reasons: [{ kind: "field", name: "identity" }] };
  assert.equal(grade(contract, valid).find((check) => check.id === "hard-choice-eligibility")!.status, "fail");
});
test("visible adverse flexible tradeoffs can accompany an otherwise eligible choice", () => {
  const value = structuredClone(observed);
  const supplied = object((object(object(value.material.body).answer).products as Json[])[0]);
  const published = products(value)[0]!;
  const assessment = { ...object(supplied.identity), status: "contradicted" };
  supplied.attributes = [{ name: "Optional finish", assessment }];
  published.attributes = [{ name: "Optional finish", assessment: { ...object(published.identity), status: "contradicted" } }];
  assert.equal(object(research(value).choice).productId, published.id);
  assert.equal(grade(contract, value).find((check) => check.id === `adverse-evidence:${published.id}:attribute:Optional finish`)!.status, "pass");
});
test("public source syntax rejects canonical local hosts and invalid authorities", () => {
  for (const url of ["https://localhost./x", "https://host.internal/x", "https://host.local./x", "https://host.test/x", "https://host.invalid/x", "https://host.onion/x", "https://host.arpa/x", "https://127.1/x", "https://2130706433/x", "https://[::1]/x", "https://user:pass@example.com/x", "https://@example.com/x", "https://example.com:443/x", "https://example.com:8443/x", "https://bad_label.example.com/x", "https://-bad.example.com/x", "https://example..com/x", "http://example.com/x", "https:example.com/x", "https://exam\nple.com/x"]) assert.equal(safeSourceUrl(url), false, url);
  for (const url of ["https://fixture.example.com/product", "https://www.wikipedia.org/wiki/Shop", "https://ui.shadcn.com/docs", "https://www.example.com./product"]) assert.equal(safeSourceUrl(url), true, url);
});
test("unsafe supplied local source cannot be restored into published output", () => {
  for (const url of ["https://localhost./x", "https://host.internal/x", "https://host.local./x"]) {
    const bad = structuredClone(observed);
    const source = object((research(bad).sources as Json[])[0]);
    const supplied = object((object(bad.material.body).citations as Json[])[0]);
    source.url = supplied.url = url;
    assert.equal(grade(contract, bad).find((check) => check.id === "safe-source-urls")!.status, "fail");
  }
});
test("report ingestion recomputes payload bindings, checks, verdict and summary", () => {
  validateReport(report);
  const reordered = JSON.parse(JSON.stringify(report, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).reverse()) : item)) as RunReport;
  assert.equal(compareReports(report, reordered).compatible, true);
  assert.equal(compareReports(report, structuredClone(report)).compatible, true);
  const mutations: ((value: RunReport) => void)[] = [
    (value) => { value.cases[0]!.expectedBehavior = ["Weakened expectations"]; },
    (value) => { value.cases[0]!.checks[0]!.status = "fail"; },
    (value) => { value.cases[0]!.verdict = "fail"; },
    (value) => { value.summary.passed++; },
    (value) => { value.implementationInputs.grading[0]!.text += "tampered source"; },
    (value) => { value.implementationInputs.adapter[0]!.path = "../private-env"; },
    (value) => { value.implementationHashes.grading = "stale-grading"; },
    (value) => { value.cases[0]!.contract.expectedBehavior = ["Rewritten contract"]; },
    (value) => { value.cases[0]!.material.provenance.push("Forged provenance"); },
    (value) => { object(value.cases[0]!.observation!.material.body).requestId = "rewritten"; },
    (value) => { value.cases[0]!.material.sha256 = "stale"; },
    (value) => { value.cases[0]!.observation!.interpretation.inputHash = "forged"; },
    (value) => { const response = value.cases[0]!.observation!.events.find((event) => event.kind === "interpreter-response")!; object(response.body).interpretation = { disposition: "acknowledge", actions: [] }; },
    (value) => { value.configuration.openAIHttpRequests = 1 as 0; },
  ];
  for (const mutate of mutations) { const bad = structuredClone(report); mutate(bad); assert.throws(() => compareReports(report, bad), /Invalid report integrity/); }
  assert.throws(() => compareReports({ ...report, schemaVersion: 1 } as unknown as RunReport, report), /Unsupported report schema/);
});
test("honestly rehashed changed expectations and material remain incomparable", async () => {
  const changed = { ...contract, expectedBehavior: ["Different independently owned expectation"] };
  const changedReport = await makeReport([caseResult(changed, observed.material, observed)], [changed]);
  const comparison = compareReports(report, changedReport);
  assert.equal(comparison.compatible, false);
  assert.deepEqual(comparison.newlyPassing, []);
  assert.deepEqual(comparison.notComparable, [contract.id]);
  const changedMaterial = structuredClone(observed.material);
  changedMaterial.provenance.push("Changed material provenance");
  changedMaterial.sha256 = materialPayloadHash(changedMaterial);
  const changedObservation = { ...observed, material: changedMaterial };
  const materialReport = await makeReport([caseResult(contract, changedMaterial, changedObservation)], [contract]);
  assert.deepEqual(compareReports(report, materialReport).notComparable, [contract.id]);
});
test("compare CLI accepts intact reports and rejects stale metadata and rewritten grades", async () => {
  const directory = await mkdtemp(join(tmpdir(), "fieldnote-eval-integrity-"));
  const baselinePath = join(directory, "baseline.json");
  const candidatePath = join(directory, "candidate.json");
  await writeFile(baselinePath, JSON.stringify(report));
  const run = () => spawnSync(process.execPath, ["--import", "tsx", "evals/run.ts", "--compare", "--baseline", baselinePath, "--candidate", candidatePath, "--out", join(directory, "comparison")], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "test", EXA_RESEARCH_ENABLED: "false" } });
  await writeFile(candidatePath, JSON.stringify(report));
  assert.equal(run().status, 0);
  const failedContract: Scenario = { ...contract, milestones: [{ after: 0, requirements: [{ kind: "budget", maximum: 1, currency: "USD" }] }] };
  const failedReport = await makeReport([caseResult(failedContract, observed.material, observed)], [failedContract]);
  assert.equal(failedReport.cases[0]!.verdict, "fail");
  await writeFile(baselinePath, JSON.stringify(failedReport));
  const gradesOnly = structuredClone(failedReport);
  gradesOnly.cases[0]!.checks = gradesOnly.cases[0]!.checks.map((check) => ({ ...check, status: "pass" }));
  gradesOnly.cases[0]!.verdict = "pass";
  gradesOnly.summary = summarize(gradesOnly.cases);
  await writeFile(candidatePath, JSON.stringify(gradesOnly));
  assert.match(run().stderr, /Invalid report integrity/);
  await writeFile(baselinePath, JSON.stringify(report));
  const bad = structuredClone(report);
  bad.cases[0]!.expectedBehavior = ["Weakened by report caller"];
  bad.cases[0]!.checks = bad.cases[0]!.checks.map((check) => ({ ...check, status: "pass" }));
  bad.cases[0]!.verdict = "pass";
  bad.summary = summarize(bad.cases);
  await writeFile(candidatePath, JSON.stringify(bad));
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid report integrity/);
  const honest = { ...contract, milestones: [{ after: 0, requirements: [{ kind: "unassessed" as const, capability: "semantic", reason: "Different expectation" }] }] };
  await writeFile(candidatePath, JSON.stringify(await makeReport([caseResult(honest, observed.material, observed)], [honest])));
  const changed = run();
  assert.equal(changed.status, 2);
  assert.deepEqual(JSON.parse(changed.stdout.trim()).newlyPassing, []);
  assert.notEqual(hash(honest), hash(contract));
});
test("timeout and cancellation retain terminal events in immutable completed observations", async () => {
  const guard = offlineNetwork();
  try {
    const { observe } = await import("../adapter");
    for (const kind of ["message", "cancel"] as const) {
      const timeout: Scenario = { ...contract, provider: "timeout", actions: [{ kind, text: "Find binoculars under USD 250" }] };
      const input = scenarioMaterial("timeout", "FN-ER-001");
      const value = await observe(timeout, input, guard, { intent: controlIntent(timeout) });
      assert.equal(value.cleanup, true);
      assert(value.events.some((event) => event.kind === "provider-aborted"));
      assert(value.events.some((event) => event.kind === "settlement" && object(event.body).cost === null && object(event.body).successful === false));
      if (kind === "cancel") assert.equal(value.turns[0]!.cancelled, true);
      const initial = hash(caseResult(timeout, input, value));
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(hash(caseResult(timeout, input, value)), initial);
      const savedMaterial = hash(value.material);
      input.provenance.push("Caller mutation after observation is sealed");
      assert.equal(hash(value.material), savedMaterial);
    }
  } finally { guard.close(); }
});
test("browser geometry waits for responsive reflow and still fails persistent clipping", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.setContent('<style>textarea { position: fixed; left: 10px; bottom: 10px; width: 300px; height: 70px; box-sizing: border-box; }</style><textarea aria-label="Message"></textarea>');
    assert.equal((await stableComposerGeometry(page)).stable, true);
    await page.setViewportSize({ width: 390, height: 600 });
    await page.evaluate(() => {
      const input = document.querySelector("textarea")!;
      input.style.bottom = "auto";
      input.style.top = "890px";
      setTimeout(() => { input.style.top = "auto"; input.style.bottom = "10px"; }, 150);
    });
    const mobile = await stableComposerGeometry(page);
    assert.equal(mobile.stable, true);
    assert(mobile.elapsedMs >= 150);
    assert(mobile.box!.y + mobile.box!.height <= 600);
    await page.evaluate(() => { document.querySelector("textarea")!.style.width = "500px"; });
    const clipped = await stableComposerGeometry(page, 250);
    assert.equal(clipped.stable, false);
    assert.equal(clipped.fits, false);
    assert(clipped.elapsedMs >= 250);
  } finally { await browser.close(); }
});
