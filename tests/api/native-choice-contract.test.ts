import { describe, expect, it } from "vitest";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { research } from "../helpers/local-exa";

const typedAnswer = (reasons: unknown[]) => {
  const payload = syntheticAnswer();
  return {
    ...payload,
    answer: {
      ...payload.answer,
      choice: { productId: "aster-pure", reasons },
    },
  };
};

describe("native typed choice references", () => {
  it.each([
    [{ kind: "field", name: "identity" }, "identity"],
    [{ kind: "field", name: "requestMatch" }, "request-match"],
    [{ kind: "field", name: "budget" }, "budget"],
    [{ kind: "field", name: "price" }, "price"],
    [{ kind: "criterion", criterionId: "criterion-1" }, "criterion-1"],
    [{ kind: "attribute", name: "Room size" }, "attribute:Room size"],
  ])("binds %j to the unchanged public assessment", async (reference, id) => {
    const result = await research(typedAnswer([reference]));
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.choice?.reasons).toMatchObject([
      { assessmentId: id },
    ]);
  });

  it.each([
    { kind: "criterion", criterionId: "criterion-other" },
    { kind: "attribute", name: "room size" },
    { kind: "attribute", name: "missing" },
  ])("does not repair an unresolved reference %j", async (reference) => {
    const result = await research(typedAnswer([reference]));
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.choice).toBeNull();
  });

  it("rejects invented field names rather than interpreting ID prefixes", async () => {
    expect(
      await research(
        typedAnswer([{ kind: "field", name: "price-aster-pure" }]),
      ),
    ).toMatchObject({ status: "unavailable", reason: "invalid-response" });
  });

  it("requires request relevance rather than accepting an incomplete native product", async () => {
    const payload = typedAnswer([{ kind: "field", name: "identity" }]);
    const product = payload.answer.products[0]!;
    delete (product as Partial<typeof product>).requestMatch;
    expect(await research(payload)).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });

  it("does not interpret a field name as a criterion ID", async () => {
    const result = await research(
      typedAnswer([{ kind: "criterion", criterionId: "identity" }]),
    );
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.choice).toBeNull();
  });

  it("rejects ambiguous attribute names without choosing the first assessment", async () => {
    const payload = typedAnswer([{ kind: "attribute", name: "Room size" }]);
    payload.answer.products[0]!.attributes.push({
      ...payload.answer.products[0]!.attributes[0]!,
      assessment: {
        ...payload.answer.products[0]!.attributes[0]!.assessment,
        status: "unknown",
        support: [],
      },
    });
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.research.choice).toBeNull();
  });

  it("does not normalize placeholder conditions to an empty condition list", async () => {
    const payload = typedAnswer([{ kind: "field", name: "budget" }]);
    payload.answer.products[0]!.price.conditions = ["None specified"];
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products[0]!.price?.conditionsResolved).toBe(false);
    expect(result.research.choice).toBeNull();
  });

  it("keeps abbreviated evidence unknown under the typed choice protocol", async () => {
    const payload = typedAnswer([{ kind: "field", name: "requestMatch" }]);
    payload.answer.products[0]!.requestMatch.support[0]!.quote =
      "Aster Pure 30 white...air purifier for rooms up to 30 square metres.";
    const result = await research(payload);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.research.products[0]!.requestMatch).toMatchObject({
      status: "unknown",
      support: [],
    });
    expect(result.research.choice).toBeNull();
  });
});
