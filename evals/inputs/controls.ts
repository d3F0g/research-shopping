import type { IntentActions } from "../../src/domain/intent-actions";
import type { PublicScenario } from "../contracts";
import { fixedIntentInput, type IntentTurn } from "./intent";

const span = (message: string, text: string) => {
  const start = message.indexOf(text);
  if (start < 0 || message.indexOf(text, start + 1) !== -1) throw new Error("Control source must be an exact unique literal span");
  return { start, end: start + text.length, text };
};
function shopping(message: string, description: string, money?: { text: string; amount: number; currency: "SGD" | "USD" }) {
  const proposal: IntentActions = { disposition: "research", actions: [{ kind: "start-request", source: span(message, description) }] };
  if (money) proposal.actions.push({ kind: "budget", source: span(message, money.text), operation: "set-maximum", draft: { amount: money.amount, minimum: null, currency: money.currency } });
  return proposal;
}
const fixed = new Map<string, IntentActions>([
  ["Find a power bank under SGD40", shopping("Find a power bank under SGD40", "power bank", { text: "under SGD40", amount: 40, currency: "SGD" })],
  ["Find three binocular options for birdwatching under USD 250", shopping("Find three binocular options for birdwatching under USD 250", "binocular options for birdwatching", { text: "under USD 250", amount: 250, currency: "USD" })],
  ["Find binoculars under USD 250", shopping("Find binoculars under USD 250", "binoculars", { text: "under USD 250", amount: 250, currency: "USD" })],
  ["Find binoculars for birdwatching", shopping("Find binoculars for birdwatching", "binoculars for birdwatching")],
  ["Thanks", { disposition: "acknowledge", actions: [] }],
  ["Hi", { disposition: "acknowledge", actions: [] }],
  ["Compare the first and third options", { disposition: "acknowledge", actions: [] }],
]);
export function controlIntent(scenario: PublicScenario) {
  const turns: IntentTurn[] = scenario.actions.flatMap((action, turnIndex) => {
    if (action.kind !== "message" && action.kind !== "cancel") return [];
    const proposal = fixed.get(action.text);
    if (!proposal) throw new Error(`No explicitly authored control proposal for ${JSON.stringify(action.text)}`);
    return [{ turnIndex, message: action.text, proposal, limitations: action.text.startsWith("Compare") ? ["Acknowledgement tests dispatch restraint only. It does not supply or establish a useful held-evidence comparison."] : [] }];
  });
  return fixedIntentInput(turns, "Synthetic evaluator control with explicit literal operations, separate from the sixty-case tape");
}
