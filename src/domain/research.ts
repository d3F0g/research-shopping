import type { DeepReadonly, ShoppingIntent } from "./conversation";
import type { Assessment, ResearchProduct, ResearchSnapshot } from "./research-history-v4";
export { SupportSchema, AssessmentSchema, SourceSchema, ProductSchema, ResearchSnapshotSchema } from "./research-history-v4";
export type { Assessment, ResearchSource, ResearchProduct, ResearchSnapshot, CatalogPriceObservation } from "./research-history-v4";
export type ResearchUnavailableReason =
  | "not-configured"
  | "disabled"
  | "quota"
  | "busy"
  | "duplicate"
  | "timeout"
  | "provider-error"
  | "invalid-response"
  | "empty"
  | "stale";
export type ResearchOperation = (
  request: { intent: ShoppingIntent },
  signal: AbortSignal,
) => Promise<
  | { status: "ready"; research: ResearchSnapshot }
  | {
      status: "unavailable";
      reason: ResearchUnavailableReason;
      reportedCostUsd?: number;
    }
>;

export function supportedExactly(value: DeepReadonly<Assessment>): boolean {
  return (
    value.status === "supported" &&
    value.scope === "exact-variant" &&
    value.support.length > 0
  );
}

export function assessProduct<Product extends DeepReadonly<ResearchProduct>>(
  product: Product,
  intent: ShoppingIntent,
): Product & { eligible: boolean; blockers: string[] } {
  const blockers: string[] = [];
  if (!product.variant || !supportedExactly(product.identity))
    blockers.push("Exact product identity and variant remain unproven.");
  if (!supportedExactly(product.requestMatch))
    blockers.push("Fit to the complete shopping objective remains unresolved.");
  for (const requirement of intent.requirements.filter(
    (r) => r.strength === "hard",
  )) {
    const assessment = product.requirements.find(
      (row) => row.requirementId === requirement.id,
    )?.assessment;
    if (!assessment || !supportedExactly(assessment))
      blockers.push(`${requirement.text} (${assessment?.status ?? "unknown"})`);
  }
  if (intent.budget) {
    const p = product.price;
    if (
      !p ||
      !supportedExactly(p.assessment) ||
      p.variant !== product.variant ||
      !p.conditionsResolved
    )
      blockers.push("An applicable exact-variant price is unverified.");
    else if (
      p.currency !== intent.budget.currency ||
      (intent.budget.minimum !== undefined &&
        p.amount < intent.budget.minimum) ||
      (intent.budget.maximum !== undefined && p.amount > intent.budget.maximum)
    )
      blockers.push(
        "Observed price does not meet both budget bounds and explicit currency.",
      );
  }
  return { ...product, eligible: blockers.length === 0, blockers };
}
