import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/server/app";
import { createConversationService } from "../../src/server/conversations";
import { projectExaAnswer } from "../../src/server/exa-research";
import { nativeMaterial } from "../helpers/v2-material";
import type { TurnResponse } from "../../src/domain/conversation";
import type { ResearchOperation } from "../../src/domain/research";

const quota = () => ({ reserve: vi.fn(async () => "admitted" as const), settle: vi.fn(async () => {}) });
async function client(app: ReturnType<typeof createApp>) {
  const first = await app.request("http://localhost:3000/api/session");
  const cookie = first.headers.get("set-cookie")!.split(";")[0]!;
  return { cookie, async post(body: unknown, path = "/api/turn") { const r = await app.request(`http://localhost:3000${path}`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) }); expect(r.status).toBe(200); return await r.json() as TurnResponse; } };
}
describe("V2 server-owned prepare and paid lifecycle", () => {
  it("prepares once, binds owner, retains state on errors and never accepts caller intent", async () => {
    const budget = quota();
    const provider: ResearchOperation = vi.fn(async ({ intent }) => projectExaAnswer(nativeMaterial(intent), intent));
    const app = createApp({ conversations: createConversationService({ research: provider, quota: budget }) });
    const a = await client(app), b = await client(app);
    const input = { phase: "prepare", operationId: randomUUID(), message: "a powerbank between SGD30 and40" };
    const prepared = await a.post(input);
    expect(prepared.kind).toBe("prepared");
    if (prepared.kind !== "prepared") throw new Error("Missing prepared ID");
    expect(await a.post(input)).toEqual(prepared);
    expect(provider).not.toHaveBeenCalled();
    expect((await b.post({ phase: "research", preparedId: prepared.preparedId })).kind).toBe("research-unavailable");
    const result = await a.post({ phase: "research", preparedId: prepared.preparedId });
    expect(result.kind).toBe("research");
    expect((await a.post({ phase: "research", preparedId: prepared.preparedId })).kind).toBe("research");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(budget.reserve).toHaveBeenCalledTimes(1);
    expect(budget.settle).toHaveBeenCalledWith(input.operationId, 0.005, true);
    const invalid = await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { cookie: a.cookie, "content-type": "application/json" }, body: JSON.stringify({ ...input, intent: prepared.state.intent }) });
    expect(invalid.status).toBe(400);
  });
  it("cancels upstream, settles unknown and prevents late results after reset", async () => {
    const budget = quota();
    let signal: AbortSignal | undefined;
    let finish: (() => void) | undefined;
    const provider: ResearchOperation = async (request, abort) => { signal = abort; await new Promise<void>((resolve) => { finish = resolve; }); return projectExaAnswer(nativeMaterial(request.intent), request.intent); };
    const service = createConversationService({ research: provider, quota: budget });
    const id = service.create();
    const prepared = service.prepare(id, { phase: "prepare", operationId: randomUUID(), message: "a powerbank under SGD40" });
    if (prepared.kind !== "prepared") throw new Error("Not prepared");
    const response = service.research(id, prepared.preparedId, new AbortController().signal);
    await vi.waitFor(() => expect(signal).toBeDefined());
    service.reset(id);
    expect(signal!.aborted).toBe(true);
    finish!();
    expect((await response).kind).toBe("research-unavailable");
    expect(service.state(id).messages).toEqual([]);
    expect(budget.settle).toHaveBeenCalledWith(expect.any(String), null, false);
  });
  it("preserves in-flight results through a free presentation change and joins duplicate dispatch", async () => {
    const budget = quota(); let finish: (() => void) | undefined;
    const provider: ResearchOperation = vi.fn(async ({ intent }) => { await new Promise<void>((resolve) => { finish = resolve; }); return projectExaAnswer(nativeMaterial(intent), intent); });
    const service = createConversationService({ research: provider, quota: budget }); const id = service.create();
    const prepared = service.prepare(id, { phase: "prepare", operationId: randomUUID(), message: "a powerbank under SGD40" });
    if (prepared.kind !== "prepared") throw new Error("Not prepared");
    const first = service.research(id, prepared.preparedId, new AbortController().signal);
    const duplicate = service.research(id, prepared.preparedId, new AbortController().signal);
    await vi.waitFor(() => expect(finish).toBeDefined());
    service.prepare(id, { phase: "prepare", operationId: randomUUID(), message: "more detail" }); finish!();
    expect((await first).kind).toBe("research"); expect((await duplicate).kind).toBe("research");
    expect(service.state(id).intent.responseLength).toBe("expanded"); expect(provider).toHaveBeenCalledTimes(1);
  });
  it("has no fixture fallback and enforces boundary origin, body and content type", async () => {
    const app = createApp(); const a = await client(app);
    const p = await a.post({ phase: "prepare", operationId: randomUUID(), message: "I want a book cradle" });
    if (p.kind !== "prepared") throw new Error("Not prepared");
    const r = await a.post({ phase: "research", preparedId: p.preparedId }); expect(r).toMatchObject({ kind: "research-unavailable", reason: "not-configured" }); expect(r.state.intent.originalText).toBe("I want a book cradle");
    expect((await app.request("http://evil.com/api/session")).status).toBe(403);
    expect((await app.request("http://localhost:3000/api/session", { headers: { origin: "https://evil.com" } })).status).toBe(403);
    expect((await app.request("http://localhost:3000/api/turn", { method: "POST", body: "{}" })).status).toBe(415);
    expect((await app.request("http://localhost:3000/api/turn", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(17000) })).status).toBe(413);
  });
});
