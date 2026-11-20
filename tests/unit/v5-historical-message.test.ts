import { describe, expect, it } from "vitest";
import storedV4 from "../fixtures/stored-workspace-v4-price.json";
import catalogV4 from "../fixtures/stored-research-v4-catalog.json";
import { actualStoredConversationV2 } from "../helpers/v2-stored-material";
import { actualStoredConversationV3 } from "../helpers/v3-stored-material";
import { StoredWorkspaceV4Schema } from "../../src/domain/workspace-history-v4";
import { ResearchSnapshotSchema as ResearchV4Schema } from "../../src/domain/research-history-v4";
import { emptyWorkspace, readWorkspaceData, WorkspaceDataSchema } from "../../src/domain/workspace";
import { reduceTurn } from "../../src/domain/turn-reducer";
import { randomUUID } from "node:crypto";

describe("frozen actual V2 through V4 workspaces under V5 storage", () => {
  it.each([2, 3, 4])("preserves every historical message and question while migrating actual workspace %s", (version) => {
    const previous = version === 4 ? StoredWorkspaceV4Schema.parse(storedV4) : { ...emptyWorkspace(), schema: version, state: version === 2 ? actualStoredConversationV2() : actualStoredConversationV3() };
    const bytes = JSON.stringify(previous.state.messages), question = JSON.stringify(previous.state.pending);
    const migrated = readWorkspaceData(previous);
    expect(migrated.migrated).toBe(true);
    expect(migrated.data.schema).toBe(5);
    expect(JSON.stringify(migrated.data.state.messages)).toBe(bytes);
    expect(JSON.stringify(migrated.data.state.pending)).toBe(question);
    const reloaded = readWorkspaceData(JSON.parse(JSON.stringify(migrated.data)));
    expect(reloaded.migrated).toBe(false);
    expect(JSON.stringify(reloaded.data.state.messages)).toBe(bytes);
    expect(JSON.stringify(reloaded.data.state.pending)).toBe(question);
  });
  it("retains V4 catalog provenance, reported conditions and recorded choice without V5 reinterpretation", () => {
    const snapshot = ResearchV4Schema.parse(catalogV4);
    const old = StoredWorkspaceV4Schema.parse(storedV4);
    old.state.messages.push({ id: "fixture-v4-catalog", role: "assistant", text: snapshot.summary, research: snapshot });
    old.state.messages.unshift(...actualStoredConversationV2().messages, ...actualStoredConversationV3().messages);
    const bytes = JSON.stringify(old.state.messages);
    const migrated = readWorkspaceData(old).data;
    expect(JSON.stringify(migrated.state.messages)).toBe(bytes);
    expect(WorkspaceDataSchema.parse(migrated).state.messages).toEqual(old.state.messages);
    const result = reduceTurn({ ...migrated.state, pending: null }, { phase: "prepare", operationId: randomUUID(), message: "Just show me the best one" });
    expect(result.kind).toBe("message");
    expect(result.state.messages.at(-1)!.text).toContain("cannot choose a compliant best");
    expect(JSON.stringify(result.state.messages.slice(0, old.state.messages.length))).toBe(bytes);
  });
  it("interrupts historical prepared work without changing requests, messages or typed drafts", () => {
    const previous = StoredWorkspaceV4Schema.parse(storedV4);
    const operationId = randomUUID(), preparedId = randomUUID(), createdAt = "2026-11-20T00:00:00.000Z";
    previous.receipts = [{ operationId, preparedId, status: "prepared", digest: "a".repeat(64), createdAt }];
    previous.pending = { operationId, preparedId, sessionId: "fixture-old-session", revision: 0, epoch: 0, intentDigest: "b".repeat(64), deadline: createdAt, status: "prepared" };
    const migrated = readWorkspaceData(previous).data;
    expect(migrated.pending).toBeNull();
    expect(migrated.receipts).toEqual([{ ...previous.receipts[0], status: "interrupted" }]);
    expect(migrated.state).toEqual(previous.state);
  });
});
