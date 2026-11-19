import { constants } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { IntentActionsSchema, type IntentActions } from "../domain/intent-actions";

const Usage = z.strictObject({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() });
export type IntentUsage = z.infer<typeof Usage>;
const estimateCost = (usage: IntentUsage) => (usage.inputTokens * 2 + usage.outputTokens * 10) / 1_000_000;
const withinAllowance = (usage: IntentUsage) => usage.inputTokens <= 12_000 && usage.outputTokens <= 2048 && estimateCost(usage) <= 0.05;
const Receipt = z.strictObject({
  operationId: z.string().uuid(), inputHash: z.string().regex(/^[a-f0-9]{64}$/),
  reservedUsd: z.literal(0.05), state: z.enum(["pending", "complete", "uncertain"]),
  interpretation: IntentActionsSchema.nullable(),
  usage: Usage.nullable(),
  estimatedCostUsd: z.number().finite().nonnegative().nullable(),
}).superRefine((receipt, context) => {
  if (receipt.estimatedCostUsd !== (receipt.usage ? estimateCost(receipt.usage) : null))
    context.addIssue({ code: "custom", message: "Receipt estimate must match retained usage" });
  if (receipt.state === "pending" && (receipt.interpretation !== null || receipt.usage !== null || receipt.estimatedCostUsd !== null))
    context.addIssue({ code: "custom", message: "Pending receipts cannot contain settlement data" });
  if (receipt.state === "complete" && (!receipt.interpretation || !receipt.usage || !withinAllowance(receipt.usage)))
    context.addIssue({ code: "custom", message: "Completed receipts require valid actions and usage within the allowance" });
});
const Ledger = z.strictObject({ version: z.literal(1), stopped: z.boolean(), receipts: z.array(Receipt).max(2) }).superRefine((ledger, context) => {
  if (new Set(ledger.receipts.map((receipt) => receipt.operationId)).size !== ledger.receipts.length)
    context.addIssue({ code: "custom", message: "Receipt operation identities must be unique" });
  if (ledger.receipts.some((receipt, index) => receipt.state !== "complete" && index !== ledger.receipts.length - 1))
    context.addIssue({ code: "custom", message: "Unsettled or uncertain receipts cannot precede another dispatch" });
  if (!ledger.stopped && ledger.receipts.some((receipt) => receipt.state === "uncertain"))
    context.addIssue({ code: "custom", message: "Uncertain usage requires a stopped ledger" });
});
type Ledger = z.infer<typeof Ledger>;

export function createIntentReceipts(path: string) {
  if (!isAbsolute(path)) throw new Error("Intent receipt path must be absolute");
  async function change<T>(run: (ledger: Ledger) => T): Promise<T> {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const lock = await open(`${path}.lock`, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      let ledger: Ledger;
      try {
        const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { ledger = Ledger.parse(JSON.parse(await file.readFile("utf8"))); }
        finally { await file.close(); }
      } catch (error) {
        if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        ledger = { version: 1, stopped: false, receipts: [] };
      }
      const result = run(ledger);
      const file = await open(temporary, "wx", 0o600);
      try { await file.writeFile(JSON.stringify(Ledger.parse(ledger))); await file.sync(); }
      finally { await file.close(); }
      await rename(temporary, path);
      return result;
    } finally {
      await unlink(temporary).catch(() => undefined);
      await lock.close();
      await unlink(`${path}.lock`);
    }
  }
  return {
    async reserve(operationId: string, inputHash: string): Promise<{ status: "admitted" } | { status: "reused"; interpretation: IntentActions } | { status: "unavailable" }> {
      return change((ledger) => {
        const existing = ledger.receipts.find((receipt) => receipt.operationId === operationId);
        if (existing) return existing.inputHash === inputHash && existing.state === "complete" && existing.interpretation
          ? { status: "reused" as const, interpretation: existing.interpretation }
          : { status: "unavailable" as const };
        if (ledger.stopped || ledger.receipts.length >= 2 || ledger.receipts.some((receipt) => receipt.state !== "complete")) return { status: "unavailable" as const };
        ledger.receipts.push({ operationId, inputHash, reservedUsd: 0.05, state: "pending", interpretation: null, usage: null, estimatedCostUsd: null });
        return { status: "admitted" as const };
      });
    },
    async settle(operationId: string, interpretation: IntentActions | null, usage: IntentUsage | null): Promise<"complete" | "uncertain"> {
      return change((ledger) => {
        const receipt = ledger.receipts.find((entry) => entry.operationId === operationId);
        if (!receipt || receipt.state !== "pending") throw new Error("Intent receipt is not pending");
        const estimatedCostUsd = usage ? estimateCost(usage) : null;
        receipt.usage = usage;
        receipt.estimatedCostUsd = estimatedCostUsd;
        receipt.interpretation = interpretation;
        receipt.state = interpretation && usage && withinAllowance(usage) ? "complete" : "uncertain";
        if (receipt.state === "uncertain") ledger.stopped = true;
        return receipt.state;
      });
    },
  };
}
