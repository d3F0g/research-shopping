import test from "node:test";
import assert from "node:assert/strict";
import { currentScenarioMaterial } from "../materials";
import { scenarioMaterial } from "../../inputs/materials";
import { materialPayloadHash } from "../../hash";
import { NativeAnswerSchema } from "../../../src/server/exa-answer-v2";

for (const [id, recipe, count] of [["FN-CU-001", "supported", 1], ["FN-RT-002", "held-comparison", 3], ["FN-PQ-001", "held-comparison", 3]] as const) {
  test(`${id} has a separately labeled V5 test composition while its original wire stays invalid`, () => {
    const original = scenarioMaterial(recipe, id), before = JSON.stringify(original);
    const current = currentScenarioMaterial(recipe, id);
    const answer = NativeAnswerSchema.parse((current.body as { answer: unknown }).answer);
    assert.equal(answer.products.length, count);
    assert.match(current.label, /synthetic/);
    assert.notEqual(current.sha256, original.sha256);
    assert.equal(current.sha256, materialPayloadHash(current));
    assert.equal(JSON.stringify(scenarioMaterial(recipe, id)), before);
    assert.equal(NativeAnswerSchema.safeParse((original.body as { answer: unknown }).answer).success, false);
    assert(answer.products.every((product) => product.name.startsWith("Fixture") && product.criteria.length === 0));
    assert.equal(answer.choice, null);
  });
}
test("new material composition does not rewrite adverse or unassigned frozen inputs", () => {
  for (const [recipe, id] of [["conditional-price", "FN-CU-001"], ["bare-currency", "FN-RT-002"], ["supported", "FN-CU-002"]]) assert.deepEqual(currentScenarioMaterial(recipe!, id!), scenarioMaterial(recipe!, id!));
});
test("the frozen V4 provenance validator still binds its actual historical native1 evidence", async () => {
  const { readFile } = await import("node:fs/promises");
  const { StoredWorkspaceV4Schema } = await import("../../../src/domain/workspace-history-v4");
  const { nativeMaterial } = await import("../../../artifacts/issue-64-price-v5/old-wire-material");
  const { validV4Provenance } = await import("../provenance-v4");
  const previous = StoredWorkspaceV4Schema.parse(JSON.parse(await readFile(new URL("../../../tests/fixtures/stored-workspace-v4-price.json", import.meta.url), "utf8")));
  const research = previous.state.messages.find((message) => message.research?.evidenceVersion === 4)!.research!;
  if (research.evidenceVersion !== 4) throw new Error("Expected actual frozen V4 evidence");
  const body = JSON.parse(JSON.stringify(nativeMaterial(research.intent)));
  assert.equal(validV4Provenance(research, research.products[0]!, body), true);
});
