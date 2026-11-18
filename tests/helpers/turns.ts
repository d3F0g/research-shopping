import type { PrepareTurnRequest } from "../../src/domain/contracts";
import {
  TurnTransportResponseSchema,
  type ResearchTurns,
} from "../../src/domain/research";
import type { createApp } from "../../src/server/app";

export async function submitTurn(
  turns: ResearchTurns,
  request: PrepareTurnRequest,
  signal: AbortSignal,
) {
  const prepared = await turns.turn(request, signal);
  return prepared.kind === "prepared"
    ? turns.turn(
        {
          phase: "research",
          preferences: prepared.preferences,
          operationId: request.operationId,
        },
        signal,
      )
    : prepared;
}
export async function postTurn(
  app: ReturnType<typeof createApp>,
  body: unknown,
) {
  const request = {
    phase: "prepare",
    ...(typeof body === "object" && body !== null ? body : {}),
  };
  const send = (payload: unknown) =>
    app.request("http://127.0.0.1:3000/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  const response = await send(request);
  if (!response.ok) return response;
  const prepared = TurnTransportResponseSchema.parse(
    await response.clone().json(),
  );
  return prepared.kind === "prepared"
    ? send({
        phase: "research",
        preferences: prepared.preferences,
        operationId: "operationId" in request ? request.operationId : undefined,
      })
    : response;
}
