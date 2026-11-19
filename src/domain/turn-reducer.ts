import { assessProduct } from "./research";
import { BudgetSchema, MoneySchema, type ChatMessage, type ConversationState, type PrepareInput, type Requirement, type ShoppingIntent, type TurnDecision } from "./conversation";

const normalize = (value: string) => value.trim().replace(/[.!?]+$/, "").toLowerCase();
const currency = (value: string) => ({ "s$": "SGD", "us$": "USD", "€": "EUR", "£": "GBP", "sgd": "SGD", "usd": "USD", "eur": "EUR", "gbp": "GBP", "aud": "AUD", "cad": "CAD", "myr": "MYR", "jpy": "JPY", "inr": "INR" }[value.toLowerCase()] ?? null);
const amount = (value: string) => Number(value.replaceAll(",", "").replace(/k$/i, "")) * (/k$/i.test(value) ? 1000 : 1);

function monetaryDraft(text: string): { minimum?: number; maximum?: number; currency: string | null; remainder: string } | null {
  const token = "(?:SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR|US\\$|S\\$|\\$|€|£)";
  const number = "([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?k?)";
  const range = new RegExp(`(?:between|around|budget(?: of)?|from)?\\s*(${token})?\\s*${number}\\s*(?:-|–|to|and)\\s*(${token})?\\s*${number}\\s*(${token})?\\s*(?=$|[\\s.,;!?])`, "i").exec(text);
  const hasCurrency = range && [range[1], range[3], range[5]].some(Boolean);
  const bareRange = range && /^(?:between|around|budget(?: of)?|from)\s*/i.test(range[0]) && /^(?:\s*[.,;!?]|\s*$)/.test(text.slice(range.index + range[0].length));
  if (range && (hasCurrency || bareRange || /^\s*[\d$]/.test(text))) {
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

type LocalOperation = "short" | "detail" | "compare" | "best" | "held-question" | "cheaper" | "selection" | "remember" | "sources" | "theme" | "help" | "error" | "cancel" | "status" | "dissatisfied" | "retry";
const localOperations: { kind: LocalOperation; matches: RegExp }[] = [
  { kind: "short", matches: /^(?:keep it short|shorter|less detail)$/i },
  { kind: "detail", matches: /^(?:(?:show|give) me )?more details?$/i },
  { kind: "theme", matches: /^(?:thanks[.,]?\s*)?(?:how do i|how can i) change the theme$/i },
  { kind: "help", matches: /^(?:help|what can you do|how does this work)$/i },
  { kind: "remember", matches: /^what do you remember about my (?:requirements|preferences)$/i },
  { kind: "sources", matches: /^(?:open|show)(?: me)? (?:the )?(?:supporting )?sources?\b/i },
  { kind: "error", matches: /^(?:the (?:search|research) failed[.,]?\s*)?(?:what happened|why did (?:the )?(?:search|research) fail)$/i },
  { kind: "cancel", matches: /^(?:cancel that|stop(?: (?:the )?research)?)$/i },
  { kind: "status", matches: /^(?:did it stop|has it stopped|is it cancelled)$/i },
  { kind: "retry", matches: /^(?:retry|try again(?: once)?|refresh|research again)$/i },
  { kind: "dissatisfied", matches: /^(?:i (?:don't|do not) like (?:any of )?(?:these|those)|not happy with (?:these|those))$/i },
  { kind: "best", matches: /^(?:(?:just )?(?:give|show) me the best one|best one|which(?: one)? is best(?: overall)?)$/i },
  { kind: "compare", matches: /^compare (?:the |their |them|these|current )/i },
  { kind: "cheaper", matches: /^(?:something cheaper|the lower-priced options within that range are fine)$/i },
  { kind: "selection", matches: /^(?:i like .+|don't change my existing budget)(?:[.,].*)?$/i },
  { kind: "held-question", matches: /^(?:what about |which (?:one |has |is |of )|why is |is that one |i mean the |battery life$)/i },
];

function requirementClauses(text: string, userId: string, request: boolean): Requirement[] {
  const clauses = text.split(/(?<=[.!?;])\s+/);
  const flexible = (clause: string) => /\b(?:would be nice|(?:i(?:'d| would)? )?prefer|rather avoid)\b/i.test(clause) && !/\b(?:must|essential|required|no |without|only )\b/i.test(clause);
  const soft = clauses.filter(flexible);
  const hard = clauses.filter((clause) => !flexible(clause)).join(" ");
  return [
    ...(hard ? [{ id: `${request ? "request" : "requirement"}-${userId}`, text: hard, strength: "hard" as const, originMessageId: userId, kind: request ? "request" as const : /^(?:no|avoid|exclude|without)\b/i.test(hard) ? "exclusion" as const : "preference" as const }] : []),
    ...soft.map((clause, index) => ({ id: `flexible-${userId}-${index}`, text: clause, strength: "flexible" as const, originMessageId: userId, kind: "preference" as const })),
  ];
}

type HeldReply = Pick<ChatMessage, "text" | "detail">;
const brandName = "[A-Z][a-z][A-Za-z0-9]*(?: [A-Z][a-z][A-Za-z0-9]*)*";
const brandClause = new RegExp(`^[Oo][Nn][Ll][Yy]\\s+${brandName}$`);

function heldReply(state: ConversationState, mode: "compare" | "best" | "detail" | "held-question" | "cheaper", question = ""): HeldReply {
  const research = lastResearch(state);
  if (!research) return { text: "There is no retained research for this question. Your request is unchanged. Submit research explicitly when you want new evidence." };
  const previousQuestion = [...state.messages].reverse().find((message) => message.role === "user" && message.text !== question)?.text ?? "";
  const subject = /^i mean the /i.test(question) ? `${previousQuestion} ${question}` : question;
  const ordinals = /\bfirst two\b/i.test(subject) ? [0, 1] : [...subject.matchAll(/\b(first|second|third)\b/gi)].map((match) => ({ first: 0, second: 1, third: 2 }[match[1]!.toLowerCase()]!));
  if (/\bthat one\b/i.test(subject) && !ordinals.length && research.products.length > 1) return { text: "Which displayed option do you mean, the first, second, or third? I will use its retained evidence." };
  const selected = ordinals.length ? research.products.filter((_, index) => ordinals.includes(index)) : research.products;
  if (!selected.length || ordinals.some((index) => !research.products[index])) return { text: "That option is not present in the retained comparison." };
  const unchanged = state.intent.requirements.filter((requirement) => requirement.strength === "hard").every((requirement) => research.intent.requirements.some((prior) => prior.id === requirement.id && prior.text === requirement.text && prior.strength === "hard"));
  const current = selected.map((product) => {
    const assessed = assessProduct(product, state.intent);
    return unchanged ? assessed : { ...assessed, eligible: false, blockers: [...assessed.blockers, "The retained evidence has not assessed the changed requirements."] };
  });
  const supportText = (assessment: typeof research.products[number]["identity"]) => {
    const spans = assessment.support.map((span) => {
      const source = research.sources.find((item) => item.id === span.sourceId);
      return source ? ` "${span.quote}" (${source.url})` : "";
    }).join("");
    return `${assessment.rationale} (${assessment.status}).${spans}`;
  };
  const fixture = research.dataKind === "test-fixture" ? "Fixture data. " : "";
  const display = (text: string, paragraphs: string[]): HeldReply => {
    const full = paragraphs.join("\n\n");
    if (state.intent.responseLength === "expanded" && full.length <= 6000) return { text: full };
    let detail = "";
    for (const paragraph of paragraphs) {
      if (detail.length + paragraph.length > 23800) {
        detail += "\n\nAdditional complete evidence remains in the original research message. Open its evidence and tradeoffs for the full retained passages.";
        break;
      }
      detail += `${detail ? "\n\n" : ""}${paragraph}`;
    }
    return { text: fixture + text, detail };
  };
  if (mode === "best") {
    const chosen = current.find((product) => product.id === research.choice?.productId && product.eligible);
    return chosen
      ? display(`${chosen.name} is the retained source-supported option. Merchant price, stock and delivery remain unverified.`, [`${fixture}${chosen.name}. ${research.choice!.rationale} ${supportText(chosen.requestMatch)}`])
      : display(`I cannot choose a compliant best option from the retained evidence.${!unchanged ? " The retained evidence has not assessed the changed requirements." : " The options have unresolved requirements."}`, current.map((product) => `${product.name}: ${product.blockers.join(" ")}`));
  }
  const ordered = mode === "cheaper" ? [...current].sort((a, b) => a.eligible !== b.eligible ? Number(b.eligible) - Number(a.eligible) : a.eligible && a.price && b.price && a.price.currency === b.price.currency ? a.price.amount - b.price.amount : 0) : current;
  const topics = subject.toLowerCase().match(/[a-z][a-z-]{3,}/g)?.filter((word) => !["what", "about", "which", "their", "compare", "first", "second", "third", "options", "machine", "mean", "good", "stronger", "evidence"].includes(word)) ?? [];
  const rows = (product: typeof current[number]) => mode === "held-question" || /their /i.test(question) ? product.attributes.filter((attribute) => topics.some((topic) => attribute.name.toLowerCase().includes(topic) || topic.includes(attribute.name.toLowerCase()))) : product.attributes;
  const findingsByProduct = ordered.map((product) => {
    const attributes = rows(product);
    const findings = attributes.slice(0, 2).map(({ name, assessment }) => {
      const status = `AI source assessment ${assessment.status}, ${assessment.scope}`;
      const qualified = assessment.rationale;
      return `${name}: (${status})${assessment.support.length && qualified.length <= 180 ? ` ${qualified}` : ""}`;
    }).join("; ");
    return { name: product.name, finding: `${findings || "Missing attributes remain unknown."}${product.blockers.length ? " Unresolved requirements remain." : ""}` };
  });
  const sameFinding = findingsByProduct.every((row) => row.finding === findingsByProduct[0]?.finding);
  const brief = (sameFinding
    ? `${findingsByProduct[0]!.name}: ${findingsByProduct[0]!.finding}${findingsByProduct.length > 1 ? `\nSame assessment status for ${findingsByProduct.slice(1).map((row) => row.name).join(" and ")}.` : ""}`
    : findingsByProduct.map((row) => `${row.name}: ${row.finding}`).join("\n\n"))
    + "\n\nFull findings and price conditions are in the details. Stock and delivery remain unverified.";
  const full = ordered.map((product, index) => {
    const attributes = rows(product);
    const detail = attributes.length ? attributes.map((attribute) => `${attribute.name}: ${supportText(attribute.assessment)}`).join("; ") : "No supported detail was retained for this question. Missing attributes remain unknown.";
    const price = product.price ? ` Observed ${product.price.currency} ${product.price.amount}. ${product.price.conditions.join(" ")} ${supportText(product.price.assessment)} Stock and delivery remain unverified.` : " No qualifying observed price was retained.";
    return `${index === 0 ? fixture : ""}${product.name}: ${detail}${price}${product.blockers.length ? ` Unresolved: ${product.blockers.join(" ")}` : ""}`;
  });
  return display(brief, full);
}

export function reduceTurn(previous: ConversationState, input: PrepareInput): TurnDecision {
  const state = structuredClone(previous);
  const text = input.message.trim();
  const editText = text.replace(/^(?:actually|please)[, ]+|^my new budget is /i, "");
  const command = normalize(text);
  const userId = input.operationId;
  state.revision++;
  state.messages.push({ id: userId, role: "user", text });
  const reply = (content: string | HeldReply, kind: "message" | "clarification" = "message"): TurnDecision => {
    const message = typeof content === "string" ? { text: content } : content;
    state.messages.push({ id: `${userId}-reply`, role: "assistant", ...message });
    return { state, kind, message: message.text };
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
  const operation = localOperations.find((operation) => operation.matches.test(command))?.kind;
  const changeText = command.replace(/don't change my existing budget/g, "");
  const unsupportedCompound = /\b(?:and|but|also|then)\b|[.;!?]\s+/.test(changeText) && (/\b(?:make it|change|remove|drop|budget|currency|must|need|want|prefer|only|without|no longer|cheaper)\b/.test(changeText) || monetaryDraft(changeText) !== null);
  if (operation && !["theme", "error", "remember"].includes(operation) && unsupportedCompound) return pendingEdit("I kept the complete combined instruction pending because it includes a request change I cannot safely combine with this operation. No part was applied.");
  if (operation === "short" || operation === "detail") {
    state.intent.responseLength = operation === "detail" ? "expanded" : "concise";
    return reply(operation === "detail" ? heldReply(state, "detail", text) : "I'll keep replies short.");
  }
  if (operation === "theme") return reply("Use the light/dark theme toggle in the header. Your selection is saved for your next visit.");
  if (operation === "help") return reply("Describe what you want to buy and any requirements. I research sources with Exa, compare evidence, and link to product pages. Research submissions can use paid Exa credits. Viewing existing evidence is free.");
  if (operation === "remember") return reply([state.intent.productDescription || "No shopping request is accepted yet.", state.intent.budget ? `Budget ${state.intent.budget.currency} ${state.intent.budget.minimum ?? "no minimum"} to ${state.intent.budget.maximum ?? "no maximum"}.` : "No budget is set."].join("\n"));
  if (operation === "sources") {
    const research = lastResearch(state);
    return reply(research?.sources.length ? research.sources.map((source) => `${source.title} (${source.url})`).join("\n") : "No validated supporting source is retained. I cannot open an invented link.");
  }
  if (operation === "error") return reply([...state.messages].reverse().find((message) => message.role === "assistant")?.text ?? "No successful research response is retained. Your accepted requirements remain unchanged. An explicit retry is subject to the existing research limits.");
  if (operation === "cancel") {
    state.pending = null;
    const message = "Any active application research is cancelled. Your accepted requirements remain available.";
    state.messages.push({ id: `${userId}-reply`, role: "assistant", text: message });
    return { state, kind: "cancel", message };
  }
  if (operation === "status") return reply("This status question does not start research. Transport cancellation status is shown by the active research operation; this message cannot confirm a provider stopped.");
  if (operation === "dissatisfied") return reply("What should change, such as price, size, or a specific feature? Your existing requirements remain active.");
  if (operation === "selection") {
    const held = heldReply(state, "detail", text);
    return reply({ ...held, text: "Your existing budget and requirements remain active. " + held.text });
  }
  if (operation === "cheaper") {
    if (state.intent.requirements.length >= 24) return reply("The requirement limit is reached. Your accepted requirements remain unchanged.");
    if (!state.intent.requirements.some((requirement) => requirement.text === text)) state.intent.requirements.push({ id: `requirement-${userId}`, text, strength: "flexible", originMessageId: userId, kind: "preference" });
    state.intent.productDescription = state.intent.requirements.map((requirement) => requirement.text).join("\n");
    return reply(heldReply(state, "cheaper", text));
  }
  if (operation === "compare" || operation === "best" || operation === "held-question") return reply(heldReply(state, operation, text));
  if (["discard pending change", "cancel that change"].includes(command)) { state.pending = null; return reply("The pending change was discarded. Your accepted requirements are unchanged."); }
  if (state.pending?.kind === "currency") {
    const answer = /^(?:actually,?\s*)?(SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR)\b[.,;!?]?\s*(.*)$/i.exec(text);
    const resolved = answer ? currency(answer[1]!) : null;
    if (!resolved) return reply("Which currency applies to the saved amount? For example, SGD or USD.", "clarification");
    if (answer?.[2] && /\b(?:remove|drop|change|budget|make it|currency)\b/i.test(answer[2])) return reply("The currency and saved amount remain pending. Give only the currency first, then submit the complete change separately.", "clarification");
    const draft = state.pending;
    state.intent = { ...draft.draft, budget: BudgetSchema.parse({ minimum: draft.minimum, maximum: draft.maximum, currency: resolved }) };
    state.pending = null;
    if (answer?.[2]) { state.intent.requirements.push(...requirementClauses(answer[2], userId, false)); state.intent.productDescription += `\n${answer[2]}`; }
    return { state, kind: "research" };
  }
  if (state.pending?.kind === "edit") return reply(`${state.pending.explanation} You can explicitly discard the pending change to keep your accepted request.`, "clarification");
  if (operation === "retry") return state.intent.originalText ? { state, kind: "research" } : reply("What are you shopping for?", "clarification");
  if (state.intent.originalText && /\b(?:make it|change|remove|drop|budget|currency)\b.*\b(?:and|but|also)\b|\b(?:and|but|also)\b.*\b(?:make it|remove|drop|budget|currency)\b/i.test(text)) return pendingEdit("I kept this complete change pending because I cannot safely apply its combined edits. State each change separately. No part was applied.");
  const correctedCurrency = /^(?:(?:actually|i meant|change currency to)[, ]+)?(SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR)(?:,? not (SGD|USD|EUR|GBP|AUD|CAD|MYR|JPY|INR))?\.?$/i.exec(text);
  if (correctedCurrency) {
    if (!state.intent.budget) return reply("There is no accepted budget to relabel. State an amount with the currency.", "clarification");
    state.intent.budget.currency = currency(correctedCurrency[1]!)!;
    return { state, kind: "research" };
  }
  if (["remove budget", "remove the budget", "no budget limit", "no budget"].includes(command)) { state.intent.budget = null; return { state, kind: "research" }; }
  const abandoning = /^(?:actually[, ]+)?(?:forget|abandon|discard) (?:the |that |my )?.+?[.!;]\s*(?:i (?:want|need|would like)|find|recommend)/i.test(text);
  const newObjective = abandoning || /^(?:actually[, ]+)?(?:i (?:want|need|would like)|find|recommend|looking for)\b/i.test(text);
  const requestIntent: ShoppingIntent = abandoning ? { ...state.intent, originalText: "", productDescription: "", requirements: [], budget: null, region: null } : structuredClone(state.intent);
  if (!requestIntent.originalText || newObjective) {
    const retainedHard = requestIntent.requirements.filter((requirement) => requirement.kind === "request").flatMap((requirement) => {
      const clauses = requirement.text.match(/\b(?:must|without|no|only|excluding|at least|with)\b[^.;]+/gi) ?? [];
      return clauses.map((clause, index) => ({ ...requirement, id: `${userId}-retained-${index}`, text: clause, kind: "preference" as const }));
    });
    requestIntent.originalText = text;
    requestIntent.requirements = [...requestIntent.requirements.filter((requirement) => requirement.kind !== "request"), ...retainedHard, ...requirementClauses(text, userId, true)];
    requestIntent.productDescription = requestIntent.requirements.map((requirement) => requirement.text).join("\n");
  }
  const quotedObservation = state.intent.originalText && /\b(?:page|source|seller|website|says|shows|quote|advertis)\b/i.test(text);
  const money = quotedObservation ? null : monetaryDraft(editText);
  if (money) {
    if ((money.minimum !== undefined && !MoneySchema.safeParse(money.minimum).success) || (money.maximum !== undefined && !MoneySchema.safeParse(money.maximum).success) || (money.minimum !== undefined && money.maximum !== undefined && money.minimum > money.maximum)) return pendingEdit("That budget is not a valid positive range. Your accepted budget is unchanged. Discard this pending change, then state a valid amount.");
    const draft = requestIntent;
    const unit = money.currency ?? draft.budget?.currency;
    const bounds = { minimum: money.minimum ?? draft.budget?.minimum, maximum: money.maximum ?? draft.budget?.maximum };
    const extra = money.remainder.replace(/^[.,;!?\s]+|[.,;!?\s]+$/g, "").trim() ? text : "";
    if (extra && state.intent.originalText && !newObjective) { draft.requirements.push(...requirementClauses(extra, userId, false)); draft.productDescription += `\n${extra}`; }
    if (bounds.minimum !== undefined && bounds.maximum !== undefined && bounds.minimum > bounds.maximum) return pendingEdit("The new budget would put the maximum below the retained minimum. State both bounds or explicitly remove the old minimum. No budget change was applied.");
    if (draft.requirements.length > 24) return pendingEdit("This complete change exceeds the requirement limit. Your accepted request is unchanged.");
    if (!unit) {
      state.intent = { ...draft, budget: abandoning ? null : state.intent.budget };
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
    for (const requirement of state.intent.requirements.filter((r) => r.kind === "request")) requirement.text = requirement.text.replace(new RegExp(`\\b[Oo][Nn][Ll][Yy]\\s+${brandName}(?=[.;!?]|$)`, "g"), "").trim();
    state.intent.requirements = state.intent.requirements.filter((r) => r.kind !== "brand");
    state.intent.productDescription = state.intent.requirements.map((r) => r.text).join("\n");
    return { state, kind: "research" };
  }
  if (!newObjective && /^(?:actually|i meant)\b/i.test(text) && /\d/.test(text)) {
    const correction = /^(?:actually|i meant)[, ]+([a-z][a-z -]{0,39}?)\s+(\d{1,9}(?:\.\d{1,6})?)\s*([a-z%]{0,8})[.!?]?$/i.exec(text);
    if (!correction) return pendingEdit("I kept this complete correction pending. Open Edit preferences to change the intended criterion, or discard this pending change. Your accepted requirements are unchanged.");
    const name = correction[1]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${name}\\s+(\\d+(?:\\.\\d+)?)(?!\\d|\\.\\d)`, "gi");
    const targets = state.intent.requirements.flatMap((requirement) => [...requirement.text.matchAll(pattern)].map((match) => ({ requirement, match })));
    if (targets.length !== 1) return pendingEdit(`Which single ${correction[1]} criterion should change? Open Edit preferences to identify it, or discard this pending change. No part was applied.`);
    const { requirement, match } = targets[0]!;
    const valueStart = match.index! + match[0].length - match[1]!.length;
    const suffix = requirement.text.slice(valueStart + match[1]!.length);
    if (/^\s*(?:[a-z%]{1,8}\s*)?(?:[-–/]|\b(?:to|or|and)\s+\d)/i.test(suffix)) return pendingEdit("The retained attribute contains a range or alternative, rather than one scalar. Open Edit preferences to specify the complete criterion. No part was applied.");
    if (correction[3] && !new RegExp(`^\\s*${correction[3]}\\b`, "i").test(suffix)) return pendingEdit("The requested unit does not match the retained scalar. Open Edit preferences to specify the complete criterion. No part was applied.");
    requirement.text = requirement.text.slice(0, valueStart) + correction[2]! + suffix;
    requirement.originMessageId = userId;
    const originalMatches = [...state.intent.originalText.matchAll(pattern)];
    if (originalMatches.length === 1 && originalMatches[0]![1] === match[1]) state.intent.originalText = state.intent.originalText.replace(pattern, (whole) => whole.slice(0, -match[1]!.length) + correction[2]!);
    state.intent.productDescription = state.intent.requirements.map((row) => row.text).join("\n");
    return { state, kind: "research" };
  }
  if (!state.intent.originalText || newObjective) {
    state.intent = requestIntent;
  } else {
    const brand = brandClause.test(text.replace(/[.!?]+$/, ""));
    const kind = brand ? "brand" : /^(?:no|avoid|exclude|without)\b/i.test(text) ? "exclusion" : "preference";
    const clauses = requirementClauses(text, userId, false);
    state.intent.requirements.push(...clauses.map((requirement) => ({ ...requirement, kind: kind === "brand" ? "brand" as const : requirement.kind })));
  }
  if (state.intent.requirements.length > 24) { state.intent = structuredClone(previous.intent); return pendingEdit("This conversation has reached its requirement limit. Start a new chat or explicitly remove a requirement."); }
  state.intent.productDescription = state.intent.requirements.map((r) => r.text).join("\n");
  if (/\bsuitable for Singapore\b/i.test(text)) state.intent.region = "SG";
  if (!previous.intent.originalText && /\breplacement\b.+\bfor my\b/i.test(text) && !/\b(?:model|fitting|thread|connector|\d+\s*mm)\b/i.test(text)) return reply("What model and attachment or fitting must the replacement match? I need that compatibility detail before research.", "clarification");
  return { state, kind: "research" };
}
