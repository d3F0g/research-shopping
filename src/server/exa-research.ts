import Exa, { ExaTimeoutError } from "exa-js";
import { z } from "zod";
import { catalog, type CatalogId } from "../domain/catalog";
import {
  isSafeWebResearchUrl,
  WebResearchResponseSchema,
  type ShortlistResearchRequest,
  type WebResearchOperation,
  type WebResearchResponse,
  type WebResearchSource,
} from "../domain/web-research";

const WEB_RESEARCH_DEADLINE_MS = 5_000;
const MAX_RESULTS = 10;
const MAX_TITLE_LENGTH = 180;
const MAX_URL_LENGTH = 2_048;
const MAX_HIGHLIGHTS_PER_RESULT = 3;
const MAX_HIGHLIGHT_LENGTH = 640;
const MAX_HIGHLIGHT_SCAN_LENGTH = 16_384;
const MAX_TOTAL_HIGHLIGHT_BYTES = 8_192;
const textEncoder = new TextEncoder();

const ExaResponseSchema = z.object({ results: z.array(z.unknown()) });
const ExaResultSchema = z.object({
  title: z.string().nullable(),
  url: z.string(),
  highlights: z.array(z.string()).optional(),
});

type ExaResearchOptions = { baseUrl?: string; timeoutMs?: number };

function unavailable(reason: "timeout" | "provider-error" | "invalid-response"): WebResearchResponse {
  return { status: "unavailable", reason };
}

function safeUrl(raw: string): string | null {
  if (raw.length > MAX_URL_LENGTH || !isSafeWebResearchUrl(raw)) return null;
  return new URL(raw).href;
}

function cleanText(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
}

function boundedTitle(raw: string | null, hostname: string): { title: string; truncated: boolean } {
  const cleaned = raw === null ? "" : cleanText(raw);
  if (!cleaned) return { title: hostname, truncated: false };
  return {
    title: cleaned.slice(0, MAX_TITLE_LENGTH),
    truncated: cleaned.length > MAX_TITLE_LENGTH,
  };
}

function boundedHighlight(raw: string, remainingBytes: number) {
  const scan = raw.slice(0, MAX_HIGHLIGHT_SCAN_LENGTH);
  const normalized = cleanText(scan);
  let value = "";
  let bytes = 0;
  let truncated = raw.length > scan.length;

  for (const character of normalized) {
    const characterBytes = textEncoder.encode(character).byteLength;
    if (value.length + character.length > MAX_HIGHLIGHT_LENGTH || bytes + characterBytes > remainingBytes) {
      truncated = true;
      break;
    }
    value += character;
    bytes += characterBytes;
  }

  if (value.length < normalized.length) truncated = true;
  return { value, bytes, truncated };
}

function projectResults(response: unknown): WebResearchResponse {
  const parsedResponse = ExaResponseSchema.safeParse(response);
  if (!parsedResponse.success) return unavailable("invalid-response");

  let truncated = parsedResponse.data.results.length > MAX_RESULTS;
  let totalHighlightBytes = 0;
  const results: WebResearchSource[] = [];

  for (const rawResult of parsedResponse.data.results.slice(0, MAX_RESULTS)) {
    const parsedResult = ExaResultSchema.safeParse(rawResult);
    if (!parsedResult.success) return unavailable("invalid-response");

    const url = safeUrl(parsedResult.data.url);
    if (!url) {
      truncated = true;
      continue;
    }

    const title = boundedTitle(parsedResult.data.title, new URL(url).hostname);
    truncated ||= title.truncated;
    const highlights: string[] = [];
    const rawHighlights = parsedResult.data.highlights ?? [];
    if (rawHighlights.length > MAX_HIGHLIGHTS_PER_RESULT) truncated = true;

    for (const rawHighlight of rawHighlights.slice(0, MAX_HIGHLIGHTS_PER_RESULT)) {
      const bounded = boundedHighlight(rawHighlight, MAX_TOTAL_HIGHLIGHT_BYTES - totalHighlightBytes);
      if (bounded.value) highlights.push(bounded.value);
      totalHighlightBytes += bounded.bytes;
      truncated ||= bounded.truncated;
    }

    results.push({ title: title.title, url, highlights });
  }

  const safeResponse = WebResearchResponseSchema.safeParse({
    status: "ready",
    retrievedAt: new Date().toISOString(),
    results,
    truncated,
  });
  return safeResponse.success ? safeResponse.data : unavailable("invalid-response");
}

function researchQuery(request: ShortlistResearchRequest): { query: string; objective: string } | null {
  const products = request.productIds.map((productId) => catalog[productId as CatalogId]);
  if (products.some((product) => !product)) return null;

  const names = products.flatMap((product) => product ? [product.name] : []);
  if (names.length !== request.productIds.length) return null;
  const context = [
    request.preferences.hard.category,
    request.preferences.hard.requiredFeatures.join(" "),
    request.preferences.soft.useCase,
    request.preferences.soft.priorities.join(" "),
  ].filter(Boolean).join(" ");

  return {
    query: `Product information and independent reviews for ${names.join(", ")}${context ? ` considering ${context}` : ""}`,
    objective: "Find useful feature and tradeoff context for these shortlisted products and the shopper's stated needs. Prioritize manufacturer documentation and substantive independent reviews. Exclude checkout, current prices, and inventory claims.",
  };
}

export function createExaWebResearch(apiKey: string, options: ExaResearchOptions = {}): WebResearchOperation {
  const key = apiKey.trim();
  if (!key) throw new Error("An Exa API key is required");

  const exa = new Exa(key, options.baseUrl, { warnings: "silent" });
  const timeoutMs = options.timeoutMs ?? WEB_RESEARCH_DEADLINE_MS;

  return async (request, signal) => {
    const search = researchQuery(request);
    if (!search) return unavailable("invalid-response");

    try {
      const response = await exa.search(
        search.query,
        { objective: search.objective, contents: { highlights: true } },
        { signal, timeout: timeoutMs },
      );
      return projectResults(response);
    } catch (error) {
      if (signal.aborted) throw error;
      return unavailable(error instanceof ExaTimeoutError ? "timeout" : "provider-error");
    }
  };
}

export function createExaWebResearchFromEnvironment(
  environment: NodeJS.ProcessEnv,
): WebResearchOperation | undefined {
  const mayCompose = environment.NODE_ENV === "development" || environment.NODE_ENV === "test";
  if (!mayCompose || environment.EXA_RESEARCH_ENABLED === "false") return undefined;
  const apiKey = environment.EXA_API_KEY?.trim();
  if (!apiKey) return undefined;
  return createExaWebResearch(apiKey);
}
