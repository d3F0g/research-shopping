import type {
  ConversationState,
  PrepareInput,
  TurnResponse,
} from "../domain/conversation";

export async function api<T>(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      `Request failed (${response.status}). Your message is retained.`,
    );
  return (await response.json()) as T;
}
export const getSession = (signal?: AbortSignal) =>
  api<{ state: ConversationState }>("/api/session", undefined, signal);
export const prepare = (input: PrepareInput, signal: AbortSignal) =>
  api<TurnResponse>("/api/turn", input, signal);
export const research = (preparedId: string, signal: AbortSignal) =>
  api<TurnResponse>("/api/turn", { phase: "research", preparedId }, signal);
