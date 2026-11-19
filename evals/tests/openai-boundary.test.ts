import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { defaultIntent, type PrepareTurnRequest } from "../../src/domain/contracts";
import { createOpenAIIntentInterpreter } from "../../src/server/openai-intent";
import { offlineNetwork } from "../network";
const proposal = { disposition: "research", actions: [{ kind: "start-request", source: { start: 5, end: 9, text: "lamp" } }] };
const envelope = (value: unknown) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }], usage: { input_tokens: 100, output_tokens: 20 } });
const request = (): PrepareTurnRequest => ({ phase: "prepare", operationId: randomUUID(), message: "Find lamp", preferences: defaultIntent() });
async function localInterpreter(options: { response?: unknown; slowBody?: boolean } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "fieldnote-eval-synthetic-intent-"));
  const ledgerPath = join(directory, "synthetic-receipts.json");
  const guard = offlineNetwork();
  let calls = 0;
  let closedBeforeEnd = false;
  const server = createServer((req, res) => {
    calls++;
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    if (options.slowBody) {
      res.write('{"status":"completed",');
      const timer = setTimeout(() => res.end('"output":[]}'), 2000);
      res.on("close", () => { clearTimeout(timer); closedBeforeEnd = !res.writableFinished; });
    } else res.end(JSON.stringify(options.response ?? envelope(proposal)));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  guard.allow(origin);
  const interpreter = createOpenAIIntentInterpreter("fake-synthetic-openai-key", { ledgerPath, timeoutMs: 1000, fetch: async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer fake-synthetic-openai-key");
    return fetch(`${origin}/responses`, init);
  } });
  return { interpreter, ledger: async () => JSON.parse(await readFile(ledgerPath, "utf8")), calls: () => calls, aborted: () => closedBeforeEnd, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); guard.close(); await rm(directory, { recursive: true, force: true }); } };
}
test("production OpenAI adapter reuses one preparation receipt and enforces two reservations across the conversation", async () => {
  const local = await localInterpreter();
  try {
    const first = request();
    assert.equal((await local.interpreter(first, new AbortController().signal)).status, "ready");
    assert.equal((await local.interpreter(first, new AbortController().signal)).status, "ready");
    assert.equal(local.calls(), 1);
    assert.equal((await local.interpreter({ ...first, message: "Different request" }, new AbortController().signal)).status, "unavailable");
    assert.equal(local.calls(), 1);
    assert.equal((await local.interpreter(request(), new AbortController().signal)).status, "ready");
    assert.equal((await local.interpreter(request(), new AbortController().signal)).status, "unavailable");
    assert.equal(local.calls(), 2);
    const ledger = await local.ledger();
    assert.equal(ledger.receipts.length, 2);
    assert.equal(ledger.receipts.reduce((sum: number, receipt: { reservedUsd: number }) => sum + receipt.reservedUsd, 0), 0.1);
    assert(ledger.receipts.every((receipt: { state: string }) => receipt.state === "complete"));
  } finally { await local.close(); }
});
test("production interpreter malformed literal spans retain an uncertain reservation and stop further dispatch", async () => {
  const local = await localInterpreter({ response: envelope({ ...proposal, actions: [{ kind: "start-request", source: { start: 0, end: 4, text: "lamp" } }] }) });
  try {
    assert.equal((await local.interpreter(request(), new AbortController().signal)).status, "unavailable");
    assert.equal((await local.interpreter(request(), new AbortController().signal)).status, "unavailable");
    assert.equal(local.calls(), 1);
    const ledger = await local.ledger();
    assert.equal(ledger.stopped, true);
    assert.equal(ledger.receipts[0].state, "uncertain");
    assert.equal(ledger.receipts[0].reservedUsd, 0.05);
  } finally { await local.close(); }
});
test("production interpreter cancellation reaches response-body transport and retains unknown usage", async () => {
  const local = await localInterpreter({ slowBody: true });
  try {
    const controller = new AbortController();
    const pending = local.interpreter(request(), controller.signal);
    const deadline = Date.now() + 1500;
    while (!local.calls() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(local.calls(), 1);
    controller.abort();
    await assert.rejects(pending);
    while (!local.aborted() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(local.aborted(), true);
    const ledger = await local.ledger();
    assert.equal(ledger.stopped, true);
    assert.equal(ledger.receipts[0].state, "uncertain");
    assert.equal(ledger.receipts[0].usage, null);
    assert.equal(ledger.receipts[0].reservedUsd, 0.05);
    assert.equal((await local.interpreter(request(), new AbortController().signal)).status, "unavailable");
    assert.equal(local.calls(), 1);
  } finally { await local.close(); }
});
