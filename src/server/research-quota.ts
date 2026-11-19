import { createHash, randomUUID } from "node:crypto";
import {
  link,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { z } from "zod";

const RESERVATION_USD = 0.05;
const MAX_ATTEMPTS = 40;
const ALLOWANCE_USD = 2;
const MANUAL_MAX_ATTEMPTS = 10;
const MANUAL_ALLOWANCE_USD = 0.5;
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const AttemptSchema = z
  .object({
    id: z.string().uuid(),
    digest: Sha256Schema,
    state: z.enum(["pending", "complete", "uncertain"]),
    reservedUsd: z.literal(RESERVATION_USD),
    reportedCostUsd: z.number().finite().nonnegative().nullable(),
  })
  .strict()
  .refine((attempt) =>
    attempt.state === "complete"
      ? attempt.reportedCostUsd !== null &&
        attempt.reportedCostUsd <= RESERVATION_USD
      : attempt.state !== "pending" || attempt.reportedCostUsd === null,
  );
const LedgerSchema = z
  .object({
    version: z.literal(1),
    stopped: z.boolean(),
    attempts: z.array(AttemptSchema).max(MAX_ATTEMPTS),
  })
  .strict()
  .refine(
    (ledger) =>
      new Set(ledger.attempts.map((attempt) => attempt.id)).size ===
      ledger.attempts.length,
  );
const ApprovalSchema = z
  .object({
    grantId: z.string().uuid(),
    approvalReference: z.string().trim().min(1).max(500),
    reviewedCommit: z.string().regex(/^[a-f0-9]{40}$/),
    approvedAt: z.iso.datetime({ offset: true }),
    expectedLedgerSha256: Sha256Schema,
  })
  .strict();
const ManualGrantSchema = ApprovalSchema.extend({
  version: z.literal(1),
  ledgerPath: z.string().refine(isAbsolute),
  baseline: z
    .object({
      attemptCount: z.number().int().min(1).max(MAX_ATTEMPTS),
      attemptsSha256: Sha256Schema,
      uncertainAttemptIds: z.array(z.string().uuid()).min(1).max(MAX_ATTEMPTS),
    })
    .strict(),
  maxAttempts: z.literal(MANUAL_MAX_ATTEMPTS),
  reservedAllowanceUsd: z.literal(MANUAL_ALLOWANCE_USD),
}).strict();
type Ledger = z.infer<typeof LedgerSchema>;
type ManualGrant = z.infer<typeof ManualGrantSchema>;
type Inspection = {
  eligible: boolean;
  reason: "ready" | "stopped" | "busy" | "quota" | "invalid-state";
  remainingAttempts: number;
  remainingReservedUsd: number;
  acknowledgedUncertainAttempts: number;
};
export type ResearchQuota = {
  reserve(
    id: string,
    digest: string,
  ): Promise<"admitted" | "quota" | "busy" | "duplicate">;
  settle(id: string, cost: number | null, successful: boolean): Promise<void>;
};

const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const reservedUsd = (attempts: Ledger["attempts"]) =>
  attempts.reduce(
    (total, attempt) =>
      total + Math.max(attempt.reservedUsd, attempt.reportedCostUsd ?? 0),
    0,
  );
function acknowledgedIds(ledger: Ledger) {
  if (
    !ledger.stopped ||
    ledger.attempts.some(
      (attempt) =>
        attempt.state === "pending" ||
        (attempt.state === "uncertain" && attempt.reportedCostUsd !== null),
    )
  )
    throw new Error("Baseline cannot be acknowledged for manual research");
  const ids = ledger.attempts
    .filter((attempt) => attempt.state === "uncertain")
    .map((attempt) => attempt.id);
  if (!ids.length)
    throw new Error("Manual research requires an uncertain baseline");
  return ids;
}
function validateGrant(grant: ManualGrant, ledger: Ledger, path: string) {
  const prefix = ledger.attempts.slice(0, grant.baseline.attemptCount);
  const ids = acknowledgedIds({ ...ledger, attempts: prefix });
  if (
    grant.ledgerPath !== path ||
    prefix.length !== grant.baseline.attemptCount ||
    sha256(JSON.stringify(prefix)) !== grant.baseline.attemptsSha256 ||
    JSON.stringify(ids) !== JSON.stringify(grant.baseline.uncertainAttemptIds)
  )
    throw new Error("Manual research grant does not match the ledger");
}
function admission(ledger: Ledger, grant?: ManualGrant): Inspection {
  const additional = grant
    ? ledger.attempts.slice(grant.baseline.attemptCount)
    : ledger.attempts;
  const remainingReservedUsd = Math.max(
    0,
    Math.min(
      ALLOWANCE_USD - reservedUsd(ledger.attempts),
      grant
        ? grant.reservedAllowanceUsd - reservedUsd(additional)
        : ALLOWANCE_USD,
    ),
  );
  const remainingAttempts = Math.max(
    0,
    Math.min(
      MAX_ATTEMPTS - ledger.attempts.length,
      grant ? grant.maxAttempts - additional.length : MAX_ATTEMPTS,
    ),
  );
  const reason =
    (!grant && ledger.stopped) ||
    additional.some((attempt) => attempt.state === "uncertain")
      ? "stopped"
      : ledger.attempts.some((attempt) => attempt.state === "pending")
        ? "busy"
        : remainingAttempts === 0 ||
            remainingReservedUsd + 0.000001 < RESERVATION_USD
          ? "quota"
          : "ready";
  return {
    eligible: reason === "ready",
    reason,
    remainingAttempts,
    remainingReservedUsd:
      Math.round(remainingReservedUsd * 1_000_000) / 1_000_000,
    acknowledgedUncertainAttempts:
      grant?.baseline.uncertainAttemptIds.length ?? 0,
  };
}
async function readGrant(path: string) {
  if (!isAbsolute(path))
    throw new Error("Manual research grant path must be absolute");
  const raw = await readFile(path, "utf8");
  if (raw.length > 16_000) throw new Error("Invalid manual research grant");
  return ManualGrantSchema.parse(JSON.parse(raw));
}

export function createResearchQuota(
  path: string,
  options: { manualGrantPath?: string } = {},
) {
  if (!isAbsolute(path))
    throw new Error("Research ledger path must be absolute");
  let serial = Promise.resolve();
  async function locked<T>(
    write: boolean,
    initialize: boolean,
    operation: (
      ledger: Ledger,
      canonicalPath: string,
      raw: string | null,
    ) => Promise<T>,
  ): Promise<T> {
    let release!: () => void;
    const previous = serial;
    serial = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    let lock;
    let lockPath;
    try {
      let canonicalPath: string;
      try {
        canonicalPath = await realpath(path);
      } catch (error) {
        if (!initialize || (error as NodeJS.ErrnoException).code !== "ENOENT")
          throw error;
        await mkdir(dirname(path), { recursive: true, mode: 0o700 });
        canonicalPath = join(await realpath(dirname(path)), basename(path));
      }
      lockPath = `${canonicalPath}.lock`;
      lock = await open(lockPath, "wx", 0o600);
      let raw: string | null = null;
      try {
        raw = await readFile(canonicalPath, "utf8");
      } catch (error) {
        if (!initialize || (error as NodeJS.ErrnoException).code !== "ENOENT")
          throw error;
      }
      if (raw !== null && raw.length > 64_000)
        throw new Error("Invalid research ledger");
      const ledger: Ledger =
        raw === null
          ? { version: 1, stopped: false, attempts: [] }
          : LedgerSchema.parse(JSON.parse(raw));
      const before = JSON.stringify(ledger);
      const value = await operation(ledger, canonicalPath, raw);
      if (write && (raw === null || JSON.stringify(ledger) !== before)) {
        const temporary = `${canonicalPath}.${randomUUID()}.tmp`;
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(JSON.stringify(ledger));
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, canonicalPath);
      }
      return value;
    } finally {
      try {
        if (lock) {
          await lock.close();
          await unlink(lockPath!);
        }
      } finally {
        release();
      }
    }
  }
  async function policy(ledger: Ledger, canonicalPath: string) {
    const grant =
      options.manualGrantPath === undefined
        ? undefined
        : await readGrant(options.manualGrantPath);
    if (grant) validateGrant(grant, ledger, canonicalPath);
    return admission(ledger, grant);
  }
  return {
    async reserve(
      id: string,
      digest: string,
    ): Promise<"admitted" | "quota" | "busy" | "duplicate"> {
      try {
        return await locked(
          true,
          options.manualGrantPath === undefined,
          async (ledger, canonicalPath) => {
            if (ledger.attempts.some((attempt) => attempt.id === id))
              return "duplicate";
            const status = await policy(ledger, canonicalPath);
            if (!status.eligible)
              return status.reason === "busy" ? "busy" : "quota";
            ledger.attempts.push(
              AttemptSchema.parse({
                id,
                digest,
                state: "pending",
                reservedUsd: RESERVATION_USD,
                reportedCostUsd: null,
              }),
            );
            return "admitted";
          },
        );
      } catch {
        return "quota";
      }
    },
    async settle(
      id: string,
      cost: number | null,
      successful: boolean,
    ): Promise<void> {
      await locked(true, false, async (ledger) => {
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
    async inspect(): Promise<Inspection> {
      try {
        return await locked(false, false, policy);
      } catch {
        return {
          eligible: false,
          reason: "invalid-state",
          remainingAttempts: 0,
          remainingReservedUsd: 0,
          acknowledgedUncertainAttempts: 0,
        };
      }
    },
    async createManualGrant(
      input: z.input<typeof ApprovalSchema>,
    ): Promise<Inspection> {
      if (process.env.NODE_ENV !== "development")
        throw new Error("Manual grant creation requires development mode");
      const approval = ApprovalSchema.parse(input);
      const grantPath = options.manualGrantPath;
      if (grantPath === undefined || !isAbsolute(grantPath))
        throw new Error("An absolute manual grant path is required");
      return locked(false, false, async (ledger, canonicalPath, raw) => {
        let existing: ManualGrant | undefined;
        try {
          existing = await readGrant(grantPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (existing) {
          validateGrant(existing, ledger, canonicalPath);
          if (
            Object.entries(approval).some(
              ([key, value]) =>
                existing[key as keyof typeof approval] !== value,
            )
          )
            throw new Error("Cannot replace an existing manual research grant");
          return admission(ledger, existing);
        }
        if (raw === null || sha256(raw) !== approval.expectedLedgerSha256)
          throw new Error("Research ledger changed since approval");
        const grant = ManualGrantSchema.parse({
          ...approval,
          version: 1,
          ledgerPath: canonicalPath,
          baseline: {
            attemptCount: ledger.attempts.length,
            attemptsSha256: sha256(JSON.stringify(ledger.attempts)),
            uncertainAttemptIds: acknowledgedIds(ledger),
          },
          maxAttempts: MANUAL_MAX_ATTEMPTS,
          reservedAllowanceUsd: MANUAL_ALLOWANCE_USD,
        });
        const temporary = `${grantPath}.${randomUUID()}.tmp`;
        const file = await open(temporary, "wx", 0o600);
        try {
          try {
            await file.writeFile(JSON.stringify(grant));
            await file.sync();
          } finally {
            await file.close();
          }
          await link(temporary, grantPath);
        } finally {
          await unlink(temporary);
        }
        return admission(ledger, grant);
      });
    },
  };
}
