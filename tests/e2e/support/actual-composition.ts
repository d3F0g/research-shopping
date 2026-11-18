import { once } from "node:events";
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createApp } from "../../../src/server/app";
import { createExaProductResearch } from "../../../src/server/exa-research";
import { createResearchTurns } from "../../../src/server/research-turns";
import { syntheticAnswer } from "../../fixtures/dynamic-research";

export async function actualComposition(page: Page, testInfo: TestInfo) {
  const sdkRequests: Record<string, unknown>[] = [];
  const requests: Record<string, unknown>[] = [];
  const responses: unknown[] = [];
  let deferred = false;
  let release: (() => void) | undefined;
  let aborts = 0;
  const native = JSON.parse(
    JSON.stringify(syntheticAnswer()).replaceAll(
      "Aster Pure 30",
      "Synthetic Aster Pure 30",
    ),
  );
  const provider = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      sdkRequests.push(JSON.parse(body));
      const finish = () => {
        if (!response.destroyed) {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.end(JSON.stringify(native));
        }
      };
      if (deferred) {
        deferred = false;
        release = finish;
        response.on("close", () => {
          if (!response.writableFinished) aborts++;
        });
      } else finish();
    });
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerUrl = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  const originalFetch = globalThis.fetch;
  const apiPort = 6543;
  const webPort = 6544;
  const baseUrl = `http://127.0.0.1:${webPort}`;
  globalThis.fetch = (input, init) => {
    const target =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    expect([providerUrl, baseUrl, `http://127.0.0.1:${apiPort}`]).toContain(
      new URL(target).origin,
    );
    return originalFetch(input, init);
  };
  const app = createApp(
    {
      researchTurns: createResearchTurns({
        research: createExaProductResearch("fake-lifecycle-loopback-key", {
          baseUrl: providerUrl,
        }),
        quota: {
          async reserve() {
            return "admitted";
          },
          async settle() {},
        },
      }),
    },
    { apiPort, webPort },
  );
  const api = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: apiPort });
  const web = spawn(
    `${process.cwd()}/node_modules/.bin/vite`,
    ["--host", "127.0.0.1"],
    {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "development",
        EXA_RESEARCH_ENABLED: "false",
        API_PORT: String(apiPort),
        VITE_API_PORT: String(apiPort),
        WEB_PORT: String(webPort),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let serverLog = "";
  web.stdout.on("data", (chunk) => {
    serverLog += String(chunk);
  });
  web.stderr.on("data", (chunk) => {
    serverLog += String(chunk);
  });
  page.on("request", (request) => {
    if (request.url().endsWith("/api/turn"))
      requests.push(request.postDataJSON());
  });
  page.on("response", async (response) => {
    if (response.url().endsWith("/api/turn")) {
      try {
        responses.push(await response.json());
      } catch {}
    }
  });
  try {
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${baseUrl}/api/health`)).ok;
          } catch {
            return false;
          }
        },
        { timeout: 15000 },
      )
      .toBe(true);
  } catch (error) {
    web.kill("SIGTERM");
    api.close();
    provider.close();
    globalThis.fetch = originalFetch;
    throw error;
  }
  return {
    baseUrl,
    sdkRequests,
    requests,
    responses,
    deferNext() {
      deferred = true;
    },
    get aborts() {
      return aborts;
    },
    async close() {
      release?.();
      web.kill("SIGTERM");
      await once(web, "exit");
      await new Promise<void>((resolve, reject) =>
        api.close((error) => (error ? reject(error) : resolve())),
      );
      provider.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        provider.close((error) => (error ? reject(error) : resolve())),
      );
      globalThis.fetch = originalFetch;
      const proofPath = testInfo.outputPath("actual-http-lifecycle-proof.json");
      await writeFile(
        proofPath,
        JSON.stringify(
          {
            label:
              "Actual browser HTTP Hono and SDK transport with fake-key synthetic loopback provider. No paid or real merchant call.",
            requests,
            responses,
            sdkRequests,
            aborts,
            cleanup: true,
          },
          null,
          2,
        ),
      );
      await writeFile(testInfo.outputPath("server.log"), serverLog);
      await testInfo.attach("actual-http-lifecycle-proof.json", {
        path: proofPath,
        contentType: "application/json",
      });
    },
  };
}
