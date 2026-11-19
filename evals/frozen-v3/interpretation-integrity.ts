import { fixedIntentInput, INTENT_TAPE_SHA256, InputCoverageError, validateTape, type IntentTurn } from "./intent-input";
import { hash } from "../hash";
import type { Json, Observation, RunReport } from "./contracts";
import type { PrepareTurnRequest } from "./intent-input";
const object = (value: Json) => value as Record<string, Json>;
export function validateInterpretation(observation: Observation, report: RunReport) {
  const input = observation.interpretation;
  const invocations = observation.events.filter((event) => event.kind === "interpreter-request");
  if (!input || input.openAIHttpRequests !== 0 || input.invocations !== invocations.length) throw new Error("interpretation provenance mismatch");
  if (input.mode === "unavailable") {
    if (input.inputHash !== null || invocations.length || input.suppliedTurns.length || input.limitations.length) throw new Error("unavailable interpretation cannot contain supplied inputs");
    return;
  }
  if (input.mode !== "fixed-proposals") throw new Error("unknown interpretation mode");
  if (input.inputHash === INTENT_TAPE_SHA256) {
    const tapeText = report.implementationInputs.adapter.find((item) => item.path === "inputs/intent-proposals.v2.json")?.text;
    const publicText = report.implementationInputs.adapter.find((item) => item.path === "inputs/public-conversations.v1.json")?.text;
    if (!tapeText || !publicText) throw new Error("fixed tape source is absent");
    const conversations = JSON.parse(publicText) as { id: string; turns: string[] }[];
    const tape = validateTape(tapeText, conversations.map(({ id, turns }) => ({ id, actions: turns.map((text) => ({ kind: "message", text })), provider: "unused-by-intent" })));
    const expected = tape.conversations.find((row) => row.id === observation.scenarioId)?.turns;
    if (!expected || hash(expected) !== hash(input.suppliedTurns)) throw new Error("supplied scenario interpretations differ from the immutable tape");
  } else if (input.inputHash !== hash(input.suppliedTurns)) throw new Error("synthetic control interpretation hash mismatch");
  const fixture = fixedIntentInput(input.suppliedTurns as IntentTurn[], "Report integrity validation", input.inputHash!);
  const limitations: string[] = [];
  for (const event of invocations) {
    const metadata = object(event.body);
    const requestEvent = observation.events.filter((item) => item.kind === "app-request" && item.turn === event.turn && item.sequence < event.sequence).at(-1);
    const rawRequest = requestEvent ? object(requestEvent.body) : null;
    if (!rawRequest || rawRequest.phase !== "prepare" || rawRequest.operationId !== metadata.operationId || rawRequest.message !== metadata.message || (rawRequest.questionId ?? null) !== metadata.questionId || metadata.inputHash !== input.inputHash) throw new Error("interpretation invocation does not match the actual preparation");
    const terminal = observation.events.find((item) => item.kind === "interpreter-response" && item.turn === event.turn && item.sequence > event.sequence);
    if (!terminal) throw new Error("interpretation terminal event is absent");
    try {
      const proposed = fixture.propose(event.turn, rawRequest as unknown as PrepareTurnRequest);
      if (hash(terminal.body) !== hash({ status: "ready", ...proposed })) throw new Error("supplied interpretation or symbolic binding changed");
    } catch (error) {
      if (!(error instanceof InputCoverageError)) throw error;
      limitations.push(error.message);
      if (hash(terminal.body) !== hash({ status: "unavailable" })) throw new Error("unbound interpretation was accepted");
    }
  }
  if (hash(limitations) !== hash(input.limitations)) throw new Error("interpretation limitations differ from bindings");
}
