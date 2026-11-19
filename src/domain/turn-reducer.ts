import { assessProduct } from "./research";
import { BudgetSchema, MoneySchema, type ConversationState, type PrepareInput, type ShoppingIntent, type TurnDecision } from "./conversation";

const normalize = (value: string) => value.trim().replace(/[.!?]+$/, "").toLowerCase();
const currency = (value: string) => ({ "s$": "SGD", "us$": "USD", "€": "EUR", "£": "GBP", "sgd": "SGD", "usd": "USD", "eur": "EUR", "gbp": "GBP", "aud": "AUD", "cad": "CAD", "myr": "MYR", "jpy": "JPY", "inr": "INR" }[value.toLowerCase()] ?? null);
const amount = (value: string) => Number(value.replaceAll(",", "")) * (/k$/i.test(value) ? 1000 : 1);

function monetaryDraft(text: string): { minimum?: number; maximum?: number; currency: string | null; remainder: string } | null {
  const token = "(?:SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR|US\\$|S\\$|\\$|€|£)";
  const number = "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)";
  const range = new RegExp(`(?:between|around|budget(?: of)?|from)?\\s*(${token})?\\s*${number}\\s*(?:-|–|to|and)\\s*(${token})?\\s*${number}\\s*(${token})?\\s*(?=$|[\\s.,;!?])`, "i").exec(text);
  if (range && (/[A-Za-z$€£]/.test(range[0].replace(/to|and/gi, "")) || /^\s*[\d$]/.test(text))) {
    const tokens = [range[1], range[3], range[5]].filter((v): v is string => !!v && v !== "$");
    const currencies = new Set(tokens.map((v) => currency(v)));
    if (currencies.size > 1) return { minimum: NaN, maximum: NaN, currency: null, remainder: text };
    return { minimum: amount(range[2]!), maximum: amount(range[4]!), currency: tokens.length ? currency(tokens[0]!) : null, remainder: text.slice(0, range.index) + text.slice(range.index + range[0].length) };
  }
  const single = new RegExp(`(?:under|below|up to|at most|budget(?: is| of)?|maximum(?: of)?|max|around|make it|at least|minimum(?: of)?)?\\s*(${token})\\s*${number}\\s*(?=$|[\\s.,;!?])|(?:under|below|up to|at most|budget(?: is| of)?|maximum(?: of)?|max|around|make it|at least|minimum(?: of)?)\\s*${number}\\s*(${token})?\\s*(?=$|[\\s.,;!?])|${number}\\s*(${token})\\s*(?=$|[\\s.,;!?])`, "i").exec(text);
  if (!single) return null;
  const value = single[2] ?? single[3] ?? single[5];
  const unit = single[1] ?? single[4] ?? single[6];
  return /\b(?:at least|minimum)\b/i.test(single[0]) ? { minimum: amount(value!), currency: currency(unit ?? ""), remainder: text.slice(0, single.index) + text.slice(single.index + single[0].length) } : { maximum: amount(value!), currency: currency(unit ?? ""), remainder: text.slice(0, single.index) + text.slice(single.index + single[0].length) };
}

function lastResearch(state: ConversationState) { return [...state.messages].reverse().find((m) => m.research)?.research; }
function heldReply(state: ConversationState, mode: "compare" | "best" | "battery"): string {
  const research = lastResearch(state);
  if (!research) return "There is no research in this conversation yet. Tell me what you want to buy.";
  if (mode === "best" && JSON.stringify({ ...research.intent, responseLength: null }) !== JSON.stringify({ ...state.intent, responseLength: null })) return "The retained comparison belongs to earlier requirements. I cannot reuse its recommendation for your current request.";
  if (mode === "best") return research.choice && assessProduct(research.products.find((p) => p.id === research.choice!.productId)!, state.intent).eligible ? `${research.products.find((p) => p.id === research.choice!.productId)!.name}. ${research.choice.rationale}` : "I cannot choose a compliant best option from this evidence. The unresolved requirements are shown with each product.";
  const products = mode === "compare" ? research.products.slice(0, 2) : research.products;
  return products.map((p) => {
    const rows = mode === "battery" ? p.attributes.filter((a) => /battery|runtime|hours/i.test(a.name)) : p.attributes.slice(0, 2);
    return `${p.name}: ${rows.length ? rows.map((a) => `${a.name}: ${a.assessment.rationale} (${a.assessment.status})`).join("; ") : "No supported detail was retained for this question."}${p.blockers.length ? ` Unresolved: ${p.blockers.join(" ")}` : ""}`;
  }).join("\n\n");
}

export function reduceTurn(previous: ConversationState, input: PrepareInput): TurnDecision {
  const state = structuredClone(previous);
  const text = input.message.trim();
  const editText = text.replace(/^(?:actually|please)[, ]+|^my new budget is /i, "");
  const command = normalize(text);
  const userId = input.operationId;
  state.revision++;
  state.messages.push({ id: userId, role: "user", text });
  const reply = (message: string, kind: "message" | "clarification" = "message"): TurnDecision => {
    state.messages.push({ id: `${userId}-reply`, role: "assistant", text: message });
    return { state, kind, message };
  };
  const pendingEdit = (explanation: string) => {
    state.pending = { kind: "edit", id: userId, message: text, explanation };
    return reply(explanation, "clarification");
  };
  if (input.questionId && input.questionId !== state.pending?.id) return reply("That question is no longer active. Your accepted request is unchanged.");
  if (input.expectedRevision !== undefined && input.expectedRevision !== previous.revision) return reply("The request changed while the editor was open. Reopen it to edit current preferences.");
  if (input.edit) {
    const edit = input.edit;
    const current = new Map(state.intent.requirements.map((r) => [r.id, r]));
    state.intent = { ...state.intent, originalText: edit.description, productDescription: [edit.description, ...edit.requirements.map((r) => r.text)].join("\n"), budget: edit.budget, requirements: [{ id: `request-${userId}`, text: edit.description, strength: "hard", originMessageId: userId, kind: "request" }, ...edit.requirements.map((r) => ({ ...r, originMessageId: current.get(r.id)?.originMessageId ?? userId, kind: current.get(r.id)?.kind ?? "preference" as const }))] };
    state.pending = null;
    return { state, kind: "research" };
  }
  if (["hi", "hello", "hey"].includes(command)) return reply("Hi. What are you looking to buy?");
  if (["thanks", "thank you", "ok", "okay"].includes(command)) return reply("You're welcome. Tell me what you would like to change.");
  if (["help", "what can you do", "how does this work"].includes(command)) return reply("Describe what you want to buy and any requirements. I research sources with Exa, compare evidence, and link to product pages. Research submissions can use paid Exa credits. Viewing existing evidence is free.");
  if (["keep it short", "shorter", "less detail", "more detail", "more details"].includes(command)) {
    state.intent.responseLength = command.startsWith("more") ? "expanded" : "concise";
    return reply(state.intent.responseLength === "concise" ? "I'll keep replies short." : "I'll include more evidence in replies.");
  }
  if (command === "compare the first and third") { const retained = lastResearch(state); if (!retained || retained.products.length < 3) return reply("The retained comparison does not contain three products."); return reply([retained.products[0]!, retained.products[2]!].map((p) => `${p.name}: ${p.requestMatch.rationale} ${p.blockers.join(" ")}`).join("\n\n")); }
  if (["compare the first two", "compare them", "compare these"].includes(command)) return reply(heldReply(state, "compare"));
  if (["just give me the best one", "best one", "which is best"].includes(command)) return reply(heldReply(state, "best"));
  if (["what about battery life", "battery life"].includes(command)) return reply(heldReply(state, "battery"));
  if (["i don't like these", "i do not like these", "not happy with these"].includes(command)) return reply("What should change, such as price, size, or a specific feature? Your existing requirements remain active.");
  if (["discard pending change", "cancel that change"].includes(command)) { state.pending = null; return reply("The pending change was discarded. Your accepted requirements are unchanged."); }
  if (state.pending?.kind === "currency") {
    const answer = /^(?:actually,?\s*)?(SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR)\b[.,;!?]?\s*(.*)$/i.exec(text);
    const resolved = answer ? currency(answer[1]!) : null;
    if (!resolved) return reply("Which currency applies to the saved amount? For example, SGD or USD.", "clarification");
    const draft = state.pending;
    state.intent = { ...draft.draft, budget: BudgetSchema.parse({ minimum: draft.minimum, maximum: draft.maximum, currency: resolved }) };
    state.pending = null;
    if (answer?.[2]) { state.intent.requirements.push({ id: `requirement-${userId}`, text: answer[2], strength: "hard", originMessageId: userId, kind: "preference" }); state.intent.productDescription += `\n${answer[2]}`; }
    return { state, kind: "research" };
  }
  if (state.pending?.kind === "edit") return reply(`${state.pending.explanation} You can explicitly discard the pending change to keep your accepted request.`, "clarification");
  if (["retry", "try again", "refresh", "research again"].includes(command)) return state.intent.originalText ? { state, kind: "research" } : reply("What are you shopping for?", "clarification");
  if (state.intent.originalText && /\b(?:make it|change|remove|drop|budget|currency)\b.*\b(?:and|but|also)\b|\b(?:and|but|also)\b.*\b(?:make it|remove|drop|budget|currency)\b/i.test(text)) return pendingEdit("I kept this complete change pending because I cannot safely apply its combined edits. State each change separately. No part was applied.");
  const correctedCurrency = /^(?:(?:actually|i meant|change currency to)[, ]+)?(SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR)(?:,? not (SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR))?\.?$/i.exec(text);
  if (correctedCurrency) {
    if (!state.intent.budget) return reply("There is no accepted budget to relabel. State an amount with the currency.", "clarification");
    state.intent.budget.currency = currency(correctedCurrency[1]!)!;
    return { state, kind: "research" };
  }
  if (["remove budget", "remove the budget", "no budget limit", "no budget"].includes(command)) { state.intent.budget = null; return { state, kind: "research" }; }
  const quotedObservation = state.intent.originalText && /\b(?:page|source|seller|website|says|shows|quote|advertis)\b/i.test(text);
  const money = quotedObservation ? null : monetaryDraft(editText);
  if (money) {
    if ((money.minimum !== undefined && !MoneySchema.safeParse(money.minimum).success) || (money.maximum !== undefined && !MoneySchema.safeParse(money.maximum).success) || (money.minimum !== undefined && money.maximum !== undefined && money.minimum > money.maximum)) return pendingEdit("That budget is not a valid positive range. Your accepted budget is unchanged. Discard this pending change, then state a valid amount.");
    const exactBudgetEdit = /^(?:make it|under|below|up to|at most|budget(?: is| of)?|maximum(?: of)?|max|around|at least|minimum(?: of)?|between|from|SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR|S\$|US\$|\$|€|£|\d)/i.test(editText);
    const draft: ShoppingIntent = structuredClone(state.intent);
    if (!draft.originalText || (!exactBudgetEdit && !state.intent.originalText)) {
      draft.originalText = text;
      draft.productDescription = text;
      draft.requirements = [...draft.requirements.filter((r) => r.kind !== "request"), { id: `request-${userId}`, text, strength: "hard", originMessageId: userId, kind: "request" }];
    }
    const unit = money.currency ?? draft.budget?.currency;
    const bounds = { minimum: money.minimum ?? draft.budget?.minimum, maximum: money.maximum ?? draft.budget?.maximum };
    const extra = money.remainder.replace(/^[.,;!?\s]+|[.,;!?\s]+$/g, "").trim() ? text : "";
    if (extra && state.intent.originalText) { draft.requirements.push({ id: `requirement-${userId}`, text: extra, strength: "hard", originMessageId: userId, kind: "preference" }); draft.productDescription += `\n${extra}`; }
    if (bounds.minimum !== undefined && bounds.maximum !== undefined && bounds.minimum > bounds.maximum) return pendingEdit("The new budget would put the maximum below the retained minimum. State both bounds or explicitly remove the old minimum. No budget change was applied.");
    if (!unit) {
      state.intent = { ...draft, budget: state.intent.budget };
      state.pending = { kind: "currency", id: userId, originalRequest: draft.originalText, draft, ...bounds };
      return reply("Which currency, for example SGD or USD?", "clarification");
    }
    draft.budget = BudgetSchema.parse({ ...bounds, currency: unit });
    state.intent = draft;
    return { state, kind: "research" };
  }
  if (/^(?:make it|budget|under|between|at least|minimum|maximum)\b/i.test(text) && /\d/.test(text)) return pendingEdit("I could not safely apply the complete budget edit. Your previous budget remains active. Discard this pending change, then state one amount or range with its currency.");
  if (["remove minimum", "remove the minimum", "remove lower bound"].includes(command) && state.intent.budget) {
    const { maximum, currency: unit } = state.intent.budget;
    state.intent.budget = maximum === undefined ? null : { maximum, currency: unit };
    return { state, kind: "research" };
  }
  if (["show me other brands", "other brands", "remove brand restriction"].includes(command)) {
    for (const requirement of state.intent.requirements.filter((r) => r.kind === "request")) requirement.text = requirement.text.replace(/\bonly\s+[A-Z][A-Za-z0-9-]*\b/g, "").trim();
    state.intent.requirements = state.intent.requirements.filter((r) => r.kind !== "brand");
    state.intent.productDescription = state.intent.requirements.map((r) => r.text).join("\n");
    return { state, kind: "research" };
  }
  if (!state.intent.originalText || /^(?:i (?:want|need|would like)|find|recommend|looking for)\b/i.test(text)) {
    const retainedHard = state.intent.requirements.filter((r) => r.kind === "request").flatMap((r) => { const clauses = r.text.match(/\b(?:must|without|no|only|excluding|at least|with)\b[^.;]+/gi) ?? []; return clauses.map((clause, i) => ({ ...r, id: `${userId}-retained-${i}`, text: clause, kind: "preference" as const })); });
    state.intent.originalText = text;
    state.intent.requirements = [...state.intent.requirements.filter((r) => r.kind !== "request"), ...retainedHard, { id: `request-${userId}`, text, strength: "hard", originMessageId: userId, kind: "request" }];
  } else {
    const brand = /^only\s+([^,;.!?]+)$/i.exec(text);
    const kind = brand && !/\b(?:and|or|with|without|must)\b/i.test(brand[1]!) ? "brand" : /^(?:no|avoid|exclude|without)\b/i.test(text) ? "exclusion" : "preference";
    const flexible = command === "something cheaper" || /^prefer\b/i.test(text);
    state.intent.requirements.push({ id: `requirement-${userId}`, text, strength: flexible ? "flexible" : "hard", originMessageId: userId, kind });
  }
  if (state.intent.requirements.length > 24) { state.intent = structuredClone(previous.intent); return pendingEdit("This conversation has reached its requirement limit. Start a new chat or explicitly remove a requirement."); }
  state.intent.productDescription = state.intent.requirements.map((r) => r.text).join("\n");
  return { state, kind: "research" };
}
