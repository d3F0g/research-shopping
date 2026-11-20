import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { IntentActionsSchema, type IntentActions } from "../../src/domain/intent-actions";
import type { PrepareTurnRequest } from "../../src/domain/contracts";
import type { PublicScenario } from "../contracts";
import { hash } from "../hash";

export const INTENT_TAPE_SHA256 = "ba136b479052387d0ab913a7bb4d802eebe4f7e17be79846d908e5fd87c4044a";
const Turn = z.strictObject({
  turnIndex: z.number().int().nonnegative(), message: z.string(), proposal: IntentActionsSchema,
  symbolicTargets: z.array(z.strictObject({ actionIndex: z.number().int().nonnegative(), targetWording: z.string().min(1) })).optional(),
  limitations: z.array(z.string()).optional(),
});
const Tape = z.strictObject({
  format: z.literal("fieldnote-independent-synthetic-intent-proposals-v1"),
  provenance: z.record(z.string(), z.unknown()),
  conversations: z.array(z.strictObject({ id: z.string(), turns: z.array(Turn) })),
});
export type IntentTurn = z.infer<typeof Turn>;
export type Binding = { actionIndex: number; targetWording: string; criterionId: string };
export type IntentInput = {
  hash: string;
  label: string;
  turns: IntentTurn[];
  propose(turn: number, request: PrepareTurnRequest): { interpretation: IntentActions; bindings: Binding[]; limitations: string[] };
};
export class InputCoverageError extends Error {}
function validateTurns(turns: IntentTurn[]) {
  if (new Set(turns.map((turn) => turn.turnIndex)).size !== turns.length) throw new Error("Duplicate interpretation turn");
  for (const turn of turns) {
    for (const [index, action] of turn.proposal.actions.entries()) {
      const span = action.source;
      if (span.end <= span.start || span.end > turn.message.length || turn.message.slice(span.start, span.end) !== span.text) throw new Error(`Malformed fixed interpretation span at turn ${turn.turnIndex}, action ${index}`);
      const targets = turn.symbolicTargets?.filter((target) => target.actionIndex === index) ?? [];
      if (action.kind === "remove-criterion" && action.id.startsWith("@symbolic-")) {
        if (targets.length !== 1) throw new Error("Symbolic removal must declare exactly one target");
      } else if (targets.length) throw new Error("Symbolic target requires a symbolic removal action");
    }
    if (turn.symbolicTargets?.some((target) => !turn.proposal.actions[target.actionIndex])) throw new Error("Symbolic target references absent action");
  }
}
export function fixedIntentInput(raw: IntentTurn[], label: string, inputHash = hash(raw)): IntentInput {
  const turns = z.array(Turn).parse(raw);
  validateTurns(turns);
  const consumed = new Set<number>();
  return {
    hash: inputHash, label, turns: structuredClone(turns),
    propose(index, request) {
      const row = turns.find((turn) => turn.turnIndex === index);
      if (!row || row.message !== request.message || hash(row.message) !== hash(request.message)) throw new InputCoverageError(`Fixed interpretation does not cover exact turn ${index} and message`);
      if (consumed.has(index)) throw new InputCoverageError(`Fixed interpretation turn ${index} was already consumed`);
      consumed.add(index);
      const interpretation = structuredClone(row.proposal);
      const bindings: Binding[] = [];
      for (const target of row.symbolicTargets ?? []) {
        const matches = request.preferences.criteria.filter((criterion) => criterion.wording === target.targetWording || criterion.origin.text === target.targetWording);
        if (matches.length !== 1) throw new InputCoverageError(`Symbolic removal at turn ${index} has ${matches.length} prior literal matches for ${JSON.stringify(target.targetWording)}`);
        const action = interpretation.actions[target.actionIndex]!;
        if (action.kind !== "remove-criterion") throw new Error("Invalid validated symbolic removal");
        action.id = matches[0]!.id;
        bindings.push({ ...target, criterionId: action.id });
      }
      return { interpretation, bindings, limitations: [...row.limitations ?? []] };
    },
  };
}
export function validateTape(raw: string, scenarios: PublicScenario[], expectedHash = INTENT_TAPE_SHA256) {
  if (createHash("sha256").update(raw).digest("hex") !== expectedHash) throw new Error("Fixed intent tape byte hash mismatch");
  const tape = Tape.parse(JSON.parse(raw));
  if (tape.conversations.length !== scenarios.length || new Set(tape.conversations.map((item) => item.id)).size !== scenarios.length) throw new Error("Intent tape scenario coverage mismatch");
  for (const scenario of scenarios) {
    const rows = tape.conversations.find((item) => item.id === scenario.id)?.turns;
    if (!rows || rows.length !== scenario.actions.length) throw new Error(`Intent tape action coverage mismatch for ${scenario.id}`);
    validateTurns(rows);
    for (const [index, action] of scenario.actions.entries()) {
      if (action.kind !== "message" || rows[index]?.turnIndex !== index || rows[index]?.message !== action.text || hash(rows[index]?.message) !== hash(action.text)) throw new Error(`Intent tape public action mismatch for ${scenario.id} turn ${index}`);
    }
  }
  return tape;
}
export async function scenarioIntentInput(scenario: PublicScenario): Promise<IntentInput> {
  const raw = await readFile(new URL("./intent-proposals.v2.json", import.meta.url), "utf8");
  const publicRaw = await readFile(new URL("./public-conversations.v1.json", import.meta.url), "utf8");
  if (createHash("sha256").update(publicRaw).digest("hex") !== "8289c7fc6bf66e68595b1ca2c68169234f8a93eed5edc818056a8fc03780c218") throw new Error("Public conversation byte hash mismatch");
  const conversations = z.array(z.strictObject({ id: z.string(), turns: z.array(z.string()) })).parse(JSON.parse(publicRaw));
  const tape = validateTape(raw, conversations.map(({ id, turns }) => ({ id, actions: turns.map((text) => ({ kind: "message", text })), provider: "unused-by-intent" })));
  const rows = tape.conversations.find((row) => row.id === scenario.id)?.turns;
  if (!rows || hash(rows.map((row) => ({ kind: "message", text: row.message }))) !== hash(scenario.actions)) throw new InputCoverageError(`No fixed interpretation for exact public scenario ${scenario.id}`);
  return fixedIntentInput(rows, "Independently authored synthetic proposals. Conditional technical behavior only.", INTENT_TAPE_SHA256);
}
