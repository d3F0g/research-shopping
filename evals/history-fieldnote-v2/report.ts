import { createHash } from "node:crypto";
import type { CaseResult, Observation, RunReport } from "../frozen-v4/contracts";
import { historicalReportArchive, additionalArchivedReports } from "./archive";

type HistoricalObservation = Observation & { rawInitialState: unknown; rawTurns: { index: number; before: unknown; after: unknown; response: unknown }[] };
type HistoricalCase = Omit<CaseResult, "observation"> & { observation: HistoricalObservation | null };
export type HistoricalFieldnoteReport = Omit<RunReport, "schemaVersion" | "cases" | "configuration"> & { schemaVersion: 5; cases: HistoricalCase[]; configuration: Omit<RunReport["configuration"], "interpretationMode"> & { interpretationMode: "local-only" } };

export function historicalReportDigest(report: unknown): string {
  const canonical = JSON.stringify(report, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateHistoricalFieldnoteReport(report: HistoricalFieldnoteReport): void {
  if (report.schemaVersion !== 5 || !((report.adapterVersion === "fieldnote-v2-http-1.0.0" && ["fieldnote-v2-grounded-1.0.0", "fieldnote-v2-grounded-1.1.0"].includes(report.assertionVersion)) || (report.adapterVersion === "fieldnote-v2-http-1.1.0" && report.assertionVersion === "fieldnote-v2-grounded-1.2.0"))) throw new Error("Unknown historical Fieldnote report contract");
  const digest = historicalReportDigest(report);
  if (![...historicalReportArchive.reports, ...additionalArchivedReports].some((entry) => entry.sha256 === digest)) throw new Error("Historical archive digest is unknown or the recorded payload changed");
}
