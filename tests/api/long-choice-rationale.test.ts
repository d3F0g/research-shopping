import { describe, expect, it } from "vitest";
import { ConditionalChoiceSchema } from "../../src/domain/research";
import { ConditionalChoiceSchema as Version3ChoiceSchema } from "../../src/domain/research-evidence-v3";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { research } from "../helpers/local-exa";

const rationale =
  "The retained source describes the washable prefilter on the Aster Pure 30 white variant. ".repeat(
    5,
  ) + "This finding does not establish the same feature on another variant.";

describe("complete conditional-choice rationales", () => {
  it.each(["native", "derived"])(
    "retains the complete qualified rationale for a %s choice through the local SDK",
    async (kind) => {
      expect(rationale.length).toBeGreaterThan(400);
      expect(rationale.length).toBeLessThanOrEqual(600);
      const payload = syntheticAnswer();
      payload.answer.products[0]!.criteria[0]!.assessment.rationale = rationale;
      if (kind === "derived") payload.answer.choice = null;
      const result = await research(payload);
      expect(result.status).toBe("ready");
      if (result.status !== "ready") return;
      expect(result.research.choice?.reasons).toContainEqual({
        assessmentId: "criterion-1",
        explanation: rationale,
      });
      expect(
        result.research.products[0]!.criteria[0]!.assessment.rationale,
      ).toBe(rationale);
      expect(result.research.summary).not.toContain(rationale.slice(0, 400));
    },
  );

  it("keeps v4 choice explanations within the assessment bound and frozen v3 at its old bound", () => {
    const choice = {
      productId: "aster-pure",
      reasons: [
        {
          assessmentId: "criterion-1",
          explanation: rationale.padEnd(600, " "),
        },
      ],
      caveat: "Synthetic fixture.",
    };
    expect(ConditionalChoiceSchema.safeParse(choice).success).toBe(true);
    expect(Version3ChoiceSchema.safeParse(choice).success).toBe(false);
    choice.reasons[0]!.explanation += "x";
    expect(ConditionalChoiceSchema.safeParse(choice).success).toBe(false);
  });

  it("still rejects a provider rationale above the assessment limit", async () => {
    const payload = syntheticAnswer();
    payload.answer.products[0]!.criteria[0]!.assessment.rationale =
      rationale.padEnd(601, " ");
    expect(await research(payload)).toMatchObject({
      status: "unavailable",
      reason: "invalid-response",
    });
  });
});
