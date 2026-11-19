import { spawn } from "node:child_process";
import { once } from "node:events";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { syntheticAnswer } from "../fixtures/dynamic-research";
import { fixtureIntentInterpreter } from "./intent";
import type { PrepareTurnRequest } from "../../src/domain/contracts";

export async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export async function startManualServer(
  files: { ledgerPath: string; directory: string },
  options: { grantPath?: string; mode?: string; webPort?: number; intent?: boolean } = {},
) {
  const requests: unknown[] = [];
  const intentRequests: unknown[] = [];
  let defer = false;
  let aborts = 0;
  const provider = createServer((request, response) => {
    if (request.url === "/api/tags" && options.intent) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ models: [{ name: "fixture-local:latest", model: "fixture-local:latest" }] }));
      return;
    }
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", async () => {
      const parsed = JSON.parse(body);
      if (request.url === "/api/chat" && options.intent) {
        intentRequests.push(parsed);
        const input = JSON.parse(parsed.messages.find((message: { role: string }) => message.role === "user").content);
        const result = await fixtureIntentInterpreter({
          ...input, phase: "prepare", operationId: "00000000-0000-4000-8000-000000000001",
        } as PrepareTurnRequest, new AbortController().signal);
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({
          done: true,
          done_reason: "stop",
          message: { role: "assistant", content: result.status === "ready" ? JSON.stringify(result.interpretation) : "{}" },
          eval_count: 100,
        }));
        return;
      }
      requests.push(parsed);
      if (defer) {
        defer = false;
        response.on("close", () => {
          if (!response.writableFinished) aborts++;
        });
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify(syntheticAnswer()).replaceAll(
          "Aster Pure 30",
          "Synthetic fixture Aster Pure 30",
        ),
      );
    });
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const providerUrl = `http://127.0.0.1:${(provider.address() as AddressInfo).port}`;
  const preloadPath = join(files.directory, "loopback-transport.mjs");
  await writeFile(
    preloadPath,
    `
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const localIntent = ${options.intent === true} && url.origin === "http://127.0.0.1:11434" && ["/api/tags", "/api/chat"].includes(url.pathname) && !url.search;
  if (url.origin !== "https://api.exa.ai" && !localIntent) throw new Error("External transport forbidden in automated proof");
  const target = new URL(url.pathname + url.search, ${JSON.stringify(providerUrl)});
  return originalFetch(input instanceof Request ? new Request(target, input) : target, init);
};
`,
  );
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--import", preloadPath, "src/server/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        PATH: process.env.PATH,
        NODE_ENV: options.mode ?? "development",
        EXA_RESEARCH_ENABLED: "true",
        EXA_API_KEY: "fake-manual-loopback-key",
        EXA_RESEARCH_LEDGER_PATH: files.ledgerPath,
        API_PORT: String(port),
        WEB_PORT: String(options.webPort ?? port),
        ...(options.intent ? {
          FIELDNOTE_INTENT_PROVIDER: "ollama",
          OLLAMA_INTENT_MODEL: "fixture-local:latest",
        } : {}),
        ...(options.grantPath !== undefined
          ? { EXA_MANUAL_RESEARCH_GRANT_PATH: options.grantPath }
          : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const exited = once(child, "exit");
  let log = "";
  child.stdout.on("data", (chunk) => {
    log += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    log += String(chunk);
  });
  async function close() {
    if (child.exitCode === null) child.kill("SIGTERM");
    await exited;
    provider.closeAllConnections();
    await new Promise<void>((resolve) => provider.close(() => resolve()));
  }
  try {
    const deadline = Date.now() + 10_000;
    while (true) {
      try {
        if ((await fetch(`${url}/api/health`)).ok) break;
      } catch {}
      if (child.exitCode !== null || Date.now() > deadline)
        throw new Error(`Test server failed to start. ${log}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  } catch (error) {
    await close();
    throw error;
  }
  return {
    url,
    port,
    requests,
    intentRequests,
    close,
    get log() {
      return log;
    },
    get aborts() {
      return aborts;
    },
    deferNext() {
      defer = true;
    },
  };
}
