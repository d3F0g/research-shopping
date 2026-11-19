import { hasExplicitBudgetCurrency, parseBudget } from "../../src/domain/budget";
import { unresolvedMoneyDraft } from "../../src/domain/preferences";
import type { IntentActions, IntentInterpreter } from "../../src/domain/intent-actions";

export const fixtureIntentInterpreter: IntentInterpreter = async ({ message, preferences }, signal) => {
  signal.throwIfAborted();
  const source = (text: string) => ({ text, start: message.indexOf(text), end: message.indexOf(text) + text.length });
  const actions: IntentActions["actions"] = [];
  if (!preferences.productDescription) actions.push({ kind: "start-request", source: source(message) });
  if (preferences.productDescription && /^(?:how|what|can you)\b/i.test(message)) actions.push({ kind: "refine-description", source: source(message) });
  const money = parseBudget(message, preferences.budget, preferences.region);
  if (money.kind === "updated" && money.budget) {
    const range = /(?:\d\s*(?:to|and|[-–—])\s*(?:(?:SGD|USD|S\$|US\$|\$)\s*)?\d)/i.test(message);
    actions.push({ kind: "budget", source: source(message), operation: range ? "replace-range" : "set-maximum", draft: { amount: money.budget.amount, minimum: range ? money.budget.minimum ?? null : null, currency: hasExplicitBudgetCurrency(message) ? money.budget.currency : null } });
  } else if (money.kind === "clarification") actions.push({ kind: "budget", source: source(message), operation: "clarify", draft: unresolvedMoneyDraft(message, preferences) });
  const clauses = message.split(/(?:[.;\n]+|(?=\b(?:must(?: have| be)?|require|exclude|avoid|prefer|prioriti[sz]e|compare)\b))/i).map((item) => item.trim()).filter(Boolean);
  for (const clause of clauses) {
    if (/^(?:must|require|need(?:s)? to|exclude|avoid|only)\s/i.test(clause)) actions.push({ kind: "add-criterion", strength: "hard", source: source(clause) });
    else if (/^(?:prefer|prioriti[sz]e|compare|lighter|cheaper)\b/i.test(clause)) actions.push({ kind: "add-criterion", strength: "flexible", source: source(clause) });
  }
  return { status: "ready", interpretation: { disposition: /^(?:none of these|not happy|not satisfied|try again)/i.test(message) ? "feedback" : "research", actions } };
};
