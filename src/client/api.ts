import {
  AccountStateSchema,
  WorkspaceResultSchema,
  type WorkspaceCommand,
} from "../domain/workspace";
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
      body: JSON.stringify({
        message,
        preferences,
        operationId: crypto.randomUUID(),
      }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Research could not finish. Check the connection and try again.",
    );
  }
  if (!response.ok) throw new Error("Research could not finish. Try again.");
  const result = ApplicationTurnResponseSchema.safeParse(await response.json());
  if (!result.success)
    throw new Error("The research service returned an unreadable result.");
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
    throw new Error(
      "A sample handoff is unavailable. Check the connection and try again.",
    );
  }
  if (!response.ok)
    throw new Error(
      "A fresh sample handoff is unavailable. Try the selection again.",
    );
  const result = SelectionResultSchema.safeParse(await response.json());
  if (!result.success)
    throw new Error("The selection service returned an unreadable result.");
  if (
    result.data.kind === "handoff" &&
    (result.data.productId !== productId ||
      !isSafeCatalogHandoff(
        result.data.productId,
        result.data.productName,
        result.data.productUrl,
        result.data.offer,
      ))
  )
    throw new Error("The selection service returned an unsafe product link.");
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
    throw new Error(
      "Web research could not finish. Check the connection and try again.",
    );
  }
  if (!response.ok)
    throw new Error("Web research could not finish. Try again.");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Web research returned an unreadable result.");
  }
  const result = WebResearchResponseSchema.safeParse(payload);
  if (!result.success)
    throw new Error("Web research returned an unreadable result.");
  return result.data;
}

export async function loadAccount(signal: AbortSignal) {
  const response = await fetch("/api/account", { signal, cache: "no-store" });
  const result = AccountStateSchema.parse(await response.json());
  return result;
}
export async function workspaceCommand(
  input: WorkspaceCommand,
  signal: AbortSignal,
) {
  const response = await fetch("/api/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "Your session ended. Sign in again."
        : response.status === 409
          ? "Saved conversation changed. Reload before sending again."
          : "Saved conversation is unavailable. The request was not retried.",
    );
  return WorkspaceResultSchema.parse(await response.json());
}
export async function accountAction(
  action: "sign-in/email" | "sign-up/email" | "sign-out",
  body: Record<string, string>,
  signal: AbortSignal,
) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Too many account attempts. Wait a minute and try again."
        : action === "sign-out"
          ? "Sign-out did not complete. Try again."
          : "Account request failed. Check your details and try again.",
    );
}
