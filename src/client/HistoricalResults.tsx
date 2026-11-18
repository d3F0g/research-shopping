import type { HistoricalApplicationTurnResponse } from "../domain/research-history";
import { LegacyResearchResults } from "./LegacyResearchResults";
import { LiveResearchResults } from "./LiveResearchResults";
import { Results } from "./ResearchResults";

export function HistoricalResults({
  outcome,
}: {
  outcome: HistoricalApplicationTurnResponse;
}) {
  if ("responseVersion" in outcome) {
    if (outcome.kind === "research" || outcome.kind === "research-unavailable")
      return <LiveResearchResults outcome={outcome} />;
    return <p className="ordinary-message">{outcome.message}</p>;
  }
  if (outcome.kind === "research" || outcome.kind === "research-unavailable")
    return <LegacyResearchResults outcome={outcome} />;
  return <Results outcome={outcome} />;
}
