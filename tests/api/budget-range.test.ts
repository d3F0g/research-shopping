import { describe, expect, it } from "vitest";
import { research } from "../helpers/local-exa";
import { syntheticAnswer, syntheticIntent } from "../fixtures/dynamic-research";

describe("observed price interval eligibility", () => {
  it("rejects a below-minimum choice even when native budget assessment says supported", async () => {
    const intent = syntheticIntent();
    const preferences = {
      ...intent,
      budget: { ...intent.budget, minimum: 250 },
    };
    const result = await research(syntheticAnswer(), preferences);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]?.budget?.status).toBe("contradicted");
  });
});

it.each([
  [249, 300],
  [100, 249],
])(
  "includes a qualifying price at either interval boundary %s-%s",
  async (minimum, amount) => {
    const intent = syntheticIntent();
    const result = await research(syntheticAnswer(), {
      ...intent,
      budget: { ...intent.budget, minimum, amount },
    });
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice?.productId).toBe("aster-pure");
  },
);

it("does not claim interval compliance when price applicability is unresolved", async () => {
  const native = syntheticAnswer();
  native.answer.products[0].price.conditionsResolved = false;
  const intent = syntheticIntent();
  const result = await research(native, {
    ...intent,
    budget: { ...intent.budget, minimum: 250 },
  });
  expect(result.status).toBe("ready");
  if (result.status !== "ready") return;
  expect(result.research.choice).toBeNull();
  expect(result.research.products[0]?.budget?.status).toBe("unknown");
});
