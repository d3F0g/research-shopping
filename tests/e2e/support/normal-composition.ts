import { writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createApp } from "../../../src/server/app";
import { createExaProductResearch } from "../../../src/server/exa-research";
import { createResearchTurns } from "../../../src/server/research-turns";

export async function normalComposition(
  page: Page,
  testInfo: TestInfo,
  nativeReply: unknown | ((body: Record<string, unknown>) => unknown),
) {
  const requests: Record<string, unknown>[] = [];
  const settlements: unknown[][] = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      requests.push(parsed);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(
          typeof nativeReply === "function" ? nativeReply(parsed) : nativeReply,
        ),
      );
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    expect(new URL(target).origin).toBe(baseUrl);
    return originalFetch(input, init);
  };
  const app = createApp(
    {
      researchTurns: createResearchTurns({
        research: createExaProductResearch("fake-browser-loopback-key", {
          baseUrl,
        }),
        quota: {
          async reserve() {
            return "admitted";
          },
          async settle(...args) {
            settlements.push(args);
          },
        },
      }),
    },
    { apiPort: 6473, webPort: 6474 },
  );
  const responses: unknown[] = [];
  await page.route("**/api/health", async (route) => {
    const result = await app.request("http://127.0.0.1:6473/api/health");
    await route.fulfill({ status: result.status, json: await result.json() });
  });
  await page.route("**/api/turn", async (route) => {
    const result = await app.request("http://127.0.0.1:6473/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: route.request().postData(),
    });
    const json = await result.json();
    responses.push(json);
    await route.fulfill({ status: result.status, json });
  });
  return {
    requests,
    responses,
    settlements,
    async close() {
      const proofPath = testInfo.outputPath("synthetic-sdk-hono-proof.json");
      await writeFile(
        proofPath,
        JSON.stringify(
          {
            label:
              "Synthetic provider response through real SDK, normal Hono turn composition and browser. No real Exa, merchant or paid call.",
            requests,
            responses,
            settlements,
          },
          null,
          2,
        ),
      );
      await testInfo.attach("synthetic-sdk-hono-proof.json", {
        path: proofPath,
        contentType: "application/json",
      });
      globalThis.fetch = originalFetch;
      await page.unroute("**/api/turn");
      await page.unroute("**/api/health");
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
