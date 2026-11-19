import { z } from "zod";
import { StoredConversationV2Schema, StoredResearchV2Schema, StoredWorkspaceV2Schema } from "./workspace-history-v2";
import { ResearchSnapshotSchema, ShoppingIntentSchema } from "./research-history-v3";

export const StoredConversationV3Schema = StoredConversationV2Schema.extend({
  intent: ShoppingIntentSchema,
  messages: z.array(z.strictObject({ id: z.string().max(100), role: z.enum(["user", "assistant"]), text: z.string().max(6000), detail: z.string().max(24000).optional(), research: z.union([StoredResearchV2Schema, ResearchSnapshotSchema]).optional() })).max(200),
});
export const StoredWorkspaceV3Schema = StoredWorkspaceV2Schema.extend({ schema: z.literal(3), state: StoredConversationV3Schema });
