import { z } from "zod";
import {
  BudgetSchema,
  isWithinBudget,
  ShoppingIntentSchema,
  type ShoppingIntent,
  type TurnRequest,
} from "./contracts";
import { isSafeWebResearchUrl } from "./web-research";

const Id = z
  .string()
  .regex(/^[a-z0-9-]+$/)
  .max(80);
export const EvidenceSpanSchema = z.strictObject({
  sourceId: Id,
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  quote: z.string().min(1).max(2000),
});
export const AssessmentSchema = z
  .strictObject({
    status: z.enum(["supported", "unknown", "contradicted", "conflict"]),
    rationale: z.string().min(1).max(600),
    scope: z.enum(["exact-variant", "product-family", "unclear"]),
    support: z.array(EvidenceSpanSchema).max(2),
  })
  .superRefine((value, context) => {
    if (value.status !== "unknown" && !value.support.length)
      context.addIssue({
        code: "custom",
        message: "An assessment requires source evidence",
      });
    if (value.status === "conflict" && value.support.length < 2)
      context.addIssue({
        code: "custom",
        message: "Conflicting assessments require both observations",
      });
  });
export const ResearchSourceSchema = z.strictObject({
  id: Id,
  url: z.string().url().max(2048).refine(isSafeWebResearchUrl),
  title: z.string().max(500),
  titleTruncated: z.boolean(),
  text: z.string().max(24000),
  textTruncated: z.boolean(),
});
export const ObservedPriceSchema = z.strictObject({
  amount: BudgetSchema.shape.amount,
  currency: z.enum(["SGD", "USD"]),
  conditions: z.array(z.string().min(1).max(300)).max(6),
  conditionsResolved: z.boolean(),
  variant: z.string().min(1).max(160),
  assessment: AssessmentSchema,
});
export const ResearchProductSchema = z.strictObject({
  id: Id,
  name: z.string().min(1).max(160),
  variant: z.string().min(1).max(160).nullable(),
  identity: AssessmentSchema,
  requestMatch: AssessmentSchema,
  criteria: z
    .array(
      z.strictObject({
        criterionId: z.string().max(40),
        assessment: AssessmentSchema,
      }),
    )
    .max(12),
  attributes: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(80),
        assessment: AssessmentSchema,
      }),
    )
    .max(4),
  price: ObservedPriceSchema.nullable(),
  budget: AssessmentSchema.nullable(),
  stock: z.literal("unverified"),
  explanation: z
    .strictObject({
      reasons: z.array(z.string().min(1).max(100)).max(20),
      tradeoffs: z.array(z.string().min(1).max(100)).max(20),
    })
    .optional(),
});
export const ConditionalChoiceSchema = z.strictObject({
  productId: Id,
  reasons: z
    .array(
      z.strictObject({
        assessmentId: z.string().min(1).max(100),
        explanation: z.string().min(1).max(400),
      }),
    )
    .min(1)
    .max(4),
  caveat: z.string().min(1).max(600),
});
export const ResearchSnapshotSchema = z
  .strictObject({
    dataKind: z.literal("web-research"),
    evidenceVersion: z.literal(4),
    retrievedAt: z.string().datetime(),
    intent: ShoppingIntentSchema,
    summary: z.string().min(1).max(1200),
    products: z.array(ResearchProductSchema).max(3),
    choice: ConditionalChoiceSchema.nullable(),
    sources: z.array(ResearchSourceSchema).max(10),
    limitations: z.array(z.string().min(1).max(600)).max(12),
    requestId: z.string().max(180),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
  })
  .superRefine((snapshot, context) => {
    const sources = new Map(
      snapshot.sources.map((source) => [source.id, source]),
    );
    if (
      sources.size !== snapshot.sources.length ||
      new Set(snapshot.sources.map((source) => source.url)).size !==
        snapshot.sources.length
    )
      context.addIssue({ code: "custom", message: "Sources must be distinct" });
    if (
      new Set(snapshot.products.map((product) => product.id)).size !==
      snapshot.products.length
    )
      context.addIssue({
        code: "custom",
        message: "Products must be distinct",
      });
    for (const product of snapshot.products) {
      const assessments = [
        product.identity,
        product.requestMatch,
        ...product.criteria.map((item) => item.assessment),
        ...product.attributes.map((item) => item.assessment),
        ...(product.price ? [product.price.assessment] : []),
        ...(product.budget ? [product.budget] : []),
      ];
      for (const assessment of assessments)
        for (const span of assessment.support) {
          if (
            sources.get(span.sourceId)?.text.slice(span.start, span.end) !==
            span.quote
          )
            context.addIssue({
              code: "custom",
              message: "Evidence must be an exact retained source passage",
            });
        }
      if (
        product.criteria.length !== snapshot.intent.criteria.length ||
        new Set(product.criteria.map((row) => row.criterionId)).size !==
          product.criteria.length ||
        snapshot.intent.criteria.some(
          (criterion) =>
            !product.criteria.some((row) => row.criterionId === criterion.id),
        )
      )
        context.addIssue({
          code: "custom",
          message: "Every criterion requires an assessment",
        });
      if (Boolean(product.budget) !== Boolean(snapshot.intent.budget))
        context.addIssue({
          code: "custom",
          message: "Budget assessment must follow the intent",
        });
      if (product.explanation) {
        for (const [kind, ids] of Object.entries(product.explanation)) {
          if (new Set(ids).size !== ids.length)
            context.addIssue({
              code: "custom",
              message: "Explanation references must be distinct",
            });
          for (const id of ids) {
            const assessment = choiceAssessment(product, id);
            if (
              !assessment ||
              supportedExactly(assessment) !== (kind === "reasons") ||
              (kind === "reasons" &&
                id === "price" &&
                !qualifyingPrice(product, snapshot.intent))
            )
              context.addIssue({
                code: "custom",
                message:
                  "Explanation references must match supported reasons or unresolved assessments",
              });
          }
        }
      }
    }
    if (snapshot.choice) {
      const product = snapshot.products.find(
        (item) => item.id === snapshot.choice!.productId,
      );
      if (!product || !eligibleForChoice(product, snapshot.intent))
        context.addIssue({
          code: "custom",
          message: "Choice must satisfy all hard requirements",
        });
      for (const reason of snapshot.choice.reasons)
        if (
          !product ||
          !choiceAssessment(product, reason.assessmentId) ||
          choiceAssessment(product, reason.assessmentId)?.status !==
            "supported" ||
          choiceAssessment(product, reason.assessmentId)?.scope !==
            "exact-variant" ||
          (reason.assessmentId === "price" &&
            !qualifyingPrice(product, snapshot.intent))
        )
          context.addIssue({
            code: "custom",
            message: "Choice reasons must reference supported assessments",
          });
    }
  });
export const ResearchUnavailableReasonSchema = z.enum([
  "not-configured",
  "disabled",
  "quota",
  "busy",
  "duplicate",
  "timeout",
  "provider-error",
  "invalid-response",
  "empty",
]);
const ResponseBase = {
  responseVersion: z.literal(4),
  preferences: ShoppingIntentSchema,
  notes: z.array(z.string().max(600)).max(12),
};
export const ApplicationTurnResponseSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...ResponseBase,
    kind: z.literal("question"),
    question: z.literal("budget"),
    message: z.string().min(1).max(600),
  }),
  z.strictObject({
    ...ResponseBase,
    kind: z.literal("research"),
    answer: z.string().min(1).max(1200),
    research: ResearchSnapshotSchema,
  }),
  z.strictObject({
    ...ResponseBase,
    kind: z.literal("research-unavailable"),
    message: z.string().min(1).max(600),
    reason: ResearchUnavailableReasonSchema,
  }),
  z.strictObject({
    ...ResponseBase,
    kind: z.literal("message"),
    message: z.string().min(1).max(600),
  }),
  z.strictObject({
    ...ResponseBase,
    kind: z.literal("clarification"),
    message: z.string().min(1).max(600),
    reason: z.enum([
      "constraint",
      "feedback",
      "currency",
      "budget",
      "description",
    ]),
  }),
]);
export const PreparedTurnResponseSchema = z.strictObject({
  kind: z.literal("prepared"),
  preferences: ShoppingIntentSchema,
  notes: z.array(z.string().max(600)).max(12),
});
export const TurnTransportResponseSchema = z.union([
  PreparedTurnResponseSchema,
  ApplicationTurnResponseSchema,
]);
export type PreparedTurnResponse = z.infer<typeof PreparedTurnResponseSchema>;
export type TurnTransportResponse = z.infer<typeof TurnTransportResponseSchema>;
export type Assessment = z.infer<typeof AssessmentSchema>;
export type EvidenceSpan = z.infer<typeof EvidenceSpanSchema>;
export type ResearchSource = z.infer<typeof ResearchSourceSchema>;
export type ResearchSnapshot = z.infer<typeof ResearchSnapshotSchema>;
export type ResearchProduct = z.infer<typeof ResearchProductSchema>;
export type ApplicationTurnResponse = z.infer<
  typeof ApplicationTurnResponseSchema
>;
export type ResearchUnavailableReason = z.infer<
  typeof ResearchUnavailableReasonSchema
>;
export type ResearchOperation = (
  request: { preferences: ShoppingIntent },
  signal: AbortSignal,
) => Promise<
  | { status: "ready"; research: ResearchSnapshot }
  | {
      status: "unavailable";
      reason: ResearchUnavailableReason;
      reportedCostUsd?: number;
    }
>;
export type ResearchTurns = {
  turn(
    request: TurnRequest,
    signal: AbortSignal,
  ): Promise<TurnTransportResponse>;
};
export function choiceAssessment(
  product: ResearchProduct,
  id: string,
): Assessment | undefined {
  if (id === "identity") return product.identity;
  if (id === "request-match") return product.requestMatch;
  if (id === "budget") return product.budget ?? undefined;
  if (id === "price") return product.price?.assessment;
  const criterion = product.criteria.find((row) => row.criterionId === id);
  if (criterion) return criterion.assessment;
  const attributes = product.attributes.filter(
    (row) => `attribute:${row.name}` === id,
  );
  return attributes.length === 1 ? attributes[0]!.assessment : undefined;
}
function supportedExactly(assessment: Assessment | undefined | null): boolean {
  return (
    assessment?.status === "supported" && assessment.scope === "exact-variant"
  );
}
export function qualifyingPrice(
  product: ResearchProduct,
  intent: ShoppingIntent,
): boolean {
  const price = product.price;
  return Boolean(
    price &&
      supportedExactly(price.assessment) &&
      price.conditionsResolved &&
      price.variant === product.variant &&
      (!intent.budget ||
        (price.currency === intent.budget.currency &&
          isWithinBudget(price.amount, intent.budget))),
  );
}
export function eligibleForChoice(
  product: ResearchProduct,
  intent: ShoppingIntent,
): boolean {
  return Boolean(
    product.variant &&
      supportedExactly(product.identity) &&
      supportedExactly(product.requestMatch) &&
      intent.criteria
        .filter((item) => item.strength === "hard")
        .every((criterion) =>
          supportedExactly(
            product.criteria.find((row) => row.criterionId === criterion.id)
              ?.assessment,
          ),
        ) &&
      (!intent.budget ||
        (supportedExactly(product.budget) && qualifyingPrice(product, intent))),
  );
}

export type ChoiceHint =
  | { status: "absent" | "invalid" }
  | { status: "valid"; choice: z.infer<typeof ConditionalChoiceSchema> };

export function assessResearch(
  products: ResearchProduct[],
  intent: ShoppingIntent,
  hint: ChoiceHint,
): Pick<ResearchSnapshot, "products" | "choice" | "summary"> {
  const candidates = products.map((product) => {
    const flexible = new Set(
      intent.criteria
        .filter(
          (criterion) =>
            criterion.strength === "flexible" &&
            supportedExactly(choiceAssessment(product, criterion.id)),
        )
        .map((criterion) => criterion.id),
    );
    const ids = [
      ...flexible,
      "request-match",
      ...intent.criteria
        .filter((criterion) => criterion.strength === "hard")
        .map((criterion) => criterion.id),
      "budget",
      "identity",
      "price",
      ...product.attributes.map((attribute) => `attribute:${attribute.name}`),
      ...intent.criteria
        .filter(
          (criterion) =>
            criterion.strength === "flexible" && !flexible.has(criterion.id),
        )
        .map((criterion) => criterion.id),
    ];
    const explanation: NonNullable<ResearchProduct["explanation"]> = {
      reasons: [],
      tradeoffs: [],
    };
    for (const id of new Set(ids)) {
      const assessment = choiceAssessment(product, id);
      if (!assessment) continue;
      if (!supportedExactly(assessment)) explanation.tradeoffs.push(id);
      else if (id !== "price" || qualifyingPrice(product, intent))
        explanation.reasons.push(id);
    }
    return {
      product: { ...product, explanation },
      eligible: eligibleForChoice(product, intent),
      relevant: supportedExactly(product.requestMatch),
      flexible,
    };
  });
  type Candidate = (typeof candidates)[number];
  const dominates = (left: Candidate, right: Candidate) => {
    if (left.eligible !== right.eligible) return left.eligible;
    if (left.relevant !== right.relevant) return left.relevant;
    return (
      left.flexible.size > right.flexible.size &&
      [...right.flexible].every((id) => left.flexible.has(id))
    );
  };
  const tiers: Candidate[][] = [];
  let remaining = candidates;
  while (remaining.length) {
    const tier = remaining.filter(
      (candidate) => !remaining.some((other) => dominates(other, candidate)),
    );
    tiers.push(tier);
    remaining = remaining.filter((candidate) => !tier.includes(candidate));
  }
  const strongest = (tiers[0] ?? []).filter((candidate) => candidate.eligible);
  const selected =
    hint.status === "invalid"
      ? undefined
      : strongest.length === 1
        ? strongest[0]
        : hint.status === "valid"
          ? strongest.find(
              (candidate) => candidate.product.id === hint.choice.productId,
            )
          : undefined;
  const choice = selected
    ? hint.status === "valid" && hint.choice.productId === selected.product.id
      ? hint.choice
      : {
          productId: selected.product.id,
          reasons: selected.product.explanation.reasons
            .slice(0, 4)
            .map((id) => ({
              assessmentId: id,
              explanation: choiceAssessment(
                selected.product,
                id,
              )!.rationale.slice(0, 400),
            })),
          caveat:
            "Source-based AI interpretation. Confirm the exact variant, all price conditions and current merchant stock before buying.",
        }
    : null;
  const ordering =
    "Order reflects hard eligibility, exact request match and source-supported preferences. Original order within tied evidence tiers does not imply superiority.";
  const summary =
    choice && selected
      ? `My conditional choice is ${selected.product.name}. ${strongest.length > 1 ? "The strongest options are tied on preference evidence; this choice uses the source-based research suggestion. " : ""}${choice.reasons.map((reason) => reason.explanation).join(" ")}`.slice(
          0,
          900,
        )
      : !strongest.length
        ? "I could not establish an option that meets every hard requirement. Compare the sourced assessments and check the unresolved details before choosing."
        : hint.status === "invalid"
          ? "Eligible options are available, but the research suggestion contained an unresolved evidence reference. No conditional choice is established."
          : "Eligible options are tied or have incomplete preference evidence. Compare their tradeoffs before choosing; the evidence does not establish one strongest option.";
  return {
    products: tiers.flat().map((candidate) => candidate.product),
    choice,
    summary: `${summary} ${ordering}`,
  };
}
