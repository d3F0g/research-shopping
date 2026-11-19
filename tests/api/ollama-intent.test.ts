import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultIntent } from "../../src/domain/contracts";
import { createOllamaIntentInterpreter } from "../../src/server/ollama-intent";
import { localProvider } from "../helpers/local-exa";

const model = "fixture-local:latest";
const message = "I want to buy a powerbank that costs around $30-40";
const interpretation = { disposition: "research", actions: [{ kind: "start-request", source: { start: 0, end: message.length, text: message } }, { kind: "budget", source: { start: 0, end: message.length, text: message }, operation: "replace-range", draft: { amount: 40, minimum: 30, currency: null } }] };
const request = () => ({ phase: "prepare" as const, message, preferences: defaultIntent(), operationId: randomUUID() });
const envelope = (value: unknown = interpretation) => ({ done: true, done_reason: "stop", message: { role: "assistant", content: JSON.stringify(value) }, eval_count: 100 });
const tags = () => ({ models: [{ name: model, model }] });
const signal = () => new AbortController().signal;
const port = (url: string) => Number(new URL(url).port);
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>((done) => { resolve = done; }); return { promise, resolve }; };

describe("bounded local Ollama intent transport", () => {
  it("checks the installed local model before requesting schema-constrained actions without credentials or tools", async () => {
    const paths: string[] = [];
    const bodies: Record<string, unknown>[] = [];
    const provider = await localProvider((incoming, response) => {
      paths.push(incoming.url!);
      expect(incoming.headers.authorization).toBeUndefined();
      if (incoming.url === "/api/tags") { response.end(JSON.stringify(tags())); return; }
      const chunks: Buffer[] = [];
      incoming.on("data", (chunk) => chunks.push(chunk));
      incoming.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        expect(Buffer.byteLength(body)).toBeLessThanOrEqual(16_000);
        bodies.push(JSON.parse(body));
        response.end(JSON.stringify({ ...envelope(), message: { ...envelope().message, thinking: "Private reasoning stays private" } }));
      });
    });
    try {
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(request(), signal())).toEqual({ status: "ready", interpretation });
      expect(paths).toEqual(["/api/tags", "/api/chat"]);
      expect(bodies[0]).toMatchObject({ model, stream: false, format: { type: "object", additionalProperties: false }, options: { temperature: 0, num_predict: 2048 } });
      expect(bodies[0]).not.toHaveProperty("tools");
      expect(bodies[0]).not.toHaveProperty("think");
    } finally { await provider.close(); }
  });

  it.each(["missing", "remote-model", "remote-host", "null-remote", "cloud-alias", "duplicate", "invalid-json", "oversized"])("does not infer when model metadata is %s", async (failure) => {
    const paths: string[] = [];
    const provider = await localProvider((incoming, response) => {
      paths.push(incoming.url!);
      const raw: { models: Record<string, unknown>[] } = tags();
      if (failure === "missing") raw.models = [];
      if (failure === "remote-model") raw.models[0]!.remote_model = "hosted-model";
      if (failure === "remote-host") raw.models[0]!.remote_host = "https://ollama.com";
      if (failure === "null-remote") raw.models[0]!.remote_host = null;
      if (failure === "cloud-alias") raw.models[0]!.name = "fixture:cloud";
      if (failure === "duplicate") raw.models.push({ name: model, model });
      response.end(failure === "invalid-json" ? "invalid" : failure === "oversized" ? "x".repeat(70_000) : JSON.stringify(raw));
    });
    try {
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(request(), signal())).toEqual({ status: "unavailable" });
      expect(paths).toEqual(["/api/tags"]);
    } finally { await provider.close(); }
  });

  it.each(["cloud", "fixture:cloud", "fixture:1b-cloud", "", "https://remote/model"])("does not contact a provider for invalid local model %s", async (name) => {
    let calls = 0;
    const provider = await localProvider((_incoming, response) => { calls++; response.end(JSON.stringify(tags())); });
    try {
      expect(await createOllamaIntentInterpreter(name, { port: port(provider.baseUrl) })(request(), signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(0);
    } finally { await provider.close(); }
  });

  it.each(["invalid-provenance", "invalid-schema", "wrong-money", "tool-call", "http-error", "incomplete", "truncated", "excessive-output", "invalid-utf8", "oversized"])("returns unavailable without retry for %s", async (failure) => {
    const paths: string[] = [];
    const provider = await localProvider((incoming, response) => {
      paths.push(incoming.url!);
      if (incoming.url === "/api/tags") { response.end(JSON.stringify(tags())); return; }
      response.writeHead(failure === "http-error" ? 500 : 200);
      const raw = envelope();
      if (failure === "invalid-provenance") raw.message.content = JSON.stringify({ ...interpretation, actions: [{ kind: "start-request", source: { start: 0, end: 5, text: "invented" } }] });
      if (failure === "invalid-schema") raw.message.content = '{"unexpected":true}';
      if (failure === "wrong-money") raw.message.content = JSON.stringify(interpretation).replace('"amount":40', '"amount":400');
      if (failure === "tool-call") Object.assign(raw.message, { tool_calls: [{ function: { name: "search" } }] });
      if (failure === "incomplete") raw.done = false;
      if (failure === "truncated") raw.done_reason = "length";
      if (failure === "excessive-output") raw.eval_count = 3000;
      response.end(failure === "invalid-utf8" ? Buffer.from([0xc3, 0x28]) : failure === "oversized" ? "x".repeat(70_000) : JSON.stringify(raw));
    });
    try {
      const input = request();
      const original = structuredClone(input);
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(input, signal())).toEqual({ status: "unavailable" });
      expect(input).toEqual(original);
      expect(paths).toEqual(["/api/tags", "/api/chat"]);
    } finally { await provider.close(); }
  });

  it.each(["/api/tags", "/api/chat"])("refuses redirects from %s", async (path) => {
    let targetCalls = 0;
    const target = await localProvider((_incoming, response) => { targetCalls++; response.end(JSON.stringify(envelope())); });
    const provider = await localProvider((incoming, response) => {
      if (incoming.url !== path) { response.end(JSON.stringify(tags())); return; }
      response.writeHead(307, { location: `${target.baseUrl}/api/chat` });
      response.end();
    });
    try {
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(request(), signal())).toEqual({ status: "unavailable" });
      expect(targetCalls).toBe(0);
    } finally { await provider.close(); await target.close(); }
  });

  it.each([
    ["/api/tags", "headers"], ["/api/tags", "body"], ["/api/chat", "headers"], ["/api/chat", "body"],
  ])("cancels the actual %s %s wait", async (path, phase) => {
    const observed = deferred();
    const closed = deferred();
    const provider = await localProvider((incoming, response) => {
      if (incoming.url !== path) { response.end(JSON.stringify(tags())); return; }
      response.on("close", closed.resolve);
      if (phase === "body") { response.writeHead(200); response.write('{"done":'); }
      observed.resolve();
    });
    const controller = new AbortController();
    try {
      const active = createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(request(), controller.signal);
      await observed.promise;
      controller.abort();
      await expect(active).rejects.toThrow();
      await closed.promise;
    } finally { await provider.close(); }
  });

  it.each(["/api/tags", "/api/chat"])("bounds the deadline while awaiting %s", async (path) => {
    const closed = deferred();
    const provider = await localProvider((incoming, response) => {
      if (incoming.url !== path) { response.end(JSON.stringify(tags())); return; }
      response.on("close", closed.resolve);
      response.writeHead(200); response.write("{");
    });
    try {
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl), timeoutMs: 100 })(request(), signal())).toEqual({ status: "unavailable" });
      await closed.promise;
    } finally { await provider.close(); }
  });

  it("rejects oversized UTF-8 input before contacting the model service", async () => {
    let calls = 0;
    const provider = await localProvider((_incoming, response) => { calls++; response.end(JSON.stringify(tags())); });
    try {
      expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })({ ...request(), message: "💼".repeat(2000) }, signal())).toEqual({ status: "unavailable" });
      expect(calls).toBe(0);
    } finally { await provider.close(); }
  });

  it("returns unavailable for a missing local service", async () => {
    const provider = await localProvider((_incoming, response) => response.end());
    await provider.close();
    expect(await createOllamaIntentInterpreter(model, { port: port(provider.baseUrl) })(request(), signal())).toEqual({ status: "unavailable" });
  });

  it.each([0, -1, 65_536, 12.5, Number.NaN, "http://remote.example"])("rejects nonlocal port configuration %s", (value) => {
    expect(() => createOllamaIntentInterpreter(model, { port: value as number })).toThrow("Invalid local intent port");
  });
});
