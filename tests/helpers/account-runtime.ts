import { createServer } from "node:http";
import { dirname, basename, isAbsolute } from "node:path";
import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { createApp } from "../../src/server/app";
import { configFromEnvironment } from "../../src/server/config";
import { createAccounts } from "../../src/server/accounts";
import { createConversationService } from "../../src/server/conversations";
import { createExaProductResearch } from "../../src/server/exa-research";
import { createResearchQuota } from "../../src/server/research-quota";
import { createResearchExecutor } from "../../src/server/research-executor";
import { reduceTurn } from "../../src/domain/turn-reducer";
import type { ShoppingIntent } from "../../src/domain/conversation";
import { nativeMaterial } from "./v2-material";
import { catalogMaterial } from "./v3-catalog-material";

const database = process.env.FIELDNOTE_TEST_DATABASE_URL;
const ledger = process.env.FIELDNOTE_TEST_LEDGER_PATH;
if (
  process.env.NODE_ENV !== "test" ||
  process.env.EXA_RESEARCH_ENABLED !== "false" ||
  !database ||
  new URL(database).pathname !== "/fieldnote_fixture" ||
  !ledger ||
  !isAbsolute(ledger) ||
  !basename(dirname(ledger)).startsWith("fieldnote-v2-lifecycle-")
)
  throw new Error("Owned automated fixture composition is required");
let calls = 0,
  closed = 0;
const upstream = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  if (request.url !== "/answer") {
    response.writeHead(404).end();
    return;
  }
  calls++;
  response.on("close", () => {
    closed++;
  });
  const input = JSON.parse(body) as { systemPrompt: string };
  const intent = JSON.parse(
    input.systemPrompt.split("Current authoritative shopping intent: ")[1]!,
  ) as ShoppingIntent;
  const material = intent.productDescription.includes("catalog fixture") ? catalogMaterial(intent) : nativeMaterial(intent);
  if (intent.productDescription.includes("slow fixture")) {
    response.writeHead(200, { "content-type": "application/json" });
    response.write('{"answer":');
    setTimeout(() => response.end("null}"), 30000);
    return;
  }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(material));
});
await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const address = upstream.address();
if (!address || typeof address === "string")
  throw new Error("No fixture upstream");
const sdk = createExaProductResearch("fixture-loopback-only", {
  baseUrl: `http://127.0.0.1:${address.port}`,
  timeoutMs: 45000,
});
const dependencies = {
  quota: createResearchQuota(ledger),
  research: async (request: Parameters<typeof sdk>[0], signal: AbortSignal) => {
    const result = await sdk(request, signal);
    if (result.status === "ready") result.research.dataKind = "test-fixture";
    return result;
  },
};
const pool = new Pool({ connectionString: database });
const config = configFromEnvironment(process.env);
const accounts = createAccounts(
  pool,
  process.env.FIELDNOTE_AUTH_ORIGIN!,
  "fixture-account-lifecycle-secret-long-enough",
  { reduce: reduceTurn, research: createResearchExecutor(dependencies) },
);
const app = createApp(
  {
    conversations: createConversationService(dependencies),
    accounts,
    accountCapability: "configured",
  },
  config,
);
app.get("/api/test-stats", (c) => c.json({ calls, closed }));
serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.apiPort });
