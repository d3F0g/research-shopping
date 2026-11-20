import { z } from "zod";
import type { ResearchSnapshot } from "./research";
import type { ResearchSnapshot as StoredResearchV3 } from "./research-history-v3";
import type { ResearchSnapshot as StoredResearchV4 } from "./research-history-v4";
import type { StoredResearchV2 } from "./workspace-history-v2";
export type DeepReadonly<T> = T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> } : T;
export type RenderableResearch = DeepReadonly<ResearchSnapshot | StoredResearchV4 | StoredResearchV3 | StoredResearchV2>;

export const MoneySchema = z
  .number()
  .finite()
  .positive()
  .max(1_000_000)
  .refine((n) => Math.round(n * 100) / 100 === n);
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/);
export const BudgetSchema = z
  .strictObject({
    minimum: MoneySchema.optional(),
    maximum: MoneySchema.optional(),
    currency: CurrencySchema,
  })
  .refine(
    (b) =>
      (b.minimum !== undefined || b.maximum !== undefined) &&
      (b.minimum === undefined ||
        b.maximum === undefined ||
        b.minimum <= b.maximum),
  );
export const RequirementSchema = z.strictObject({
  id: z.string().max(80),
  text: z.string().min(1).max(2000),
  strength: z.enum(["hard", "flexible"]),
  originMessageId: z.string().max(80),
  kind: z.enum(["request", "brand", "exclusion", "preference"]),
});
export const ShoppingIntentSchema = z.strictObject({
  intentVersion: z.literal(2),
  originalText: z.string().max(2000),
  productDescription: z.string().max(6000),
  requirements: z
    .array(RequirementSchema)
    .max(24)
    .refine((r) => new Set(r.map((v) => v.id)).size === r.length),
  budget: BudgetSchema.nullable(),
  region: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
  responseLength: z.enum(["concise", "expanded"]),
});
export type ShoppingIntent = z.infer<typeof ShoppingIntentSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type Requirement = z.infer<typeof RequirementSchema>;
export type PendingChange =
  | {
      kind: "currency";
      id: string;
      originalRequest: string;
      draft: ShoppingIntent;
      minimum?: number;
      maximum?: number;
    }
  | { kind: "edit"; id: string; message: string; explanation: string };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  detail?: string;
  research?: RenderableResearch;
};
export type ConversationState = {
  version: 2;
  revision: number;
  intent: ShoppingIntent;
  pending: PendingChange | null;
  messages: ChatMessage[];
};
export type TurnDecision =
  | { state: ConversationState; kind: "research" }
  | {
      state: ConversationState;
      kind: "message" | "clarification" | "cancel";
      message: string;
    };
export const IntentEditSchema = z.strictObject({
  description: z.string().trim().min(1).max(2000),
  requirements: z
    .array(
      z.strictObject({
        id: z.string().max(80),
        text: z.string().trim().min(1).max(2000),
        strength: z.enum(["hard", "flexible"]),
      }),
    )
    .max(23)
    .refine((r) => new Set(r.map((v) => v.id)).size === r.length),
  budget: BudgetSchema.nullable(),
});
export const PrepareInputSchema = z.strictObject({
  phase: z.literal("prepare"),
  operationId: z.string().uuid(),
  message: z.string().trim().min(1).max(2000),
  questionId: z.string().max(80).optional(),
  edit: IntentEditSchema.optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
});
export const ResearchInputSchema = z.strictObject({
  phase: z.literal("research"),
  preparedId: z.string().uuid(),
});
export const TurnInputSchema = z.discriminatedUnion("phase", [
  PrepareInputSchema,
  ResearchInputSchema,
]);
export type PrepareInput = z.infer<typeof PrepareInputSchema>;
export type TurnResponse =
  | { kind: "prepared"; preparedId: string; state: ConversationState }
  | {
      kind: "message" | "clarification";
      message: string;
      state: ConversationState;
    }
  | { kind: "research"; research: ResearchSnapshot; state: ConversationState }
  | {
      kind: "research-unavailable";
      reason: string;
      message: string;
      state: ConversationState;
    };

export function initialConversation(): ConversationState {
  return {
    version: 2,
    revision: 0,
    intent: {
      intentVersion: 2,
      originalText: "",
      productDescription: "",
      requirements: [],
      budget: null,
      region: null,
      responseLength: "concise",
    },
    pending: null,
    messages: [],
  };
}
