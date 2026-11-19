import type { ConversationState, TurnResponse } from "../../src/domain/conversation";
import type { CaseResult as HistoricalCase, Observation as HistoricalObservation, RunReport as HistoricalReport } from "../frozen-v4/contracts";

export const ADAPTER_VERSION = "fieldnote-v2-http-1.0.0";
export const ASSERTION_VERSION = "fieldnote-v2-grounded-1.1.0";
export type RawTurn = { index: number; before: ConversationState; after: ConversationState; response: TurnResponse | null };
export type Observation = HistoricalObservation & { rawInitialState: ConversationState; rawTurns: RawTurn[] };
export type CaseResult = Omit<HistoricalCase, "observation"> & { observation: Observation | null };
export type RunReport = Omit<HistoricalReport, "schemaVersion" | "cases" | "configuration"> & {
  schemaVersion: 5;
  cases: CaseResult[];
  configuration: Omit<HistoricalReport["configuration"], "interpretationMode"> & { interpretationMode: "local-only" };
};
