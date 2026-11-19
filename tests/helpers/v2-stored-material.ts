import type { StoredResearchV2 } from "../../src/domain/workspace-history-v2";
import { initialConversation } from "../../src/domain/conversation";

export function storedResearchV2(): StoredResearchV2 {
  const text = "Fixture data: historical V2 evidence remains unchanged.";
  const assessment = { status: "unknown" as const, scope: "unclear" as const, rationale: "Fixture data: historical interpretation.", support: [{ sourceId: "fixture-old", originalQuote: "Fixture data", originalStart: 0, originalEnd: 12, quote: text, start: 0, end: text.length }] };
  return {
    version: 2, evidenceVersion: 2, dataKind: "test-fixture", retrievedAt: "2026-11-19T00:00:00.000Z", intent: initialConversation().intent,
    summary: "Fixture data: historical response.", products: [{ id: "fixture-old", name: "Fixture historical item", variant: null, identity: assessment, requestMatch: assessment, requirements: [], attributes: [], price: null, stock: "unverified", eligible: false, blockers: ["Fixture historical uncertainty."] }],
    choice: null, sources: [{ id: "fixture-old", url: "https://example.com/fixture-old", title: "Fixture historical source", text, originalLength: text.length, textTruncated: false }], limitations: ["Fixture data only."], requestId: "fixture-historical-request", reportedCostUsd: null,
  };
}
