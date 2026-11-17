import { describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "../../src/domain/contracts";
import type { WebResearchOperation, WebResearchResponse } from "../../src/domain/web-research";
import { createApp, type RequestLog } from "../../src/server/app";

const url = "http://127.0.0.1:3000/api/research";
const shortlist = {
  productIds: ["sony-wh-ch720n"],
  preferences: defaultPreferences(),
};
const ready: WebResearchResponse = {
  status: "ready",
  retrievedAt: "2026-11-18T00:00:00.000Z",
  results: [{
    title: "Review notes",
    url: "https://reviews.example.com/headphones",
    highlights: ["Comfort and battery notes."],
  }],
  truncated: false,
};

function post(app: ReturnType<typeof createApp>, payload: unknown = shortlist) {
  return app.request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("web research API", () => {
  it("keeps fixture health and web research disabled by default", async () => {
    const app = createApp();
    const health = await app.request("http://127.0.0.1:3000/api/health");
    expect(await health.json()).toEqual({
      status: "ok",
      mode: "fixture",
      liveIntegrations: false,
      webResearch: "disabled",
    });
    expect(await (await post(app)).json()).toEqual({ status: "disabled" });
  });

  it("reports configured web research without changing the fixture commerce mode", async () => {
    const app = createApp({ webResearch: async () => ready });
    const health = await app.request("http://127.0.0.1:3000/api/health");
    expect(await health.json()).toEqual({
      status: "ok",
      mode: "fixture",
      liveIntegrations: true,
      webResearch: "enabled",
    });
  });

  it("sends only the validated shortlist and accepted preferences to the injected operation", async () => {
    let received: Parameters<WebResearchOperation>[0] | undefined;
    let signal: AbortSignal | undefined;
    const operation: WebResearchOperation = async (request, requestSignal) => {
      received = request;
      signal = requestSignal;
      return ready;
    };
    const response = await post(createApp({ webResearch: operation }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(ready);
    expect(received).toEqual(shortlist);
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { ...shortlist, extra: "not allowed" },
    { ...shortlist, productIds: [] },
    { ...shortlist, productIds: ["sony-wh-ch720n", "sony-wh-ch720n"] },
    { ...shortlist, productIds: ["unknown-product"] },
    { ...shortlist, productIds: ["sony-wh-ch720n", "sony-wh-1000xm5", "sennheiser-momentum-4", "audio-technica-ath-m50xbt2", "asus-zenbook-14-ux3405", "dell-xps-13-9340"] },
    { ...shortlist, preferences: { ...shortlist.preferences, payment: "not allowed" } },
  ])("rejects invalid web research input", async (payload) => {
    const operation = vi.fn(async () => ready);
    const response = await post(createApp({ webResearch: operation }), payload);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Invalid JSON or request fields" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("returns a generic failure for operation errors and keeps details out of logs", async () => {
    const logs: RequestLog[] = [];
    const app = createApp({
      webResearch: async () => { throw new Error("private-api-key-and-query"); },
      logger: (event) => logs.push(event),
    });
    const response = await post(app);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(logs).toHaveLength(1);
    expect(logs[0].route).toBe("/api/research");
    expect(logs[0].outcomes).toEqual([]);
    expect(JSON.stringify(logs)).not.toContain("private-api-key-and-query");
  });

  it("rejects an unsafe provider link before it reaches the browser", async () => {
    const unsafe = {
      ...ready,
      results: [{ title: "Local host", url: "https://127.0.0.1/private", highlights: [] }],
    };
    const response = await post(createApp({ webResearch: async () => unsafe as WebResearchResponse }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "unavailable", reason: "provider-error" });
  });
});
