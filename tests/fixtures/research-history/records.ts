import { randomUUID } from "node:crypto";
import capture from "./unversioned-application-response.json" with { type: "json" };
import legacySnapshot from "./unversioned-browser-snapshot.json" with { type: "json" };
import version2Snapshot from "./version2-browser-snapshot.json" with { type: "json" };
import { ApplicationTurnResponseSchema } from "../../../src/domain/research";

export const legacyBrowserResponse = {
  ...capture,
  answer:
    "These source-backed research leads are worth comparing. Prices are page observations; current affordability, stock and delivery need verification.",
  research: legacySnapshot,
};
export const version2Response = ApplicationTurnResponseSchema.parse({
  ...capture,
  answer: "Automated fixture research leads. No current product evidence.",
  preferences: {
    ...capture.preferences,
    hard: {
      ...capture.preferences.hard,
      budget: { amount: 250, currency: "SGD" },
    },
  },
  research: version2Snapshot,
});

export function storedResearchTurn(value: unknown) {
  return {
    id: randomUUID(),
    operationId: randomUUID(),
    digest: "a".repeat(64),
    createdAt: new Date().toISOString(),
    message: "Historical fixture research",
    request: {
      message: "Historical fixture research",
      preferences: structuredClone(capture.preferences),
    },
    body: { status: "complete", value },
  };
}
