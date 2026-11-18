import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import { isAbsolute } from "node:path";
type EvidenceDecision = { sourceIndex: number; path: string; code: string; field?: string; highlight?: number; start?: number; end?: number };

export type ResearchDiagnosticSink = string | ((artifact: string) => void | Promise<void>);
export type ResearchDiagnostic = {
  endpoint: "search" | "answer";
  schemaStatus: string;
  extractionStatus: string;
  requestId: string;
  reportedCostUsd: number | null;
  resultCount: number;
  notices: (string | number | null)[];
  warnings: (string | number | null)[];
  validationIssues: { path: string; code: string }[];
  decisions: EvidenceDecision[];
  nativeContent: unknown;
  results: { title: string | null; url: string; highlights?: string[]; text?: string }[];
};
const MAX_BYTES = 128 * 1024;

export function researchDiagnosticPath(environment: NodeJS.ProcessEnv): string | undefined {
  const path = environment.EXA_RESEARCH_DIAGNOSTIC_PATH;
  return environment.NODE_ENV === "development" && path && isAbsolute(path) ? path : undefined;
}

export function captureResearchDiagnostic(raw: unknown, endpoint: "search" | "answer" = "search"): ResearchDiagnostic {
  const object = (value: unknown): Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const envelope = object(raw);
  const output = object(envelope.output);
  const cost = object(envelope.costDollars).total;
  const rawResults = endpoint === "answer" ? envelope.citations : envelope.results;
  const results = Array.isArray(rawResults) ? rawResults : [];
  const codes = (value: unknown) => Array.isArray(value) ? value.slice(0, 30).map((item) => {
    const code = object(item).code;
    return typeof code === "string" ? code.slice(0, 160) : typeof code === "number" && Number.isFinite(code) ? code : null;
  }) : [];
  return {
    endpoint, schemaStatus: "invalid", extractionStatus: "unavailable",
    requestId: typeof envelope.requestId === "string" ? envelope.requestId.slice(0, 180) : "",
    reportedCostUsd: typeof cost === "number" && Number.isFinite(cost) && cost >= 0 ? cost : null,
    resultCount: results.length, notices: codes(envelope.notices), warnings: codes(envelope.warnings),
    decisions: [], validationIssues: [], nativeContent: endpoint === "answer" ? envelope.answer : output.content,
    results: results.slice(0, 10).map((value) => {
      const source = object(value);
      return {
        title: typeof source.title === "string" ? source.title : null,
        url: typeof source.url === "string" ? source.url : "",
        ...(typeof source.text === "string" ? { text: source.text } : {}),
        highlights: Array.isArray(source.highlights) ? source.highlights.map((highlight) => typeof highlight === "string" ? highlight : "") : [],
      };
    }),
  };
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
    schemaVersion: 2, endpoint: diagnostic.endpoint,
    retention: "Opt-in bounded diagnostic. Truncated fields are not the complete provider response.",
    schemaStatus: diagnostic.schemaStatus,
    extractionStatus: diagnostic.extractionStatus,
    validationIssues: diagnostic.validationIssues.slice(0, 30),
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
    results: [] as { sourceIndex: number; title: ReturnType<typeof boundedText>; url: ReturnType<typeof boundedText>; highlightCount: number; text?: ReturnType<typeof boundedText>; highlights: { highlight: number; text: string; originalLength: number; originalBytes: number; truncated: boolean; sha256: string }[] }[],
  };
  for (const [sourceIndex, result] of diagnostic.results.slice(0, 10).entries()) {
    const source = { sourceIndex, title: boundedText(result.title ?? "", 720), url: boundedText(result.url, 2048), highlightCount: result.highlights?.length ?? 0, highlights: [] as typeof artifact.results[number]["highlights"] };
    artifact.results.push(source);
    if (result.text !== undefined) artifact.results[artifact.results.length - 1]!.text = boundedText(result.text, 8192);
    for (const [highlight, value] of (result.highlights ?? []).slice(0, 6).entries()) {
      const remaining = MAX_BYTES - Buffer.byteLength(JSON.stringify(artifact)) - 2048;
      source.highlights.push({ highlight, ...boundedText(value, Math.max(0, Math.min(8192, Math.floor(remaining / 6)))) });
    }
  }
  let serialized = JSON.stringify(artifact);
  while (Buffer.byteLength(serialized) > MAX_BYTES) {
    const longest = [...artifact.results.flatMap((source) => [...source.highlights, ...(source.text ? [source.text] : []), source.title, source.url]), artifact.native, ...artifact.decisionSpans].sort((a, b) => b.text.length - a.text.length)[0];
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
