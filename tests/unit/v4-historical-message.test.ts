import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/stored-conversation-v3.json";
import { actualStoredConversationV3 } from "../helpers/v3-stored-material";
import { actualStoredConversationV2 } from "../helpers/v2-stored-material";
import { emptyWorkspace, readWorkspaceData } from "../../src/domain/workspace";

describe("actual mixed V2 and V3 historical messages", () => {
  it("matches the exact public archived V3 state without inventing Git provenance", async () => {
    const bytes = await readFile(fixture.provenance.archive);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(fixture.provenance.sha256);
    expect(fixture.provenance.pointer).toBe("/rawTurns/1/after");
    const trace = JSON.parse(execFileSync("tar", ["-xOf", fixture.provenance.archive, fixture.provenance.member], { encoding: "utf8", maxBuffer: 5_000_000 }));
    expect(fixture.state).toEqual(trace.rawTurns[1].after);
  });
  it("migrates the V3 wrapper and preserves both actual historical message values", () => {
    const state = actualStoredConversationV3();
    state.messages.unshift(...actualStoredConversationV2().messages);
    const migrated = readWorkspaceData({ ...emptyWorkspace(), schema: 3, state });
    expect(migrated.migrated).toBe(true);
    expect(migrated.data.schema).toBe(4);
    expect(migrated.data.state.messages).toEqual(state.messages);
    expect(migrated.data.state.messages.filter((message) => message.research).map((message) => message.research!.evidenceVersion)).toEqual([2, 3]);
    expect(migrated.data.pending).toBeNull();
  });
});
