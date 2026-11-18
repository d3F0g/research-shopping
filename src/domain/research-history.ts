import { z } from "zod";
import { ApplicationTurnResponseSchema } from "./research";
import { Version2ResearchResponseSchema } from "./research-evidence-v2";
import { UnversionedResearchResponseSchema } from "./research-history-unversioned";

export const HistoricalApplicationTurnResponseSchema = z
  .unknown()
  .transform((raw, context) => {
    let schema:
      | typeof ApplicationTurnResponseSchema
      | typeof UnversionedResearchResponseSchema
      | typeof Version2ResearchResponseSchema = ApplicationTurnResponseSchema;
    if (
      typeof raw === "object" &&
      raw !== null &&
      "kind" in raw &&
      raw.kind === "research"
    ) {
      const research = "research" in raw ? raw.research : null;
      if (typeof research !== "object" || research === null) {
        context.addIssue({
          code: "custom",
          message: "Stored research is unreadable",
        });
        return z.NEVER;
      }
      if (!Object.hasOwn(research, "evidenceVersion")) {
        schema = UnversionedResearchResponseSchema;
      } else if (
        "evidenceVersion" in research &&
        research.evidenceVersion === 2
      ) {
        schema = Version2ResearchResponseSchema;
      } else {
        context.addIssue({
          code: "custom",
          message: "Stored research evidence version is unsupported",
        });
        return z.NEVER;
      }
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) context.addIssue({ ...issue });
      return z.NEVER;
    }
    return parsed.data;
  });

export type HistoricalApplicationTurnResponse = z.infer<
  typeof HistoricalApplicationTurnResponseSchema
>;
