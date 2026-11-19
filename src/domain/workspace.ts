import { z } from "zod";
import { initialConversation, PrepareInputSchema, ShoppingIntentSchema, type ConversationState, type TurnResponse } from "./conversation";
import { StoredConversationV2Schema, StoredResearchV2Schema, StoredWorkspaceV2Schema } from "./workspace-history-v2";
import { ResearchSnapshotSchema } from "./research-history-v3";
export { StoredConversationV2Schema, StoredResearchV2Schema } from "./workspace-history-v2";

export const WORKSPACE_LIMIT = 256 * 1024;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const PENDING_MS = 120_000;
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Id = z.string().uuid();
export const StoredConversationSchema = StoredConversationV2Schema.extend({
  intent: ShoppingIntentSchema,
  messages: z.array(z.strictObject({ id: z.string().max(100), role: z.enum(["user", "assistant"]), text: z.string().max(6000), detail: z.string().max(24000).optional(), research: z.union([StoredResearchV2Schema, ResearchSnapshotSchema]).optional() })).max(200),
});
export const WorkspaceDataSchema = StoredWorkspaceV2Schema.extend({ schema: z.literal(3), state: StoredConversationSchema });
export function readWorkspaceData(value: unknown): { data: WorkspaceData; migrated: boolean } {
  if (typeof value === "object" && value !== null && "schema" in value && value.schema === 2) {
    const previous = StoredWorkspaceV2Schema.parse(value);
    return { migrated: true, data: WorkspaceDataSchema.parse({
      ...previous, schema: 3, pending: null,
      state: { ...previous.state, intent: ShoppingIntentSchema.parse(previous.state.intent) },
      receipts: previous.receipts.map((receipt) => receipt.status === "prepared" || receipt.status === "running" ? { ...receipt, status: "interrupted" } : receipt),
    }) };
  }
  return { data: WorkspaceDataSchema.parse(value), migrated: false };
}
export type WorkspaceData = Omit<z.infer<typeof WorkspaceDataSchema>, "state"> & { state: ConversationState };
export const WorkspaceSnapshotSchema = z.strictObject({ revision: Revision, epoch: Revision, state: StoredConversationSchema, pendingOperationId: Id.nullable(), pendingPreparedId: Id.nullable() });
export type WorkspaceSnapshot = Omit<z.infer<typeof WorkspaceSnapshotSchema>, "state"> & { state: ConversationState };
export type WorkspaceResult = { workspace: WorkspaceSnapshot; response: TurnResponse | null; operation: { operationId: string; status: WorkspaceData["receipts"][number]["status"] } | null };
export const WorkspaceCommandSchema = z.discriminatedUnion("phase", [
  PrepareInputSchema.extend({ revision: Revision }),
  z.strictObject({ phase: z.literal("research"), revision: Revision, preparedId: Id }),
  z.strictObject({ phase: z.literal("cancel"), revision: Revision, operationId: Id, target: Id }),
  z.strictObject({ phase: z.literal("new-chat"), revision: Revision, operationId: Id }),
  z.strictObject({ phase: z.literal("delete-saved-data"), revision: Revision, operationId: Id }),
]);
export type WorkspaceCommand = z.infer<typeof WorkspaceCommandSchema>;
export const AccountStateSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("guest-only") }), z.strictObject({ status: z.literal("unavailable") }), z.strictObject({ status: z.literal("guest") }),
  z.strictObject({ status: z.literal("signed-in"), user: z.strictObject({ id: z.string(), email: z.string() }), workspace: WorkspaceSnapshotSchema }),
]);
export type AccountState = Exclude<z.infer<typeof AccountStateSchema>, { status: "signed-in" }> | { status: "signed-in"; user: { id: string; email: string }; workspace: WorkspaceSnapshot };
export function emptyWorkspace(): WorkspaceData {
  return { schema: 3, state: initialConversation(), acceptedAt: null, turns: [], receipts: [], pending: null };
}
export function workspaceBytes(data: WorkspaceData): number { return new TextEncoder().encode(JSON.stringify(data)).byteLength; }
export function boundWorkspace(data: WorkspaceData, protectedOperationId?: string): boolean {
  const removeTurn = () => {
    const index = data.turns.findIndex((turn) => turn.operationId !== data.pending?.operationId && turn.operationId !== protectedOperationId);
    if (index < 0) return false;
    const [turn] = data.turns.splice(index, 1);
    const ids = new Set(turn.messageIds);
    data.state.messages = data.state.messages.filter((message) => !ids.has(message.id));
    return true;
  };
  while (data.turns.length > 50 && removeTurn()) {}
  while (data.receipts.length > 64) {
    const index = data.receipts.findIndex((receipt) => receipt.operationId !== data.pending?.operationId);
    if (index < 0) break;
    data.receipts.splice(index, 1);
  }
  while (workspaceBytes(data) > WORKSPACE_LIMIT - 1024 && data.turns.length > 1 && removeTurn()) {}
  return workspaceBytes(data) <= WORKSPACE_LIMIT - 1024;
}
