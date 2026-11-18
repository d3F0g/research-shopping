import type { SyntheticChoiceReason } from "./dynamic-research";

export function withCurrentChoiceProtocol<
  T extends {
    answer: { choice: { productId: string; reasonIds: string[] } | null };
  },
>(payload: T) {
  const choice = payload.answer.choice;
  return {
    ...payload,
    answer: {
      ...payload.answer,
      choice: choice
        ? {
            productId: choice.productId,
            reasons: choice.reasonIds.map((id): SyntheticChoiceReason => {
              if (id === "request-match")
                return { kind: "field", name: "requestMatch" };
              if (id === "identity" || id === "budget" || id === "price")
                return { kind: "field", name: id };
              if (id.startsWith("attribute:"))
                return { kind: "attribute", name: id.slice(10) };
              return { kind: "criterion", criterionId: id };
            }),
          }
        : null,
    },
  };
}
