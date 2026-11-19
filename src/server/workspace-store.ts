import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { ConversationState, PrepareInput, TurnDecision, TurnResponse } from "../domain/conversation";
import type { ResearchOperation } from "../domain/research";
import { boundWorkspace, emptyWorkspace, PENDING_MS, RETENTION_MS, WorkspaceDataSchema, type WorkspaceCommand, type WorkspaceData, type WorkspaceResult, type WorkspaceSnapshot } from "../domain/workspace";

export type Identity = { userId: string; sessionId: string };
export class AccountError extends Error {
  constructor(public status: 400 | 401 | 403 | 409 | 413 | 415 | 429 | 503, message: string) { super(message); }
}
type Row = { revision: number; epoch: number; data: WorkspaceData };
export type WorkspaceDependencies = {
  reduce: (state: ConversationState, input: PrepareInput) => TurnDecision;
  research: (intent: ConversationState["intent"], operationId: string, signal: AbortSignal) => ReturnType<ResearchOperation>;
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const intentDigest = (state: ConversationState) => digest({ ...state.intent, responseLength: undefined });
const conflict = () => new AccountError(409, "Saved conversation changed. Reload it before continuing.");
const snapshot = (row: Row): WorkspaceSnapshot => structuredClone({ revision: row.revision, epoch: row.epoch, state: row.data.state, pendingOperationId: row.data.pending?.operationId ?? null, pendingPreparedId: row.data.pending?.preparedId ?? null });
const result = (row: Row, operationId?: string, response: TurnResponse | null = null): WorkspaceResult => {
  const receipt = row.data.receipts.find((item) => item.operationId === operationId);
  return { workspace: snapshot(row), response, operation: receipt ? { operationId: receipt.operationId, status: receipt.status } : null };
};
function interrupt(row: Row): void {
  if (!row.data.pending) return;
  const receipt = row.data.receipts.find((item) => item.operationId === row.data.pending!.operationId);
  if (receipt) receipt.status = "interrupted";
  row.data.pending = null;
}
function expire(row: Row, now: number): boolean {
  const before = JSON.stringify(row.data);
  const cutoff = now - RETENTION_MS;
  if (row.data.pending && Date.parse(row.data.pending.deadline) <= now) interrupt(row);
  const expired = new Set(row.data.turns.filter((turn) => Date.parse(turn.createdAt) <= cutoff).flatMap((turn) => turn.messageIds));
  row.data.state.messages = row.data.state.messages.filter((message) => !expired.has(message.id));
  row.data.turns = row.data.turns.filter((turn) => Date.parse(turn.createdAt) > cutoff);
  row.data.receipts = row.data.receipts.filter((receipt) => Date.parse(receipt.createdAt) > cutoff);
  if (row.data.acceptedAt && Date.parse(row.data.acceptedAt) <= cutoff) {
    row.data.state.intent = emptyWorkspace().state.intent;
    row.data.state.pending = null;
    row.data.acceptedAt = null;
  }
  if (JSON.stringify(row.data) === before) return false;
  interrupt(row);
  row.revision++;
  row.epoch++;
  return true;
}
async function readRow(client: PoolClient, userId: string): Promise<Row | null> {
  const found = await client.query<{ revision: string; epoch: string; data: unknown }>("SELECT revision, epoch, data FROM fieldnote_v2_workspace WHERE user_id = $1 FOR UPDATE", [userId]);
  const row = found.rows[0];
  return row ? { revision: Number(row.revision), epoch: Number(row.epoch), data: WorkspaceDataSchema.parse(row.data) } : null;
}
async function save(client: PoolClient, userId: string, row: Row) {
  if (!boundWorkspace(row.data)) throw new AccountError(413, "This saved response exceeds the account storage limit.");
  WorkspaceDataSchema.parse(row.data);
  await client.query("UPDATE fieldnote_v2_workspace SET revision = $2, epoch = $3, data = $4::jsonb WHERE user_id = $1", [userId, row.revision, row.epoch, JSON.stringify(row.data)]);
}

export function createWorkspaceStore(pool: Pool, dependencies: WorkspaceDependencies) {
  const running = new Map<string, { controller: AbortController; sessionId: string }>();
  const key = (identity: Identity, pending: NonNullable<WorkspaceData["pending"]>) => `${identity.userId}:${pending.epoch}:${pending.operationId}`;
  async function transaction<T>(identity: Identity, action: (client: PoolClient, row: Row, now: number) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const session = await client.query<{ expiresAt: Date }>('SELECT "expiresAt" FROM "session" WHERE id = $1 AND "userId" = $2 FOR UPDATE', [identity.sessionId, identity.userId]);
      if (!session.rows[0]) throw new AccountError(401, "Your session ended. Sign in again.");
      await client.query("INSERT INTO fieldnote_v2_workspace (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING", [identity.userId, JSON.stringify(emptyWorkspace())]);
      const row = await readRow(client, identity.userId);
      if (!row) throw conflict();
      const clock = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      const now = clock.rows[0].now.getTime();
      if (session.rows[0].expiresAt.getTime() <= now) throw new AccountError(401, "Your session ended. Sign in again.");
      const pending = row.data.pending;
      let changed = expire(row, now);
      if (row.data.pending && row.data.pending.sessionId !== identity.sessionId) {
        const owner = await client.query('SELECT id FROM "session" WHERE id = $1 AND "userId" = $2 AND "expiresAt" > clock_timestamp()', [row.data.pending.sessionId, identity.userId]);
        if (!owner.rowCount) { interrupt(row); row.revision++; row.epoch++; changed = true; }
      }
      if (changed) await save(client, identity.userId, row);
      const outcome = await action(client, row, now);
      await client.query("COMMIT");
      if (pending && row.data.pending?.operationId !== pending.operationId) running.get(key(identity, pending))?.controller.abort();
      return outcome;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
  }
  async function prepare(identity: Identity, input: Extract<WorkspaceCommand, { phase: "prepare" }>): Promise<WorkspaceResult> {
    const inputDigest = digest({ ...input, revision: undefined, operationId: undefined });
    const outcome = await transaction<WorkspaceResult | AccountError>(identity, async (client, row, now) => {
      const receipt = row.data.receipts.find((item) => item.operationId === input.operationId);
      if (receipt) {
        if (receipt.digest !== inputDigest) return conflict();
        const pending = row.data.pending;
        return result(row, input.operationId, pending?.operationId === input.operationId && pending.status === "prepared" ? { kind: "prepared", preparedId: pending.preparedId, state: structuredClone(row.data.state) } : null);
      }
      if (row.revision !== input.revision) return conflict();
      const previous = structuredClone(row.data.state);
      const decision = dependencies.reduce(previous, input);
      const changed = intentDigest(row.data.state) !== intentDigest(decision.state);
      if (decision.kind === "research" || decision.kind === "cancel" || changed || decision.state.pending) { interrupt(row); row.epoch++; }
      if (JSON.stringify(row.data.state.intent) !== JSON.stringify(decision.state.intent) || JSON.stringify(row.data.state.pending) !== JSON.stringify(decision.state.pending)) row.data.acceptedAt = new Date(now).toISOString();
      const known = new Set(row.data.state.messages.map((message) => message.id));
      const messageIds = decision.state.messages.filter((message) => !known.has(message.id)).map((message) => message.id);
      row.data.state = decision.state;
      row.revision++;
      row.data.turns.push({ operationId: input.operationId, messageIds, createdAt: new Date(now).toISOString() });
      row.data.receipts.push({ operationId: input.operationId, digest: inputDigest, status: decision.kind === "research" ? "prepared" : "complete", createdAt: new Date(now).toISOString() });
      let response: TurnResponse;
      if (decision.kind === "research") {
        row.data.pending = { preparedId: randomUUID(), operationId: input.operationId, sessionId: identity.sessionId, revision: row.revision, epoch: row.epoch, intentDigest: intentDigest(row.data.state), deadline: new Date(now + PENDING_MS).toISOString(), status: "prepared" };
        row.data.receipts.at(-1)!.preparedId = row.data.pending.preparedId;
        response = { kind: "prepared", preparedId: row.data.pending.preparedId, state: structuredClone(row.data.state) };
      } else response = { kind: decision.kind === "cancel" ? "message" : decision.kind, message: decision.message, state: structuredClone(row.data.state) };
      await save(client, identity.userId, row);
      response.state = structuredClone(row.data.state);
      return result(row, input.operationId, response);
    });
    if (outcome instanceof AccountError) throw outcome;
    return outcome;
  }
  async function research(identity: Identity, input: Extract<WorkspaceCommand, { phase: "research" }>, signal: AbortSignal): Promise<WorkspaceResult> {
    signal.throwIfAborted();
    const controller = new AbortController();
    let operationKey: string | undefined;
    const claim = await transaction<{ pending: NonNullable<WorkspaceData["pending"]>; state: ConversationState } | WorkspaceResult | AccountError>(identity, async (client, row) => {
      const receipt = row.data.receipts.find((item) => item.preparedId === input.preparedId);
      if (receipt && ["complete", "interrupted"].includes(receipt.status)) return result(row, receipt.operationId);
      const pending = row.data.pending;
      if (!pending || pending.preparedId !== input.preparedId || pending.sessionId !== identity.sessionId) return conflict();
      if (pending.status === "running") return result(row, pending.operationId);
      if (row.revision !== input.revision || pending.intentDigest !== intentDigest(row.data.state)) return conflict();
      pending.status = "running";
      row.data.receipts.find((item) => item.operationId === pending.operationId)!.status = "running";
      await save(client, identity.userId, row);
      operationKey = key(identity, pending);
      running.set(operationKey, { controller, sessionId: identity.sessionId });
      return { pending: structuredClone(pending), state: structuredClone(row.data.state) };
    }).catch((error) => { if (operationKey) running.delete(operationKey); throw error; });
    if (claim instanceof AccountError) throw claim;
    if ("workspace" in claim) return claim;
    operationKey = key(identity, claim.pending);
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) controller.abort();
    const deadline = setTimeout(abort, Math.max(0, Date.parse(claim.pending.deadline) - Date.now()));
    try {
      let response: Awaited<ReturnType<ResearchOperation>>;
      try {
        controller.signal.throwIfAborted();
        response = await dependencies.research(claim.state.intent, claim.pending.operationId, controller.signal);
        controller.signal.throwIfAborted();
      } catch { response = { status: "unavailable", reason: controller.signal.aborted ? "stale" : "provider-error" }; }
      const finished = await transaction<WorkspaceResult | AccountError>(identity, async (client, row) => {
        const pending = row.data.pending;
        if (!pending || pending.operationId !== claim.pending.operationId || pending.preparedId !== claim.pending.preparedId || pending.sessionId !== identity.sessionId || pending.epoch !== claim.pending.epoch || pending.revision !== claim.pending.revision || row.epoch !== claim.pending.epoch || pending.intentDigest !== intentDigest(row.data.state)) return conflict();
        const turn = row.data.turns.find((item) => item.operationId === pending.operationId)!;
        const receipt = row.data.receipts.find((item) => item.operationId === pending.operationId)!;
        const id = `${pending.operationId}-research`;
        const text = response.status === "ready" ? response.research.summary : response.reason === "stale" ? "Research stopped. Your preferences are retained." : `Exa research is unavailable (${response.reason}). Your preferences are retained. No automatic retry was sent.`;
        row.data.state.messages.push({ id, role: "assistant", text, ...(response.status === "ready" ? { research: response.research } : {}) });
        turn.messageIds.push(id);
        row.data.pending = null;
        receipt.status = response.status === "ready" ? "complete" : "interrupted";
        let published: TurnResponse = response.status === "ready" ? { kind: "research", research: response.research, state: structuredClone(row.data.state) } : { kind: "research-unavailable", reason: response.reason, message: text, state: structuredClone(row.data.state) };
        if (!boundWorkspace(row.data, claim.pending.operationId)) {
          row.data.state.messages = row.data.state.messages.filter((message) => message.id !== id);
          row.data.state.messages.push({ id, role: "assistant", text: "This research response exceeds the saved conversation limit. Your preferences are retained." });
          receipt.status = "interrupted";
          published = { kind: "research-unavailable", reason: "invalid-response", message: row.data.state.messages.at(-1)!.text, state: structuredClone(row.data.state) };
        }
        row.revision++;
        await save(client, identity.userId, row);
        published.state = structuredClone(row.data.state);
        return result(row, claim.pending.operationId, published);
      });
      if (finished instanceof AccountError) throw finished;
      return finished;
    } finally {
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      if (running.get(operationKey)?.controller === controller) running.delete(operationKey);
    }
  }
  async function command(identity: Identity, input: WorkspaceCommand, signal: AbortSignal): Promise<WorkspaceResult> {
    if (input.phase === "prepare") return prepare(identity, input);
    if (input.phase === "research") return research(identity, input, signal);
    const inputDigest = digest({ phase: input.phase, ...(input.phase === "cancel" ? { target: input.target } : {}) });
    const outcome = await transaction<WorkspaceResult | AccountError>(identity, async (client, row, now) => {
      const receipt = row.data.receipts.find((item) => item.operationId === input.operationId);
      if (receipt) return receipt.digest === inputDigest ? result(row, input.operationId) : conflict();
      if (input.revision !== row.revision) return conflict();
      if (input.phase === "cancel") {
        if (row.data.pending?.operationId !== input.target) return conflict();
        interrupt(row);
      } else {
        const receipts = row.data.receipts;
        interrupt(row);
        row.data = emptyWorkspace();
        row.data.receipts = receipts;
      }
      row.epoch++;
      row.revision++;
      row.data.receipts.push({ operationId: input.operationId, digest: inputDigest, status: "complete", createdAt: new Date(now).toISOString() });
      await save(client, identity.userId, row);
      return result(row, input.operationId);
    });
    if (outcome instanceof AccountError) throw outcome;
    return outcome;
  }
  return {
    load: (identity: Identity) => transaction(identity, async (_client, row) => snapshot(row)),
    command,
    abortSession(sessionId: string) { for (const entry of running.values()) if (entry.sessionId === sessionId) entry.controller.abort(); },
  };
}
export async function cleanExpiredWorkspaces(pool: Pool): Promise<number> {
  const client = await pool.connect();
  let cleared = 0;
  try {
    await client.query("BEGIN");
    const owners = await client.query<{ user_id: string }>("SELECT user_id FROM fieldnote_v2_workspace ORDER BY user_id FOR UPDATE");
    for (const owner of owners.rows) {
      const row = (await readRow(client, owner.user_id))!;
      const clock = await client.query<{ now: Date }>("SELECT clock_timestamp() AS now");
      if (expire(row, clock.rows[0].now.getTime())) { await save(client, owner.user_id, row); cleared++; }
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { client.release(); }
  return cleared;
}
