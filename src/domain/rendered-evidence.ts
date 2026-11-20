import type { RenderableResearch } from "./conversation";

type Support = RenderableResearch["products"][number]["identity"]["support"][number];
export function evidenceContext(support: Support, sources: RenderableResearch["sources"] = []): string {
  if (!("context" in support)) return support.quote;
  if ("text" in support.context) return support.context.text;
  return sources.find((source) => source.id === support.sourceId)?.text.slice(support.context.start, support.context.end) ?? "";
}
export function evidenceLabel(support: Support): string {
  if (!("origin" in support)) return "Historical literal source passage.";
  if (support.origin.kind === "source-context") return "Source context found independently of the provider quotation.";
  return support.origin.match === "whitespace"
    ? "Literal source passage. Provider wording differs only in whitespace."
    : "Literal source passage matching the provider quotation.";
}
