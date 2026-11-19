import type { IntentActions, IntentInterpreter } from "../../src/domain/intent-actions";

export const fixtureIntentInterpreter: IntentInterpreter = async ({ message, preferences }, signal) => {
  signal.throwIfAborted();
  const source = (text: string) => ({ text, start: message.indexOf(text), end: message.indexOf(text) + text.length });
  const actions: IntentActions["actions"] = [];
  if (!preferences.productDescription) actions.push({ kind: "start-request", source: source(message) });
  const clauses = message.split(/(?:[.;\n]+|(?=\b(?:must(?: have| be)?|require|exclude|avoid|prefer|prioriti[sz]e|compare)\b))/i).map((item) => item.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (/^(?:must|require|need(?:s)? to|exclude|avoid|only)\s/i.test(clause)) actions.push({ kind: "add-criterion", strength: "hard", source: source(clause) });
    else if (/^(?:prefer|prioriti[sz]e|lighter|cheaper)\b/i.test(clause)) actions.push({ kind: "add-criterion", strength: "flexible", source: source(clause) });
  }
  return { status: "ready", interpretation: { disposition: /^(?:none of these|not happy|not satisfied|try again)/i.test(message) ? "feedback" : "research", actions } };
};
