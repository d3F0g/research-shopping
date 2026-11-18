import type { Preferences } from "./contracts";
import { conversationalReply, updatePreferences } from "./preferences";
import type { ApplicationTurnResponse } from "./research";

export function conversationPolicy(message: string, previous: Preferences) {
  const ordinary = conversationalReply(message, previous);
  const update = updatePreferences(message, previous);
  const { preferences, notes } = update;
  let reply: ApplicationTurnResponse | null = null;
  if (ordinary)
    reply = {
      kind: "message",
      message: ordinary,
      preferences: structuredClone(previous),
      notes: [],
      toolActivity: [],
    };
  else if (update.clarification)
    reply = {
      kind: "clarification",
      ...update.clarification,
      preferences,
      notes,
      toolActivity: [],
    };
  else if (
    /^(?:(?:please )?(?:shorter|concise|brief|briefly|less detail|keep it short|more details?|detailed|expanded|explain more|in depth))[.!?]*$/i.test(
      message.trim(),
    )
  ) {
    reply = {
      kind: "message",
      message:
        preferences.soft.responseLength === "expanded"
          ? "I’ll keep more detail in future responses. Open the evidence on the existing research cards to inspect their source quotations."
          : "I’ll keep future responses concise. Your existing research and source links remain above.",
      preferences,
      notes,
      toolActivity: [],
    };
  }
  return {
    preferences: reply?.preferences ?? preferences,
    notes,
    reply,
    budgetContext:
      !reply &&
      !preferences.hard.budget &&
      !update.budgetRemoved &&
      preferences.hard.category
        ? `${preferences.hard.category}:${preferences.hard.region}`
        : null,
  };
}

export function preferenceDisplay(preferences: Preferences) {
  const budget = preferences.hard.budget;
  return `Update preferences. ${preferences.hard.category ?? "Choose a category"}${budget ? `, under ${budget.currency} ${budget.amount}` : ", no budget cap"}.`;
}
