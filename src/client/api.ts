import {
  SelectionResultSchema,
  type Preferences,
  type ProductId,
} from "../domain/contracts";
import { ApplicationTurnResponseSchema } from "../domain/research";
import { isSafeCatalogHandoff } from "../domain/merchant-links";
import {
  WebResearchResponseSchema,
  type ShortlistResearchRequest,
} from "../domain/web-research";

export async function runTurn(
  message: string,
  preferences: Preferences,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, preferences, operationId: crypto.randomUUID() }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Research could not finish. Check the connection and try again.");
  }
  if (!response.ok) throw new Error("Research could not finish. Try again.");
  const result = ApplicationTurnResponseSchema.safeParse(await response.json());
  if (!result.success) throw new Error("The research service returned an unreadable result.");
  return result.data;
}

export async function selectProduct(
  productId: ProductId,
  preferences: Preferences,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, preferences }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("A sample handoff is unavailable. Check the connection and try again.");
  }
  if (!response.ok) throw new Error("A fresh sample handoff is unavailable. Try the selection again.");
  const result = SelectionResultSchema.safeParse(await response.json());
  if (!result.success) throw new Error("The selection service returned an unreadable result.");
  if (result.data.kind === "handoff" && (
    result.data.productId !== productId
    || !isSafeCatalogHandoff(result.data.productId, result.data.productName, result.data.productUrl, result.data.offer)
  )) throw new Error("The selection service returned an unsafe product link.");
  return result.data;
}

export async function researchShortlist(
  request: ShortlistResearchRequest,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/research", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Web research could not finish. Check the connection and try again.");
  }
  if (!response.ok) throw new Error("Web research could not finish. Try again.");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Web research returned an unreadable result.");
  }
  const result = WebResearchResponseSchema.safeParse(payload);
  if (!result.success) throw new Error("Web research returned an unreadable result.");
  return result.data;
}
