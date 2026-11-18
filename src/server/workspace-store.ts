import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  conversationPolicy,
  preferenceDisplay,
} from "../domain/conversation-policy";
import {
  ApplicationTurnResponseSchema,
  type ResearchTurns,
} from "../domain/research";
import {
  boundWorkspace,
  emptyWorkspace,
  PENDING_MS,
  RETENTION_MS,
  WorkspaceDataSchema,
  type WorkspaceCommand,
  type WorkspaceData,
  type WorkspaceResult,
  type WorkspaceSnapshot,
} from "../domain/workspace";

export type Identity = { userId: string; sessionId: string };
export class AccountError extends Error {
  constructor(
    public status: 401 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
type Row = { revision: number; epoch: number; data: WorkspaceData };
type CommandResult = {
  result: WorkspaceResult;
  dispatch?: {
    revision: number;
    epoch: number;
    operationId: string;
    request: { message: string; preferences: WorkspaceData["preferences"] };
  };
  abort?: string;
};
const snapshot = (row: Row): WorkspaceSnapshot => ({
  revision: row.revision,
  epoch: row.epoch,
  preferences: row.data.preferences,
  budgetQuestions: row.data.budgetQuestions,
  turns: row.data.turns,
  pendingOperationId: row.data.pending?.operationId ?? null,
});
const conflict = () =>
  new AccountError(
    409,
    "Saved conversation changed. Reload it before sending another request.",
  );

function interrupt(row: Row, reason: "cancelled" | "timeout" | "failed") {
  const id = row.data.pending?.operationId;
  if (!id) return;
  const turn = row.data.turns.find((item) => item.operationId === id);
  if (turn?.body.status === "pending")
    turn.body = { status: "interrupted", reason };
  const receipt = row.data.receipts.find((item) => item.operationId === id);
  if (receipt) receipt.status = "interrupted";
  row.data.pending = null;
  row.revision++;
  return id;
}
function expire(row: Row, now: number) {
  const before = JSON.stringify(row.data);
  const cutoff = now - RETENTION_MS;
  const pendingTurn = row.data.turns.find(
    (turn) => turn.operationId === row.data.pending?.operationId,
  );
  if (
    row.data.pending &&
    (Date.parse(row.data.pending.deadline) <= now ||
      !pendingTurn ||
      Date.parse(pendingTurn.createdAt) <= cutoff)
  )
    interrupt(row, "timeout");
  row.data.turns = row.data.turns.filter(
    (turn) => Date.parse(turn.createdAt) > cutoff,
  );
  row.data.receipts = row.data.receipts.filter(
    (receipt) => Date.parse(receipt.createdAt) > cutoff,
  );
  if (row.data.mutatedAt && Date.parse(row.data.mutatedAt) <= cutoff) {
    interrupt(row, "timeout");
    row.data.preferences = emptyWorkspace().preferences;
    row.data.budgetQuestions = [];
    row.data.mutatedAt = null;
  }
  if (before !== JSON.stringify(row.data)) {
    interrupt(row, "timeout");
    row.revision++;
    row.epoch++;
    return true;
  }
  return false;
}
async function readRow(
  client: PoolClient,
  userId: string,
): Promise<Row | null> {
  const found = await client.query<{
    revision: string;
    epoch: string;
    data: unknown;
  }>(
    "SELECT revision, epoch, data FROM shopping_workspace WHERE user_id = $1 FOR UPDATE",
    [userId],
  );
  const row = found.rows[0];
  return row
    ? {
        revision: Number(row.revision),
        epoch: Number(row.epoch),
        data: WorkspaceDataSchema.parse(row.data),
      }
    : null;
}
async function save(client: PoolClient, identity: Identity, row: Row) {
  if (!boundWorkspace(row.data))
    throw new Error("Workspace exceeds its storage limit");
  await client.query(
    "UPDATE shopping_workspace SET revision = $2, epoch = $3, data = $4::jsonb WHERE user_id = $1",
    [identity.userId, row.revision, row.epoch, JSON.stringify(row.data)],
  );
}

export function createWorkspaceStore(pool: Pool, turns: ResearchTurns) {
  const running = new Map<
    string,
    { controller: AbortController; sessionId: string }
  >();
  async function transaction<T>(
    identity: Identity,
    create: boolean,
    action: (client: PoolClient, row: Row, now: number) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query<{ expiresAt: Date }>(
        'SELECT "expiresAt" FROM "session" WHERE id = $1 AND "userId" = $2 FOR UPDATE',
        [identity.sessionId, identity.userId],
      );
      const clock = await client.query<{ now: Date }>(
        "SELECT clock_timestamp() AS now",
      );
      const now = clock.rows[0].now.getTime();
      if (!session.rows[0] || session.rows[0].expiresAt.getTime() <= now)
        throw new AccountError(401, "Your session ended. Sign in again.");
      if (create)
        await client.query(
          "INSERT INTO shopping_workspace (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING",
          [identity.userId, JSON.stringify(emptyWorkspace())],
        );
      const row = await readRow(client, identity.userId);
      if (!row) throw conflict();
      const lockedClock = await client.query<{ now: Date }>(
        "SELECT clock_timestamp() AS now",
      );
      const lockedNow = lockedClock.rows[0].now.getTime();
      if (session.rows[0].expiresAt.getTime() <= lockedNow)
        throw new AccountError(401, "Your session ended. Sign in again.");
      const result = await action(client, row, lockedNow);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  const operationKey = (
    identity: Identity,
    operationId: string,
    epoch: number,
  ) => `${identity.userId}:${epoch}:${operationId}`;
  async function load(identity: Identity) {
    let aborted: string | undefined;
    const result = await transaction(
      identity,
      true,
      async (client, row, now) => {
        const pending = row.data.pending;
        if (expire(row, now)) {
          await save(client, identity, row);
          if (pending && !row.data.pending)
            aborted = operationKey(
              identity,
              pending.operationId,
              pending.epoch,
            );
        }
        return snapshot(row);
      },
    );
    if (aborted) running.get(aborted)?.controller.abort();
    return result;
  }
  async function command(
    identity: Identity,
    input: WorkspaceCommand,
    signal: AbortSignal,
  ): Promise<WorkspaceResult> {
    const digest = createHash("sha256")
      .update(JSON.stringify(input.command))
      .digest("hex");
    const controller = new AbortController();
    let key: string | undefined;
    let expiredOperation: string | undefined;
    const admitted = await transaction<CommandResult | AccountError>(
      identity,
      true,
      async (client, row, now) => {
        const priorPending = row.data.pending;
        if (expire(row, now)) {
          await save(client, identity, row);
          if (priorPending && !row.data.pending)
            expiredOperation = operationKey(
              identity,
              priorPending.operationId,
              priorPending.epoch,
            );
        }
        const receipt =
          row.data.receipts.find(
            (item) => item.operationId === input.operationId,
          ) ??
          row.data.turns.find((item) => item.operationId === input.operationId);
        if (receipt) {
          if (receipt.digest !== digest) return conflict();
          const status =
            "status" in receipt
              ? receipt.status
              : receipt.body.status === "pending"
                ? "pending"
                : receipt.body.status === "interrupted"
                  ? "interrupted"
                  : "complete";
          return {
            result: {
              workspace: snapshot(row),
              operation: { operationId: input.operationId, status },
            },
          };
        }
        if (input.revision !== row.revision) return conflict();
        const action = input.command;
        if (
          action.kind === "cancel" &&
          row.data.pending?.operationId !== action.target
        )
          return conflict();
        if (
          row.data.pending &&
          action.kind !== "cancel" &&
          action.kind !== "new-chat" &&
          action.kind !== "delete-saved-data" &&
          action.kind !== "apply-preferences"
        )
          return conflict();
        const timestamp = new Date(now).toISOString();
        const pending = row.data.pending;
        let abort = pending
          ? operationKey(identity, pending.operationId, pending.epoch)
          : undefined;
        if (action.kind === "new-chat" || action.kind === "delete-saved-data") {
          row.data = emptyWorkspace();
          row.epoch++;
          row.revision++;
        } else if (action.kind === "cancel") {
          interrupt(row, "cancelled");
        } else {
          if (action.kind === "apply-preferences") interrupt(row, "cancelled");
          else abort = undefined;
          const preferences =
            action.kind === "apply-preferences"
              ? action.preferences
              : row.data.preferences;
          const message =
            action.kind === "message" ? action.text : "Show options";
          const display =
            action.kind === "message"
              ? action.text
              : action.kind === "skip-budget"
                ? "Skip the budget for now"
                : preferenceDisplay(preferences);
          const decision = conversationPolicy(message, preferences);
          const question =
            action.kind === "message" &&
            decision.budgetContext &&
            !row.data.budgetQuestions.includes(decision.budgetContext);
          if (
            JSON.stringify(row.data.preferences) !==
            JSON.stringify(decision.preferences)
          )
            row.data.mutatedAt = timestamp;
          row.data.preferences = decision.preferences;
          row.revision++;
          row.data.turns.push({
            id: randomUUID(),
            operationId: input.operationId,
            digest,
            createdAt: timestamp,
            message: display,
            request: { message, preferences: structuredClone(preferences) },
            body: question
              ? {
                  status: "question",
                  question: "budget",
                  preferences: decision.preferences,
                }
              : decision.reply
                ? { status: "complete", value: decision.reply }
                : { status: "pending" },
          });
          if (question)
            row.data.budgetQuestions = [
              ...row.data.budgetQuestions,
              decision.budgetContext!,
            ].slice(-16);
          if (!question && !decision.reply)
            row.data.pending = {
              operationId: input.operationId,
              sessionId: identity.sessionId,
              revision: row.revision,
              epoch: row.epoch,
              deadline: new Date(now + PENDING_MS).toISOString(),
            };
        }
        const status =
          row.data.pending?.operationId === input.operationId
            ? "pending"
            : "complete";
        row.data.receipts.push({
          operationId: input.operationId,
          digest,
          status,
          createdAt: timestamp,
        });
        await save(client, identity, row);
        const result: CommandResult = {
          result: {
            workspace: snapshot(row),
            operation: { operationId: input.operationId, status },
          },
          abort,
        };
        if (status === "pending") {
          key = operationKey(identity, input.operationId, row.epoch);
          running.set(key, { controller, sessionId: identity.sessionId });
          result.dispatch = {
            revision: row.revision,
            epoch: row.epoch,
            operationId: input.operationId,
            request: row.data.turns.at(-1)!.request,
          };
        }
        return result;
      },
    ).catch((error) => {
      if (key && running.get(key)?.controller === controller)
        running.delete(key);
      throw error;
    });
    if (expiredOperation) running.get(expiredOperation)?.controller.abort();
    if (admitted instanceof AccountError) throw admitted;
    if (admitted.abort) running.get(admitted.abort)?.controller.abort();
    if (!admitted.dispatch) return admitted.result;
    const claim = admitted.dispatch;
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    const deadline = setTimeout(abort, PENDING_MS);
    try {
      let body: WorkspaceData["turns"][number]["body"];
      try {
        controller.signal.throwIfAborted();
        const value = await turns.turn(
          { ...claim.request, operationId: claim.operationId },
          controller.signal,
        );
        controller.signal.throwIfAborted();
        body = {
          status: "complete",
          value: ApplicationTurnResponseSchema.parse(value),
        };
      } catch {
        body = {
          status: "interrupted",
          reason: controller.signal.aborted ? "cancelled" : "failed",
        };
      }
      let expiredCompletion: string | undefined;
      const finished = await transaction<WorkspaceResult | AccountError>(
        identity,
        false,
        async (client, row, now) => {
          const pending = row.data.pending;
          if (expire(row, now)) {
            await save(client, identity, row);
            if (pending && !row.data.pending)
              expiredCompletion = operationKey(
                identity,
                pending.operationId,
                pending.epoch,
              );
          }
          if (
            row.revision !== claim.revision ||
            row.epoch !== claim.epoch ||
            row.data.pending?.operationId !== claim.operationId ||
            row.data.pending.sessionId !== identity.sessionId
          )
            return conflict();
          const turn = row.data.turns.find(
            (item) => item.operationId === claim.operationId,
          )!;
          turn.body = body;
          row.data.pending = null;
          const acceptedPreferences = row.data.preferences;
          if (turn.body.status === "complete")
            row.data.preferences =
              turn.body.value.preferences ?? acceptedPreferences;
          if (!boundWorkspace(row.data)) {
            row.data.preferences = acceptedPreferences;
            turn.body = { status: "interrupted", reason: "too-large" };
          }
          const receipt = row.data.receipts.find(
            (item) => item.operationId === claim.operationId,
          )!;
          receipt.status =
            turn.body.status === "complete" ? "complete" : "interrupted";
          row.revision++;
          await save(client, identity, row);
          return {
            workspace: snapshot(row),
            operation: {
              operationId: claim.operationId,
              status: receipt.status,
            },
          };
        },
      );
      if (expiredCompletion) running.get(expiredCompletion)?.controller.abort();
      if (finished instanceof AccountError) throw finished;
      return finished;
    } finally {
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      if (key && running.get(key)?.controller === controller)
        running.delete(key);
    }
  }
  return {
    load,
    command,
    abortSession(sessionId: string) {
      for (const entry of running.values())
        if (entry.sessionId === sessionId) entry.controller.abort();
    },
  };
}

export async function cleanExpiredWorkspaces(pool: Pool) {
  const client = await pool.connect();
  let cleared = 0;
  try {
    await client.query("BEGIN");
    const owners = await client.query<{ user_id: string }>(
      "SELECT user_id FROM shopping_workspace ORDER BY user_id FOR UPDATE",
    );
    for (const owner of owners.rows) {
      const row = (await readRow(client, owner.user_id))!;
      const clock = await client.query<{ now: Date }>(
        "SELECT clock_timestamp() AS now",
      );
      if (expire(row, clock.rows[0].now.getTime())) {
        await save(client, { userId: owner.user_id, sessionId: "" }, row);
        cleared++;
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return cleared;
}
