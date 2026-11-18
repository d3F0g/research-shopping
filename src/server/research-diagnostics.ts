import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import type { EvidenceDecision } from "./page-evidence";

export type ResearchDiagnosticSink = string | ((artifact: string) => void | Promise<void>);
export type ResearchDiagnostic = {
  schemaStatus: string;
  extractionStatus: string;
  requestId: string;
  reportedCostUsd: number | null;
  resultCount: number;
  notices: string[];
  warnings: string[];
  decisions: EvidenceDecision[];
  nativeContent: unknown;
  results: { title: string | null; url: string; highlights?: string[] }[];
};
const MAX_BYTES = 128 * 1024;

export function researchDiagnosticPath(environment: NodeJS.ProcessEnv): string | undefined {
  const path = environment.EXA_RESEARCH_DIAGNOSTIC_PATH;
  return environment.NODE_ENV === "development" && path && isAbsolute(path) ? path : undefined;
}

function boundedText(value: string, byteLimit: number) {
  const originalBytes = Buffer.byteLength(value);
  let text = value;
  if (originalBytes > byteLimit) {
    text = Buffer.from(value).subarray(0, byteLimit).toString("utf8").replace(/\uFFFD$/, "");
  }
  return { text, originalLength: value.length, originalBytes, truncated: text.length !== value.length, sha256: createHash("sha256").update(value).digest("hex") };
}

function serialize(diagnostic: ResearchDiagnostic): string {
  const decisions = [...diagnostic.decisions].sort((a, b) => Number(b.code === "admitted") - Number(a.code === "admitted")).slice(0, 120);
  const artifact = {
    schemaVersion: 1,
    retention: "Opt-in bounded diagnostic. Truncated fields are not the complete provider response.",
    schemaStatus: diagnostic.schemaStatus,
    extractionStatus: diagnostic.extractionStatus,
    requestId: diagnostic.requestId,
    reportedCostUsd: diagnostic.reportedCostUsd,
    resultCount: diagnostic.resultCount,
    notices: diagnostic.notices.slice(0, 30), warnings: diagnostic.warnings.slice(0, 30),
    decisions, decisionsTruncated: diagnostic.decisions.length > decisions.length,
    decisionSpans: decisions.filter((decision) => decision.highlight !== undefined && decision.start !== undefined)
      .slice(0, 25).map((decision) => ({
        sourceIndex: decision.sourceIndex, highlight: decision.highlight, start: decision.start,
        ...boundedText(diagnostic.results[decision.sourceIndex]?.highlights?.[decision.highlight!]?.slice(decision.start, decision.end ?? decision.start! + 640) ?? "", 1500),
      })),
    native: { kind: typeof diagnostic.nativeContent === "string" ? "string" : diagnostic.nativeContent === undefined ? "missing" : Array.isArray(diagnostic.nativeContent) ? "array" : diagnostic.nativeContent === null ? "null" : typeof diagnostic.nativeContent,
      encoding: typeof diagnostic.nativeContent === "string" ? "text" : "json",
      ...boundedText(typeof diagnostic.nativeContent === "string" ? diagnostic.nativeContent : JSON.stringify(diagnostic.nativeContent) ?? "", 24_000) },
    results: [] as { sourceIndex: number; title: ReturnType<typeof boundedText>; url: ReturnType<typeof boundedText>; highlightCount: number; highlights: { highlight: number; text: string; originalLength: number; originalBytes: number; truncated: boolean; sha256: string }[] }[],
  };
  for (const [sourceIndex, result] of diagnostic.results.slice(0, 5).entries()) {
    const source = { sourceIndex, title: boundedText(result.title ?? "", 720), url: boundedText(result.url, 2048), highlightCount: result.highlights?.length ?? 0, highlights: [] as typeof artifact.results[number]["highlights"] };
    artifact.results.push(source);
    for (const [highlight, value] of (result.highlights ?? []).slice(0, 6).entries()) {
      const remaining = MAX_BYTES - Buffer.byteLength(JSON.stringify(artifact)) - 2048;
      source.highlights.push({ highlight, ...boundedText(value, Math.max(0, Math.min(8192, Math.floor(remaining / 6)))) });
    }
  }
  let serialized = JSON.stringify(artifact);
  while (Buffer.byteLength(serialized) > MAX_BYTES) {
    const longest = [...artifact.results.flatMap((source) => source.highlights), artifact.native, ...artifact.decisionSpans].sort((a, b) => b.text.length - a.text.length)[0];
    if (!longest?.text.length) throw new Error("Diagnostic metadata exceeds byte budget");
    longest.text = longest.text.slice(0, Math.floor(longest.text.length / 2));
    longest.truncated = true;
    serialized = JSON.stringify(artifact);
  }
  return serialized;
}

export async function writeResearchDiagnostic(sink: ResearchDiagnosticSink, diagnostic: ResearchDiagnostic, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const artifact = serialize(diagnostic);
    const write = Promise.resolve().then(async () => {
      if (typeof sink === "function") await sink(artifact);
      else {
        if (!isAbsolute(sink)) return;
        const file = await open(sink, "wx", 0o600);
        try { await file.writeFile(artifact); } finally { await file.close(); }
      }
    });
    const stop = new Promise<void>((resolve) => {
      onAbort = resolve;
      signal.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(resolve, 500);
    });
    await Promise.race([write, stop]);
  } catch {
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (timer) clearTimeout(timer);
  }
  signal.throwIfAborted();
}
