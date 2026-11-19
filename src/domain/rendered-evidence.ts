import type { RenderableResearch } from "./conversation";

type Support = RenderableResearch["products"][number]["identity"]["support"][number];
export function evidenceContext(support: Support): string {
  return "context" in support ? support.context.text : support.quote;
}
export function evidenceLabel(support: Support): string {
  if (!("origin" in support)) return "Historical literal source passage.";
  if (support.origin.kind === "source-context") return "Source context found independently of the provider quotation.";
  return support.origin.match === "whitespace"
    ? "Literal source passage. Provider wording differs only in whitespace."
    : "Literal source passage matching the provider quotation.";
}
