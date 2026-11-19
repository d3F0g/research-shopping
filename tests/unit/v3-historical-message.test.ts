import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/stored-conversation-v2.json";
import { actualStoredConversationV2 } from "../helpers/v2-stored-material";
import { emptyWorkspace, readWorkspaceData } from "../../src/domain/workspace";

describe("actual stored V2 conversation", () => {
  it("matches its committed historical source and exact JSON pointer", async () => {
    const bytes = await readFile(fixture.provenance.path);
    expect(createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex")).toBe(fixture.provenance.blob);
    expect(fixture.provenance.commit).toBe("33fadc7e3cfde2207528adb32b650287e758d343");
    expect(fixture.provenance.pointer).toBe("/rawTurns/1/after");
    expect(fixture.state).toEqual(JSON.parse(bytes.toString()).rawTurns[1].after);
  });
  it("preserves every historical message and research value while migrating only its workspace wrapper", () => {
    const state = actualStoredConversationV2();
    const migrated = readWorkspaceData({ ...emptyWorkspace(), schema: 2, state });
    expect(migrated.migrated).toBe(true);
    expect(migrated.data.schema).toBe(3);
    expect(migrated.data.state).toEqual(fixture.state);
    expect(migrated.data.state.messages.filter((message) => message.research).map((message) => message.research!.evidenceVersion)).toEqual([2]);
    expect(migrated.data.pending).toBeNull();
    expect(migrated.data.receipts).toEqual([]);
  });
});
