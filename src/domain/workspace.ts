import { z } from "zod";
import { defaultPreferences, PreferencesSchema } from "./contracts";
import { ApplicationTurnResponseSchema } from "./research";
import { validBudgetAmount } from "./preferences";

export const WORKSPACE_LIMIT = 256 * 1024;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const PENDING_MS = 120_000;
const Revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const PreferenceInput = PreferencesSchema.extend({
  hard: PreferencesSchema.shape.hard
    .extend({
      budget: PreferencesSchema.shape.hard.shape.budget
        .unwrap()
        .strict()
        .refine((b) => validBudgetAmount(b.amount))
        .nullable(),
    })
    .strict(),
  soft: PreferencesSchema.shape.soft.strict(),
}).strict();
export const WorkspaceCommandSchema = z
  .object({
    revision: Revision,
    operationId: z.string().uuid(),
    command: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("message"),
          text: z.string().trim().min(1).max(2000),
        })
        .strict(),
      z
        .object({
          kind: z.literal("apply-preferences"),
          preferences: PreferenceInput,
        })
        .strict(),
      z.object({ kind: z.literal("skip-budget") }).strict(),
      z
        .object({ kind: z.literal("cancel"), target: z.string().uuid() })
        .strict(),
      z.object({ kind: z.literal("new-chat") }).strict(),
      z.object({ kind: z.literal("delete-saved-data") }).strict(),
    ]),
  })
  .strict();
export type WorkspaceCommand = z.infer<typeof WorkspaceCommandSchema>;
export type WorkspaceAction = WorkspaceCommand["command"];
export const SavedTurnSchema = z.object({
  id: z.string().uuid(),
  operationId: z.string().uuid(),
  digest: z.string().length(64),
  createdAt: z.string().datetime(),
  message: z.string().max(2400),
  request: z.object({
    message: z.string().max(2000),
    preferences: PreferencesSchema,
  }),
  body: z.discriminatedUnion("status", [
    z.object({ status: z.literal("pending") }),
    z.object({
      status: z.literal("question"),
      question: z.literal("budget"),
      preferences: PreferencesSchema,
    }),
    z.object({
      status: z.literal("complete"),
      value: ApplicationTurnResponseSchema,
    }),
    z.object({
      status: z.literal("interrupted"),
      reason: z.enum(["cancelled", "timeout", "failed", "too-large"]),
    }),
  ]),
});
const ReceiptSchema = z.object({
  operationId: z.string().uuid(),
  digest: z.string().length(64),
  status: z.enum(["pending", "complete", "interrupted"]),
  createdAt: z.string().datetime(),
});
export const WorkspaceDataSchema = z.object({
  schema: z.literal(1),
  preferences: PreferencesSchema,
  mutatedAt: z.string().datetime().nullable(),
  budgetQuestions: z.array(z.string().max(80)).max(16),
  turns: z.array(SavedTurnSchema).max(50),
  receipts: z.array(ReceiptSchema).max(64),
  pending: z
    .object({
      operationId: z.string().uuid(),
      sessionId: z.string().max(256),
      revision: Revision,
      epoch: Revision,
      deadline: z.string().datetime(),
    })
    .nullable(),
});
export type WorkspaceData = z.infer<typeof WorkspaceDataSchema>;
export const WorkspaceSnapshotSchema = z.object({
  revision: Revision,
  epoch: Revision,
  preferences: PreferencesSchema,
  budgetQuestions: z.array(z.string()),
  turns: z.array(SavedTurnSchema),
  pendingOperationId: z.string().uuid().nullable(),
});
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;
export const WorkspaceResultSchema = z.object({
  workspace: WorkspaceSnapshotSchema,
  operation: ReceiptSchema.pick({ operationId: true, status: true }).nullable(),
});
export type WorkspaceResult = z.infer<typeof WorkspaceResultSchema>;
export const AccountStateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("guest-only") }),
  z.object({ status: z.literal("unavailable") }),
  z.object({ status: z.literal("guest") }),
  z.object({
    status: z.literal("signed-in"),
    user: z.object({ id: z.string(), email: z.string() }),
    workspace: WorkspaceSnapshotSchema,
  }),
]);
export type AccountState = z.infer<typeof AccountStateSchema>;
export function emptyWorkspace(): WorkspaceData {
  return {
    schema: 1,
    preferences: defaultPreferences(),
    mutatedAt: null,
    budgetQuestions: [],
    turns: [],
    receipts: [],
    pending: null,
  };
}
export function workspaceBytes(data: WorkspaceData) {
  return new TextEncoder().encode(JSON.stringify(data)).byteLength;
}
export function boundWorkspace(data: WorkspaceData) {
  while (data.turns.length > 50) data.turns.shift();
  while (data.receipts.length > 64) data.receipts.shift();
  while (workspaceBytes(data) > WORKSPACE_LIMIT - 1024 && data.turns.length > 1)
    data.turns.shift();
  while (
    workspaceBytes(data) > WORKSPACE_LIMIT - 1024 &&
    data.receipts.length > 1
  )
    data.receipts.shift();
  return workspaceBytes(data) <= WORKSPACE_LIMIT - 1024;
}
