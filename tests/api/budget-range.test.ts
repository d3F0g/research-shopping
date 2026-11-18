import { describe, expect, it } from "vitest";
import { research } from "../helpers/local-exa";
import { syntheticAnswer, syntheticIntent } from "../fixtures/dynamic-research";

describe("observed price interval eligibility", () => {
  it("rejects a below-minimum choice even when native budget assessment says supported", async () => {
    const intent = syntheticIntent();
    const preferences = { ...intent, budget: { ...intent.budget, minimum: 250 } };
    const result = await research(syntheticAnswer(), preferences);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice).toBeNull();
    expect(result.research.products[0]?.budget?.status).toBe("contradicted");
  });
});
