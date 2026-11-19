import { constants } from "node:fs";
import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { IntentActionsSchema, type IntentActions } from "../domain/intent-actions";

const Receipt = z.strictObject({
  operationId: z.string().uuid(), inputHash: z.string().length(64),
  reservedUsd: z.literal(0.05), state: z.enum(["pending", "complete", "uncertain"]),
  interpretation: IntentActionsSchema.nullable(),
  usage: z.strictObject({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative() }).nullable(),
  estimatedCostUsd: z.number().nonnegative().nullable(),
});
const Ledger = z.strictObject({ version: z.literal(1), stopped: z.boolean(), receipts: z.array(Receipt).max(2) });
type Ledger = z.infer<typeof Ledger>;
export type IntentUsage = NonNullable<z.infer<typeof Receipt>["usage"]>;

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
    async settle(operationId: string, interpretation: IntentActions | null, usage: IntentUsage | null): Promise<void> {
      await change((ledger) => {
        const receipt = ledger.receipts.find((entry) => entry.operationId === operationId);
        if (!receipt || receipt.state !== "pending") throw new Error("Intent receipt is not pending");
        const estimatedCostUsd = usage ? (usage.inputTokens * 2 + usage.outputTokens * 10) / 1_000_000 : null;
        receipt.usage = usage;
        receipt.estimatedCostUsd = estimatedCostUsd;
        receipt.interpretation = interpretation;
        receipt.state = interpretation && usage && usage.inputTokens <= 12_000 && usage.outputTokens <= 2048 && estimatedCostUsd !== null && estimatedCostUsd <= receipt.reservedUsd ? "complete" : "uncertain";
        if (receipt.state === "uncertain") ledger.stopped = true;
      });
    },
  };
}
