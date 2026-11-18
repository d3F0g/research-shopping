import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import { z } from "zod";

const RESERVATION_USD = 0.05;
const MAX_ATTEMPTS = 40;
const ALLOWANCE_USD = 2;
const AttemptSchema = z
  .object({
    id: z.string().uuid(),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
    state: z.enum(["pending", "complete", "uncertain"]),
    reservedUsd: z.literal(RESERVATION_USD),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
  })
  .strict();
const LedgerSchema = z
  .object({
    version: z.literal(1),
    stopped: z.boolean(),
    attempts: z.array(AttemptSchema).max(MAX_ATTEMPTS),
  })
  .strict();
type Ledger = z.infer<typeof LedgerSchema>;
export type ResearchQuota = {
  reserve(
    id: string,
    digest: string,
  ): Promise<"admitted" | "quota" | "busy" | "duplicate">;
  settle(id: string, cost: number | null, successful: boolean): Promise<void>;
};

export function createResearchQuota(path: string): ResearchQuota {
  if (!isAbsolute(path))
    throw new Error("Research ledger path must be absolute");
  let serial = Promise.resolve();
  async function locked<T>(
    operation: (ledger: Ledger) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = serial;
    serial = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const lockPath = `${path}.lock`;
    let lock;
    try {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      lock = await open(lockPath, "wx", 0o600);
      let ledger: Ledger;
      try {
        const raw = await readFile(path, "utf8");
        if (raw.length > 64_000) throw new Error("Invalid research ledger");
        ledger = LedgerSchema.parse(JSON.parse(raw));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        ledger = { version: 1, stopped: false, attempts: [] };
      }
      const value = await operation(ledger);
      const temporary = `${path}.${randomUUID()}.tmp`;
      const file = await open(temporary, "wx", 0o600);
      try {
        await file.writeFile(JSON.stringify(ledger));
        await file.sync();
      } finally {
        await file.close();
      }
      await rename(temporary, path);
      return value;
    } finally {
      try {
        if (lock) {
          await lock.close();
          await unlink(lockPath);
        }
      } finally {
        release();
      }
    }
  }
  return {
    async reserve(id, digest) {
      try {
        return await locked(async (ledger) => {
          if (ledger.attempts.some((attempt) => attempt.id === id))
            return "duplicate";
          if (
            ledger.stopped ||
            ledger.attempts.some((attempt) => attempt.state === "uncertain")
          )
            return "quota";
          if (ledger.attempts.some((attempt) => attempt.state === "pending"))
            return "busy";
          const reserved = ledger.attempts.reduce(
            (total, attempt) =>
              total +
              Math.max(attempt.reservedUsd, attempt.reportedCostUsd ?? 0),
            0,
          );
          if (
            ledger.attempts.length >= MAX_ATTEMPTS ||
            reserved + RESERVATION_USD > ALLOWANCE_USD + 0.000001
          )
            return "quota";
          ledger.attempts.push({
            id,
            digest,
            state: "pending",
            reservedUsd: RESERVATION_USD,
            reportedCostUsd: null,
          });
          return "admitted";
        });
      } catch {
        return "quota";
      }
    },
    async settle(id, cost, successful) {
      await locked(async (ledger) => {
        const attempt = ledger.attempts.find((item) => item.id === id);
        if (!attempt || attempt.state !== "pending")
          throw new Error("Unknown research reservation");
        const knownCost = cost !== null && Number.isFinite(cost) && cost >= 0;
        attempt.reportedCostUsd = knownCost ? cost : null;
        attempt.state =
          knownCost && successful && cost <= RESERVATION_USD
            ? "complete"
            : "uncertain";
        if (attempt.state === "uncertain") ledger.stopped = true;
      });
    },
  };
}
