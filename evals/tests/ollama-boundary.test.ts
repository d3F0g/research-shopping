import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { defaultIntent } from "../../src/domain/contracts";
import { createOllamaIntentInterpreter } from "../../src/server/ollama-intent";
import { offlineNetwork } from "../network";
const model = "synthetic-local:latest";
const proposal = { disposition: "research", actions: [{ kind: "start-request", source: { start: 5, end: 9, text: "lamp" } }] };
const envelope = (value: unknown = proposal) => ({ done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(value) }, eval_count: 20 });
const tags = () => ({ models: [{ name: model, model }] });
const request = () => ({ phase: "prepare" as const, operationId: randomUUID(), message: "Find lamp", preferences: defaultIntent() });
const signal = () => new AbortController().signal;
async function localOllama(reply?: (request: IncomingMessage, response: ServerResponse) => void) {
  const guard = offlineNetwork();
  const paths: string[] = [];
  const payloads: Record<string, unknown>[] = [];
  const requestOptions: { url: string; redirect: RequestRedirect | undefined }[] = [];
  const guardedFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    requestOptions.push({ url: String(input), redirect: init?.redirect });
    return guardedFetch(input, init);
  };
  const server = createServer((incoming, response) => {
    paths.push(incoming.url!);
    assert.equal(incoming.headers.authorization, undefined);
    if (reply) { reply(incoming, response); return; }
    if (incoming.url === "/api/tags") { response.end(JSON.stringify(tags())); return; }
    let raw = "";
    incoming.on("data", (chunk) => { raw += String(chunk); });
    incoming.on("end", () => { payloads.push(JSON.parse(raw)); response.end(JSON.stringify(envelope())); });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  guard.allow(origin);
  return { port, origin, paths, payloads, requestOptions, guard, close: async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); guard.close(); } };
}
test("actual Ollama adapter checks an installed local model then requests bounded structured output without credentials or pulls", async () => {
  const local = await localOllama();
  try {
    assert.deepEqual(await createOllamaIntentInterpreter(model, { port: local.port })(request(), signal()), { status: "ready", interpretation: proposal });
    assert.deepEqual(local.paths, ["/api/tags", "/api/chat"]);
    assert(local.requestOptions.every((item) => item.url.startsWith(local.origin) && item.redirect === "error"));
    assert.equal(local.payloads[0]!.model, model);
    assert.equal(local.payloads[0]!.stream, false);
    assert.deepEqual(local.payloads[0]!.options, { temperature: 0, num_predict: 2048 });
    assert.equal((local.payloads[0]!.format as { additionalProperties: boolean }).additionalProperties, false);
    assert.equal(local.payloads[0]!.tools, undefined);
    assert.equal(local.guard.snapshot().externalRequests, 0);
  } finally { await local.close(); }
});
test("invalid host/URL port and cloud model configuration cannot dispatch", async () => {
  const local = await localOllama();
  try {
    for (const port of [0, -1, 65536, 12.5, "https://remote.example", "localhost:11434"]) assert.throws(() => createOllamaIntentInterpreter(model, { port: port as number }), /Invalid local intent port/);
    for (const invalid of ["", "cloud", "synthetic:cloud", "synthetic:1b-cloud", "https://remote.example/model", "../model?host=remote.example"]) assert.equal((await createOllamaIntentInterpreter(invalid, { port: local.port })(request(), signal())).status, "unavailable");
    assert.deepEqual(local.paths, []);
  } finally { await local.close(); }
});
test("missing, ambiguous and remote model metadata cannot reach inference or trigger installation", async () => {
  for (const models of [[], [{ name: model, model, remote_host: "https://ollama.com" }], [{ name: model, model, remote_host: null }], [{ name: model, model, remote_model: "hosted" }], [{ name: "synthetic:cloud", model }], [{ name: model, model }, { name: model, model }]]) {
    const local = await localOllama((_request, response) => response.end(JSON.stringify({ models })));
    try {
      assert.equal((await createOllamaIntentInterpreter(model, { port: local.port })(request(), signal())).status, "unavailable");
      assert.deepEqual(local.paths, ["/api/tags"]);
    } finally { await local.close(); }
  }
});
test("malformed spans, extra answers, tools and incomplete output stay unavailable without retries", async () => {
  const invalid = [
    envelope({ ...proposal, actions: [{ kind: "start-request", source: { start: 0, end: 4, text: "lamp" } }] }),
    envelope({ ...proposal, answer: "Invented product advice" }),
    { ...envelope(), message: { role: "assistant", content: JSON.stringify(proposal) + JSON.stringify(proposal) } },
    { ...envelope(), message: { ...envelope().message, tool_calls: [{ name: "search" }] } },
    { ...envelope(), done: false }, { ...envelope(), done_reason: "length" }, { ...envelope(), eval_count: 3000 },
  ];
  for (const value of invalid) {
    const local = await localOllama((incoming, response) => { incoming.resume(); response.end(JSON.stringify(incoming.url === "/api/tags" ? tags() : value)); });
    try {
      const input = request();
      const before = structuredClone(input);
      assert.equal((await createOllamaIntentInterpreter(model, { port: local.port })(input, signal())).status, "unavailable");
      assert.deepEqual(input, before);
      assert.deepEqual(local.paths, ["/api/tags", "/api/chat"]);
    } finally { await local.close(); }
  }
});
test("Ollama tags and chat redirects are refused before reaching another server", async () => {
  for (const path of ["/api/tags", "/api/chat"]) {
    let redirected = 0;
    const target = createServer((_request, response) => { redirected++; response.end(JSON.stringify(envelope())); });
    target.listen(0, "127.0.0.1"); await once(target, "listening");
    const destination = `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
    const local = await localOllama((incoming, response) => {
      incoming.resume();
      if (incoming.url === path) { response.writeHead(307, { location: `${destination}/api/chat` }); response.end(); }
      else response.end(JSON.stringify(tags()));
    });
    local.guard.allow(destination);
    try {
      assert.equal((await createOllamaIntentInterpreter(model, { port: local.port })(request(), signal())).status, "unavailable");
      assert.equal(redirected, 0);
      assert(local.requestOptions.every((item) => item.redirect === "error"));
    } finally { await local.close(); target.closeAllConnections(); await new Promise<void>((resolve) => target.close(() => resolve())); }
  }
});
test("actual Ollama cancellation reaches tags/chat headers and body without a model", async () => {
  for (const path of ["/api/tags", "/api/chat"]) for (const body of [false, true]) {
    let reached!: () => void;
    const started = new Promise<void>((resolve) => { reached = resolve; });
    let closed!: () => void;
    const ended = new Promise<void>((resolve) => { closed = resolve; });
    const local = await localOllama((incoming, response) => {
      incoming.resume();
      if (incoming.url !== path) { response.end(JSON.stringify(tags())); return; }
      response.on("close", closed);
      if (body) { response.writeHead(200); response.write("{"); }
      reached();
    });
    try {
      const controller = new AbortController();
      const pending = createOllamaIntentInterpreter(model, { port: local.port, timeoutMs: 1000 })(request(), controller.signal);
      await started;
      controller.abort();
      await assert.rejects(pending);
      await ended;
      assert.deepEqual(local.paths, path === "/api/tags" ? [path] : ["/api/tags", path]);
    } finally { await local.close(); }
  }
});
