import type { TurnRequest } from "../domain/contracts";
import { ApplicationTurnResponseSchema } from "../domain/research";
export async function runTurn(
  request: Omit<TurnRequest, "operationId">,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, operationId: crypto.randomUUID() }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Research could not finish. Check the connection and try again.",
    );
  }
  if (!response.ok) throw new Error("Research could not finish. Try again.");
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("The research service returned an unreadable result.");
  }
  const result = ApplicationTurnResponseSchema.safeParse(payload);
  if (!result.success)
    throw new Error("The research service returned an unreadable result.");
  return result.data;
}
